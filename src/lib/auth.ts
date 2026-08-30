import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import { google } from "googleapis";
import { getCollections } from "./db";

export const GSC_SCOPE = "https://www.googleapis.com/auth/webmasters.readonly";

// Identity is keyed by email, normalized to lowercase. Google's `sub` rotates
// between sign-ins for some accounts and email casing can differ across
// providers/fetches — either would re-fragment per-user docs.
function stableUserId(email?: string | null, sub?: string | null): string {
  const base = email?.trim() || sub || "";
  return base.toLowerCase();
}

async function persistRefreshToken(
  userId: string,
  email: string,
  refreshToken: string
) {
  try {
    const { users } = await getCollections();
    await users.updateOne(
      { userId },
      {
        $set: {
          googleRefreshToken: refreshToken,
          email,
          updatedAt: new Date(),
        },
        $setOnInsert: { createdAt: new Date() },
      },
      { upsert: true }
    );
  } catch {
    // never break auth flow over persistence failures
  }
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  trustHost: true,
  secret: process.env.AUTH_SECRET,
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      authorization: {
        params: {
          scope: `openid email profile ${GSC_SCOPE}`,
          access_type: "offline",
          prompt: "consent",
        },
      },
    }),
  ],
  callbacks: {
    async jwt({ token, account }) {
      if (account) {
        token.access_token = account.access_token ?? undefined;
        token.refresh_token = account.refresh_token ?? token.refresh_token;
        token.expires_at = account.expires_at;
        if (account.refresh_token) {
          const stableId = stableUserId(token.email, token.sub);
          await persistRefreshToken(
            stableId,
            token.email?.toLowerCase() ?? "",
            account.refresh_token
          );
          token._rt_persisted = true;
        }
        return token;
      }

      if (!token._rt_persisted && token.refresh_token && token.email) {
        await persistRefreshToken(
          stableUserId(token.email, null),
          token.email.toLowerCase(),
          token.refresh_token
        );
        token._rt_persisted = true;
      }

      if (!token.expires_at || Date.now() < token.expires_at * 1000) {
        return token;
      }
      if (!token.refresh_token) {
        token.error = "RefreshTokenError";
        return token;
      }

      try {
        const client = new google.auth.OAuth2(
          process.env.GOOGLE_CLIENT_ID,
          process.env.GOOGLE_CLIENT_SECRET
        );
        client.setCredentials({ refresh_token: token.refresh_token });
        const { credentials } = await client.refreshAccessToken();
        token.access_token = credentials.access_token ?? undefined;
        token.expires_at = credentials.expiry_date
          ? Math.floor(credentials.expiry_date / 1000)
          : undefined;
        token.refresh_token = credentials.refresh_token ?? token.refresh_token;
        return token;
      } catch {
        token.error = "RefreshTokenError";
        return token;
      }
    },
    session({ session, token }) {
      // Identity is keyed by email (lowercased), not Google's `sub`: some
      // accounts rotate their sub claim between sign-ins, which fragments
      // per-sub user docs. Lowercasing keeps casing differences from
      // fragmenting again after a provider change or Workspace email edit.
      if (session.user) {
        session.user.id = stableUserId(token.email, token.sub);
      }
      session.access_token = token.access_token;
      return session;
    },
  },
});
