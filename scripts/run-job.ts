/**
 * 잡 수동 실행: npm run job -- weekly_snapshot_backfill
 * 서버 프로세스 없이 DB 에 직접 붙어 실행한다.
 */
import "./_bootstrap";

async function main() {
  const name = process.argv[2];
  const { JOB_NAMES, runJob } = await import("../src/jobs/runner");
  if (!name || !(JOB_NAMES as readonly string[]).includes(name)) {
    console.error(`사용법: npm run job -- <${JOB_NAMES.join("|")}>`);
    process.exit(1);
  }
  const r = await runJob(name as (typeof JOB_NAMES)[number]);
  console.log(JSON.stringify(r, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
