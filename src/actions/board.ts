"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireUserId } from "@/auth";
import { db } from "@/lib/db";
import { applications, characters, partyMembers, posts } from "@/lib/db/schema";
import { getOwnedParty } from "@/lib/db/queries/parties";
import { getOwnedPost } from "@/lib/db/queries/board";
import { DIFFICULTIES } from "@/lib/maple/bossKey";
import { crystalPrice } from "@/lib/maple/prices";
import { kstDateStr } from "@/lib/maple/kst";
import type { ActionResult } from "./nexon-key";

const PostSchema = z.object({
  partyId: z.number().int().positive().nullable().optional(),
  boss: z.string().trim().min(1),
  difficulty: z.enum(DIFFICULTIES as unknown as [string, ...string[]]),
  world: z.string().trim().max(20).optional().or(z.literal("")),
  title: z.string().trim().min(2, "제목은 2자 이상").max(60, "제목은 60자 이하"),
  body: z.string().trim().max(1000).optional().or(z.literal("")),
  slots: z.number().int().min(1).max(5),
  minPower: z.number().int().min(0).max(100_000_000_000).nullable().optional(),
  scheduleNote: z.string().trim().max(100).optional().or(z.literal("")),
});
export type PostInput = z.infer<typeof PostSchema>;

function revalidateBoard(id?: number) {
  revalidatePath("/board");
  if (id) revalidatePath(`/board/${id}`);
}

type Validated = { error: string; data?: undefined } | { error?: undefined; data: PostInput; partyId: number | null };

async function validatePost(userId: string, input: PostInput): Promise<Validated> {
  const p = PostSchema.safeParse(input);
  if (!p.success) return { error: p.error.issues[0]?.message ?? "입력 오류" };
  if (crystalPrice(p.data.boss, p.data.difficulty, kstDateStr()) == null) return { error: "가격표에 없는 보스·난이도입니다" };
  let partyId: number | null = null;
  if (p.data.partyId) {
    const party = getOwnedParty(p.data.partyId, userId);
    if (!party) return { error: "내 파티가 아닙니다" };
    partyId = party.id;
  }
  return { data: p.data, partyId };
}

export async function createPost(input: PostInput): Promise<ActionResult<{ id: number }>> {
  const userId = await requireUserId();
  const v = await validatePost(userId, input);
  if (v.error !== undefined) return { ok: false, message: v.error };
  const d = v.data;
  const row = db
    .insert(posts)
    .values({ authorUserId: userId, partyId: v.partyId, boss: d.boss, difficulty: d.difficulty, world: d.world || null, title: d.title, body: d.body || null, slots: d.slots, minPower: d.minPower ?? null, scheduleNote: d.scheduleNote || null })
    .returning({ id: posts.id })
    .get();
  revalidateBoard(row.id);
  redirect(`/board/${row.id}`);
}

export async function updatePost(id: number, input: PostInput): Promise<ActionResult> {
  const userId = await requireUserId();
  if (!getOwnedPost(id, userId)) return { ok: false, message: "권한 없음" };
  const v = await validatePost(userId, input);
  if (v.error !== undefined) return { ok: false, message: v.error };
  const d = v.data;
  db.update(posts)
    .set({ partyId: v.partyId, boss: d.boss, difficulty: d.difficulty, world: d.world || null, title: d.title, body: d.body || null, slots: d.slots, minPower: d.minPower ?? null, scheduleNote: d.scheduleNote || null, updatedAt: new Date().toISOString() })
    .where(eq(posts.id, id))
    .run();
  revalidateBoard(id);
  return { ok: true, message: "저장됨" };
}

export async function setPostStatus(id: number, status: "open" | "closed"): Promise<void> {
  const userId = await requireUserId();
  db.update(posts).set({ status, updatedAt: new Date().toISOString() }).where(and(eq(posts.id, id), eq(posts.authorUserId, userId))).run();
  revalidateBoard(id);
}

export async function deletePost(id: number): Promise<void> {
  const userId = await requireUserId();
  db.delete(posts).where(and(eq(posts.id, id), eq(posts.authorUserId, userId))).run();
  revalidateBoard();
  redirect("/board");
}

const ApplySchema = z.object({ characterId: z.number().int().positive(), message: z.string().trim().max(300).optional().or(z.literal("")) });

export async function applyToPost(postId: number, input: z.infer<typeof ApplySchema>): Promise<ActionResult> {
  const userId = await requireUserId();
  const p = ApplySchema.safeParse(input);
  if (!p.success) return { ok: false, message: p.error.issues[0]?.message ?? "입력 오류" };
  const post = db.select().from(posts).where(eq(posts.id, postId)).get();
  if (!post) return { ok: false, message: "글이 없습니다" };
  if (post.status !== "open") return { ok: false, message: "마감된 모집입니다" };
  if (post.authorUserId === userId) return { ok: false, message: "내 글에는 지원할 수 없습니다" };
  const ch = db.select({ id: characters.id, name: characters.name }).from(characters).where(and(eq(characters.id, p.data.characterId), eq(characters.ownerUserId, userId))).get();
  if (!ch) return { ok: false, message: "내 캐릭터가 아닙니다" };
  if (post.partyId && db.select({ id: partyMembers.id }).from(partyMembers).where(and(eq(partyMembers.partyId, post.partyId), eq(partyMembers.characterId, ch.id))).get()) {
    return { ok: false, message: "이미 이 파티의 구성원입니다" };
  }

  const existing = db.select().from(applications).where(and(eq(applications.postId, postId), eq(applications.characterId, ch.id))).get();
  const now = new Date().toISOString();
  if (existing) {
    if (existing.status === "pending" || existing.status === "accepted") return { ok: false, message: "이미 지원한 캐릭터입니다" };
    db.update(applications).set({ status: "pending", message: p.data.message || null, createdAt: now, decidedAt: null }).where(eq(applications.id, existing.id)).run();
  } else {
    db.insert(applications).values({ postId, applicantUserId: userId, characterId: ch.id, message: p.data.message || null, status: "pending" }).run();
  }
  revalidateBoard(postId);
  return { ok: true, message: `${ch.name}(으)로 지원했습니다` };
}

export async function withdrawApplication(appId: number): Promise<void> {
  const userId = await requireUserId();
  const a = db.select().from(applications).where(and(eq(applications.id, appId), eq(applications.applicantUserId, userId))).get();
  if (!a || a.status === "withdrawn") return;
  db.update(applications).set({ status: "withdrawn", decidedAt: new Date().toISOString() }).where(eq(applications.id, appId)).run();
  revalidateBoard(a.postId);
}

/**
 * 작성자가 지원 수락/거절. 수락 시 연결 파티가 있으면 party_members 에 추가(닉네임 = 캐릭터명).
 * 수락 인원이 slots 에 도달하면 자동 마감.
 */
export async function decideApplication(appId: number, decision: "accepted" | "rejected"): Promise<void> {
  const userId = await requireUserId();
  const row = db
    .select({ a: applications, p: posts, characterName: characters.name })
    .from(applications)
    .innerJoin(posts, eq(applications.postId, posts.id))
    .innerJoin(characters, eq(applications.characterId, characters.id))
    .where(and(eq(applications.id, appId), eq(posts.authorUserId, userId)))
    .get();
  if (!row || row.a.status === "withdrawn") return;
  const now = new Date().toISOString();
  db.transaction((tx) => {
    tx.update(applications).set({ status: decision, decidedAt: now }).where(eq(applications.id, appId)).run();
    if (decision !== "accepted") return;
    if (row.p.partyId) {
      const count = tx.select({ n: partyMembers.id }).from(partyMembers).where(eq(partyMembers.partyId, row.p.partyId)).all().length;
      if (count < 6) {
        tx.insert(partyMembers)
          .values({ partyId: row.p.partyId, nickname: row.characterName, characterId: row.a.characterId, sortOrder: count })
          .onConflictDoNothing()
          .run();
      }
    }
    const accepted = tx.select({ id: applications.id }).from(applications).where(and(eq(applications.postId, row.p.id), eq(applications.status, "accepted"))).all().length;
    if (accepted >= row.p.slots) tx.update(posts).set({ status: "closed", updatedAt: now }).where(eq(posts.id, row.p.id)).run();
  });
  revalidateBoard(row.p.id);
  if (row.p.partyId) {
    revalidatePath("/parties");
    revalidatePath(`/parties/${row.p.partyId}`);
    revalidatePath("/planner");
  }
}
