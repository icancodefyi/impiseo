import { NextResponse } from "next/server";
import { google } from "googleapis";
import { auth } from "@/lib/auth";

export async function GET() {
  const session = await auth();
  const accessToken = session?.access_token;
  if (!accessToken) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  try {
    const oauth2 = new google.auth.OAuth2();
    oauth2.setCredentials({ access_token: accessToken });
    const searchconsole = google.searchconsole({ version: "v1", auth: oauth2 });
    const { data } = await searchconsole.sites.list();
    const sites = (data.siteEntry ?? [])
      .filter((s) => s.permissionLevel && s.permissionLevel !== "siteUnverifiedUser")
      .map((s) => ({
        url: s.siteUrl ?? "",
        permissionLevel: s.permissionLevel ?? "",
      }));
    return NextResponse.json({ sites });
  } catch (err) {
    console.error("[/api/sites] GSC error:", err);
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
