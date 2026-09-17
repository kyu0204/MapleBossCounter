import "server-only";
import { and, desc, eq, inArray } from "drizzle-orm";
import { db } from "@/lib/db";
import { bossClears, schedulerSnapshots, type SchedulerSnapshot } from "@/lib/db/schema";
import { getScheduler } from "@/lib/nexon/endpoints";
import type { NexonCredential } from "@/lib/nexon/credentials";
import { parseSnapshot, type ParsedSnapshot, type RawScheduler } from "@/lib/maple/scheduler";
import { kstDateStr, lastWednesdayKst, weekStartOf } from "@/lib/maple/kst";

/** raw 스냅샷 저장 + boss_clears 파생 (같은 캐릭터·날짜·kind 는 덮어씀) */
export async function saveSnapshot(characterId: number, raw: RawScheduler, kind: "realtime" | "dated", snapshotDate: string): Promise<SchedulerSnapshot> {
  const parsed = parseSnapshot(raw);
  const weekStart = weekStartOf(snapshotDate);
  return db.transaction(async (tx) => {
    const [existing] = await tx
      .select({ id: schedulerSnapshots.id })
      .from(schedulerSnapshots)
      .where(and(eq(schedulerSnapshots.characterId, characterId), eq(schedulerSnapshots.snapshotDate, snapshotDate), eq(schedulerSnapshots.kind, kind)))
      .limit(1);
    if (existing) await tx.delete(schedulerSnapshots).where(eq(schedulerSnapshots.id, existing.id)); // cascade → boss_clears
    const [snap] = await tx
      .insert(schedulerSnapshots)
      .values({ characterId, snapshotDate, kind, weekStart, weeklyClearCount: parsed.weeklyClearCount, weeklyLimit: parsed.weeklyLimit, raw, fetchedAt: new Date().toISOString() })
      .returning();
    if (parsed.bosses.length) {
      await tx
        .insert(bossClears)
        .values(parsed.bosses.map((b) => ({ snapshotId: snap.id, characterId, weekStart, boss: b.boss, difficulty: b.diff, cycle: b.cycle, registered: b.registered, completed: b.completed, listOrderNo: b.order })));
    }
    return snap;
  });
}

/** 실시간 스케줄러 조회 후 오늘 날짜 realtime 스냅샷으로 저장. 미접속 등으로 데이터 없으면 null. */
export async function fetchAndSaveRealtime(characterId: number, ocid: string, cred: NexonCredential, force = false): Promise<ParsedSnapshot | null> {
  const raw = await getScheduler(cred, ocid, undefined, force);
  if (!raw || !raw.character_name) return null;
  await saveSnapshot(characterId, raw, "realtime", kstDateStr());
  return parseSnapshot(raw);
}

/** date 지정 조회 후 dated 스냅샷 저장. 기록 없으면 null. */
export async function fetchAndSaveDated(characterId: number, ocid: string, date: string, cred: NexonCredential): Promise<ParsedSnapshot | null> {
  const raw = await getScheduler(cred, ocid, date);
  if (!raw) return null;
  await saveSnapshot(characterId, raw, "dated", date);
  return parseSnapshot(raw);
}

export async function latestSnapshot(characterId: number, kind?: "realtime" | "dated"): Promise<SchedulerSnapshot | null> {
  const where = kind ? and(eq(schedulerSnapshots.characterId, characterId), eq(schedulerSnapshots.kind, kind)) : eq(schedulerSnapshots.characterId, characterId);
  const [row] = await db.select().from(schedulerSnapshots).where(where).orderBy(desc(schedulerSnapshots.snapshotDate), desc(schedulerSnapshots.fetchedAt)).limit(1);
  return row ?? null;
}

/**
 * 여러 캐릭터의 최신 스냅샷을 한 번에.
 *
 * 캐릭터마다 latestSnapshot 을 부르면 목록 화면에서 왕복이 캐릭터 수만큼 난다.
 * DB 가 파일이던 시절에는 공짜였지만 Neon 은 네트워크 너머라 그대로 지연이 된다.
 * 한 질의로 받아 와 캐릭터별 첫 행만 남긴다.
 */
export async function latestSnapshotsFor(characterIds: number[]): Promise<Map<number, SchedulerSnapshot>> {
  const out = new Map<number, SchedulerSnapshot>();
  if (!characterIds.length) return out;
  const rows = await db
    .select()
    .from(schedulerSnapshots)
    .where(inArray(schedulerSnapshots.characterId, characterIds))
    .orderBy(desc(schedulerSnapshots.snapshotDate), desc(schedulerSnapshots.fetchedAt));
  for (const r of rows) if (!out.has(r.characterId)) out.set(r.characterId, r);
  return out;
}

export async function snapshotOn(characterId: number, date: string): Promise<SchedulerSnapshot | null> {
  const rows = await db
    .select()
    .from(schedulerSnapshots)
    .where(and(eq(schedulerSnapshots.characterId, characterId), eq(schedulerSnapshots.snapshotDate, date)))
    .orderBy(desc(schedulerSnapshots.kind)); // 'realtime' > 'dated' 사전순이라 dated 우선하려면 반대로
  return rows.sort((a, b) => (a.kind === "dated" ? -1 : b.kind === "dated" ? 1 : 0))[0] ?? null;
}

export function parsed(snap: SchedulerSnapshot | null): ParsedSnapshot | null {
  return snap ? parseSnapshot(snap.raw as RawScheduler) : null;
}

/**
 * 플래너 상한 산정용 스냅샷 쌍: 이번 주 최신 + 지난 수요일(없으면 그 주 아무 스냅샷).
 */
export async function ceilingSnapshots(characterId: number): Promise<ParsedSnapshot[]> {
  const out: ParsedSnapshot[] = [];
  const latest = await latestSnapshot(characterId);
  if (latest) out.push(parseSnapshot(latest.raw as RawScheduler));
  const lastWed = lastWednesdayKst();
  const lw =
    (await snapshotOn(characterId, lastWed)) ??
    (
      await db
        .select()
        .from(schedulerSnapshots)
        .where(and(eq(schedulerSnapshots.characterId, characterId), eq(schedulerSnapshots.weekStart, weekStartOf(lastWed))))
        .orderBy(desc(schedulerSnapshots.snapshotDate))
        .limit(1)
    )[0];
  if (lw && lw.id !== latest?.id) out.push(parseSnapshot(lw.raw as RawScheduler));
  return out;
}
