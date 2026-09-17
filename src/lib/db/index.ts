import "server-only";
import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

/**
 * Postgres 연결 (Neon / Supabase / Render — 어디든 연결 문자열만 바꾸면 된다).
 *
 * prepare 를 끈다. 트랜잭션 풀러(Supabase 6543, Neon -pooler)에서는 prepared
 * statement 가 세션에 남지 않아 깨진다. 일반 연결에서는 조금 느려질 뿐이다.
 *
 * max 는 작게 잡는다. 무료 등급은 동시 연결 수가 빡빡하고 이 앱은 인스턴스 하나다.
 *
 * Neon 은 유휴 시 컴퓨트를 재운다. 자고 있을 때 첫 연결은 깨우느라 1~2초 걸리므로
 * connect_timeout 을 넉넉히 둔다.
 */
export type DB = PostgresJsDatabase<typeof schema>;

declare global {
  var __mapleDb: DB | undefined;
  var __mapleSql: ReturnType<typeof postgres> | undefined;
}

/**
 * postgres-js 가 모르는 쿼리 파라미터를 떼어 낸다.
 *
 * Neon 이 주는 문자열에는 channel_binding 처럼 이 드라이버가 해석하지 못하는 것이
 * 붙어 온다. 그대로 넘기면 연결 옵션으로 잘못 읽혀 죽는다. sslmode 만 남긴다.
 */
function cleanUrl(raw: string): string {
  try {
    const u = new URL(raw);
    const keep = new Map<string, string>();
    const ssl = u.searchParams.get("sslmode");
    if (ssl) keep.set("sslmode", ssl);
    u.search = "";
    for (const [k, v] of keep) u.searchParams.set(k, v);
    return u.toString();
  } catch {
    return raw; // URL 로 안 읽히면 드라이버에 그대로 맡긴다
  }
}

function open(): DB {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL 이 없습니다 (Postgres 연결 문자열)");
  const client = postgres(cleanUrl(url), {
    max: Number(process.env.DATABASE_POOL_MAX ?? 5),
    prepare: false,
    idle_timeout: 20,
    connect_timeout: 30,
  });
  globalThis.__mapleSql = client;
  return drizzle(client, { schema });
}

// dev HMR 에서 커넥션 중복 방지
export const db: DB = globalThis.__mapleDb ?? (globalThis.__mapleDb = open());
export { schema };
