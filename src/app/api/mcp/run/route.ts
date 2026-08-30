import { NextResponse, type NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { keyBelongsToUser } from "@/lib/api-keys";

const MCP_BASE = (process.env.MCP_BASE_URL ?? "http://localhost:3777").replace(/\/+$/, "");
const PROTOCOL_VERSION = "2024-11-05";

type RpcMessage = {
  jsonrpc: "2.0";
  id?: number;
  method: string;
  params?: Record<string, unknown>;
};

type RpcResponse = {
  jsonrpc: "2.0";
  id?: number;
  result?: {
    isError?: boolean;
    structuredContent?: Record<string, unknown>;
    content?: { type: string; text?: string }[];
  };
  error?: { code?: number; message?: string };
};

async function parseMcpBody(res: Response): Promise<RpcResponse | undefined> {
  const raw = await res.text();
  const ct = res.headers.get("content-type") ?? "";
  if (ct.includes("text/event-stream")) {
    for (const frame of raw.split("\n\n")) {
      for (const line of frame.split("\n")) {
        if (line.startsWith("data:")) {
          try {
            return JSON.parse(line.slice(5).trim()) as RpcResponse;
          } catch {
            // skip malformed frame and look for the next one
          }
        }
      }
    }
    return undefined;
  }
  try {
    return JSON.parse(raw) as RpcResponse;
  } catch {
    return undefined;
  }
}

async function rpc(
  key: string,
  message: RpcMessage,
  sessionId?: string
): Promise<{ status: number; json?: RpcResponse; sessionId?: string }> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "application/json, text/event-stream",
    Authorization: `Bearer ${key}`,
  };
  if (sessionId) headers["Mcp-Session-Id"] = sessionId;

  const res = await fetch(`${MCP_BASE}/mcp`, {
    method: "POST",
    headers,
    body: JSON.stringify(message),
    signal: AbortSignal.timeout(180_000),
  });
  const nextSessionId = res.headers.get("mcp-session-id") ?? undefined;
  const json = await parseMcpBody(res);
  return { status: res.status, json, sessionId: nextSessionId };
}

function rpcErrorText(json: RpcResponse | undefined, fallback: string): string {
  if (json?.error?.message) return json.error.message;
  if (json?.error) return `RPC error ${json.error.code ?? ""}`;
  return fallback;
}

export async function POST(req: NextRequest) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: { key?: string; mode?: "list" | "call"; tool?: string; params?: Record<string, unknown> };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }

  const key = body.key?.trim();
  if (!key) {
    return NextResponse.json({ error: "missing API key" }, { status: 400 });
  }
  const toolName = body.tool?.trim();
  if (body.mode !== "list" && !toolName) {
    return NextResponse.json({ error: "missing tool" }, { status: 400 });
  }

  // Only a key that belongs to the signed-in account may be piped to the MCP
  // server — otherwise any session could proxy arbitrary Bearer tokens.
  const owned = await keyBelongsToUser(key, userId).catch(() => false);
  if (!owned) {
    return NextResponse.json({ error: "API key is invalid or does not belong to this account" }, { status: 403 });
  }

  try {
    const startedAt = Date.now();

    const init = await rpc(key, {
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: {
        protocolVersion: PROTOCOL_VERSION,
        capabilities: {},
        clientInfo: { name: "impiseo-dashboard", version: "1.0.0" },
      },
    });
    if (init.status !== 200) {
      return NextResponse.json(
        { ok: false, message: rpcErrorText(init.json, `MCP server returned HTTP ${init.status}`) },
        { status: 502 }
      );
    }
    await rpc(key, { jsonrpc: "2.0", method: "notifications/initialized" }, init.sessionId);

    const method = body.mode === "list" ? "tools/list" : "tools/call";
    const params =
      body.mode === "list"
        ? {}
        : { name: toolName!, arguments: body.params ?? {} };
    const call = await rpc(key, { jsonrpc: "2.0", id: 2, method, params }, init.sessionId);
    if (call.status !== 200) {
      return NextResponse.json(
        { ok: false, message: rpcErrorText(call.json, `MCP server returned HTTP ${call.status}`) },
        { status: 502 }
      );
    }

    return NextResponse.json({ ok: true, durationMs: Date.now() - startedAt, body: call.json });
  } catch (err) {
    const message = err instanceof Error ? err.message : "MCP request failed";
    return NextResponse.json(
      { ok: false, message: /fetch failed/i.test(message) ? `MCP server unreachable at ${MCP_BASE} — is impiseo-mcp running?` : message },
      { status: 502 }
    );
  }
}