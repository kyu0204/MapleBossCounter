declare global {
  var __mapleJobsStarted: boolean | undefined;
}

/**
 * 프로세스가 뜰 때 한 번 도는 훅.
 *
 * 마이그레이션은 여기서 돌리지 않는다. 서버리스(Vercel)는 요청마다 새 인스턴스가 뜰 수
 * 있어서 매번 붙잡고 돌게 되고, 여럿이 동시에 돌면 충돌한다. 배포 단계에서
 * `npm run db:migrate` 로 한 번만 돌린다 (package.json 의 vercel-build 가 이미 그렇게 한다).
 *
 * node-cron 도 서버리스에서는 의미가 없다. 프로세스가 요청 사이에 살아 있지 않기 때문이다.
 * 그 환경에서는 CRON_ENABLED=0 으로 두고 외부 크론이 /api/jobs/<이름> 을 때린다.
 * 상시 서버로 옮기면 CRON_ENABLED=1 만 켜면 예전처럼 안에서 돈다.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  if (process.env.CRON_ENABLED !== "1") return;
  if (globalThis.__mapleJobsStarted) return; // dev HMR 중복 방지
  globalThis.__mapleJobsStarted = true;
  const { startJobs } = await import("./jobs"); // 동적 import: edge 번들 오염 방지
  startJobs();
}
