export function encodeRecId(id: string): string {
  return Buffer.from(id, "utf8").toString("base64url");
}

export function decodeRecId(param: string): string | null {
  try {
    const decoded = Buffer.from(param, "base64url").toString("utf8");
    return decoded.includes("::") ? decoded : null;
  } catch {
    return null;
  }
}
