"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUserId } from "@/auth";
import { db } from "@/lib/db";
import { characters, nexonKeys } from "@/lib/db/schema";
import { encryptSecret } from "@/lib/crypto";
import { ApiKeyCredential } from "@/lib/nexon/credentials";
import { getMyCharacterList } from "@/lib/nexon/endpoints";
import { NexonApiError, userMessageFor } from "@/lib/nexon/errors";
import { syncCharacters } from "@/services/characterSync";

const KeySchema = z.string().trim().min(20, "키가 너무 짧습니다").max(200);

export interface ActionResult<T = undefined> {
  ok: boolean;
  message: string;
  data?: T;
}

/** 키 검증(/character/list) → 암호화 저장 → 캐릭터 동기화 */
export async function registerNexonKey(_prev: unknown, formData: FormData): Promise<ActionResult<{ characters: number; accounts: number }>> {
  const userId = await requireUserId();
  const parsed = KeySchema.safeParse(formData.get("apiKey"));
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "입력 오류" };
  const key = parsed.data;

  // 검증용 임시 크레덴셜 (캐시 스코프 분리)
  const probe = new ApiKeyCredential(`probe:${userId}`, key, 5);
  let accountIds: string[];
  try {
    const list = await getMyCharacterList(probe, true);
    accountIds = (list.account_list ?? []).map((a) => a.account_id);
  } catch (e) {
    if (e instanceof NexonApiError && e.isInvalidKey) return { ok: false, message: "유효하지 않은 API 키입니다." };
    return { ok: false, message: userMessageFor(e) };
  }

  const now = new Date().toISOString();
  await db
    .insert(nexonKeys)
    .values({ userId, encKey: encryptSecret(key, userId), keyHint: key.slice(-4), status: "active", accountIds, lastOkAt: now, lastError: null, createdAt: now, updatedAt: now })
    .onConflictDoUpdate({
      target: nexonKeys.userId,
      set: { encKey: encryptSecret(key, userId), keyHint: key.slice(-4), status: "active", accountIds, lastOkAt: now, lastError: null, updatedAt: now },
    });

  let synced = 0;
  try {
    const r = await syncCharacters(userId, new ApiKeyCredential(`user:${userId}`, key, 5), true);
    synced = r.total;
  } catch (e) {
    return { ok: true, message: `키 저장됨. 캐릭터 동기화 실패: ${userMessageFor(e)}` };
  }
  revalidatePath("/me");
  revalidatePath("/settings/nexon-key");
  return { ok: true, message: `키 저장 완료. 캐릭터 ${synced}개 연동.`, data: { characters: synced, accounts: accountIds.length } };
}

export async function deleteNexonKey(): Promise<ActionResult> {
  const userId = await requireUserId();
  await db.delete(nexonKeys).where(eq(nexonKeys.userId, userId));
  // 캐릭터 소유권은 유지 (기록 보존). 원하면 별도 액션으로 해제.
  revalidatePath("/settings/nexon-key");
  revalidatePath("/me");
  return { ok: true, message: "키를 삭제했습니다. 캐릭터 기록은 유지됩니다." };
}

export async function unlinkAllCharacters(): Promise<ActionResult> {
  const userId = await requireUserId();
  await db.update(characters).set({ ownerUserId: null }).where(eq(characters.ownerUserId, userId));
  revalidatePath("/me");
  return { ok: true, message: "모든 캐릭터 연결을 해제했습니다." };
}
