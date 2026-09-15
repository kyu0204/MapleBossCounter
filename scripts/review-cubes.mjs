/**
 * 보스별 메멘토 큐브 수량을 2026-09-17 패치 이후 기준으로 계산해 출력한다. (출력만, 반영 아님)
 *
 * 계산 규칙
 *   기준값 = 나무위키 수집본(boss_rewards_raw.json) — 확인 결과 전부 패치 이전 값이다.
 *   패치 표에 있는 행 = 실버·골드를 변경값으로 덮어쓴다.
 *   패치 표에 없는 행 = 변동 없음.
 *   브론즈 에디셔널 = 패치 대상이 아니므로 그대로.
 *
 * 사용: node scripts/review-cubes.mjs
 */
import { readFileSync } from "node:fs";
import path from "node:path";

const raw = JSON.parse(readFileSync(path.join(process.cwd(), "src", "data", "boss_rewards_raw.json"), "utf8"));
const prices = JSON.parse(readFileSync(path.join(process.cwd(), "src", "data", "boss_crystal_prices.json"), "utf8"));
const tiers = JSON.parse(readFileSync(path.join(process.cwd(), "src", "data", "boss_tiers.json"), "utf8"));

const KO2EN = { 이지: "easy", 노멀: "normal", 노말: "normal", 하드: "hard", 카오스: "chaos", 익스트림: "extreme" };
const EN2KO = { easy: "이지", normal: "노멀", hard: "하드", chaos: "카오스", extreme: "익스트림" };

/**
 * 나무위키에 큐브 줄이 없어 확인이 안 되던 행의 실측값 (사용자 확인, 2026-09-15).
 * 나머지 미확인 행은 "에디셔널 큐브 없음"이 맞는 것으로 확인됨 → 0 유지.
 */
const BRONZE_OVERRIDE = {
  "검은 마법사 hard": 24,
};

/** 2026-09-17 패치: "보스 난이도" → { silver: 변경값, gold: 변경값 } */
const PATCH = {
  "데미안 hard": { silver: 0, gold: 0 },
  "스우 hard": { silver: 0, gold: 0 },
  "진 힐라 normal": { silver: 0, gold: 0 },
  "루시드 hard": { silver: 1, gold: 0 },
  "더스크 chaos": { silver: 1, gold: 0 },
  "가디언 엔젤 슬라임 chaos": { silver: 1, gold: 0 },
  "윌 hard": { silver: 1, gold: 0 },
  "듄켈 hard": { silver: 1, gold: 0 },
  "진 힐라 hard": { silver: 1, gold: 0 },
  "선택받은 세렌 normal": { silver: 2, gold: 0 },
  "벨로나 easy": { silver: 0, gold: 2 },
  "감시자 칼로스 normal": { silver: 0, gold: 3 },
  "최초의 대적자 normal": { silver: 0, gold: 3 },
  "찬란한 흉성 normal": { silver: 0, gold: 3 },
  "카링 normal": { silver: 0, gold: 3 },
  "검은 마법사 hard": { silver: 8, gold: 0 },
};

/** 수집본에서 (보스, 난이도) → 큐브 수량 (패치 이전) */
const before = {};
for (const [boss, modes] of Object.entries(raw.bosses)) {
  for (const [mode, v] of Object.entries(modes)) {
    const diff = KO2EN[mode];
    if (!diff) continue;
    const lines = (v.고정 ?? []).filter((s) => s.includes("큐브"));
    const pick = (kind) => {
      const m = lines.map((s) => s.match(new RegExp(`메멘토 ${kind} 큐브 (\\d+)개`))).find(Boolean);
      return m ? Number(m[1]) : 0;
    };
    before[`${boss} ${diff}`] = {
      silver: pick("실버"),
      gold: pick("골드"),
      bronze: pick("브론즈 에디셔널"),
      documented: lines.length > 0,
    };
  }
}

// 티어 rank 조회
const rankOf = {};
for (const [grade, stars] of Object.entries(tiers.tiers)) {
  for (const [n, list] of Object.entries(stars)) {
    for (const key of list) rankOf[key] = (tiers.rank_base[grade] ?? 0) + Number(n);
  }
}

const nonWeekly = new Set([...(prices._meta.daily ?? []), ...(prices._meta.monthly ?? [])]);
const rows = [];
for (const [boss, diffs] of Object.entries(prices.prices)) {
  for (const diff of Object.keys(diffs)) {
    const key = `${boss} ${diff}`;
    const weekly = !nonWeekly.has(key);
    const b = before[key];
    const p = PATCH[key];
    if (!b && !p) continue; // 수집본에도 패치표에도 없으면 큐브 정보 자체가 없다
    const bronze = BRONZE_OVERRIDE[key] ?? b?.bronze ?? 0;
    const after = {
      silver: p ? p.silver : (b?.silver ?? 0),
      gold: p ? p.gold : (b?.gold ?? 0),
      bronze,
    };
    rows.push({
      key, boss, diff, weekly,
      rank: rankOf[key] ?? 0,
      before: { ...(b ?? { silver: 0, gold: 0, documented: false }), bronze },
      after,
      patched: !!p,
      docGap: false, // 미확인 행은 사용자 확인으로 해소됨
    });
  }
}
rows.sort((a, b) => b.rank - a.rank || a.boss.localeCompare(b.boss));

const fmt = (c) => `실버 ${c.silver} / 골드 ${c.gold} / 브론즈에디 ${c.bronze}`;
console.log("2026-09-17 패치 이후 기준 메멘토 큐브 수량 (티어 높은 순). * = 패치로 변경된 행\n");
for (const r of rows) {
  if (!r.after.silver && !r.after.gold && !r.after.bronze) continue; // 큐브를 안 주는 행은 생략
  const mark = r.patched ? "*" : " ";
  const changed = r.patched && (r.before.silver !== r.after.silver || r.before.gold !== r.after.gold)
    ? `   (이전: 실버 ${r.before.silver} / 골드 ${r.before.gold})`
    : "";
  const w = r.weekly ? "" : " [주간 아님]";
  console.log(`${mark} ${(r.boss + " " + EN2KO[r.diff]).padEnd(22)} ${fmt(r.after)}${changed}${w}`);
}

const giving = rows.filter((r) => r.after.silver || r.after.gold || r.after.bronze);
console.log(`\n큐브를 주는 행 ${giving.length}개 (전체 ${rows.length}행 중). 패치로 변경 ${rows.filter((r) => r.patched).length}행.`);
const noCube = [];
for (const [boss, diffs] of Object.entries(prices.prices)) {
  for (const diff of Object.keys(diffs)) {
    const key = `${boss} ${diff}`;
    if (nonWeekly.has(key)) continue;
    if (!before[key] && !PATCH[key]) noCube.push(key);
  }
}
if (noCube.length) console.log(`\n큐브 정보가 아예 없는 주간 행 ${noCube.length}개:\n  ${noCube.join(", ")}`);
