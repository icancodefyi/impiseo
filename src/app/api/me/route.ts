import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getCollections } from "@/lib/db";
import type { UserDoc } from "@/lib/db";

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ loggedIn: false, profile: null });
    }

    const { users } = await getCollections();
    const doc = await users.findOne({ userId: session.user.id });
    if (!doc) {
      return NextResponse.json({ loggedIn: true, profile: null });
    }

    const { _id: _drop, ...profile } = doc;
    return NextResponse.json({ loggedIn: true, profile: profile satisfies UserDoc });
  } catch (err) {
    console.error("[/api/me] error:", err);
    // Treat as not-logged-in rather than crashing the shell: the client will
    // show the sign-in card and retry on the next navigation.
    return NextResponse.json({ loggedIn: false, profile: null });
  }
}
