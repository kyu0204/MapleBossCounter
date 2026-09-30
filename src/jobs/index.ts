import "server-only";
import cron from "node-cron";
import { runJob, type JobName } from "./runner";

const TZ = "Asia/Seoul";

/** 서버 프로세스 안에서 크론 등록. instrumentation.ts 에서 1회 호출. */
export function startJobs() {
  const jobs: [string, JobName][] = [
    ["30 23 * * 3", "weekly_snapshot_realtime"], // 수 23:30 리셋 전 안전본
    ["0 4 * * 4", "weekly_snapshot_backfill"], // 목 04:00 date=수요일 권위본
    ["5 0 * * 4", "party_cleanup"], // 목 00:05 "이번 주만" 파티 삭제 (리셋 직후)
    ["0 5 * * 4", "weekly_power_refresh"], // 목 05:00 전투력 갱신
    ["0 6 * * 4", "item_expiry_refresh"], // 목 06:00 기간제 아이템 만료일 (캘린더)
    ["0 9 * * *", "notice_refresh"], // 매일 09:00 이벤트 공지 (캘린더)
    ["0 * * * *", "cache_sweep"],
  ];
  for (const [expr, name] of jobs) {
    cron.schedule(expr, () => void runJob(name).catch((e) => console.error(`[jobs] ${name} failed`, e)), { timezone: TZ });
  }
  console.log(`[jobs] scheduled ${jobs.length} jobs (${TZ})`);
}
