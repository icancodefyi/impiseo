import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import { google } from "googleapis";

export const GSC_SCOPE = "https://www.googleapis.com/auth/webmasters.readonly";

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
        return token;
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
      if (session.user && token.sub) {
        session.user.id = token.sub;
      }
      session.access_token = token.access_token;
      return session;
    },
  },
});
