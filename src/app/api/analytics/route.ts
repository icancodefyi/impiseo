import { NextResponse, type NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { getConnections } from "@/lib/connections";
import { fetchPosthogStats } from "@/lib/providers/posthog";

export async function GET(req: NextRequest) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const ph = (await getConnections(userId)).find(
    (c) => c.provider === "posthog" && c.apiKey
  );
  if (!ph) {
    return NextResponse.json({ connected: false }, { status: 200 });
  }

  const days = Math.min(Math.max(Number(req.nextUrl.searchParams.get("days") ?? 28), 1), 90);

  try {
    const stats = await fetchPosthogStats({
      host: ph.host,
      apiKey: ph.apiKey!,
      projectId: ph.projectId,
      days,
    });
    return NextResponse.json({ connected: true, days, ...stats });
  } catch (err) {
    return NextResponse.json(
      { connected: true, error: (err as Error).message },
      { status: 500 }
    );
  }
}
