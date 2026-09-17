import "server-only";
import { and, desc, eq, isNull } from "drizzle-orm";
import { db } from "@/lib/db";
import { characters, jobRuns, nexonKeys } from "@/lib/db/schema";
import { userCredential } from "@/lib/nexon/credentials";
import { cacheSweep } from "@/lib/nexon/cache";
import { fetchAndSaveDated, fetchAndSaveRealtime, snapshotOn } from "@/services/snapshotService";
import { refreshCharacter } from "@/services/characterRefresh";
import { purgeExpiredOneOffParties } from "@/services/partyCleanup";
import { kstDateStr, lastWednesdayKst } from "@/lib/maple/kst";
import { CHARACTER_MIN_LEVEL } from "@/lib/dashboard";
import { userMessageFor } from "@/lib/nexon/errors";

export const JOB_NAMES = ["weekly_snapshot_realtime", "weekly_snapshot_backfill", "daily_snapshot", "weekly_power_refresh", "party_cleanup", "cache_sweep"] as const;
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

/**
 * 한 번의 실행에 쓸 수 있는 시간.
 *
 * 서버리스는 함수 실행 시간이 잘린다. 잘리면 job_runs 가 running 인 채로 남아
 * 다음 실행이 10분 동안 락에 막힌다. 그래서 플랫폼이 끊기 전에 우리가 먼저 멈추고
 * 남은 수를 기록한다. 크론이 다음에 다시 부르면 이미 한 것은 건너뛰고 이어서 한다.
 *
 * 상시 서버라면 넉넉히 늘려 잡으면 한 번에 끝난다.
 */
const BUDGET_MS = Number(process.env.JOB_BUDGET_MS ?? 50_000);

/** job_runs 락 + 기록. 같은 잡이 10분 내 running 이면 스킵. */
export async function runJob(name: JobName): Promise<{ status: string; stats?: JobStats }> {
  const [running] = await db.select().from(jobRuns).where(and(eq(jobRuns.jobName, name), eq(jobRuns.status, "running"))).orderBy(desc(jobRuns.startedAt)).limit(1);
  if (running && Date.now() - Date.parse(running.startedAt) < LOCK_MS) return { status: "locked" };

  const [run] = await db.insert(jobRuns).values({ jobName: name, status: "running" }).returning();
  try {
    const stats = await JOBS[name]();
    const status = stats.failed > 0 && stats.ok === 0 ? "failed" : stats.failed > 0 ? "partial" : "ok";
    await db.update(jobRuns).set({ status, stats, finishedAt: new Date().toISOString() }).where(eq(jobRuns.id, run.id));
    return { status, stats };
  } catch (e) {
    await db.update(jobRuns).set({ status: "failed", error: userMessageFor(e), finishedAt: new Date().toISOString() }).where(eq(jobRuns.id, run.id));
    throw e;
  }
}

function emptyStats(): JobStats {
  return { users: 0, characters: 0, ok: 0, skipped: 0, failed: 0, errors: [] };
}

/**
 * 활성 키 유저별 (cred, 캐릭터[]) 순회.
 *
 * 시간 예산을 넘기면 남은 캐릭터 수를 stats.remaining 에 적고 멈춘다. 잘려서 죽는 것과
 * 달리 이 경우 job_runs 는 정상 종료로 닫히므로 다음 호출이 바로 이어받을 수 있다.
 */
async function forEachLinkedCharacter(stats: JobStats, fn: (cred: NonNullable<Awaited<ReturnType<typeof userCredential>>>, ch: typeof characters.$inferSelect) => Promise<"ok" | "skipped">) {
  const deadline = Date.now() + BUDGET_MS;
  const keyRows = await db.select({ userId: nexonKeys.userId }).from(nexonKeys).where(eq(nexonKeys.status, "active"));
  let remaining = 0;
  for (const { userId } of keyRows) {
    const cred = await userCredential(userId);
    if (!cred) continue;
    stats.users++;
    // 저레벨은 건너뛴다. 캐릭터당 API 4~5건이라 저레벨까지 돌면 하루 한도를 태운다.
    const chars = (await db.select().from(characters).where(and(eq(characters.ownerUserId, userId), isNull(characters.supersededBy), eq(characters.hidden, false)))).filter(
      (c) => (c.level ?? 0) >= CHARACTER_MIN_LEVEL,
    );
    for (const ch of chars) {
      if (Date.now() > deadline) {
        remaining++;
        continue;
      }
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
  if (remaining) stats.remaining = remaining;
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
    // 이미 받은 캐릭터는 건너뛴다. 시간 예산에 걸려 나눠 돌 때 이어서 진행되게 하는 장치다.
    await forEachLinkedCharacter(s, async (cred, ch) =>
      (await snapshotOn(ch.id, wed)) ? "skipped" : (await fetchAndSaveDated(ch.id, ch.ocid, wed, cred)) ? "ok" : "skipped",
    );
    return s;
  },
  async daily_snapshot() {
    const s = emptyStats();
    const y = kstDateStr(-1);
    s.date = y;
    await forEachLinkedCharacter(s, async (cred, ch) =>
      (await snapshotOn(ch.id, y)) ? "skipped" : (await fetchAndSaveDated(ch.id, ch.ocid, y, cred)) ? "ok" : "skipped",
    );
    return s;
  },
  /** "이번 주만" 파티 정리. 주간 리셋 직후에 돈다. */
  async party_cleanup() {
    const s = emptyStats();
    s.deleted = await purgeExpiredOneOffParties();
    s.ok = 1;
    return s;
  },
  async weekly_power_refresh() {
    const s = emptyStats();
    // 12시간 안에 이미 받은 캐릭터는 건너뛴다. 캐릭터당 API 4~5건이라 한 번에 다 돌기
    // 어렵고, 나눠 돌 때 앞에서 한 것을 또 하면 하루 한도를 태운다.
    const fresh = Date.now() - 12 * 3600e3;
    await forEachLinkedCharacter(s, async (cred, ch) => {
      if (ch.curPowerAt && Date.parse(ch.curPowerAt) > fresh) return "skipped";
      const r = await refreshCharacter(ch, cred, true);
      return r.power == null ? "skipped" : "ok";
    });
    return s;
  },
  async cache_sweep() {
    const s = emptyStats();
    s.deleted = await cacheSweep();
    s.ok = 1;
    return s;
  },
};
