/**
 * Next 밖(tsx)에서 src/ 모듈을 실행하기 위한 부트스트랩.
 *  - .env.local / .env 로드
 *  - "server-only" 를 no-op 으로 대체 (Next 밖에서 import 하면 throw 하기 때문)
 * 반드시 다른 src import 보다 먼저 require 되어야 한다.
 */
import { existsSync, readFileSync } from "node:fs";
import Module from "node:module";
import path from "node:path";

for (const f of [".env.local", ".env"]) {
  const p = path.join(process.cwd(), f);
  if (!existsSync(p)) continue;
  for (const line of readFileSync(p, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}

type Resolver = (request: string, ...rest: unknown[]) => unknown;
const M = Module as unknown as { _resolveFilename: Resolver };
const orig = M._resolveFilename;
M._resolveFilename = function (this: unknown, request: string, ...rest: unknown[]) {
  if (request === "server-only") return path.join(process.cwd(), "scripts", "server-only-shim.cjs");
  return orig.call(this, request, ...rest);
};
