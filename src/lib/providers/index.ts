import type { AuthType } from "./types";
import { posthogAdapter } from "./posthog";

export type ProviderMeta = {
  id: string;
  label: string;
  description: string;
  authType: AuthType;
};

export const PROVIDERS: ProviderMeta[] = [
  {
    id: "gsc",
    label: "Google Search Console",
    description: "Search performance — clicks, impressions, positions and queries.",
    authType: "oauth",
  },
  { ...posthogAdapter },
];

export const ADAPTERS: Record<string, typeof posthogAdapter> = {
  posthog: posthogAdapter,
};
