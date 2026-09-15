"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { requireUserId } from "@/auth";
import { db } from "@/lib/db";
import { characters } from "@/lib/db/schema";
import { resolveCredential } from "@/lib/nexon/credentials";
import { userMessageFor } from "@/lib/nexon/errors";
import { listOwnedCharacters, syncCharacters } from "@/services/characterSync";
import { refreshCharacter } from "@/services/characterRefresh";
import { fetchAndSaveRealtime, latestSnapshot } from "@/services/snapshotService";
import { DASHBOARD_MIN_LEVEL, SCHEDULER_AUTO_MAX, SCHEDULER_AUTO_STALE_MS } from "@/lib/dashboard";
import type { ActionResult } from "./nexon-key";

/** 계정 캐릭터 목록 재동기화 */
export async function resyncCharacters(): Promise<ActionResult> {
  const userId = await requireUserId();
  try {
    const cred = await resolveCredential({ userId, scope: "account" });
    const r = await syncCharacters(userId, cred, true);
    revalidatePath("/me");
    return { ok: true, message: `동기화 완료: ${r.total}개 (신규 ${r.created}${r.superseded.length ? `, 리프 감지 ${r.superseded.join(", ")}` : ""})` };
  } catch (e) {
    return { ok: false, message: userMessageFor(e) };
  }
}

/**
 * 화면에 뜨는 캐릭터의 스케줄러만 일괄 갱신한다 (내 캐릭터 진입 시 자동 호출).
 *
 * 전투력은 건드리지 않는다. 전투력 갱신은 캐릭터당 API 3건이라 캐릭터가 수십 개면
 * 하루 한도(1,000건)를 몇 번 만에 태운다. 스케줄러는 1건이고, 이 화면에서 매번
 * 바뀌는 값은 보스 클리어 여부뿐이다.
 *
 * 세 가지로 비용을 묶는다.
 *  - 마지막 스냅샷이 5분(응답 캐시 TTL)보다 오래된 캐릭터만 고른다. 그래서 화면을
 *    다시 열어도 대개 한 건도 안 나간다.
 *  - 기본 표시 대상(숨김 아님 + Lv.DASHBOARD_MIN_LEVEL 이상)만 본다.
 *  - 그래도 많으면 SCHEDULER_AUTO_MAX 개에서 끊는다.
 *
 * 갱신할 것이 없으면 재검증도 하지 않는다. 안 그러면 화면이 뜰 때마다 다시 그린다.
 */
export async function refreshVisibleSchedulers(): Promise<ActionResult<{ updated: number; skipped: number }>> {
  const userId = await requireUserId();

  const stale = listOwnedCharacters(userId)
    .filter((c) => (c.level ?? 0) >= DASHBOARD_MIN_LEVEL)
    .map((c) => ({ c, at: latestSnapshot(c.id)?.fetchedAt }))
    .filter(({ at }) => !at || Date.now() - Date.parse(at.endsWith("Z") ? at : `${at}Z`) >= SCHEDULER_AUTO_STALE_MS);

  if (!stale.length) return { ok: true, message: "최신", data: { updated: 0, skipped: 0 } };

  const targets = stale.slice(0, SCHEDULER_AUTO_MAX);
  let updated = 0;
  try {
    const cred = await resolveCredential({ userId, scope: "account" });
    for (const { c } of targets) {
      // 한 캐릭터가 실패해도 나머지는 갱신한다 (키 만료처럼 전부 실패할 일은 아래에서 잡힌다)
      try {
        if (await fetchAndSaveRealtime(c.id, c.ocid, cred)) updated++;
      } catch {
        /* 개별 실패는 건너뛴다 */
      }
    }
  } catch (e) {
    return { ok: false, message: userMessageFor(e) };
  }

  if (updated > 0) revalidatePath("/me");
  return { ok: true, message: `${updated}개 갱신`, data: { updated, skipped: stale.length - targets.length } };
}

/** 캐릭터 1개: 전투력/장비 갱신 + 스케줄러 실시간 스냅샷 */
export async function refreshOne(ocid: string, force = false): Promise<ActionResult<{ note: string | null }>> {
  const userId = await requireUserId();
  const ch = db.select().from(characters).where(and(eq(characters.ownerUserId, userId), eq(characters.ocid, ocid))).get();
  if (!ch) return { ok: false, message: "내 캐릭터가 아닙니다" };
  try {
    const cred = await resolveCredential({ userId, scope: "account" });
    const r = await refreshCharacter(ch, cred, force);
    let schedNote = "";
    try {
      const s = await fetchAndSaveRealtime(ch.id, ch.ocid, cred, force);
      schedNote = s ? ` · 보스 ${s.weeklyClearCount}/${s.weeklyLimit}` : " · 스케줄러 데이터 없음";
    } catch (e) {
      schedNote = ` · 스케줄러 실패: ${userMessageFor(e)}`;
    }
    revalidatePath("/me");
    revalidatePath(`/me/characters/${ocid}`);
    const noteText = r.skipped === "cooldown" ? "쿨다운 중 (10분). 캐시 값 표시" : r.note === "new_best" ? "최대 전투력 갱신" : r.note === "invalidated" ? "세팅 변경 감지 → 최대치 재설정" : "변동 없음";
    return { ok: true, message: `${noteText}${schedNote}`, data: { note: r.note } };
  } catch (e) {
    return { ok: false, message: userMessageFor(e) };
  }
}

export async function setHidden(ocid: string, hidden: boolean): Promise<ActionResult> {
  const userId = await requireUserId();
  db.update(characters).set({ hidden, updatedAt: new Date().toISOString() }).where(and(eq(characters.ownerUserId, userId), eq(characters.ocid, ocid))).run();
  revalidatePath("/me");
  return { ok: true, message: hidden ? "숨김" : "표시" };
}
