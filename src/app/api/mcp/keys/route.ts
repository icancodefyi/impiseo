import { NextResponse, type NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { createApiKey, listApiKeys, revokeApiKey } from "@/lib/api-keys";

function unauthorized() {
  return NextResponse.json({ error: "unauthorized" }, { status: 401 });
}

export async function GET() {
  try {
    const session = await auth();
    const userId = session?.user?.id;
    if (!userId) return unauthorized();
    const keys = await listApiKeys(userId);
    return NextResponse.json({ keys });
  } catch (err) {
    console.error("[/api/mcp/keys GET] error:", err);
    return NextResponse.json({ error: "failed to load API keys" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    const userId = session?.user?.id;
    if (!userId) return unauthorized();

    let body: { name?: string };
    try {
      body = (await req.json()) as { name?: string };
    } catch {
      return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
    }
    const name = (body.name ?? "default").trim().slice(0, 60) || "default";

    const created = await createApiKey({ userId, name });
    return NextResponse.json({ created }, { status: 201 });
  } catch (err) {
    console.error("[/api/mcp/keys POST] error:", err);
    return NextResponse.json({ error: "failed to create API key" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const session = await auth();
    const userId = session?.user?.id;
    if (!userId) return unauthorized();

    const prefix = req.nextUrl.searchParams.get("prefix");
    if (!prefix) {
      return NextResponse.json({ error: "missing prefix param" }, { status: 400 });
    }
    const revoked = await revokeApiKey(userId, prefix);
    return NextResponse.json({ ok: true, revoked });
  } catch (err) {
    console.error("[/api/mcp/keys DELETE] error:", err);
    return NextResponse.json({ error: "failed to revoke API key" }, { status: 500 });
  }
}