import "server-only";
import cron from "node-cron";
import { runJob, type JobName } from "./runner";

const TZ = "Asia/Seoul";

/** 서버 프로세스 안에서 크론 등록. instrumentation.ts 에서 1회 호출. */
export function startJobs() {
  const jobs: [string, JobName][] = [
    ["30 23 * * 3", "weekly_snapshot_realtime"], // 수 23:30 리셋 전 안전본
    ["0 4 * * 4", "weekly_snapshot_backfill"], // 목 04:00 date=수요일 권위본
    ["0 5 * * 4", "weekly_power_refresh"], // 목 05:00 전투력 갱신
    ["0 * * * *", "cache_sweep"],
  ];
  for (const [expr, name] of jobs) {
    cron.schedule(expr, () => void runJob(name).catch((e) => console.error(`[jobs] ${name} failed`, e)), { timezone: TZ });
  }
  console.log(`[jobs] scheduled ${jobs.length} jobs (${TZ})`);
}
