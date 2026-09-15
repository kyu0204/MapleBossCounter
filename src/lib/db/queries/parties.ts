import "server-only";
import { and, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { characters, parties, partyMembers, type Party, type PartyMember } from "@/lib/db/schema";
import { isPartyExpired } from "@/lib/maple/partySchedule";

export interface PartyWithMembers extends Party {
  members: (PartyMember & { linkedName: string | null; linkedWorld: string | null; linkedLevel: number | null; linkedImage: string | null; ownerUserId: string | null })[];
  size: number;
  isOwner: boolean;
  /** 반복이 아닌데 만든 주가 지난 파티. 인원 계산에서 빠지고 목록에서도 따로 모인다. */
  expired: boolean;
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
  return rows.map((p) => {
    const ms = members
      .filter((x) => x.m.partyId === p.id)
      .map((x) => ({ ...x.m, linkedName: x.linkedName, linkedWorld: x.linkedWorld, linkedLevel: x.linkedLevel, linkedImage: x.linkedImage, ownerUserId: x.ownerUserId }));
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
