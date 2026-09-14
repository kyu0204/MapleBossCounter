import "server-only";
import { and, desc, eq, isNull } from "drizzle-orm";
import { db } from "@/lib/db";
import { characters, jobRuns, nexonKeys } from "@/lib/db/schema";
import { userCredential } from "@/lib/nexon/credentials";
import { cacheSweep } from "@/lib/nexon/cache";
import { fetchAndSaveDated, fetchAndSaveRealtime } from "@/services/snapshotService";
import { refreshCharacter } from "@/services/characterRefresh";
import { kstDateStr, lastWednesdayKst } from "@/lib/maple/kst";
import { userMessageFor } from "@/lib/nexon/errors";

export const JOB_NAMES = ["weekly_snapshot_realtime", "weekly_snapshot_backfill", "daily_snapshot", "weekly_power_refresh", "cache_sweep"] as const;
export type JobName = (typeof JOB_NAMES)[number];

const LOCK_MS = 10 * 60e3;

export interface JobStats {
  users: number;
  characters: number;
  ok: number;
  skipped: number;
  failed: number;
  errors: string[];
  [k: string]: unknown;
}

/** job_runs 락 + 기록. 같은 잡이 10분 내 running 이면 스킵. */
export async function runJob(name: JobName): Promise<{ status: string; stats?: JobStats }> {
  const running = db.select().from(jobRuns).where(and(eq(jobRuns.jobName, name), eq(jobRuns.status, "running"))).orderBy(desc(jobRuns.startedAt)).get();
  if (running && Date.now() - Date.parse(running.startedAt) < LOCK_MS) return { status: "locked" };

  const run = db.insert(jobRuns).values({ jobName: name, status: "running" }).returning().get();
  try {
    const stats = await JOBS[name]();
    const status = stats.failed > 0 && stats.ok === 0 ? "failed" : stats.failed > 0 ? "partial" : "ok";
    db.update(jobRuns).set({ status, stats, finishedAt: new Date().toISOString() }).where(eq(jobRuns.id, run.id)).run();
    return { status, stats };
  } catch (e) {
    db.update(jobRuns).set({ status: "failed", error: userMessageFor(e), finishedAt: new Date().toISOString() }).where(eq(jobRuns.id, run.id)).run();
    throw e;
  }
}

function emptyStats(): JobStats {
  return { users: 0, characters: 0, ok: 0, skipped: 0, failed: 0, errors: [] };
}

/** 활성 키 유저별 (cred, 캐릭터[]) 순회 */
async function forEachLinkedCharacter(stats: JobStats, fn: (cred: NonNullable<Awaited<ReturnType<typeof userCredential>>>, ch: typeof characters.$inferSelect) => Promise<"ok" | "skipped">) {
  const keyRows = db.select({ userId: nexonKeys.userId }).from(nexonKeys).where(eq(nexonKeys.status, "active")).all();
  for (const { userId } of keyRows) {
    const cred = await userCredential(userId);
    if (!cred) continue;
    stats.users++;
    const chars = db.select().from(characters).where(and(eq(characters.ownerUserId, userId), isNull(characters.supersededBy), eq(characters.hidden, false))).all();
    for (const ch of chars) {
      stats.characters++;
      try {
        const r = await fn(cred, ch);
        stats[r]++;
      } catch (e) {
        stats.failed++;
        if (stats.errors.length < 20) stats.errors.push(`${ch.name}: ${userMessageFor(e)}`);
      }
    }
  }
}

const JOBS: Record<JobName, () => Promise<JobStats>> = {
  async weekly_snapshot_realtime() {
    const s = emptyStats();
    await forEachLinkedCharacter(s, async (cred, ch) => ((await fetchAndSaveRealtime(ch.id, ch.ocid, cred, true)) ? "ok" : "skipped"));
    return s;
  },
  async weekly_snapshot_backfill() {
    const s = emptyStats();
    const wed = lastWednesdayKst();
    s.date = wed;
    await forEachLinkedCharacter(s, async (cred, ch) => ((await fetchAndSaveDated(ch.id, ch.ocid, wed, cred)) ? "ok" : "skipped"));
    return s;
  },
  async daily_snapshot() {
    const s = emptyStats();
    const y = kstDateStr(-1);
    s.date = y;
    await forEachLinkedCharacter(s, async (cred, ch) => ((await fetchAndSaveDated(ch.id, ch.ocid, y, cred)) ? "ok" : "skipped"));
    return s;
  },
  async weekly_power_refresh() {
    const s = emptyStats();
    await forEachLinkedCharacter(s, async (cred, ch) => {
      const r = await refreshCharacter(ch, cred, true);
      return r.power == null ? "skipped" : "ok";
    });
    return s;
  },
  async cache_sweep() {
    const s = emptyStats();
    s.deleted = cacheSweep();
    s.ok = 1;
    return s;
  },
};
