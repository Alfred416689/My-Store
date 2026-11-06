import { MongoClient, type Db } from "mongodb";

export class MongoConfigurationError extends Error {
  constructor() {
    super("MONGODB_URI is not configured.");
    this.name = "MongoConfigurationError";
  }
}

export function getMongoConnectionErrorMessage(error: unknown, fallback: string) {
  if (error instanceof MongoConfigurationError) {
    return "MongoDB is not configured. Copy .env.example to .env.local, add your MongoDB connection string as MONGODB_URI, and restart the app.";
  }

  return fallback;
}

declare global {
  var mongoClientPromise: Promise<MongoClient> | undefined;
  var mongoDatabaseCache: WeakMap<MongoClient, Map<string, Db>> | undefined;
}

function getMongoClient() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new MongoConfigurationError();
  }

  if (!globalThis.mongoClientPromise) {
    globalThis.mongoClientPromise = new MongoClient(uri).connect().catch((error: unknown) => {
      globalThis.mongoClientPromise = undefined;
      throw error;
    });
  }

  return globalThis.mongoClientPromise;
}

export async function getDatabase() {
  const client = await getMongoClient();
  const databaseName = process.env.MONGODB_DB || "shillong1";
  globalThis.mongoDatabaseCache ??= new WeakMap<MongoClient, Map<string, Db>>();

  let databases = globalThis.mongoDatabaseCache.get(client);
  if (!databases) {
    databases = new Map<string, Db>();
    globalThis.mongoDatabaseCache.set(client, databases);
  }

  let database = databases.get(databaseName);
  if (!database) {
    database = client.db(databaseName);
    databases.set(databaseName, database);
  }
  return database;
}
