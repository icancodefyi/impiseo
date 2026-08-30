import { createHash, randomBytes } from "node:crypto";
import { getCollections } from "./db";

const KEY_PREFIX = "imp";

export function hashSecret(secret: string): string {
  return createHash("sha256").update(secret).digest("hex");
}

export function generateApiKey(): { prefix: string; secret: string; full: string } {
  const prefix = randomBytes(3).toString("hex").toLowerCase();
  const secret = randomBytes(18).toString("base64url");
  return { prefix, secret, full: `${KEY_PREFIX}_${prefix}_${secret}` };
}

/**
 * Creates an API key in the same `api_keys` collection the impiseo-mcp server
 * validates against, so a key made here works verbatim as a Bearer token on
 * the MCP endpoint. Only the sha256 hash is stored; the full key is returned
 * exactly once.
 */
export async function createApiKey(opts: {
  userId: string;
  name: string;
}): Promise<{ full: string; keyId: string; name: string; prefix: string; createdAt: Date }> {
  const { api_keys } = await getCollections();
  const { prefix, full } = generateApiKey();
  const keyHash = hashSecret(full);
  const now = new Date();
  await api_keys.insertOne({
    userId: opts.userId,
    name: opts.name,
    keyHash,
    prefix,
    createdAt: now,
  });
  return { full, keyId: prefix, name: opts.name, prefix, createdAt: now };
}

export async function listApiKeys(userId: string) {
  const { api_keys } = await getCollections();
  const docs = await api_keys.find({ userId }).sort({ createdAt: -1 }).toArray();
  return docs.map(({ _id: _oid, keyHash: _hash, ...rest }) => ({
    keyId: String(_oid),
    prefix: rest.prefix,
    name: rest.name,
    createdAt: rest.createdAt,
    lastUsedAt: rest.lastUsedAt ?? null,
  }));
}

export async function revokeApiKey(userId: string, prefix: string) {
  const { api_keys } = await getCollections();
  const { deletedCount } = await api_keys.deleteOne({ userId, prefix });
  return deletedCount > 0;
}

/** True when `fullKey` is a live key owned by `userId` (checked by hash). */
export async function keyBelongsToUser(fullKey: string, userId: string): Promise<boolean> {
  const { api_keys } = await getCollections();
  const doc = await api_keys.findOne({ userId, keyHash: hashSecret(fullKey) });
  return Boolean(doc);
}