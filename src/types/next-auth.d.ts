import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: { id?: string } & DefaultSession["user"];
    access_token?: string;
    error?: string;
  }
}

declare module "@auth/core/jwt" {
  interface JWT {
    access_token?: string;
    refresh_token?: string;
    expires_at?: number;
    error?: string;
  }
}
