"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireUserId } from "@/auth";
import { db } from "@/lib/db";
import { characters, parties, partyMembers } from "@/lib/db/schema";
import { DIFFICULTIES } from "@/lib/maple/bossKey";
import { crystalPrice } from "@/lib/maple/prices";
import { kstDateStr } from "@/lib/maple/kst";
import { getOwnedParty } from "@/lib/db/queries/parties";
import { ensureCharacterByName } from "@/services/characterLookup";
import type { ActionResult } from "./nexon-key";

const PartySchema = z.object({
  name: z.string().trim().max(40).optional().or(z.literal("")),
  boss: z.string().trim().min(1),
  difficulty: z.enum(DIFFICULTIES as unknown as [string, ...string[]]),
  world: z.string().trim().max(20).optional().or(z.literal("")),
  scheduleNote: z.string().trim().max(100).optional().or(z.literal("")),
  memo: z.string().trim().max(500).optional().or(z.literal("")),
  members: z.array(z.string().trim().min(1).max(20)).min(1).max(6),
  leader: z.string().trim().optional().or(z.literal("")),
});
export type PartyInput = z.infer<typeof PartySchema>;

/** 멤버 칩 입력용: 닉네임 조회 결과 */
export async function resolveNickname(nickname: string): Promise<ActionResult<{ name: string; world: string | null; level: number | null; cls: string | null; linked: boolean }>> {
  const userId = await requireUserId();
  const n = nickname.trim();
  if (!n) return { ok: false, message: "닉네임을 입력하세요" };
  const found = await ensureCharacterByName(userId, n);
  if (!found) return { ok: false, message: "캐릭터를 찾을 수 없습니다 (닉네임 확인 또는 잠시 후 재시도)" };
  const c = db.select().from(characters).where(eq(characters.id, found.id)).get()!;
  return { ok: true, message: "확인", data: { name: c.name, world: c.world, level: c.level, cls: c.cls, linked: c.ownerUserId != null } };
}

async function writeMembers(partyId: number, userId: string, members: string[], leader: string | undefined) {
  db.delete(partyMembers).where(eq(partyMembers.partyId, partyId)).run();
  const seen = new Set<string>();
  let order = 0;
  for (const nick of members) {
    if (seen.has(nick)) continue;
    seen.add(nick);
    const ch = await ensureCharacterByName(userId, nick);
    db.insert(partyMembers).values({ partyId, nickname: ch ? (db.select({ n: characters.name }).from(characters).where(eq(characters.id, ch.id)).get()?.n ?? nick) : nick, characterId: ch?.id ?? null, isLeader: leader === nick, sortOrder: order++ }).run();
  }
}

export async function createParty(input: PartyInput): Promise<ActionResult<{ id: number }>> {
  const userId = await requireUserId();
  const p = PartySchema.safeParse(input);
  if (!p.success) return { ok: false, message: p.error.issues[0]?.message ?? "입력 오류" };
  if (crystalPrice(p.data.boss, p.data.difficulty, kstDateStr()) == null) return { ok: false, message: "가격표에 없는 보스·난이도입니다" };
  const row = db
    .insert(parties)
    .values({ ownerUserId: userId, name: p.data.name || null, boss: p.data.boss, difficulty: p.data.difficulty, world: p.data.world || null, scheduleNote: p.data.scheduleNote || null, memo: p.data.memo || null })
    .returning({ id: parties.id })
    .get();
  await writeMembers(row.id, userId, p.data.members, p.data.leader || undefined);
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
    .set({ name: p.data.name || null, boss: p.data.boss, difficulty: p.data.difficulty, world: p.data.world || null, scheduleNote: p.data.scheduleNote || null, memo: p.data.memo || null, updatedAt: new Date().toISOString() })
    .where(eq(parties.id, id))
    .run();
  await writeMembers(id, userId, p.data.members, p.data.leader || undefined);
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
