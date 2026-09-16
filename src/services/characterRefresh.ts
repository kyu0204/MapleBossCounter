import "server-only";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { characters, powerLog, type Character } from "@/lib/db/schema";
import { getBasic, getCombatPower, getEquipment, getForces } from "@/lib/nexon/endpoints";
import type { NexonCredential } from "@/lib/nexon/credentials";
import { setupHashes, updateBest, type BestUpdateNote } from "@/lib/maple/power";

export const REFRESH_COOLDOWN_MS = 10 * 60e3;

export interface RefreshResult {
  character: Character;
  power: number | null;
  note: BestUpdateNote;
  wearingBest: boolean;
  skipped?: "cooldown";
}

/**
 * basic + stat + equip + symbol 조회 → 대표 전투력 갱신(updateBest) → characters/power_log 저장.
 * force=false 면 쿨다운 내 재요청은 스킵하고 DB 값 그대로 반환.
 *
 * 심볼(포스)은 파티에서 보는 값이라 같이 받는다. 캐릭터당 호출이 4회에서 5회로 늘지만
 * 전부 1시간 캐시라 화면을 다시 열 때마다 나가지는 않는다.
 */
export async function refreshCharacter(ch: Character, cred: NexonCredential, force = false): Promise<RefreshResult> {
  if (!force && ch.curPowerAt && Date.now() - Date.parse(ch.curPowerAt) < REFRESH_COOLDOWN_MS) {
    return { character: ch, power: ch.curPower, note: null, wearingBest: ch.curSetupHashes?.equipped === ch.bestSetupHash, skipped: "cooldown" };
  }
  const [basic, power, equip, forces] = await Promise.all([
    getBasic(cred, ch.ocid, force),
    getCombatPower(cred, ch.ocid, force),
    getEquipment(cred, ch.ocid, force),
    getForces(cred, ch.ocid, force),
  ]);
  const hashes = setupHashes(equip);
  const now = new Date().toISOString();

  const prevBest = ch.bestPower != null && ch.bestSetupHash ? { power: ch.bestPower, ts: ch.bestPowerAt ?? now, setupHash: ch.bestSetupHash } : null;
  let note: BestUpdateNote = null;
  let best = prevBest;
  if (power != null) {
    const r = updateBest(prevBest, power, hashes, now);
    best = r.best;
    note = r.note;
  }

  const patch = {
    name: basic.character_name,
    world: basic.world_name,
    cls: basic.character_class,
    level: basic.character_level,
    imageUrl: basic.character_image,
    curPower: power,
    curPowerAt: now,
    curSetupHashes: hashes,
    bestPower: best?.power ?? null,
    bestPowerAt: best?.ts ?? null,
    bestSetupHash: best?.setupHash ?? null,
    // 심볼 조회만 실패하면(null) 이전 값을 지킨다. 0 으로 덮으면 포스가 없는 것처럼 보인다.
    arcaneForce: forces ? forces.arcane : ch.arcaneForce,
    authenticForce: forces ? forces.authentic : ch.authenticForce,
    forceFetchedAt: forces ? now : ch.forceFetchedAt,
    basicFetchedAt: now,
    updatedAt: now,
  };
  const updated = db.transaction((tx) => {
    const row = tx.update(characters).set(patch).where(eq(characters.id, ch.id)).returning().get()!;
    if (power != null) tx.insert(powerLog).values({ characterId: ch.id, power, setupHash: hashes.equipped, measuredAt: now }).run();
    return row;
  });
  return { character: updated, power, note, wearingBest: hashes.equipped === best?.setupHash };
}

export function powerHistory(characterId: number, limit = 30) {
  return db.select().from(powerLog).where(eq(powerLog.characterId, characterId)).orderBy(powerLog.measuredAt).all().slice(-limit);
}
