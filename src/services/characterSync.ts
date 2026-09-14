import "server-only";
import { and, eq, inArray, isNull, ne } from "drizzle-orm";
import { db } from "@/lib/db";
import { characters, partyMembers } from "@/lib/db/schema";
import { getMyCharacterList } from "@/lib/nexon/endpoints";
import type { NexonCredential } from "@/lib/nexon/credentials";

export interface SyncResult {
  total: number;
  created: number;
  updated: number;
  /** 월드 리프 등으로 ocid 가 바뀐 캐릭터 (이름 기준) */
  superseded: string[];
  accountIds: string[];
}

/**
 * 키 소유 계정의 캐릭터 목록을 characters 에 반영하고 owner 를 연결한다.
 * 같은 owner·같은 이름인데 ocid 가 다른 기존 row 는 superseded_by 로 연결하고 대표 전투력 기록을 이어받는다.
 * 새로 링크된 캐릭터 이름과 일치하는 party_members(character_id NULL)를 자동 연결한다.
 */
export async function syncCharacters(userId: string, cred: NexonCredential, force = false): Promise<SyncResult> {
  const list = await getMyCharacterList(cred, force);
  const now = new Date().toISOString();
  const result: SyncResult = { total: 0, created: 0, updated: 0, superseded: [], accountIds: [] };

  const mine = db.select().from(characters).where(eq(characters.ownerUserId, userId)).all();
  const byOcid = new Map(mine.map((c) => [c.ocid, c]));
  const byName = new Map(mine.filter((c) => !c.supersededBy).map((c) => [c.name, c]));
  const seenOcids = new Set<string>();

  db.transaction((tx) => {
    for (const acc of list.account_list ?? []) {
      result.accountIds.push(acc.account_id);
      for (const c of acc.character_list ?? []) {
        result.total++;
        seenOcids.add(c.ocid);
        const base = { name: c.character_name, world: c.world_name, cls: c.character_class, level: c.character_level, accountId: acc.account_id, ownerUserId: userId, updatedAt: now };
        const existing = byOcid.get(c.ocid) ?? tx.select().from(characters).where(eq(characters.ocid, c.ocid)).get();
        if (existing) {
          tx.update(characters).set(base).where(eq(characters.id, existing.id)).run();
          result.updated++;
          continue;
        }
        // 새 ocid. 같은 이름의 내 캐릭터가 있으면 리프로 간주.
        const prev = byName.get(c.character_name);
        const inserted = tx
          .insert(characters)
          .values({
            ocid: c.ocid,
            ...base,
            bestPower: prev?.bestPower ?? null,
            bestPowerAt: prev?.bestPowerAt ?? null,
            bestSetupHash: prev?.bestSetupHash ?? null,
            curSetupHashes: prev?.curSetupHashes ?? null,
          })
          .returning({ id: characters.id })
          .get();
        result.created++;
        if (prev && prev.ocid !== c.ocid) {
          tx.update(characters).set({ supersededBy: inserted.id, updatedAt: now }).where(eq(characters.id, prev.id)).run();
          tx.update(partyMembers).set({ characterId: inserted.id }).where(eq(partyMembers.characterId, prev.id)).run();
          result.superseded.push(c.character_name);
        }
      }
    }

    // 이 유저 소유였는데 목록에서 사라진 캐릭터 (삭제/타 계정 이동): owner 유지하되 hidden 처리하지 않음. 필요 시 UI 에서 판단.

    // 파티 멤버 자동 연결: 닉네임 일치 + character_id 비어 있음
    const linked = tx.select({ id: characters.id, name: characters.name }).from(characters).where(and(eq(characters.ownerUserId, userId), isNull(characters.supersededBy))).all();
    for (const ch of linked) {
      tx.update(partyMembers).set({ characterId: ch.id }).where(and(eq(partyMembers.nickname, ch.name), isNull(partyMembers.characterId))).run();
    }
  });

  return result;
}

/** 유저가 링크한(대체되지 않은) 캐릭터 목록. hidden 포함 여부 선택. */
export function listOwnedCharacters(userId: string, includeHidden = false) {
  const rows = db.select().from(characters).where(and(eq(characters.ownerUserId, userId), isNull(characters.supersededBy))).all();
  return includeHidden ? rows : rows.filter((c) => !c.hidden);
}

export function ownedCharacterByOcid(userId: string, ocid: string) {
  return db.select().from(characters).where(and(eq(characters.ownerUserId, userId), eq(characters.ocid, ocid))).get() ?? null;
}

export function charactersByIds(ids: number[]) {
  if (!ids.length) return [];
  return db.select().from(characters).where(inArray(characters.id, ids)).all();
}

export { ne };
