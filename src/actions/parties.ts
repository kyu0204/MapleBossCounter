"use server";

import { and, eq, inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireUserId } from "@/auth";
import { db } from "@/lib/db";
import { characters, parties, partyMembers } from "@/lib/db/schema";
import { DIFFICULTIES } from "@/lib/maple/bossKey";
import { crystalPrice } from "@/lib/maple/prices";
import { kstDateStr, thisWeekStartKst } from "@/lib/maple/kst";
import { getOwnedParty } from "@/lib/db/queries/parties";
import { ensureCharacterByName } from "@/services/characterLookup";
import type { ActionResult } from "./nexon-key";

const PartySchema = z.object({
  name: z.string().trim().max(40).optional().or(z.literal("")),
  boss: z.string().trim().min(1),
  difficulty: z.enum(DIFFICULTIES as unknown as [string, ...string[]]),
  world: z.string().trim().max(20).optional().or(z.literal("")),
  /** 0=일 … 6=토. 안 정했으면 null */
  dayOfWeek: z.number().int().min(0).max(6).nullable().optional(),
  hour: z.number().int().min(0).max(23).nullable().optional(),
  minute: z.number().int().min(0).max(59).nullable().optional(),
  /** 매주 도는 고정 파티인지 */
  repeats: z.boolean().optional(),
  memo: z.string().trim().max(500).optional().or(z.literal("")),
  members: z.array(z.string().trim().min(1).max(20)).min(1).max(6),
});
export type PartyInput = z.infer<typeof PartySchema>;

/** 멤버 칩 입력용: 닉네임 조회 결과 */
export async function resolveNickname(
  nickname: string,
): Promise<ActionResult<{ name: string; world: string | null; level: number | null; cls: string | null; imageUrl: string | null; linked: boolean }>> {
  const userId = await requireUserId();
  const n = nickname.trim();
  if (!n) return { ok: false, message: "닉네임을 입력하세요" };
  const found = await ensureCharacterByName(userId, n);
  if (!found) return { ok: false, message: "캐릭터를 찾을 수 없습니다 (닉네임 확인 또는 잠시 후 재시도)" };
  const c = db.select().from(characters).where(eq(characters.id, found.id)).get()!;
  return { ok: true, message: "확인", data: { name: c.name, world: c.world, level: c.level, cls: c.cls, imageUrl: c.imageUrl, linked: c.ownerUserId != null } };
}

/** 파티장 개념은 화면에서 뺐다. is_leader 컬럼은 남겨 두되 늘 기본값(false)이다. */
async function writeMembers(partyId: number, userId: string, members: string[]) {
  db.delete(partyMembers).where(eq(partyMembers.partyId, partyId)).run();
  const seen = new Set<string>();
  let order = 0;
  for (const nick of members) {
    if (seen.has(nick)) continue;
    seen.add(nick);
    const ch = await ensureCharacterByName(userId, nick);
    db.insert(partyMembers).values({ partyId, nickname: ch ? (db.select({ n: characters.name }).from(characters).where(eq(characters.id, ch.id)).get()?.n ?? nick) : nick, characterId: ch?.id ?? null, sortOrder: order++ }).run();
  }
}

export async function createParty(input: PartyInput): Promise<ActionResult<{ id: number }>> {
  const userId = await requireUserId();
  const p = PartySchema.safeParse(input);
  if (!p.success) return { ok: false, message: p.error.issues[0]?.message ?? "입력 오류" };
  if (crystalPrice(p.data.boss, p.data.difficulty, kstDateStr()) == null) return { ok: false, message: "가격표에 없는 보스·난이도입니다" };
  const row = db
    .insert(parties)
    .values({
      ownerUserId: userId,
      name: p.data.name || null,
      boss: p.data.boss,
      difficulty: p.data.difficulty,
      world: p.data.world || null,
      dayOfWeek: p.data.dayOfWeek ?? null,
      hour: p.data.hour ?? null,
      minute: p.data.minute ?? null,
      repeats: p.data.repeats ?? true,
      // 반복이 아닌 파티의 유효 기간 판정 기준. 반복이어도 기록해 둔다.
      weekStart: thisWeekStartKst(),
      memo: p.data.memo || null,
    })
    .returning({ id: parties.id })
    .get();
  await writeMembers(row.id, userId, p.data.members);
  revalidatePath("/parties");
  revalidatePath("/planner");
  redirect(`/parties/${row.id}`);
}

export async function updateParty(id: number, input: PartyInput): Promise<ActionResult> {
  const userId = await requireUserId();
  if (!getOwnedParty(id, userId)) return { ok: false, message: "권한 없음" };
  const p = PartySchema.safeParse(input);
  if (!p.success) return { ok: false, message: p.error.issues[0]?.message ?? "입력 오류" };
  db.update(parties)
    .set({
      name: p.data.name || null,
      boss: p.data.boss,
      difficulty: p.data.difficulty,
      world: p.data.world || null,
      dayOfWeek: p.data.dayOfWeek ?? null,
      hour: p.data.hour ?? null,
      minute: p.data.minute ?? null,
      repeats: p.data.repeats ?? true,
      // 고치면 이번 주 파티로 되살린다 (지난 주 일회성 파티를 다시 쓰는 길)
      weekStart: thisWeekStartKst(),
      memo: p.data.memo || null,
      updatedAt: new Date().toISOString(),
    })
    .where(eq(parties.id, id))
    .run();
  await writeMembers(id, userId, p.data.members);
  revalidatePath("/parties");
  revalidatePath(`/parties/${id}`);
  revalidatePath("/planner");
  return { ok: true, message: "저장됨" };
}

export async function deleteParty(id: number): Promise<void> {
  const userId = await requireUserId();
  db.delete(parties).where(and(eq(parties.id, id), eq(parties.ownerUserId, userId))).run();
  revalidatePath("/parties");
  revalidatePath("/planner");
  redirect("/parties");
}

/**
 * 파티에서 내 캐릭터를 뺀다 (탈퇴).
 *
 * 파티 삭제는 만든 사람만 할 수 있다. 구성원은 자기 캐릭터만 빼고 나간다 —
 * 남은 사람들의 기록은 그대로 두고, 인원이 줄어 각자의 결정 실수령이 올라간다.
 *
 * 내 캐릭터가 여러 개 들어가 있으면 전부 뺀다. 한 파티에 내 캐릭터가 둘 이상
 * 들어갈 일은 거의 없지만, 남겨 두면 "나갔는데 아직 보인다" 가 된다.
 */
export async function leaveParty(id: number): Promise<ActionResult<{ removed: number }>> {
  const userId = await requireUserId();

  const party = db.select().from(parties).where(eq(parties.id, id)).get();
  if (!party) return { ok: false, message: "파티를 찾을 수 없습니다" };
  if (party.ownerUserId === userId) return { ok: false, message: "만든 사람은 탈퇴 대신 파티 삭제를 쓰세요" };

  // 내가 소유한 캐릭터로 연결된 멤버만 고른다. 닉네임만 적힌 멤버는 내 것이라 볼 수 없다.
  const mine = db
    .select({ id: partyMembers.id })
    .from(partyMembers)
    .innerJoin(characters, eq(partyMembers.characterId, characters.id))
    .where(and(eq(partyMembers.partyId, id), eq(characters.ownerUserId, userId)))
    .all();
  if (!mine.length) return { ok: false, message: "이 파티에 내 캐릭터가 없습니다" };

  db.delete(partyMembers)
    .where(inArray(partyMembers.id, mine.map((m) => m.id)))
    .run();
  db.update(parties).set({ updatedAt: new Date().toISOString() }).where(eq(parties.id, id)).run();

  revalidatePath("/parties");
  revalidatePath(`/parties/${id}`);
  revalidatePath("/planner");
  revalidatePath("/me");
  return { ok: true, message: `${mine.length}명 나갔습니다`, data: { removed: mine.length } };
}
