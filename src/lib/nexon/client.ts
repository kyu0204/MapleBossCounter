import "server-only";
import type { NexonCredential } from "./credentials";
import { NexonApiError } from "./errors";
import { queueFor } from "./rateLimit";
import { cacheGet, cacheKey, cacheSet } from "./cache";

export const NEXON_BASE = "https://open.api.nexon.com";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export interface NxOptions {
  /** 캐시 TTL(ms). 0 이면 캐시 안 함 */
  ttlMs?: number;
  /** 캐시 스코프. 공개 데이터는 'public' 으로 두면 크레덴셜 무관 공유. 기본: cred.id */
  cacheScope?: string;
  /** true 면 캐시 무시하고 새로 받아 캐시 갱신 */
  force?: boolean;
  /** 00007 재시도 횟수 (기본 2) */
  retry?: number;
}

/**
 * 넥슨 Open API 호출 (프로토타입 nx 포팅).
 * 캐시 → 크레덴셜별 큐 → fetch → 에러 매핑 → 캐시 저장.
 */
export async function nx<T = unknown>(
  cred: NexonCredential,
  endpoint: string,
  params: Record<string, string> = {},
  opts: NxOptions = {},
): Promise<T> {
  const ttl = opts.ttlMs ?? 0;
  const key = ttl > 0 ? cacheKey(opts.cacheScope ?? cred.id, endpoint, params) : null;
  if (key && !opts.force) {
    const hit = cacheGet<T>(key);
    if (hit !== undefined) return hit;
  }

  const qs = new URLSearchParams(params).toString();
  const url = `${NEXON_BASE}${endpoint}${qs ? "?" + qs : ""}`;
  const headers = await cred.headers();
  let retry = opts.retry ?? 2;

  const run = async (): Promise<T> => {
    const res = await fetch(url, { headers, cache: "no-store" });
    const body = (await res.json().catch(() => ({}))) as { error?: { name?: string; message?: string } };
    if (!res.ok) {
      const code = body?.error?.name ?? String(res.status);
      const message = body?.error?.message ?? res.statusText;
      const err = new NexonApiError(code, message, endpoint, res.status);
      if (err.isThrottled && retry > 0) {
        retry--;
        await sleep(1200);
        return run();
      }
      if (err.isInvalidKey && cred.onAuthError) await cred.onAuthError(code, message);
      throw err;
    }
    return body as T;
  };

  const result = (await queueFor(cred.id, cred.ratePerSec).add(run)) as T;
  if (key) cacheSet(key, result, ttl);
  return result;
}
