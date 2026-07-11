import { NextRequest, NextResponse } from "next/server";

const GEMINI_API_KEY = process.env.GEMINI_API_KEY!;
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const tools = [
  {
    name: "get_candidates",
    description: "Get all candidates or filter by status.",
    parameters: {
      type: "object",
      properties: {
        status: {
          type: "string",
          enum: ["all", "applied", "selected", "rejected"]
        }
      },
      required: ["status"]
    }
  },
  {
    name: "get_candidate_by_name",
    description: "Find a specific candidate by name or email",
    parameters: {
      type: "object",
      properties: {
        search: { type: "string" }
      },
      required: ["search"]
    }
  },
  {
    name: "update_candidate_status",
    description: "Update a candidate status",
    parameters: {
      type: "object",
      properties: {
        email: { type: "string" },
        status: { type: "string", enum: ["selected", "rejected", "applied"] }
      },
      required: ["email", "status"]
    }
  },
  {
    name: "send_assignment",
    description: "Send technical assignment to a candidate",
    parameters: {
      type: "object",
      properties: {
        email: { type: "string" }
      },
      required: ["email"]
    }
  },
  {
    name: "get_stats",
    description: "Get recruitment statistics",
    parameters: {
      type: "object",
      properties: {},
      required: []
    }
  }
];

async function executeTool(name: string, args: Record<string, string>) {
  const headers = {
    "apikey": SUPABASE_SERVICE_KEY,
    "Authorization": `Bearer ${SUPABASE_SERVICE_KEY}`,
    "Content-Type": "application/json"
  };

  console.log(`Executing tool: ${name}`, args);

  if (name === "get_candidates") {
    const filter = args.status !== "all"
      ? `?status=eq.${args.status}&order=created_at.desc`
      : `?order=created_at.desc`;
    const res = await fetch(`${SUPABASE_URL}/rest/v1/candidates${filter}`, { headers });
    const data = await res.json();
    console.log("Supabase candidates response:", JSON.stringify(data));
    if (!Array.isArray(data) || !data.length) return `No candidates found with status: ${args.status}`;
    return JSON.stringify(data.map((c: Record<string, unknown>) => ({
      name: c.name, email: c.email, status: c.status,
      score: c.score, interview_score: c.interview_score,
      created_at: c.created_at
    })));
  }

  if (name === "get_candidate_by_name") {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/candidates?or=(name.ilike.*${args.search}*,email.ilike.*${args.search}*)`,
      { headers }
    );
    const data = await res.json();
    console.log("Supabase search response:", JSON.stringify(data));
    if (!Array.isArray(data) || !data.length) return `No candidate found matching: ${args.search}`;
    return JSON.stringify(data[0]);
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
    console.log("Update status response:", res.status);
    if (res.ok) return `Status updated to "${args.status}" for ${args.email}.`;
    return `Failed to update status.`;
  }

  if (name === "send_assignment") {
    const checkRes = await fetch(
      `${SUPABASE_URL}/rest/v1/candidates?email=eq.${args.email}`,
      { headers }
    );
    const candidates = await checkRes.json();
    if (!Array.isArray(candidates) || !candidates.length) return `Candidate not found: ${args.email}`;

    const n8nUrl = process.env.N8N_MANUAL_ASSIGNMENT_WEBHOOK!;
    if (!n8nUrl) return `N8N_MANUAL_ASSIGNMENT_WEBHOOK not configured.`;

    const res = await fetch(n8nUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: args.email })
    });
    console.log("N8n webhook response:", res.status);
    if (res.ok) return `Assignment sent to ${args.email} via n8n!`;
    return `Failed to send assignment.`;
  }

  if (name === "get_stats") {
    const [cRes, aRes] = await Promise.all([
      fetch(`${SUPABASE_URL}/rest/v1/candidates`, { headers }),
      fetch(`${SUPABASE_URL}/rest/v1/assignments`, { headers })
    ]);
    const data: Record<string, unknown>[] = await cRes.json();
    const assignments: Record<string, unknown>[] = await aRes.json();
    console.log("Stats - candidates:", data.length, "assignments:", assignments.length);
    const stats = {
      total_candidates: data.length,
      applied: data.filter(c => c.status === "applied").length,
      selected: data.filter(c => c.status === "selected").length,
      rejected: data.filter(c => c.status === "rejected").length,
      interviewed: data.filter(c => c.interview_score !== null).length,
      assignments_sent: assignments.length,
      avg_cv_score: data.length
        ? (data.reduce((s, c) => s + ((c.score as number) || 0), 0) / data.length).toFixed(1)
        : 0,
    };
    return JSON.stringify(stats);
  }

  return "Tool not found";
}

export async function POST(req: NextRequest) {
  try {
    const { messages } = await req.json();

    console.log("Chat request received, messages count:", messages.length);
    console.log("GEMINI_API_KEY exists:", !!GEMINI_API_KEY);
    console.log("SUPABASE_URL:", SUPABASE_URL);
    console.log("SUPABASE_SERVICE_KEY exists:", !!SUPABASE_SERVICE_KEY);

    const systemPrompt = `You are an HR recruitment assistant. You ONLY help with recruitment tasks.

You CAN help with:
- Viewing and searching candidates
- Updating candidate status (select/reject)
- Sending technical assignments
- Recruitment pipeline statistics

If asked anything outside recruitment, respond:
"Sorry, I can only assist with recruitment-related questions."

Always respond in English only.`;

    const geminiMessages = messages.map((m: { role: string; content: string }) => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: m.content }]
    }));

    const requestBody = {
      system_instruction: { parts: [{ text: systemPrompt }] },
      contents: geminiMessages,
      tools: [{ function_declarations: tools }],
      tool_config: { function_calling_config: { mode: "AUTO" } }
    };

    console.log("Calling Gemini API...");

    let response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody)
      }
    );

    console.log("Gemini response status:", response.status);
    let data = await response.json();
    console.log("Gemini raw response:", JSON.stringify(data));

    let candidate = data.candidates?.[0];
    const conversationContents = [...geminiMessages];
    let maxIterations = 5;

    while (
      candidate?.content?.parts?.some((p: Record<string, unknown>) => p.functionCall) &&
      maxIterations > 0
    ) {
      maxIterations--;
      const functionCalls = candidate.content.parts.filter(
        (p: Record<string, unknown>) => p.functionCall
      );

      conversationContents.push({ role: "model", parts: candidate.content.parts });

      const functionResponses = await Promise.all(
        functionCalls.map(async (part: { functionCall: { name: string; args: Record<string, string> } }) => {
          const result = await executeTool(part.functionCall.name, part.functionCall.args || {});
          return {
            functionResponse: {
              name: part.functionCall.name,
              response: { result }
            }
          };
        })
      );

      conversationContents.push({ role: "user", parts: functionResponses });

      response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            system_instruction: { parts: [{ text: systemPrompt }] },
            contents: conversationContents,
            tools: [{ function_declarations: tools }],
            tool_config: { function_calling_config: { mode: "AUTO" } }
          })
        }
      );

      console.log("Gemini follow-up status:", response.status);
      data = await response.json();
      console.log("Gemini follow-up response:", JSON.stringify(data));
      candidate = data.candidates?.[0];
    }

    const text = candidate?.content?.parts
      ?.find((p: Record<string, unknown>) => p.text)
      ?.text || "No response received. Please try again.";

    console.log("Final response text:", text);
    return NextResponse.json({ reply: text });

  } catch (error) {
    console.error("Chat API error:", error);
    return NextResponse.json(
      { reply: "Something went wrong. Please try again." },
      { status: 500 }
    );
  }
}