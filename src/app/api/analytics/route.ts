import { NextResponse, type NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { getConnections } from "@/lib/connections";
import { fetchPosthogStats, fetchPosthogTotals } from "@/lib/providers/posthog";

export async function GET(req: NextRequest) {
  try {
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

    const [stats, prevTotals] = await Promise.all([
      fetchPosthogStats({
        host: ph.host,
        apiKey: ph.apiKey!,
        projectId: ph.projectId,
        days,
      }),
      fetchPosthogTotals({
        host: ph.host,
        apiKey: ph.apiKey!,
        projectId: ph.projectId,
        days,
        offsetDays: days,
      }),
    ]);
    return NextResponse.json({ connected: true, days, ...stats, prevTotals });
  } catch (err) {
    console.error("[/api/analytics] error:", err);
    return NextResponse.json(
      { connected: false, error: (err as Error).message },
      { status: 200 }
    );
  }
}
