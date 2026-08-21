import { getDb } from "./db";
import type { StoredConnection } from "./providers/types";

type ConnectionDoc = StoredConnection & {
  userId: string;
};

export async function getConnections(userId: string): Promise<StoredConnection[]> {
  const db = await getDb();
  const docs = await db
    .collection<ConnectionDoc>("connections")
    .find({ userId })
    .toArray();
  return docs.map(({ _id: _drop, ...rest }) => rest);
}

export async function upsertConnection(
  userId: string,
  connection: StoredConnection
): Promise<StoredConnection[]> {
  const db = await getDb();
  await db.collection<ConnectionDoc>("connections").replaceOne(
    { userId, provider: connection.provider },
    { ...connection, userId },
    { upsert: true }
  );
  return getConnections(userId);
}

export async function deleteConnection(userId: string, provider: string): Promise<void> {
  const db = await getDb();
  await db.collection("connections").deleteOne({ userId, provider });
}
