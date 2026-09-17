import "server-only";
import { and, eq, isNull, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { characters, parties, partyMembers } from "@/lib/db/schema";
import { thisWeekStartKst } from "@/lib/maple/kst";

/**
 * 인원 계산에 넣을 파티인지. 반복이 아닌 파티는 만든 주가 지나면 빠진다.
 * SQL 로 거르면 주간 리셋 경계가 KST 기준이라 어긋나므로 값을 가져와 판정한다.
 */
const liveParty = (r: { repeats: boolean; weekStart: string | null }) => r.repeats || !r.weekStart || r.weekStart >= thisWeekStartKst();

/**
 * 유저의 캐릭터가 속한 파티들로 (characterId, boss, diff) → 인원 조회 함수를 만든다.
 * 파티 인원 = party_members 수. 같은 캐릭터가 같은 보스에 여러 파티면 첫 것.
 */
export async function partySizeLookup(userId: string): Promise<(characterId: number, boss: string, diff: string) => number> {
  const rows = await db
    .select({
      characterId: partyMembers.characterId,
      boss: parties.boss,
      difficulty: parties.difficulty,
      size: sql<number>`(select count(*) from party_members pm2 where pm2.party_id = ${parties.id})`,
      repeats: parties.repeats,
      weekStart: parties.weekStart,
    })
    .from(partyMembers)
    .innerJoin(parties, eq(partyMembers.partyId, parties.id))
    .innerJoin(characters, eq(partyMembers.characterId, characters.id))
    .where(eq(characters.ownerUserId, userId));
  const map = new Map<string, number>();
  for (const r of rows) {
    if (r.characterId == null || !liveParty(r)) continue;
    const k = `${r.characterId}|${r.boss}|${r.difficulty}`;
    if (!map.has(k)) map.set(k, Math.max(1, Number(r.size) || 1));
  }
  return (characterId, boss, diff) => map.get(`${characterId}|${boss}|${diff}`) ?? 1;
}

/** 캐릭터별 파티 유래 고정 픽: characterId → { "보스 diff": 인원 } */
export async function partyPicksByCharacter(userId: string): Promise<Map<number, Record<string, number>>> {
  const rows = await db
    .select({
      characterId: partyMembers.characterId,
      boss: parties.boss,
      difficulty: parties.difficulty,
      size: sql<number>`(select count(*) from party_members pm2 where pm2.party_id = ${parties.id})`,
      repeats: parties.repeats,
      weekStart: parties.weekStart,
    })
    .from(partyMembers)
    .innerJoin(parties, eq(partyMembers.partyId, parties.id))
    .innerJoin(characters, eq(partyMembers.characterId, characters.id))
    .where(eq(characters.ownerUserId, userId));
  const out = new Map<number, Record<string, number>>();
  for (const r of rows) {
    if (r.characterId == null || !liveParty(r)) continue;
    const rec = out.get(r.characterId) ?? {};
    const key = `${r.boss} ${r.difficulty}`;
    if (!(key in rec)) rec[key] = Math.max(1, Number(r.size) || 1);
    out.set(r.characterId, rec);
  }
  return out;
}

/** 닉네임으로 미연결 멤버 자동 연결 (characterSync 이후 호출용) */
export async function linkMembersByName(characterId: number, name: string): Promise<number> {
  const rows = await db
    .update(partyMembers)
    .set({ characterId })
    .where(and(eq(partyMembers.nickname, name), isNull(partyMembers.characterId)))
    .returning({ id: partyMembers.id });
  return rows.length;
}
