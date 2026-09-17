/**
 * 마이그레이션 적용. 배포 단계에서 한 번 돌린다.
 *
 * SQLite 시절에는 DB 를 여는 순간 동기로 돌릴 수 있었지만 Postgres 는 비동기라
 * 요청 경로에서 못 부른다. 서버리스에서는 인스턴스가 여럿 뜨므로 부팅 훅에서 돌리면
 * 동시에 돌다 충돌한다. 그래서 빌드/배포 때 한 번만 돌린다.
 *
 * 사용: DATABASE_URL=... node scripts/db-migrate.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";

const url = process.env.DATABASE_URL;
if (!url) {
  // 빌드 환경에 DB 가 없을 수 있다. 거기서 실패시키면 배포가 통째로 막힌다.
  console.log("[db] DATABASE_URL 없음 — 마이그레이션 건너뜀");
  process.exit(0);
}

const folder = path.join(process.cwd(), "drizzle");
if (!fs.existsSync(folder)) {
  console.log("[db] drizzle 폴더 없음 — 건너뜀");
  process.exit(0);
}

// 마이그레이션은 한 연결로 순서대로. 풀러를 거치면 DDL 이 꼬일 수 있어 max 1 로 둔다.
const clean = (() => {
  try {
    const u = new URL(url);
    const ssl = u.searchParams.get("sslmode");
    u.search = "";
    if (ssl) u.searchParams.set("sslmode", ssl);
    return u.toString();
  } catch {
    return url;
  }
})();

const sql = postgres(clean, { max: 1, prepare: false, connect_timeout: 30 });

try {
  await migrate(drizzle(sql), { migrationsFolder: folder });
  console.log("[db] migrations up to date");
} catch (e) {
  console.error("[db] migration failed", e);
  process.exitCode = 1;
} finally {
  await sql.end();
}
