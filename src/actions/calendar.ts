"use server";

import { revalidatePath } from "next/cache";
import { requireUserId } from "@/auth";
import { resolveCredential } from "@/lib/nexon/credentials";
import { userMessageFor } from "@/lib/nexon/errors";
import { staleExpiryCharacters } from "@/services/calendar";
import { EXPIRY_STALE_MS, refreshItemExpiries } from "@/services/itemExpiry";
import { refreshEventNotices } from "@/services/notices";
import { datedSnapshotKeys, fetchAndSaveDated, fetchAndSaveRealtime, latestSnapshot } from "@/services/snapshotService";
import { SCHEDULER_AUTO_STALE_MS } from "@/lib/dashboard";
import { addDays, kstDateStr, thisWeekStartKst } from "@/lib/maple/kst";
import type { ActionResult } from "./nexon-key";

/** 한 번에 만료 정보를 받을 캐릭터 수. 캐릭터당 API 4건이다. */
const EXPIRY_MAX_PER_CALL = 6;

/**
 * 한 번에 백필할 dated 스냅샷 수 상한. 캐릭터당 하루 1건이고 이번 주는 최대 6일(목~어제)이라
 * 캐릭터 5개면 30건. 넘치는 것은 다음 진입 때 이어서 받는다 — 이미 받은 날은 다시 안 나간다.
 */
const BACKFILL_MAX_PER_CALL = 36;

/**
 * 캘린더 갱신. 화면에 들어올 때 자동으로 한 번 돌고, 버튼은 쿨다운을 무시(force)한다.
 *  1. 이벤트 공지 (서버 키, 6시간)
 *  2. 이 계정 캐릭터의 실시간 스케줄러 (1시간 넘은 것만) → 오늘 칸·남은 숙제
 *  3. 이번 주 빠진 날짜의 dated 스케줄러 백필 (목~어제, 없는 날만) → "언제 잡았는지" 날짜 정확도
 *  4. 기간제 아이템 만료 (12시간 넘은 것만, 최대 6캐릭)
 * 전부 쿨다운·존재 검사가 있어 두 번째 진입부터는 대개 한 건도 안 나간다.
 */
export async function refreshCalendar(accountId: string, force = false): Promise<ActionResult<{ notices: number; schedulers: number; backfilled: number; expiries: number }>> {
  const userId = await requireUserId();
  let noticesN = 0;
  let sched = 0;
  let backfilled = 0;
  let exp = 0;
  const errors: string[] = [];

  try {
    noticesN = await refreshEventNotices(userId, force);
  } catch (e) {
    errors.push(`공지: ${userMessageFor(e)}`);
  }

  try {
    const cred = await resolveCredential({ userId, scope: "account" });
    const all = await staleExpiryCharacters(userId, accountId, 0);

    // 2. 실시간 (오늘)
    for (const c of all) {
      const at = (await latestSnapshot(c.id))?.fetchedAt;
      const stale = force || !at || Date.now() - Date.parse(at.endsWith("Z") ? at : `${at}Z`) >= SCHEDULER_AUTO_STALE_MS;
      if (!stale) continue;
      try {
        if (await fetchAndSaveRealtime(c.id, c.ocid, cred, force)) sched++;
      } catch {
        /* 개별 실패는 넘어간다 */
      }
    }

    // 3. 이번 주 빠진 날짜 백필 (목요일 ~ 어제). 넥슨은 어제~13일 전만 date 조회를 허용한다.
    const weekStart = thisWeekStartKst();
    const yesterday = kstDateStr(-1);
    if (yesterday >= weekStart) {
      const have = await datedSnapshotKeys(all.map((c) => c.id), weekStart, yesterday);
      let budget = BACKFILL_MAX_PER_CALL;
      outer: for (const c of all) {
        for (let d = weekStart; d <= yesterday; d = addDays(d, 1)) {
          if (have.has(`${c.id}|${d}`)) continue;
          if (budget-- <= 0) break outer;
          try {
            if (await fetchAndSaveDated(c.id, c.ocid, d, cred)) backfilled++;
          } catch {
            /* 개별 실패는 넘어간다 */
          }
        }
      }
    }

    // 4. 만료
    const staleExp = await staleExpiryCharacters(userId, accountId, force ? 0 : EXPIRY_STALE_MS);
    for (const c of staleExp.slice(0, EXPIRY_MAX_PER_CALL)) {
      try {
        const r = await refreshItemExpiries(c, cred, force);
        if (!r.skipped) exp++;
      } catch (e) {
        if (errors.length < 3) errors.push(`${c.name}: ${userMessageFor(e)}`);
      }
    }
  } catch (e) {
    errors.push(userMessageFor(e));
  }

  if (noticesN || sched || backfilled || exp) revalidatePath("/calendar");
  const parts = [noticesN ? `공지 ${noticesN}` : "", sched ? `스케줄러 ${sched}` : "", backfilled ? `지난 날짜 ${backfilled}` : "", exp ? `만료 ${exp}` : ""].filter(Boolean);
  const message = errors.length ? errors.join(" · ") : parts.length ? `갱신: ${parts.join(", ")}` : "최신";
  return { ok: errors.length === 0, message, data: { notices: noticesN, schedulers: sched, backfilled, expiries: exp } };
}
