import Groq from "groq-sdk";

export const DEFAULT_MODEL = "openai/gpt-oss-120b";

let groqClient: Groq | null = null;

function getClient(): Groq | null {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) return null;
  if (!groqClient) groqClient = new Groq({ apiKey });
  return groqClient;
}

export function aiEnabled(): boolean {
  return Boolean(process.env.GROQ_API_KEY);
}

export function model(): string {
  return process.env.LLM_MODEL ?? DEFAULT_MODEL;
}

export async function chatJSON<T = unknown>(system: string, user: string): Promise<T> {
  const client = getClient();
  if (!client) throw new Error("Missing GROQ_API_KEY in environment");

  const completion = await client.chat.completions.create({
    model: model(),
    temperature: 0.4,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
  });

  const content = completion.choices[0]?.message?.content;
  if (!content) throw new Error("LLM returned empty response");
  return JSON.parse(content) as T;
}
