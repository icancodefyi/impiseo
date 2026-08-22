export function encodeRecId(id: string): string {
  const bytes = new TextEncoder().encode(id);
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function decodeRecId(param: string): string | null {
  try {
    const normalized = param.replace(/-/g, "+").replace(/_/g, "/");
    const binary = atob(normalized);
    const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
    const decoded = new TextDecoder().decode(bytes);
    return decoded.includes("::") ? decoded : null;
  } catch {
    return null;
  }
}
