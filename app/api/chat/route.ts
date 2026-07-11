import { NextRequest, NextResponse } from "next/server";
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
async function callGemini(messages: Message[]) {
  const geminiTools = MCP_TOOLS.map(t => ({
    name: t.name,
    description: t.description,
    parameters: t.inputSchema
  }));

  const geminiMessages = messages.map(m => ({
    role: m.role === "assistant" ? "model" : "user",
    parts: [{ text: m.content }]
  }));

  let response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${GEMINI_API_KEY}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: SYSTEM_PROMPT }] },
        contents: geminiMessages,
        tools: [{ function_declarations: geminiTools }],
        tool_config: { function_calling_config: { mode: "AUTO" } }
      })
    }
  );

  let data = await response.json();
  let candidate = data.candidates?.[0];
  const conversation = [...geminiMessages];
  let maxIter = 5;

  while (candidate?.content?.parts?.some((p: Record<string, unknown>) => p.functionCall) && maxIter > 0) {
    maxIter--;
    const calls = candidate.content.parts.filter((p: Record<string, unknown>) => p.functionCall);
    conversation.push({ role: "user", content: toolResults as unknown as string });

    const responses = await Promise.all(
      calls.map(async (part: { functionCall: { name: string; args: Record<string, string> } }) => {
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

    response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          system_instruction: { parts: [{ text: SYSTEM_PROMPT }] },
          contents: conversation,
          tools: [{ function_declarations: geminiTools }],
          tool_config: { function_calling_config: { mode: "AUTO" } }
        })
      }
    );
    data = await response.json();
    candidate = data.candidates?.[0];
  }

  return candidate?.content?.parts?.find((p: Record<string, unknown>) => p.text)?.text || "No response received.";
}

// ── OpenAI Handler ────────────────────────────────────────────────────────────
async function callOpenAI(messages: Message[]) {
  const openaiTools = MCP_TOOLS.map(t => ({
    type: "function",
    function: {
      name: t.name,
      description: t.description,
      parameters: t.inputSchema
    }
  }));

  const openaiMessages = [
    { role: "system", content: SYSTEM_PROMPT },
    ...messages.map(m => ({ role: m.role, content: m.content }))
  ];

  let response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${OPENAI_API_KEY}`
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages: openaiMessages,
      tools: openaiTools,
      tool_choice: "auto"
    })
  });

  let data = await response.json();
  let msg = data.choices?.[0]?.message;
  const conversation = [...openaiMessages];
  let maxIter = 5;

  while (msg?.tool_calls && maxIter > 0) {
    maxIter--;
    conversation.push(msg);

    const toolResults = await Promise.all(
      msg.tool_calls.map(async (call: { id: string; function: { name: string; arguments: string } }) => {
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

    response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: conversation,
        tools: openaiTools,
        tool_choice: "auto"
      })
    });

    data = await response.json();
    msg = data.choices?.[0]?.message;
  }

  return msg?.content || "No response received.";
}

// ── Claude Handler ────────────────────────────────────────────────────────────
async function callClaude(messages: Message[]) {
  const claudeTools = MCP_TOOLS.map(t => ({
    name: t.name,
    description: t.description,
    input_schema: t.inputSchema
  }));

  const claudeMessages = messages.map(m => ({
    role: m.role === "assistant" ? "assistant" : "user",
    content: m.content
  }));

  let response = await fetch("https://api.anthropic.com/v1/messages", {
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
      messages: claudeMessages,
      tools: claudeTools
    })
  });

  let data = await response.json();
  const conversation = [...claudeMessages];
  let maxIter = 5;

  while (data.stop_reason === "tool_use" && maxIter > 0) {
    maxIter--;
    const toolUses = data.content.filter((c: Record<string, unknown>) => c.type === "tool_use");
    conversation.push({ role: "assistant", content: data.content });

    const toolResults = await Promise.all(
      toolUses.map(async (tool: { id: string; name: string; input: Record<string, string> }) => {
        const result = await executeMcpTool(tool.name, tool.input);
        return {
          type: "tool_result",
          tool_use_id: tool.id,
          content: result.content[0].text
        };
      })
    );

    conversation.push({ role: "user", content: toolResults });

    response = await fetch("https://api.anthropic.com/v1/messages", {
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
        messages: conversation,
        tools: claudeTools
      })
    });
    data = await response.json();
  }

  const textBlock = data.content?.find((c: Record<string, unknown>) => c.type === "text");
  return textBlock?.text || "No response received.";
}

// ── Main Handler ──────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const { messages, model = "gemini" }: { messages: Message[]; model: Model } = await req.json();

    let reply = "";

    if (model === "openai") {
      if (!OPENAI_API_KEY) return NextResponse.json({ reply: "OpenAI API key not configured." });
      reply = await callOpenAI(messages);
    } else if (model === "claude") {
      if (!ANTHROPIC_API_KEY) return NextResponse.json({ reply: "Anthropic API key not configured." });
      reply = await callClaude(messages);
    } else {
      if (!GEMINI_API_KEY) return NextResponse.json({ reply: "Gemini API key not configured." });
      reply = await callGemini(messages);
    }

    return NextResponse.json({ reply });

  } catch (error) {
    console.error("Chat error:", error);
    return NextResponse.json({ reply: "Something went wrong. Please try again." }, { status: 500 });
  }
}

// Available models info
export async function GET() {
  return NextResponse.json({
    models: [
      { id: "gemini", name: "Gemini 2.0 Flash", provider: "Google", free: true, configured: !!GEMINI_API_KEY },
      { id: "openai", name: "GPT-4o Mini", provider: "OpenAI", free: false, configured: !!OPENAI_API_KEY },
      { id: "claude", name: "Claude Haiku", provider: "Anthropic", free: false, configured: !!ANTHROPIC_API_KEY },
    ]
  });
}