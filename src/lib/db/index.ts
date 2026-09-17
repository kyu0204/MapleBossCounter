import "server-only";
import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

/**
 * Postgres 연결 (Supabase).
 *
 * Supabase 는 연결 방법이 셋이다. 어느 것을 쓰든 DATABASE_URL 하나로 받는다.
 *   - Direct(5432)      : IPv6 전용. 호스팅이 IPv6 를 안 주면 못 붙는다.
 *   - Session pooler    : IPv4 로 붙는 일반 연결. 상시 프로세스(Render)에 맞다.
 *   - Transaction pooler: 서버리스용. prepared statement 를 못 쓴다.
 * 어느 쪽에 붙어도 깨지지 않게 prepare 를 끈다 — 트랜잭션 풀러에서 필수고,
 * 세션 풀러에서는 약간 느려질 뿐이다.
 *
 * max 는 작게 잡는다. 무료 등급은 동시 연결 수가 빡빡하고, 이 앱은 인스턴스 하나다.
 */
export type DB = PostgresJsDatabase<typeof schema>;

declare global {
  var __mapleDb: DB | undefined;
  var __mapleSql: ReturnType<typeof postgres> | undefined;
}

function open(): DB {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL 이 없습니다 (Supabase 연결 문자열)");
  const client = postgres(url, {
    max: Number(process.env.DATABASE_POOL_MAX ?? 5),
    prepare: false,
    idle_timeout: 20,
    connect_timeout: 15,
  });
  globalThis.__mapleSql = client;
  return drizzle(client, { schema });
}

// dev HMR 에서 커넥션 중복 방지
export const db: DB = globalThis.__mapleDb ?? (globalThis.__mapleDb = open());
export { schema };
