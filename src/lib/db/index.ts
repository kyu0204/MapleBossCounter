import "server-only";
import Database from "better-sqlite3";
import { drizzle, type BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import fs from "node:fs";
import path from "node:path";
import * as schema from "./schema";

export type DB = BetterSQLite3Database<typeof schema>;

const DB_PATH = process.env.DATABASE_PATH ?? path.join(process.cwd(), "data", "app.db");
const MIGRATIONS = path.join(process.cwd(), "drizzle");

declare global {
  var __mapleDb: DB | undefined;
}

function open(): DB {
  fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
  const sqlite = new Database(DB_PATH);
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("foreign_keys = ON");
  sqlite.pragma("busy_timeout = 5000");
  const db = drizzle(sqlite, { schema });
  if (fs.existsSync(MIGRATIONS)) migrate(db, { migrationsFolder: MIGRATIONS });
  return db;
}

// dev HMR 에서 커넥션 중복 방지
export const db: DB = globalThis.__mapleDb ?? (globalThis.__mapleDb = open());
export { schema };
