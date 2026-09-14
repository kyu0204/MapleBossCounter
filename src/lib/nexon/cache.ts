import "server-only";
import { createHash } from "node:crypto";
import { eq, lt } from "drizzle-orm";
import { db } from "@/lib/db";
import { apiCache } from "@/lib/db/schema";

export function cacheKey(scope: string, endpoint: string, params: Record<string, string>): string {
  const sorted = Object.keys(params).sort().map((k) => `${k}=${params[k]}`).join("&");
  return createHash("sha1").update(`${scope}|${endpoint}?${sorted}`).digest("hex");
}

export function cacheGet<T = unknown>(key: string): T | undefined {
  const row = db.select().from(apiCache).where(eq(apiCache.cacheKey, key)).get();
  if (!row) return undefined;
  if (row.expiresAt < Date.now()) {
    db.delete(apiCache).where(eq(apiCache.cacheKey, key)).run();
    return undefined;
  }
  return JSON.parse(row.body) as T;
}

export function cacheSet(key: string, body: unknown, ttlMs: number): void {
  db.insert(apiCache)
    .values({ cacheKey: key, body: JSON.stringify(body), expiresAt: Date.now() + ttlMs })
    .onConflictDoUpdate({ target: apiCache.cacheKey, set: { body: JSON.stringify(body), expiresAt: Date.now() + ttlMs } })
    .run();
}

export function cacheDelete(key: string): void {
  db.delete(apiCache).where(eq(apiCache.cacheKey, key)).run();
}

export function cacheSweep(): number {
  return db.delete(apiCache).where(lt(apiCache.expiresAt, Date.now())).run().changes;
}
