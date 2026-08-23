const SUGGEST_URL = "https://suggestqueries.google.com/complete/search";
const TIMEOUT_MS = 5000;

export async function fetchAutocomplete(seed: string): Promise<string[]> {
  const url = `${SUGGEST_URL}?client=firefox&hl=en&gl=in&q=${encodeURIComponent(seed)}`;
  const res = await fetch(url, {
    signal: AbortSignal.timeout(TIMEOUT_MS),
    headers: { "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)" },
  });
  if (!res.ok) throw new Error(`autocomplete HTTP ${res.status}`);
  const data = (await res.json()) as [string, string[]];
  return Array.isArray(data?.[1]) ? data[1].filter((s) => typeof s === "string" && s.length > 0) : [];
}

export function coreTokensOf(topic: string): string[] {
  return topic
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length >= 2);
}

export async function validateTopic(
  seed: string,
  topicTokens: string[]
): Promise<{ phrasings: string[]; validated: boolean }> {
  try {
    const suggestions = await fetchAutocomplete(seed.slice(0, 60));
    const relevant = suggestions.filter((s) => {
      const toks = coreTokensOf(s);
      return topicTokens.some((t) => toks.includes(t));
    });
    const picked = (relevant.length > 0 ? relevant : suggestions).slice(0, 8);
    return { phrasings: picked, validated: relevant.length > 0 };
  } catch {
    return { phrasings: [], validated: false };
  }
}
