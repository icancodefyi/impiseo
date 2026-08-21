import { NextResponse, type NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { deleteConnection, getConnections, upsertConnection } from "@/lib/connections";
import { ADAPTERS } from "@/lib/providers";
import { toPublicConnection, type StoredConnection } from "@/lib/providers/types";

function unauthorized() {
  return NextResponse.json({ error: "unauthorized" }, { status: 401 });
}

export async function GET() {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return unauthorized();
  return NextResponse.json({
    connections: (await getConnections(userId)).map(toPublicConnection),
  });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return unauthorized();

  let body: { provider?: string; apiKey?: string; host?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }

  const adapter = ADAPTERS[body.provider ?? ""];
  if (!adapter) {
    return NextResponse.json({ error: "unknown provider" }, { status: 400 });
  }

  const result = await adapter.validate(body);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  const connection: StoredConnection = {
    provider: adapter.id,
    status: "active",
    ...result.meta,
    apiKey: adapter.authType === "api_key" ? body.apiKey : undefined,
    connectedAt: new Date().toISOString(),
  };

  const connections = await upsertConnection(userId, connection);
  return NextResponse.json({
    connection: toPublicConnection(connections.find((c) => c.provider === connection.provider)!),
  });
}

export async function DELETE(req: NextRequest) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return unauthorized();

  const provider = req.nextUrl.searchParams.get("provider");
  if (!provider) {
    return NextResponse.json({ error: "missing provider param" }, { status: 400 });
  }
  await deleteConnection(userId, provider);
  return NextResponse.json({ ok: true });
}
