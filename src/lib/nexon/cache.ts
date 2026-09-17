import "server-only";
import { createHash } from "node:crypto";
import { eq, lt } from "drizzle-orm";
import { db } from "@/lib/db";
import { apiCache } from "@/lib/db/schema";

export function cacheKey(scope: string, endpoint: string, params: Record<string, string>): string {
  const sorted = Object.keys(params).sort().map((k) => `${k}=${params[k]}`).join("&");
  return createHash("sha1").update(`${scope}|${endpoint}?${sorted}`).digest("hex");
}

export async function cacheGet<T = unknown>(key: string): Promise<T | undefined> {
  const [row] = await db.select().from(apiCache).where(eq(apiCache.cacheKey, key)).limit(1);
  if (!row) return undefined;
  if (row.expiresAt < Date.now()) {
    await db.delete(apiCache).where(eq(apiCache.cacheKey, key));
    return undefined;
  }
  return JSON.parse(row.body) as T;
}

export async function cacheSet(key: string, body: unknown, ttlMs: number): Promise<void> {
  const payload = { body: JSON.stringify(body), expiresAt: Date.now() + ttlMs };
  await db
    .insert(apiCache)
    .values({ cacheKey: key, ...payload })
    .onConflictDoUpdate({ target: apiCache.cacheKey, set: payload });
}

export async function cacheDelete(key: string): Promise<void> {
  await db.delete(apiCache).where(eq(apiCache.cacheKey, key));
}

/** 만료된 캐시 삭제. 지운 개수를 돌려준다 (잡 통계용). */
export async function cacheSweep(): Promise<number> {
  const gone = await db.delete(apiCache).where(lt(apiCache.expiresAt, Date.now())).returning({ k: apiCache.cacheKey });
  return gone.length;
}
