import "server-only";
import { and, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { bossClears, characters, parties, partyMembers, type Party, type PartyMember } from "@/lib/db/schema";
import { isPartyExpired } from "@/lib/maple/partySchedule";
import { thisWeekStartKst } from "@/lib/maple/kst";

export interface PartyWithMembers extends Party {
  members: (PartyMember & {
    linkedName: string | null;
    linkedWorld: string | null;
    linkedLevel: number | null;
    linkedImage: string | null;
    ownerUserId: string | null;
    /** 이번 주 이 파티 보스를 잡았는지. 스케줄러 기록이 없으면 null (모름) */
    cleared: boolean | null;
  })[];
  size: number;
  isOwner: boolean;
  /** 반복이 아닌데 만든 주가 지난 파티. 인원 계산에서 빠지고 목록에서도 따로 모인다. */
  expired: boolean;
}

/**
 * 구성원의 이번 주 클리어 여부.
 *
 * boss_clears 는 각 유저가 자기 캐릭터를 새로고침할 때만 쌓인다. 스케줄러 API 는
 * 키 주인의 계정 캐릭터만 주므로, 남의 캐릭터는 그 사람이 이 앱을 쓰고 새로고침해야
 * 값이 생긴다. 닉네임만 적힌 미연결 멤버는 영원히 알 수 없다 — 그래서 boolean 이 아니라
 * "모름(null)" 을 따로 둔다. 기록이 아예 없는 것과 아직 안 잡은 것은 다르다.
 *
 * 한 주에 스냅샷이 여러 장 쌓이므로 그 중 하나라도 completed 면 잡은 것으로 본다.
 * 잡은 뒤에 찍힌 스냅샷만 completed 이고 그 전 것은 아니기 때문이다.
 */
function clearStatus(characterIds: number[]): { seen: Set<number>; cleared: Set<string> } {
  const seen = new Set<number>();
  const cleared = new Set<string>();
  if (!characterIds.length) return { seen, cleared };
  const rows = db
    .select({ characterId: bossClears.characterId, boss: bossClears.boss, difficulty: bossClears.difficulty, completed: bossClears.completed })
    .from(bossClears)
    .where(and(eq(bossClears.weekStart, thisWeekStartKst()), inArray(bossClears.characterId, characterIds)))
    .all();
  for (const r of rows) {
    seen.add(r.characterId);
    if (r.completed) cleared.add(`${r.characterId}|${r.boss}|${r.difficulty}`);
  }
  return { seen, cleared };
}


function attachMembers(rows: Party[], userId: string): PartyWithMembers[] {
  if (!rows.length) return [];
  const ids = rows.map((p) => p.id);
  const members = db
    .select({
      m: partyMembers,
      linkedName: characters.name,
      linkedWorld: characters.world,
      linkedLevel: characters.level,
      linkedImage: characters.imageUrl,
      ownerUserId: characters.ownerUserId,
    })
    .from(partyMembers)
    .leftJoin(characters, eq(partyMembers.characterId, characters.id))
    .where(inArray(partyMembers.partyId, ids))
    .orderBy(partyMembers.sortOrder, partyMembers.id)
    .all();
  const { seen, cleared } = clearStatus([...new Set(members.map((x) => x.m.characterId).filter((id): id is number => id != null))]);
  return rows.map((p) => {
    const ms = members
      .filter((x) => x.m.partyId === p.id)
      .map((x) => ({
        ...x.m,
        linkedName: x.linkedName,
        linkedWorld: x.linkedWorld,
        linkedLevel: x.linkedLevel,
        linkedImage: x.linkedImage,
        ownerUserId: x.ownerUserId,
        cleared: x.m.characterId != null && seen.has(x.m.characterId) ? cleared.has(`${x.m.characterId}|${p.boss}|${p.difficulty}`) : null,
      }));
    return { ...p, members: ms, size: ms.length, isOwner: p.ownerUserId === userId, expired: isPartyExpired(p) };
  });
}

/** 내가 만든 파티 + 내 캐릭터가 멤버인 파티 */
export function listPartiesForUser(userId: string): PartyWithMembers[] {
  const memberPartyIds = db
    .select({ id: partyMembers.partyId })
    .from(partyMembers)
    .innerJoin(characters, eq(partyMembers.characterId, characters.id))
    .where(eq(characters.ownerUserId, userId))
    .all()
    .map((r) => r.id);
  const rows = db
    .select()
    .from(parties)
    .where(memberPartyIds.length ? sql`${parties.ownerUserId} = ${userId} or ${parties.id} in (${sql.join(memberPartyIds.map((i) => sql`${i}`), sql`, `)})` : eq(parties.ownerUserId, userId))
    .orderBy(parties.boss, parties.difficulty)
    .all();
  return attachMembers(rows, userId);
}

export function getParty(id: number, userId: string): PartyWithMembers | null {
  const row = db.select().from(parties).where(eq(parties.id, id)).get();
  if (!row) return null;
  return attachMembers([row], userId)[0];
}

export function getOwnedParty(id: number, userId: string): Party | null {
  return db.select().from(parties).where(and(eq(parties.id, id), eq(parties.ownerUserId, userId))).get() ?? null;
}
