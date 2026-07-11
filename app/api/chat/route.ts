import { NextRequest, NextResponse } from "next/server";

const GEMINI_API_KEY = process.env.GEMINI_API_KEY!;
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// ── Tools Definition ──────────────────────────────────────────────────────────
const tools = [
  {
    name: "get_candidates",
    description: "Get all candidates or filter by status. Use this to answer questions about candidates.",
    parameters: {
      type: "object",
      properties: {
        status: {
          type: "string",
          description: "Filter by status: 'applied', 'selected', 'rejected', or 'all'",
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
        search: { type: "string", description: "Candidate name or email to search" }
      },
      required: ["search"]
    }
  },
  {
    name: "update_candidate_status",
    description: "Update a candidate's status manually (selected, rejected, applied)",
    parameters: {
      type: "object",
      properties: {
        email: { type: "string", description: "Candidate email" },
        status: { type: "string", enum: ["selected", "rejected", "applied"], description: "New status" }
      },
      required: ["email", "status"]
    }
  },
  {
    name: "send_assignment",
    description: "Send technical assignment to a candidate via n8n webhook",
    parameters: {
      type: "object",
      properties: {
        email: { type: "string", description: "Candidate email to send assignment to" }
      },
      required: ["email"]
    }
  },
  {
    name: "get_stats",
    description: "Get recruitment statistics and pipeline summary",
    parameters: {
      type: "object",
      properties: {},
      required: []
    }
  }
];

// ── Tool Executors ────────────────────────────────────────────────────────────
async function executeTool(name: string, args: Record<string, string>) {
  const headers = {
    "apikey": SUPABASE_SERVICE_KEY,
    "Authorization": `Bearer ${SUPABASE_SERVICE_KEY}`,
    "Content-Type": "application/json"
  };

  if (name === "get_candidates") {
    const filter = args.status !== "all" ? `?status=eq.${args.status}` : "";
    const res = await fetch(`${SUPABASE_URL}/rest/v1/candidates${filter}&order=created_at.desc`, { headers });
    const data = await res.json();
    if (!data.length) return `No candidates found with status: ${args.status}`;
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
    if (!data.length) return `No candidate found matching: ${args.search}`;
    return JSON.stringify(data[0]);
  }

  if (name === "update_candidate_status") {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/candidates?email=eq.${args.email}`,
      {
        method: "PATCH",
        headers,
        body: JSON.stringify({ status: args.status, manual_override: true })
      }
    );
    if (res.ok) return `✅ ${args.email} ka status "${args.status}" kar diya gaya aur manual override set ho gaya.`;
    return `❌ Status update failed.`;
  }

  if (name === "send_assignment") {
    // First check candidate exists
    const checkRes = await fetch(
      `${SUPABASE_URL}/rest/v1/candidates?email=eq.${args.email}`,
      { headers }
    );
    const candidates = await checkRes.json();
    if (!candidates.length) return `❌ Candidate not found: ${args.email}`;

    // Trigger n8n manual assignment webhook
    const n8nUrl = process.env.N8N_MANUAL_ASSIGNMENT_WEBHOOK!;
    const res = await fetch(n8nUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: args.email })
    });
    if (res.ok) return `✅ Assignment ${args.email} ko bhej diya gaya! N8n AI assignment generate kar raha hai.`;
    return `❌ Assignment send karne mein masla aaya. N8n webhook check karo.`;
  }

  if (name === "get_stats") {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/candidates`, { headers });
    const data: Record<string, unknown>[] = await res.json();
    const aRes = await fetch(`${SUPABASE_URL}/rest/v1/assignments`, { headers });
    const assignments: Record<string, unknown>[] = await aRes.json();
    const stats = {
      total: data.length,
      applied: data.filter((c) => c.status === "applied").length,
      selected: data.filter((c) => c.status === "selected").length,
      rejected: data.filter((c) => c.status === "rejected").length,
      interviewed: data.filter((c) => c.interview_score !== null).length,
      assignments_sent: assignments.length,
      avg_score: data.length ? (data.reduce((s, c) => s + ((c.score as number) || 0), 0) / data.length).toFixed(1) : 0,
    };
    return JSON.stringify(stats);
  }

  return "Tool not found";
}

// ── Main Handler ──────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const { messages } = await req.json();

    const systemPrompt = `You are an HR recruitment assistant for a hiring dashboard. You ONLY help with recruitment-related tasks.

You CAN help with:
- Viewing and searching candidates
- Updating candidate status (select/reject)
- Sending technical assignments
- Recruitment pipeline statistics
- Questions about the hiring process

You CANNOT help with:
- Weather, news, general knowledge
- Coding help, math, translations
- Anything not related to this recruitment system

If asked anything outside recruitment scope, respond with exactly:
"Sorry, I can only assist with recruitment-related questions. Please ask about candidates, pipeline, or hiring tasks."

Always respond in English only. Never use Urdu or Roman Urdu.
Be concise and helpful.`;

    // Call Gemini with function calling
    const geminiMessages = messages.map((m: { role: string; content: string }) => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: m.content }]
    }));

    let response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          system_instruction: { parts: [{ text: systemPrompt }] },
          contents: geminiMessages,
          tools: [{ function_declarations: tools }],
          tool_config: { function_calling_config: { mode: "AUTO" } }
        })
      }
    );

    let data = await response.json();
    let candidate = data.candidates?.[0];

    // Handle function calls in a loop
    const conversationContents = [...geminiMessages];
    let maxIterations = 5;

    while (candidate?.content?.parts?.some((p: Record<string, unknown>) => p.functionCall) && maxIterations > 0) {
      maxIterations--;
      const functionCalls = candidate.content.parts.filter((p: Record<string, unknown>) => p.functionCall);

      // Add model response to conversation
      conversationContents.push({ role: "model", parts: candidate.content.parts });

      // Execute all function calls
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

      // Call Gemini again with results
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

      data = await response.json();
      candidate = data.candidates?.[0];
    }

    const text = candidate?.content?.parts?.find((p: Record<string, unknown>) => p.text)?.text || "No response received. Please try again.";
    return NextResponse.json({ reply: text });

  } catch (error) {
    console.error("Chat API error:", error);
    return NextResponse.json({ reply: "Kuch masla aaya. Please try again." }, { status: 500 });
  }
}
