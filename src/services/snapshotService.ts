import "server-only";
import { and, desc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { bossClears, schedulerSnapshots, type SchedulerSnapshot } from "@/lib/db/schema";
import { getScheduler } from "@/lib/nexon/endpoints";
import type { NexonCredential } from "@/lib/nexon/credentials";
import { parseSnapshot, type ParsedSnapshot, type RawScheduler } from "@/lib/maple/scheduler";
import { kstDateStr, lastWednesdayKst, weekStartOf } from "@/lib/maple/kst";

/** raw 스냅샷 저장 + boss_clears 파생 (같은 캐릭터·날짜·kind 는 덮어씀) */
export function saveSnapshot(characterId: number, raw: RawScheduler, kind: "realtime" | "dated", snapshotDate: string): SchedulerSnapshot {
  const parsed = parseSnapshot(raw);
  const weekStart = weekStartOf(snapshotDate);
  return db.transaction((tx) => {
    const existing = tx
      .select({ id: schedulerSnapshots.id })
      .from(schedulerSnapshots)
      .where(and(eq(schedulerSnapshots.characterId, characterId), eq(schedulerSnapshots.snapshotDate, snapshotDate), eq(schedulerSnapshots.kind, kind)))
      .get();
    if (existing) tx.delete(schedulerSnapshots).where(eq(schedulerSnapshots.id, existing.id)).run(); // cascade → boss_clears
    const snap = tx
      .insert(schedulerSnapshots)
      .values({ characterId, snapshotDate, kind, weekStart, weeklyClearCount: parsed.weeklyClearCount, weeklyLimit: parsed.weeklyLimit, raw, fetchedAt: new Date().toISOString() })
      .returning()
      .get();
    if (parsed.bosses.length) {
      tx.insert(bossClears)
        .values(parsed.bosses.map((b) => ({ snapshotId: snap.id, characterId, weekStart, boss: b.boss, difficulty: b.diff, cycle: b.cycle, registered: b.registered, completed: b.completed, listOrderNo: b.order })))
        .run();
    }
    return snap;
  });
}

/** 실시간 스케줄러 조회 후 오늘 날짜 realtime 스냅샷으로 저장. 미접속 등으로 데이터 없으면 null. */
export async function fetchAndSaveRealtime(characterId: number, ocid: string, cred: NexonCredential, force = false): Promise<ParsedSnapshot | null> {
  const raw = await getScheduler(cred, ocid, undefined, force);
  if (!raw || !raw.character_name) return null;
  saveSnapshot(characterId, raw, "realtime", kstDateStr());
  return parseSnapshot(raw);
}

/** date 지정 조회 후 dated 스냅샷 저장. 기록 없으면 null. */
export async function fetchAndSaveDated(characterId: number, ocid: string, date: string, cred: NexonCredential): Promise<ParsedSnapshot | null> {
  const raw = await getScheduler(cred, ocid, date);
  if (!raw) return null;
  saveSnapshot(characterId, raw, "dated", date);
  return parseSnapshot(raw);
}

export function latestSnapshot(characterId: number, kind?: "realtime" | "dated"): SchedulerSnapshot | null {
  const where = kind ? and(eq(schedulerSnapshots.characterId, characterId), eq(schedulerSnapshots.kind, kind)) : eq(schedulerSnapshots.characterId, characterId);
  return db.select().from(schedulerSnapshots).where(where).orderBy(desc(schedulerSnapshots.snapshotDate), desc(schedulerSnapshots.fetchedAt)).get() ?? null;
}

export function snapshotOn(characterId: number, date: string): SchedulerSnapshot | null {
  return (
    db
      .select()
      .from(schedulerSnapshots)
      .where(and(eq(schedulerSnapshots.characterId, characterId), eq(schedulerSnapshots.snapshotDate, date)))
      .orderBy(desc(schedulerSnapshots.kind)) // 'realtime' > 'dated' 사전순이라 dated 우선하려면 반대로
      .all()
      .sort((a, b) => (a.kind === "dated" ? -1 : b.kind === "dated" ? 1 : 0))[0] ?? null
  );
}

export function parsed(snap: SchedulerSnapshot | null): ParsedSnapshot | null {
  return snap ? parseSnapshot(snap.raw as RawScheduler) : null;
}

/**
 * 플래너 상한 산정용 스냅샷 쌍: 이번 주 최신 + 지난 수요일(없으면 그 주 아무 스냅샷).
 */
export function ceilingSnapshots(characterId: number): ParsedSnapshot[] {
  const out: ParsedSnapshot[] = [];
  const latest = latestSnapshot(characterId);
  if (latest) out.push(parseSnapshot(latest.raw as RawScheduler));
  const lastWed = lastWednesdayKst();
  const lw = snapshotOn(characterId, lastWed) ?? db
    .select()
    .from(schedulerSnapshots)
    .where(and(eq(schedulerSnapshots.characterId, characterId), eq(schedulerSnapshots.weekStart, weekStartOf(lastWed))))
    .orderBy(desc(schedulerSnapshots.snapshotDate))
    .get();
  if (lw && lw.id !== latest?.id) out.push(parseSnapshot(lw.raw as RawScheduler));
  return out;
}
