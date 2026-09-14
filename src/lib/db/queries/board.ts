import "server-only";
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { applications, bossClears, characters, parties, partyMembers, posts, schedulerSnapshots, users, type Application, type Post } from "@/lib/db/schema";
import { thisWeekStartKst } from "@/lib/maple/kst";

export interface PostListItem extends Post {
  authorName: string | null;
  accepted: number;
  pending: number;
  partySize: number | null;
  partyName: string | null;
}

export interface PostFilter {
  boss?: string;
  world?: string;
  /** true 면 closed 포함 */
  all?: boolean;
  authorUserId?: string;
  id?: number;
}

const acceptedCount = sql<number>`(select count(*) from applications a where a.post_id = ${posts.id} and a.status = 'accepted')`;
const pendingCount = sql<number>`(select count(*) from applications a where a.post_id = ${posts.id} and a.status = 'pending')`;
const partySize = sql<number | null>`(select count(*) from party_members pm where pm.party_id = ${posts.partyId})`;

export function listPosts(f: PostFilter = {}, limit = 100): PostListItem[] {
  const conds = [];
  if (!f.all) conds.push(eq(posts.status, "open"));
  if (f.boss) conds.push(eq(posts.boss, f.boss));
  if (f.world) conds.push(eq(posts.world, f.world));
  if (f.authorUserId) conds.push(eq(posts.authorUserId, f.authorUserId));
  if (f.id != null) conds.push(eq(posts.id, f.id));
  const rows = db
    .select({ p: posts, authorName: users.name, accepted: acceptedCount, pending: pendingCount, partySize, partyName: parties.name })
    .from(posts)
    .leftJoin(users, eq(posts.authorUserId, users.id))
    .leftJoin(parties, eq(posts.partyId, parties.id))
    .where(conds.length ? and(...conds) : undefined)
    .orderBy(desc(posts.createdAt))
    .limit(limit)
    .all();
  return rows.map((r) => ({ ...r.p, authorName: r.authorName, accepted: Number(r.accepted) || 0, pending: Number(r.pending) || 0, partySize: r.p.partyId ? Number(r.partySize) || 0 : null, partyName: r.partyName }));
}

/** 게시판 필터용 월드 목록 (열린 글 기준) */
export function openPostWorlds(): string[] {
  return db
    .selectDistinct({ w: posts.world })
    .from(posts)
    .where(eq(posts.status, "open"))
    .all()
    .map((r) => r.w)
    .filter((w): w is string => !!w)
    .sort();
}

export interface WeeklyClearInfo {
  /** 이번 주 해당 보스 클리어 여부. 스냅샷 없으면 null */
  clearedThisBoss: boolean | null;
  weeklyClearCount: number | null;
  weeklyLimit: number | null;
  snapshotDate: string | null;
}

/** 지원자 표시용: 이번 주(목~) 최신 스냅샷 기준 해당 보스 클리어 여부 + 주간 n/12 */
export function weeklyClearInfo(characterId: number, boss: string, difficulty: string): WeeklyClearInfo {
  const weekStart = thisWeekStartKst();
  const snap = db
    .select({ id: schedulerSnapshots.id, weeklyClearCount: schedulerSnapshots.weeklyClearCount, weeklyLimit: schedulerSnapshots.weeklyLimit, snapshotDate: schedulerSnapshots.snapshotDate })
    .from(schedulerSnapshots)
    .where(and(eq(schedulerSnapshots.characterId, characterId), eq(schedulerSnapshots.weekStart, weekStart)))
    .orderBy(desc(schedulerSnapshots.snapshotDate), desc(schedulerSnapshots.fetchedAt))
    .get();
  if (!snap) return { clearedThisBoss: null, weeklyClearCount: null, weeklyLimit: null, snapshotDate: null };
  const row = db
    .select({ completed: bossClears.completed })
    .from(bossClears)
    .where(and(eq(bossClears.snapshotId, snap.id), eq(bossClears.boss, boss), eq(bossClears.difficulty, difficulty)))
    .get();
  return { clearedThisBoss: row ? row.completed : false, weeklyClearCount: snap.weeklyClearCount, weeklyLimit: snap.weeklyLimit, snapshotDate: snap.snapshotDate };
}

export interface ApplicantView extends Application {
  applicantName: string | null;
  character: { id: number; ocid: string; name: string; world: string | null; cls: string | null; level: number | null; imageUrl: string | null; bestPower: number | null; curPower: number | null; ownerUserId: string | null };
  clear: WeeklyClearInfo;
  worldMismatch: boolean;
}

export interface PostDetail extends PostListItem {
  isAuthor: boolean;
  party: { id: number; name: string | null; members: { id: number; nickname: string; characterId: number | null; isLeader: boolean }[] } | null;
  /** 작성자: 전체. 그 외: 본인 지원만 */
  applicants: ApplicantView[];
  /** 로그인 유저 본인의 지원 (캐릭터 여러 개 가능) */
  mine: ApplicantView[];
}

export function getPost(id: number, viewerUserId: string | null): PostDetail | null {
  const base = listPosts({ all: true, id }, 1)[0] ?? null;
  if (!base) return null;
  const isAuthor = viewerUserId != null && base.authorUserId === viewerUserId;

  let party: PostDetail["party"] = null;
  if (base.partyId) {
    const p = db.select({ id: parties.id, name: parties.name }).from(parties).where(eq(parties.id, base.partyId)).get();
    if (p) {
      const members = db
        .select({ id: partyMembers.id, nickname: partyMembers.nickname, characterId: partyMembers.characterId, isLeader: partyMembers.isLeader })
        .from(partyMembers)
        .where(eq(partyMembers.partyId, p.id))
        .orderBy(partyMembers.sortOrder, partyMembers.id)
        .all();
      party = { ...p, members };
    }
  }

  const appRows = db
    .select({ a: applications, applicantName: users.name, c: characters })
    .from(applications)
    .leftJoin(users, eq(applications.applicantUserId, users.id))
    .innerJoin(characters, eq(applications.characterId, characters.id))
    .where(eq(applications.postId, id))
    .orderBy(applications.createdAt)
    .all();
  const all: ApplicantView[] = appRows.map((r) => ({
    ...r.a,
    applicantName: r.applicantName,
    character: { id: r.c.id, ocid: r.c.ocid, name: r.c.name, world: r.c.world, cls: r.c.cls, level: r.c.level, imageUrl: r.c.imageUrl, bestPower: r.c.bestPower, curPower: r.c.curPower, ownerUserId: r.c.ownerUserId },
    clear: weeklyClearInfo(r.c.id, base.boss, base.difficulty),
    worldMismatch: !!base.world && !!r.c.world && base.world !== r.c.world,
  }));
  const mine = viewerUserId ? all.filter((a) => a.applicantUserId === viewerUserId) : [];
  return { ...base, isAuthor, party, applicants: isAuthor ? all : mine, mine };
}

export function getOwnedPost(id: number, userId: string): Post | null {
  return db.select().from(posts).where(and(eq(posts.id, id), eq(posts.authorUserId, userId))).get() ?? null;
}

/** 내가 지원한 글 목록 (상태 무관) */
export function listMyApplications(userId: string): (Application & { post: Post; characterName: string })[] {
  const rows = db
    .select({ a: applications, p: posts, characterName: characters.name })
    .from(applications)
    .innerJoin(posts, eq(applications.postId, posts.id))
    .innerJoin(characters, eq(applications.characterId, characters.id))
    .where(and(eq(applications.applicantUserId, userId), inArray(applications.status, ["pending", "accepted"])))
    .orderBy(desc(applications.createdAt))
    .all();
  return rows.map((r) => ({ ...r.a, post: r.p, characterName: r.characterName }));
}
