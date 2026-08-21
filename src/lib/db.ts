import { MongoClient } from "mongodb";

const globalForMongo = globalThis as unknown as { _mongoClient?: MongoClient };

export async function getDb() {
  const uri = process.env.MONGO_URI;
  if (!uri) throw new Error("Missing MONGO_URI in environment");
  if (!globalForMongo._mongoClient) {
    globalForMongo._mongoClient = new MongoClient(uri);
    await globalForMongo._mongoClient.connect();
  }
  return globalForMongo._mongoClient.db("seo_console");
}
