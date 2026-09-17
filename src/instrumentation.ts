declare global {
  var __mapleJobsStarted: boolean | undefined;
}

export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  // 마이그레이션 먼저. Postgres 는 비동기라 db 를 여는 시점에 못 돌린다.
  const { runMigrations } = await import("./lib/db/migrate");
  await runMigrations();

  if (process.env.CRON_ENABLED !== "1") return;
  if (globalThis.__mapleJobsStarted) return; // dev HMR 중복 방지
  globalThis.__mapleJobsStarted = true;
  const { startJobs } = await import("./jobs"); // 동적 import: edge 번들 오염 방지
  startJobs();
}
