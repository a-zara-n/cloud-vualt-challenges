import { BedrockRuntimeClient, ConverseCommand } from "@aws-sdk/client-bedrock-runtime";

const port = Number(process.env.PORTAL_CHAT_PROXY_PORT ?? "8787");
const region =
  process.env.BEDROCK_RUNTIME_REGION ??
  process.env.AWS_BEDROCK_REGION ??
  process.env.AWS_REGION ??
  process.env.AWS_DEFAULT_REGION ??
  "ap-northeast-1";

const client = new BedrockRuntimeClient({
  region,
  endpoint: process.env.BEDROCK_RUNTIME_ENDPOINT,
});

type ChatRequest = {
  system?: string;
  message?: string;
  modelId?: string;
};

async function invokeBedrock(body: ChatRequest): Promise<string> {
  if (!body.message || typeof body.message !== "string") {
    throw new Error("message field is required");
  }

  const response = await client.send(
    new ConverseCommand({
      modelId: body.modelId ?? "jp.amazon.nova-2-lite-v1:0",
      system: body.system ? [{ text: body.system }] : undefined,
      messages: [{ role: "user", content: [{ text: body.message }] }],
      inferenceConfig: {
        maxTokens: 1024,
        temperature: 0.7,
      },
    })
  );

  return response.output?.message?.content?.[0]?.text?.trim() || "No response";
}

Bun.serve({
  port,
  async fetch(req) {
    const url = new URL(req.url);
    if (req.method === "GET" && url.pathname === "/health") {
      return Response.json({ ok: true, region });
    }

    if (req.method !== "POST" || url.pathname !== "/chat") {
      return Response.json({ error: "not found" }, { status: 404 });
    }

    try {
      const body = (await req.json().catch(() => ({}))) as ChatRequest;
      const reply = await invokeBedrock(body);
      return Response.json({ reply });
    } catch (error) {
      return Response.json(
        { error: error instanceof Error ? error.message : "bedrock proxy failed" },
        { status: 502 }
      );
    }
  },
});

console.log(`[bedrock-chat-proxy] listening on http://127.0.0.1:${port}`);
console.log(`[bedrock-chat-proxy] region=${region}`);
