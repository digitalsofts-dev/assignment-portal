import { NextRequest, NextResponse } from "next/server";
export const runtime = "nodejs";
import { MCP_TOOLS, executeMcpTool } from "../mcp/route";

const GEMINI_API_KEY = process.env.GEMINI_API_KEY!;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;

type Message = { role: string; content: string };
type Model = "gemini" | "openai" | "claude";

const SYSTEM_PROMPT = `You are an HR recruitment assistant. You ONLY help with recruitment tasks.

You CAN help with:
- Viewing and searching candidates
- Updating candidate status (select/reject/reset)
- Sending technical assignments
- Recruitment pipeline statistics and analytics

If asked anything outside recruitment scope, respond:
"Sorry, I can only assist with recruitment-related questions."

Rules:
- If multiple candidates have same name, always ask for email confirmation before taking action
- Always confirm before updating status or sending assignments
- Always respond in English only
- Be concise and professional`;

// ── Gemini Handler ────────────────────────────────────────────────────────────
async function callGemini(messages: Message[]): Promise<string> {
  const geminiTools = MCP_TOOLS.map(t => ({
    name: t.name,
    description: t.description,
    parameters: t.inputSchema
  }));

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const conversation: any[] = messages.map(m => ({
    role: m.role === "assistant" ? "model" : "user",
    parts: [{ text: m.content }]
  }));

  const callApi = async (contents: unknown[]) => {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          system_instruction: { parts: [{ text: SYSTEM_PROMPT }] },
          contents,
          tools: [{ function_declarations: geminiTools }],
          tool_config: { function_calling_config: { mode: "AUTO" } }
        })
      }
    );
    return res.json();
  };

  let data = await callApi(conversation);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let candidate = data.candidates?.[0] as any;
  let maxIter = 5;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  while (candidate?.content?.parts?.some((p: any) => p.functionCall) && maxIter > 0) {
    maxIter--;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const calls = candidate.content.parts.filter((p: any) => p.functionCall);
    conversation.push({ role: "model", parts: candidate.content.parts });

    const responses = await Promise.all(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      calls.map(async (part: any) => {
        const result = await executeMcpTool(part.functionCall.name, part.functionCall.args || {});
        return {
          functionResponse: {
            name: part.functionCall.name,
            response: { result: result.content[0].text }
          }
        };
      })
    );

    conversation.push({ role: "user", parts: responses });
    data = await callApi(conversation);
    candidate = data.candidates?.[0];
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return candidate?.content?.parts?.find((p: any) => p.text)?.text || "No response received.";
}

// ── OpenAI Handler ────────────────────────────────────────────────────────────
async function callOpenAI(messages: Message[]): Promise<string> {
  const openaiTools = MCP_TOOLS.map(t => ({
    type: "function",
    function: {
      name: t.name,
      description: t.description,
      parameters: t.inputSchema
    }
  }));

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const conversation: any[] = [
    { role: "system", content: SYSTEM_PROMPT },
    ...messages.map(m => ({ role: m.role, content: m.content }))
  ];

  const callApi = async (msgs: unknown[]) => {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: msgs,
        tools: openaiTools,
        tool_choice: "auto"
      })
    });
    return res.json();
  };

  let data = await callApi(conversation);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let msg = data.choices?.[0]?.message as any;
  let maxIter = 5;

  while (msg?.tool_calls && maxIter > 0) {
    maxIter--;
    conversation.push(msg);

    const toolResults = await Promise.all(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      msg.tool_calls.map(async (call: any) => {
        const args = JSON.parse(call.function.arguments);
        const result = await executeMcpTool(call.function.name, args);
        return {
          role: "tool",
          tool_call_id: call.id,
          content: result.content[0].text
        };
      })
    );

    conversation.push(...toolResults);
    data = await callApi(conversation);
    msg = data.choices?.[0]?.message;
  }

  return msg?.content || "No response received.";
}

// ── Claude Handler ────────────────────────────────────────────────────────────
async function callClaude(messages: Message[]): Promise<string> {
  const claudeTools = MCP_TOOLS.map(t => ({
    name: t.name,
    description: t.description,
    input_schema: t.inputSchema
  }));

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const conversation: any[] = messages.map(m => ({
    role: m.role === "assistant" ? "assistant" : "user",
    content: m.content
  }));

  const callApi = async (msgs: unknown[]) => {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": ANTHROPIC_API_KEY!,
        "anthropic-version": "2023-06-01"
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 1024,
        system: SYSTEM_PROMPT,
        messages: msgs,
        tools: claudeTools
      })
    });
    return res.json();
  };

  let data = await callApi(conversation);
  let maxIter = 5;

  while (data.stop_reason === "tool_use" && maxIter > 0) {
    maxIter--;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const toolUses = data.content.filter((c: any) => c.type === "tool_use");
    conversation.push({ role: "assistant", content: data.content });

    const toolResults = await Promise.all(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      toolUses.map(async (tool: any) => {
        const result = await executeMcpTool(tool.name, tool.input);
        return {
          type: "tool_result",
          tool_use_id: tool.id,
          content: result.content[0].text
        };
      })
    );

    conversation.push({ role: "user", content: toolResults });
    data = await callApi(conversation);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const textBlock = data.content?.find((c: any) => c.type === "text");
  return textBlock?.text || "No response received.";
}

// ── Main Handler ──────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const { messages, model = "gemini" }: { messages: Message[]; model: Model } = await req.json();
    console.log("Chat called, model:", model);

    let reply = "";

    if (model === "openai") {
  if (!OPENAI_API_KEY) return NextResponse.json({ reply: "OpenAI API key not configured." });
  reply = await callOpenAI(messages);
 } else if (model === "claude") {
  if (!ANTHROPIC_API_KEY) return NextResponse.json({ reply: "Anthropic API key not configured." });
  reply = await callClaude(messages);
 } else {
  // Gemini first, fallback to others if rate limited
  try {
    reply = await callGemini(messages);
    if (!reply || reply === "No response received.") throw new Error("Empty response");
  } catch {
    if (OPENAI_API_KEY) {
      console.log("Gemini failed, trying OpenAI...");
      reply = await callOpenAI(messages);
    } else if (ANTHROPIC_API_KEY) {
      console.log("Gemini failed, trying Claude...");
      reply = await callClaude(messages);
    } else {
      reply = "Service temporarily unavailable. Please try again later.";
    }
  }
 }

    return NextResponse.json({ reply });

  } catch (error) {
    console.error("Chat error:", error);
    return NextResponse.json({ reply: "Something went wrong. Please try again." }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({
    models: [
      { id: "gemini", name: "Gemini 2.0 Flash", provider: "Google", free: true, configured: !!GEMINI_API_KEY },
      { id: "openai", name: "GPT-4o Mini", provider: "OpenAI", free: false, configured: !!OPENAI_API_KEY },
      { id: "claude", name: "Claude Haiku", provider: "Anthropic", free: false, configured: !!ANTHROPIC_API_KEY },
    ]
  });
}