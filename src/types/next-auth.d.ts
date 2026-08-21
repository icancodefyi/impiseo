import "next-auth";
import "@auth/core/jwt";

declare module "next-auth" {
  interface Session {
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
