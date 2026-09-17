import "server-only";
import type { Character } from "@/lib/db/schema";
import { SlidingWindowLimiter } from "@/lib/limiter";
import { resolveCredential } from "@/lib/nexon/credentials";
import { userMessageFor } from "@/lib/nexon/errors";
import { characterById, ensureCharacterByName } from "./characterLookup";
import { REFRESH_COOLDOWN_MS, refreshCharacter } from "./characterRefresh";

/** /lookup IP 리밋: 분당 20회 (DB 히트 포함). API 쿼터는 refreshCharacter 쿨다운 + 캐시 TTL 로 별도 보호. */
const ipLimiter = new SlidingWindowLimiter(20, 60e3);

export const NICKNAME_RE = /^[가-힣A-Za-z0-9]{2,12}$/;

export type LookupResult =
  | { status: "ok"; character: Character; refreshed: boolean; note: string | null }
  | { status: "invalid" }
  | { status: "limited"; retryAfterSec: number }
  | { status: "notfound" };

/**
 * 공개 캐릭터 조회. 공개 엔드포인트(/id /basic /stat /item-equipment)만 사용.
 * 로그인 유저면 그 유저 키로(쿼터 분산), 아니면 서버 키.
 */
export async function lookupCharacter(rawName: string, opts: { userId: string | null; ip: string }): Promise<LookupResult> {
  const name = rawName.trim();
  if (!NICKNAME_RE.test(name)) return { status: "invalid" };
  if (!ipLimiter.allow(opts.ip)) return { status: "limited", retryAfterSec: Math.ceil(ipLimiter.retryAfterMs(opts.ip) / 1000) };

  const found = await ensureCharacterByName(opts.userId, name);
  if (!found) return { status: "notfound" };
  let ch = await characterById(found.id);
  if (!ch) return { status: "notfound" };

  let refreshed = false;
  let note: string | null = null;
  const stale = !ch.curPowerAt || Date.now() - Date.parse(ch.curPowerAt) >= REFRESH_COOLDOWN_MS;
  if (stale) {
    try {
      const cred = await resolveCredential({ userId: opts.userId, scope: "public" });
      const r = await refreshCharacter(ch, cred, false);
      ch = r.character;
      refreshed = r.skipped !== "cooldown";
      note = r.note === "new_best" ? "최대 전투력 갱신" : r.note === "invalidated" ? "세팅 변경 감지" : null;
    } catch (e) {
      note = `갱신 실패: ${userMessageFor(e)}`;
    }
  }
  return { status: "ok", character: ch, refreshed, note };
}
