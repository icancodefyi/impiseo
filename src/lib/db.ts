import { MongoClient } from "mongodb";

const globalForMongo = globalThis as unknown as { _mongoClient?: MongoClient };

async function getClient(): Promise<MongoClient> {
  const uri = process.env.MONGO_URI;
  if (!uri) throw new Error("Missing MONGO_URI in environment");
  if (!globalForMongo._mongoClient) {
    globalForMongo._mongoClient = new MongoClient(uri);
    await globalForMongo._mongoClient.connect();
  }
  return globalForMongo._mongoClient;
}

export async function getDb() {
  const client = await getClient();
  return client.db("seo_console");
}

export type PageDoc = {
  userId: string;
  siteUrl: string;
  path: string;
  url: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
  syncedAt: Date;
  createdAt?: Date;
};

export type PageContentDoc = {
  userId: string;
  siteUrl: string;
  path: string;
  httpStatus: number;
  title: string | null;
  metaDescription: string | null;
  canonical: string | null;
  headings: { level: number; text: string }[];
  wordCount: number;
  textSample: string;
  structuredData: unknown[];
  etag?: string | null;
  lastModified?: string | null;
  fetchedAt: Date;
};

export type RecEnhancementDoc = {
  userId: string;
  siteUrl: string;
  recId: string;
  fingerprint: string;
  why: string;
  steps: string[];
  draftTitle?: string | null;
  draftMeta?: string | null;
  agentPrompt?: string;
  updatedAt: Date;
};

export type IdeaDoc = {
  id: string;
  type: "gap" | "striking-distance" | "intent-mismatch" | "winner-expansion" | "new-topic";
  topic: string;
  tokens: string[];
  queriesCount: number;
  impressions90d: number;
  clicks90d: number;
  ctr: number;
  weightedPosition: number;
  projectedClicksPerMonth: { low: number; high: number };
  confidence: "low" | "medium" | "high";
  branded: boolean;
  evidenceNote: string;
  angle?: string;
  outline?: string[];
  evidence: {
    topQueries: { query: string; impressions: number; clicks: number; position: number }[];
    coveringPages: string[];
    autocompletePhrasings: string[];
    validated: boolean;
  };
};

export type IdeaRunDoc = {
  userId: string;
  siteUrl: string;
  generatedAt: Date;
  stats: {
    windowDays: number;
    queriesAnalyzed: number;
    brandedFiltered: number;
    clustersFormed: number;
    ideasReturned: number;
    aiPackaged: boolean;
    discoveryPhrasings?: number;
    discoveryTopics?: number;
  };
  ideas: IdeaDoc[];
};

export type UserDoc = {
  userId: string;
  email: string;
  onboarded: boolean;
  siteUrl: string;
  product: {
    type?: string;
    audience?: string;
    goal?: string;
  };
  properties: { url: string; permissionLevel: string; addedAt: Date }[];
  activeProperty: string;
  createdAt: Date;
  updatedAt: Date;
};

type Collections = {
  pages: import("mongodb").Collection<PageDoc>;
  page_content: import("mongodb").Collection<PageContentDoc>;
  rec_enhancements: import("mongodb").Collection<RecEnhancementDoc>;
  users: import("mongodb").Collection<UserDoc>;
  idea_runs: import("mongodb").Collection<IdeaRunDoc>;
};

let collections: Collections | null = null;

export async function getCollections(): Promise<Collections> {
  if (collections) return collections;
  const client = await getClient();
  const db = client.db("seo_console");

  const pages = db.collection<PageDoc>("pages");
  const page_content = db.collection<PageContentDoc>("page_content");
  const rec_enhancements = db.collection<RecEnhancementDoc>("rec_enhancements");
  const users = db.collection<UserDoc>("users");
  const idea_runs = db.collection<IdeaRunDoc>("idea_runs");
  await Promise.all([
    pages.createIndex({ userId: 1, siteUrl: 1, path: 1 }, { unique: true }),
    page_content.createIndex({ userId: 1, siteUrl: 1, path: 1 }, { unique: true }),
    rec_enhancements.createIndex({ userId: 1, siteUrl: 1, recId: 1 }, { unique: true }),
    users.createIndex({ userId: 1 }, { unique: true }),
    idea_runs.createIndex({ userId: 1, siteUrl: 1 }, { unique: true }),
  ]);

  collections = { pages, page_content, rec_enhancements, users, idea_runs };
  return collections;
}
