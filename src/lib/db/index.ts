import "server-only";
import { Pool } from "@neondatabase/serverless";
import { drizzle, type NeonDatabase } from "drizzle-orm/neon-serverless";
import * as schema from "./schema";

/**
 * Postgres 연결 (Neon).
 *
 * 일반 Postgres 드라이버 대신 Neon 의 serverless 드라이버를 쓴다. 이유는 포트다.
 * Postgres 기본 포트 5432 는 회사·학교 망에서 막혀 있는 경우가 많고, 실제로 개발
 * 환경에서 ETIMEDOUT 이 났다. 이 드라이버는 WebSocket 으로 443 을 타므로 그런 망에서도
 * 붙는다. Vercel 에서도 이쪽이 권장이다.
 *
 * HTTP 드라이버(neon-http)가 아니라 WebSocket 쪽을 쓰는 이유는 트랜잭션이다.
 * 스냅샷 저장·캐릭터 동기화·지원 수락이 트랜잭션을 쓰는데 HTTP 모드는 지원하지 않는다.
 *
 * max 는 작게 잡는다. 무료 등급은 동시 연결이 빡빡하고 이 앱은 인스턴스가 하나다.
 * Neon 은 유휴 시 컴퓨트를 재워서 첫 연결이 1~2초 걸리므로 타임아웃을 넉넉히 둔다.
 *
 * 다른 Postgres(Supabase·Render 등)로 옮기려면 이 파일만 postgres-js 로 되돌리면 된다.
 * 쿼리 코드는 drizzle 이라 그대로다.
 */
export type DB = NeonDatabase<typeof schema>;

declare global {
  var __mapleDb: DB | undefined;
  var __maplePool: Pool | undefined;
}

function open(): DB {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL 이 없습니다 (Neon 연결 문자열)");
  const pool = new Pool({
    connectionString: url,
    max: Number(process.env.DATABASE_POOL_MAX ?? 5),
    idleTimeoutMillis: 20_000,
    connectionTimeoutMillis: 30_000,
  });
  globalThis.__maplePool = pool;
  return drizzle(pool, { schema });
}

// dev HMR 에서 커넥션 중복 방지
export const db: DB = globalThis.__mapleDb ?? (globalThis.__mapleDb = open());
export { schema };
