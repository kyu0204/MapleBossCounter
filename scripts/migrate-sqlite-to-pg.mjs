/**
 * 기존 SQLite 데이터를 Postgres(Supabase)로 옮긴다. 한 번만 쓰는 스크립트다.
 *
 * 사용:
 *   DATABASE_URL=postgresql://... node scripts/migrate-sqlite-to-pg.mjs [--from data/app.db] [--dry]
 *
 * 규칙
 *   - id 를 그대로 옮긴다. 파티·스냅샷·지원 글이 서로 id 로 엮여 있어서 새로 매기면 다 끊긴다.
 *     옮긴 뒤 시퀀스를 최댓값 다음으로 밀어 준다. 안 하면 다음 삽입이 중복 키로 실패한다.
 *   - 부모 먼저, 자식 나중 (외래 키 순서).
 *   - 대상 테이블이 비어 있을 때만 넣는다. 두 번 돌려도 덮어쓰지 않는다.
 *   - boolean 은 SQLite 에서 0/1 이라 그대로 넣으면 타입 오류가 난다. 바꿔서 넣는다.
 *   - json 컬럼은 SQLite 에 문자열로 들어 있다. 파싱해서 넣는다.
 */
import "./_runenv.mjs";
import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import { Pool } from "@neondatabase/serverless";

const args = process.argv.slice(2);
const dry = args.includes("--dry");
const fromIdx = args.indexOf("--from");
const SQLITE_PATH = fromIdx >= 0 ? args[fromIdx + 1] : path.join(process.cwd(), "data", "app.db");

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL 이 필요하다 (Supabase 연결 문자열)");
  process.exit(1);
}
if (!fs.existsSync(SQLITE_PATH)) {
  console.error(`SQLite 파일이 없다: ${SQLITE_PATH}`);
  process.exit(1);
}

/** [테이블, boolean 컬럼[], json 컬럼[], id 시퀀스 있는지] — 부모 먼저 */
const TABLES = [
  ['"user"', [], [], false],
  ["account", [], [], false],
  ["session", [], [], false],
  ['"verificationToken"', [], [], false],
  ["nexon_keys", [], ["account_ids"], false],
  ["characters", ["hidden"], ["cur_setup_hashes"], true],
  ["power_log", [], [], true],
  ["scheduler_snapshots", [], ["raw"], true],
  ["boss_clears", ["registered", "completed"], [], true],
  ["parties", ["repeats"], [], true],
  ["party_members", ["is_leader"], [], true],
  ["plan_configs", [], ["config"], true],
  ["api_cache", [], [], false],
  ["job_runs", [], ["stats"], true],
  ["posts", [], [], true],
  ["applications", [], [], true],
];

/** timestamp 로 바뀐 칸: SQLite 는 epoch ms 정수였다 */
const TIMESTAMP_COLS = { session: ["expires"], '"verificationToken"': ["expires"], '"user"': ["emailVerified"] };

const bare = (t) => t.replaceAll('"', "");

const sqlite = new Database(SQLITE_PATH, { readonly: true });
const pool = new Pool({ connectionString: url, max: 1, connectionTimeoutMillis: 30_000 });

function readRows(table) {
  try {
    return sqlite.prepare(`select * from ${table}`).all();
  } catch (e) {
    console.log(`  ${bare(table)}: SQLite 에 없음 — 건너뜀 (${e.message})`);
    return null;
  }
}

function convert(row, bools, jsons, timestamps) {
  const out = {};
  for (const [k, v] of Object.entries(row)) {
    if (bools.includes(k)) out[k] = v == null ? null : !!v;
    else if (jsons.includes(k)) out[k] = v == null ? null : typeof v === "string" ? JSON.parse(v) : v;
    else if (timestamps.includes(k)) out[k] = v == null ? null : new Date(Number(v));
    else out[k] = v;
  }
  return out;
}

async function main() {
  console.log(`SQLite: ${SQLITE_PATH}`);
  console.log(`Postgres: ${url.replace(/:[^:@]+@/, ":****@")}`);
  if (dry) console.log("--dry: 읽기만 한다\n");

  for (const [table, bools, jsons, hasSeq] of TABLES) {
    const rows = readRows(bare(table));
    if (rows == null) continue;
    if (!rows.length) {
      console.log(`  ${bare(table)}: 0행`);
      continue;
    }

    const { rows: [{ count }] } = await pool.query(`select count(*)::int as count from ${table}`);
    if (count > 0) {
      console.log(`  ${bare(table)}: 대상에 이미 ${count}행 있음 — 건너뜀`);
      continue;
    }

    const converted = rows.map((r) => convert(r, bools, jsons, TIMESTAMP_COLS[table] ?? []));
    if (dry) {
      console.log(`  ${bare(table)}: ${converted.length}행 (예시 키: ${Object.keys(converted[0]).join(", ")})`);
      continue;
    }

    // 한 번에 다 넣으면 파라미터 한도(65535)에 걸린다. 칸 수에 맞춰 끊는다.
    const cols = Object.keys(converted[0]);
    const chunk = Math.max(1, Math.floor(60000 / cols.length));
    const quoted = cols.map((c) => `"${c}"`).join(", ");
    for (let i = 0; i < converted.length; i += chunk) {
      const slice = converted.slice(i, i + chunk);
      const values = [];
      const params = [];
      for (const row of slice) {
        values.push(`(${cols.map((_, j) => `$${params.length + j + 1}`).join(", ")})`);
        params.push(...cols.map((c) => (row[c] !== null && typeof row[c] === "object" && !(row[c] instanceof Date) ? JSON.stringify(row[c]) : row[c])));
      }
      await pool.query(`insert into ${table} (${quoted}) values ${values.join(", ")}`, params);
    }
    console.log(`  ${bare(table)}: ${converted.length}행 이관`);

    if (hasSeq) {
      // identity 시퀀스를 최댓값 다음으로. 안 하면 다음 삽입이 중복 키로 죽는다.
      await pool.query(`select setval(pg_get_serial_sequence('${bare(table)}', 'id'), coalesce((select max(id) from ${table}), 1))`);
    }
  }

  console.log("\n이관 완료");
  await pool.end();
  sqlite.close();
}

main().catch(async (e) => {
  console.error("이관 실패:", e);
  await pool.end().catch(() => {});
  process.exit(1);
});
