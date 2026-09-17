/**
 * .env.local / .env 를 읽어 process.env 에 얹는다.
 *
 * tsx 를 거치는 스크립트는 _bootstrap.ts 가 해 주지만, 순수 .mjs 스크립트
 * (db-migrate, migrate-sqlite-to-pg)는 스스로 읽어야 한다. import 하면 끝난다.
 * 이미 들어 있는 값은 덮지 않는다 — CI 에서 넘긴 값이 우선이다.
 */
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

for (const f of [".env.local", ".env"]) {
  const p = path.join(process.cwd(), f);
  if (!existsSync(p)) continue;
  for (const line of readFileSync(p, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}
