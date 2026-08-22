import { NextResponse, type NextRequest } from "next/server";
import type { WithId } from "mongodb";
import { auth } from "@/lib/auth";
import { getCollections, type PageDoc } from "@/lib/db";
import { crawlPage, politeDelay, staleThreshold } from "@/lib/crawler";

export async function POST(req: NextRequest) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const site = req.nextUrl.searchParams.get("site");
  if (!site) {
    return NextResponse.json({ error: "missing site param" }, { status: 400 });
  }
  const limit = Math.min(Math.max(Number(req.nextUrl.searchParams.get("batch") ?? 5), 1), 20);

  const { pages, page_content } = await getCollections();

  const pending: WithId<PageDoc>[] = await pages
    .find({
      userId,
      siteUrl: site,
      $or: [{ crawledAt: { $exists: false } }, { crawledAt: null }, { crawledAt: { $lt: staleThreshold() } }],
    })
    .sort({ impressions: -1 })
    .limit(limit)
    .toArray();

  let crawled = 0;
  let failed = 0;
  const errors: string[] = [];

  for (const page of pending) {
    const prior = await page_content.findOne(
      { userId, siteUrl: site, path: page.path },
      { projection: { etag: 1, lastModified: 1 } }
    );

    const outcome = await crawlPage(page, prior ?? undefined);

    if (outcome.status === "ok") {
      await page_content.updateOne(
        { userId, siteUrl: site, path: page.path },
        { $set: { ...outcome.content, userId, siteUrl: site, path: page.path } },
        { upsert: true }
      );
      await pages.updateOne({ _id: page._id }, { $set: { crawledAt: new Date(), crawlError: null } });
      crawled++;
    } else if (outcome.status === "not_modified") {
      await page_content.updateOne(
        { userId, siteUrl: site, path: page.path },
        { $set: { fetchedAt: new Date() } }
      );
      await pages.updateOne({ _id: page._id }, { $set: { crawledAt: new Date(), crawlError: null } });
      crawled++;
    } else if (outcome.status === "error") {
      failed++;
      errors.push(`${page.path}: ${outcome.error}`);
      await pages.updateOne({ _id: page._id }, { $set: { crawledAt: new Date(), crawlError: outcome.error } });
    } else {
      // blocked_by_robots | skipped — don't retry forever
      const reason =
        outcome.status === "blocked_by_robots" ? "blocked by robots.txt" : outcome.reason;
      await pages.updateOne({ _id: page._id }, { $set: { crawledAt: new Date(), crawlError: reason } });
    }

    await politeDelay();
  }

  const remaining = await pages.countDocuments({
    userId,
    siteUrl: site,
    $or: [{ crawledAt: { $exists: false } }, { crawledAt: null }],
  });

  return NextResponse.json({ crawled, failed, remaining, total: pending.length, errors: errors.slice(0, 5) });
}
