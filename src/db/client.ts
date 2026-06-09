import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";

let sqlite: Database.Database | null = null;
let db: ReturnType<typeof drizzle> | null = null;

export function getDb() {
  if (!sqlite) {
    sqlite = new Database(process.env.DATABASE_URL ?? "local.db");
    sqlite.pragma("foreign_keys = ON");
  }

  if (!db) {
    db = drizzle(sqlite);
  }

  return db;
}

export function resetDbForTests() {
  sqlite?.close();
  sqlite = null;
  db = null;
}
