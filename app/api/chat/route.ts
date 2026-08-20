export const maxDuration = 60;
import { NextRequest, NextResponse } from "next/server";
export const runtime = "nodejs";
import { MCP_TOOLS, executeMcpTool } from "../mcp/route";

const OLLAMA_URL = process.env.OLLAMA_URL || "http://localhost:11434";
const OLLAMA_API_KEY = process.env.OLLAMA_API_KEY || "";

type Message = { role: string; content: string };

const SYSTEM_PROMPT = `You are an HR recruitment assistant. You ONLY help with recruitment tasks. If asked to resend an assignment, ALWAYS call send_assignment tool again regardless of chat history

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

async function callOllama(messages: Message[]): Promise<string> {
  const tools = MCP_TOOLS.map(t => ({
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
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 55000);
  
  const res = await fetch(`${OLLAMA_URL}/v1/chat/completions`, {
    method: "POST",
    signal: controller.signal,
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${OLLAMA_API_KEY}`
    },
    body: JSON.stringify({
      model: "qwen2.5-coder:7b",
      messages: msgs,
      tools,
      tool_choice: "auto"
    })
  });
  
  clearTimeout(timeout);
  const text = await res.text();
  console.log("Ollama status:", res.status);
  console.log("Ollama raw response:", text.substring(0, 500));
  
  if (!text || text.startsWith("<")) throw new Error("Invalid response from Ollama");
  return JSON.parse(text);
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

  if (msg?.content) return msg.content;
   if (msg?.tool_calls) return "Action completed successfully.";

  
   console.log("Raw msg:", JSON.stringify(msg));
   return "No response received.";
}

export async function POST(req: NextRequest) {
  try {
    const { messages }: { messages: Message[] } = await req.json();
    console.log("Chat called, model: ollama");
    const reply = await callOllama(messages);
    return NextResponse.json({ reply });
  } catch (error) {
    console.error("Chat error:", error);
    return NextResponse.json({ reply: "Something went wrong. Please try again." }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({
    models: [
      { id: "ollama", name: "Qwen 2.5 Coder 7b", provider: "Ollama", free: true, configured: true }
    ]
  });
}