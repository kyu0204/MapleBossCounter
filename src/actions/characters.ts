"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { requireUserId } from "@/auth";
import { db } from "@/lib/db";
import { characters } from "@/lib/db/schema";
import { resolveCredential } from "@/lib/nexon/credentials";
import { userMessageFor } from "@/lib/nexon/errors";
import { syncCharacters } from "@/services/characterSync";
import { refreshCharacter } from "@/services/characterRefresh";
import { fetchAndSaveRealtime } from "@/services/snapshotService";
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
