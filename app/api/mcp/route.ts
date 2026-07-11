import { NextRequest, NextResponse } from "next/server";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// ── MCP Tool Definitions ──────────────────────────────────────────────────────
export const MCP_TOOLS = [
  {
    name: "get_candidates",
    description: "Get all candidates or filter by status (applied/selected/rejected/all)",
    inputSchema: {
      type: "object",
      properties: {
        status: {
          type: "string",
          enum: ["all", "applied", "selected", "rejected"],
          description: "Filter candidates by status"
        }
      },
      required: ["status"]
    }
  },
  {
    name: "get_candidate_by_name",
    description: "Search a candidate by name or email. If multiple found, returns all matches.",
    inputSchema: {
      type: "object",
      properties: {
        search: {
          type: "string",
          description: "Candidate name or email to search"
        }
      },
      required: ["search"]
    }
  },
  {
    name: "update_candidate_status",
    description: "Update a candidate status. Sets manual_override=true so automation won't override.",
    inputSchema: {
      type: "object",
      properties: {
        email: { type: "string", description: "Candidate email" },
        status: {
          type: "string",
          enum: ["selected", "rejected", "applied"],
          description: "New status"
        }
      },
      required: ["email", "status"]
    }
  },
  {
    name: "send_assignment",
    description: "Send a technical assignment to a candidate via n8n automation",
    inputSchema: {
      type: "object",
      properties: {
        email: { type: "string", description: "Candidate email" }
      },
      required: ["email"]
    }
  },
  {
    name: "get_pipeline_stats",
    description: "Get full recruitment pipeline statistics including today's applicants, interview status, assignment status",
    inputSchema: {
      type: "object",
      properties: {},
      required: []
    }
  }
];

// ── MCP Tool Executor ─────────────────────────────────────────────────────────
export async function executeMcpTool(name: string, args: Record<string, string>) {
  const headers = {
    "apikey": SUPABASE_SERVICE_KEY,
    "Authorization": `Bearer ${SUPABASE_SERVICE_KEY}`,
    "Content-Type": "application/json"
  };

  if (name === "get_candidates") {
    const filter = args.status !== "all"
      ? `?status=eq.${args.status}&order=created_at.desc`
      : `?order=created_at.desc`;
    const res = await fetch(`${SUPABASE_URL}/rest/v1/candidates${filter}`, { headers });
    const data = await res.json();
    if (!Array.isArray(data) || !data.length) return { content: [{ type: "text", text: `No candidates found with status: ${args.status}` }] };
    const result = data.map((c: Record<string, unknown>) => ({
      name: c.name, email: c.email, status: c.status,
      cv_score: c.score, interview_score: c.interview_score,
      applied_on: c.created_at, manual_override: c.manual_override
    }));
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  }

  if (name === "get_candidate_by_name") {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/candidates?or=(name.ilike.*${args.search}*,email.ilike.*${args.search}*)&order=created_at.desc`,
      { headers }
    );
    const data = await res.json();
    if (!Array.isArray(data) || !data.length) return { content: [{ type: "text", text: `No candidate found matching: ${args.search}` }] };
    if (data.length > 1) {
      return {
        content: [{
          type: "text",
          text: `Multiple candidates found. Please confirm by email:\n${data.map((c: Record<string, unknown>) => `- ${c.name} (${c.email})`).join("\n")}`
        }]
      };
    }
    return { content: [{ type: "text", text: JSON.stringify(data[0], null, 2) }] };
  }

  if (name === "update_candidate_status") {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/candidates?email=eq.${args.email}`,
      {
        method: "PATCH",
        headers: { ...headers, "Prefer": "return=minimal" },
        body: JSON.stringify({ status: args.status, manual_override: true })
      }
    );
    if (res.ok) return { content: [{ type: "text", text: `Successfully updated ${args.email} status to "${args.status}". Manual override activated — automation will not override this.` }] };
    return { content: [{ type: "text", text: `Failed to update status for ${args.email}` }], isError: true };
  }

  if (name === "send_assignment") {
    const checkRes = await fetch(`${SUPABASE_URL}/rest/v1/candidates?email=eq.${args.email}`, { headers });
    const candidates = await checkRes.json();
    if (!Array.isArray(candidates) || !candidates.length) {
      return { content: [{ type: "text", text: `No candidate found with email: ${args.email}` }], isError: true };
    }
    const n8nUrl = process.env.N8N_MANUAL_ASSIGNMENT_WEBHOOK;
    if (!n8nUrl) return { content: [{ type: "text", text: "N8N_MANUAL_ASSIGNMENT_WEBHOOK not configured in environment." }], isError: true };
    const res = await fetch(n8nUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: args.email })
    });
    if (res.ok) return { content: [{ type: "text", text: `Assignment successfully sent to ${args.email}. N8n is generating a personalized assignment based on their skills.` }] };
    return { content: [{ type: "text", text: `Failed to trigger assignment for ${args.email}. Please check N8n webhook.` }], isError: true };
  }

  if (name === "get_pipeline_stats") {
    const today = new Date().toISOString().split("T")[0];
    const [cRes, aRes] = await Promise.all([
      fetch(`${SUPABASE_URL}/rest/v1/candidates`, { headers }),
      fetch(`${SUPABASE_URL}/rest/v1/assignments`, { headers })
    ]);
    const candidates: Record<string, unknown>[] = await cRes.json();
    const assignments: Record<string, unknown>[] = await aRes.json();

    const stats = {
      overview: {
        total_candidates: candidates.length,
        applied_today: candidates.filter(c => (c.created_at as string)?.startsWith(today)).length,
        avg_cv_score: candidates.length
          ? (candidates.reduce((s, c) => s + ((c.score as number) || 0), 0) / candidates.length).toFixed(1)
          : 0,
      },
      status_breakdown: {
        applied: candidates.filter(c => c.status === "applied").length,
        selected: candidates.filter(c => c.status === "selected").length,
        rejected: candidates.filter(c => c.status === "rejected").length,
      },
      interview_stage: {
        completed: candidates.filter(c => c.interview_score !== null).length,
        pending: candidates.filter(c => c.interview_score === null).length,
        passed: candidates.filter(c => c.interview_score !== null && (c.interview_score as number) >= 50).length,
        failed: candidates.filter(c => c.interview_score !== null && (c.interview_score as number) < 50).length,
        avg_score: candidates.filter(c => c.interview_score !== null).length
          ? (candidates.filter(c => c.interview_score !== null)
              .reduce((s, c) => s + ((c.interview_score as number) || 0), 0) /
              candidates.filter(c => c.interview_score !== null).length).toFixed(1)
          : 0,
      },
      assignment_stage: {
        sent: assignments.length,
        submitted: assignments.filter(a => a.submitted_github !== null).length,
        pending_submission: assignments.filter(a => a.submitted_github === null).length,
        passed: assignments.filter(a => a.review_score !== null && (a.review_score as number) >= 50).length,
        failed: assignments.filter(a => a.review_score !== null && (a.review_score as number) < 50).length,
      },
      final_interview: {
        booked: candidates.filter(c => c.cal_booking_status === "booked").length,
        link_sent: candidates.filter(c => c.cal_booking_status === "pending").length,
      },
      manual_overrides: candidates.filter(c => c.manual_override === true).length,
    };
    return { content: [{ type: "text", text: JSON.stringify(stats, null, 2) }] };
  }

  return { content: [{ type: "text", text: `Unknown tool: ${name}` }], isError: true };
}

// ── MCP HTTP Endpoint ─────────────────────────────────────────────────────────
// This follows MCP Streamable HTTP transport spec
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { method, params } = body;

    // MCP: List available tools
    if (method === "tools/list") {
      return NextResponse.json({
        jsonrpc: "2.0",
        id: body.id,
        result: { tools: MCP_TOOLS }
      });
    }

    // MCP: Execute a tool
    if (method === "tools/call") {
      const { name, arguments: args } = params;
      const result = await executeMcpTool(name, args || {});
      return NextResponse.json({
        jsonrpc: "2.0",
        id: body.id,
        result
      });
    }

    // MCP: Initialize
    if (method === "initialize") {
      return NextResponse.json({
        jsonrpc: "2.0",
        id: body.id,
        result: {
          protocolVersion: "2024-11-05",
          capabilities: { tools: {} },
          serverInfo: { name: "recruitment-mcp", version: "1.0.0" }
        }
      });
    }

    return NextResponse.json({
      jsonrpc: "2.0",
      id: body.id,
      error: { code: -32601, message: "Method not found" }
    });

  } catch (error) {
    return NextResponse.json({
      jsonrpc: "2.0",
      id: null,
      error: { code: -32603, message: "Internal error", data: String(error) }
    }, { status: 500 });
  }
}

// MCP: List tools via GET (for discovery)
export async function GET() {
  return NextResponse.json({
    name: "Recruitment MCP Server",
    version: "1.0.0",
    tools: MCP_TOOLS.map(t => ({ name: t.name, description: t.description }))
  });
}