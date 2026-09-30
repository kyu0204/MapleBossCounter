import "server-only";
import { and, eq, gte, inArray, lte } from "drizzle-orm";
import { db } from "@/lib/db";
import { characters, itemExpiries, type Character, type ItemExpiry } from "@/lib/db/schema";
import type { NexonCredential } from "@/lib/nexon/credentials";
import { getAndroidEquipment, getCashItems, getEquipment, getPetEquipment } from "@/lib/nexon/endpoints";
import { collectExpiries } from "@/lib/maple/expiry";

/** 이 시간 안에 받은 적 있으면 다시 안 받는다. 기간제 아이템은 하루에 몇 번 안 바뀐다. */
export const EXPIRY_STALE_MS = 12 * 3600e3;

/**
 * 캐릭터 하나의 기간제 아이템 만료일을 받아 item_expiries 를 통째로 갈아 넣는다.
 * 캐릭터당 API 4건(캐시·펫·안드로이드·장비). 장비는 전투력 갱신과 캐시를 같이 쓴다.
 * force=false 면 12시간 안에 받은 캐릭터는 건너뛴다.
 */
export async function refreshItemExpiries(ch: Character, cred: NexonCredential, force = false): Promise<{ rows: number; skipped?: "fresh" }> {
  if (!force && ch.expiryFetchedAt && Date.now() - Date.parse(ch.expiryFetchedAt) < EXPIRY_STALE_MS) return { rows: 0, skipped: "fresh" };

  // 한 종류가 실패해도(안드로이드 없음 등) 나머지는 살린다
  const safe = async <T>(p: Promise<T>): Promise<T | null> => p.catch(() => null);
  const [cash, pet, android, equip] = await Promise.all([
    safe(getCashItems(cred, ch.ocid, force)),
    safe(getPetEquipment(cred, ch.ocid, force)),
    safe(getAndroidEquipment(cred, ch.ocid, force)),
    safe(getEquipment(cred, ch.ocid, false)),
  ]);
  const rows = collectExpiries({ cash, pet, android, equip });
  const now = new Date().toISOString();

  await db.transaction(async (tx) => {
    await tx.delete(itemExpiries).where(eq(itemExpiries.characterId, ch.id));
    if (rows.length) await tx.insert(itemExpiries).values(rows.map((r) => ({ characterId: ch.id, source: r.source, slot: r.slot, name: r.name, icon: r.icon, expireAt: r.expireAt, fetchedAt: now })));
    await tx.update(characters).set({ expiryFetchedAt: now }).where(eq(characters.id, ch.id));
  });
  return { rows: rows.length };
}

/** 여러 캐릭터의 만료 항목을 [fromIso, toIso] 범위로 */
export async function listExpiries(characterIds: number[], fromIso: string, toIso: string): Promise<ItemExpiry[]> {
  if (!characterIds.length) return [];
  return db
    .select()
    .from(itemExpiries)
    .where(and(inArray(itemExpiries.characterId, characterIds), gte(itemExpiries.expireAt, fromIso), lte(itemExpiries.expireAt, toIso)))
    .orderBy(itemExpiries.expireAt);
}
