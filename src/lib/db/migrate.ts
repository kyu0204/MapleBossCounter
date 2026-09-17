import "server-only";
import fs from "node:fs";
import path from "node:path";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { db } from "./index";

/**
 * 마이그레이션을 서버 부팅 때 한 번 적용한다.
 *
 * SQLite 시절에는 db 를 여는 순간 동기로 돌릴 수 있었지만 Postgres 는 비동기라
 * 요청 경로에서 부를 수 없다. instrumentation 의 register() 에서 부른다.
 * drizzle 이 적용 이력 테이블을 두므로 여러 번 불려도 안전하다.
 *
 * 인스턴스가 하나라는 전제다 (Render 무료 = 프로세스 1개). 여러 개면 동시에 돌다
 * 충돌할 수 있어 배포 단계에서 따로 돌려야 한다.
 */
let done: Promise<void> | null = null;

export function runMigrations(): Promise<void> {
  if (done) return done;
  const folder = path.join(process.cwd(), "drizzle");
  if (!fs.existsSync(folder)) return (done = Promise.resolve());
  done = migrate(db, { migrationsFolder: folder }).then(
    () => console.log("[db] migrations up to date"),
    (e) => {
      console.error("[db] migration failed", e);
      throw e;
    },
  );
  return done;
}
