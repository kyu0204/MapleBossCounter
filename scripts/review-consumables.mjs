/**
 * 수집본(boss_rewards_raw.json)의 '소비 아이템'을 중복 제거해 나열한다.
 * 이름만 보면 흔해 보여도 상위 보스에만 나오는 것(예: 영롱한 달빛 포션)이 있으므로
 * 어느 보스·난이도에서 나오는지 같이 보여준다. (화면 반영 아님, 판단용)
 *
 * 사용: node scripts/review-consumables.mjs [--check]
 *   --check : 제외 후보 중 보스 커버리지가 좁아 재검토가 필요한 것만
 */
import { readFileSync } from "node:fs";
import path from "node:path";

const raw = JSON.parse(readFileSync(path.join(process.cwd(), "src", "data", "boss_rewards_raw.json"), "utf8"));
const checkOnly = process.argv.includes("--check");

const baseName = (s) => s.replace(/\s*\([^)]*\)/g, "").replace(/\s+/g, " ").trim();

const map = new Map(); // 이름 → { where: [{boss, mode}] }
for (const [boss, modes] of Object.entries(raw.bosses)) {
  for (const [mode, v] of Object.entries(modes)) {
    for (const item of v.소비 ?? []) {
      const k = baseName(item);
      if (!map.has(k)) map.set(k, { where: [], bosses: new Set() });
      map.get(k).where.push(`${boss} ${mode}`);
      map.get(k).bosses.add(boss);
    }
  }
}
const totalBosses = Object.keys(raw.bosses).length;

/** 표시 대상 (확정) */
const KEEP = [/에테르넬/, /칠흑 장신구/, /보스 반지 상자/, /연마석/, /아케인셰이드/, /앱솔랩스/, /선택 상자/, /익셉셔널 해머/];
/** 제외 확정: 모든 보스에 깔리는 소모품·소제목, 그리고 이번에 빼기로 한 것들 */
const DROP = [
  /명예의 훈장/, /경험치 50%/, /경험 축적/, /물약$/, /주문서 교환권/, /혼돈 주문서/, /태초의 정수/,
  /소울 조각/, /소울 상자/, /^주문서$/, /^기타$/, /^장비$/,
  /교환권$/, /최초 격파/, /최초 1회/, /운명의 인도/, /메이플홈/, /커스텀 배경/,
];
const verdict = (n) => (KEEP.some((r) => r.test(n)) ? "표시" : DROP.some((r) => r.test(n)) ? "제외" : "???");

const rows = [...map.entries()]
  .map(([name, e]) => ({ name, n: e.bosses.size, bosses: [...e.bosses], where: e.where, v: verdict(name) }))
  .sort((a, b) => a.n - b.n || a.name.localeCompare(b.name));

if (checkOnly) {
  // 제외로 분류됐지만 절반 미만 보스에서만 나오는 것 = 사실상 상위 보스 전용일 수 있다
  const suspects = rows.filter((r) => r.v !== "표시" && r.n < totalBosses / 2);
  console.log(`제외/미분류인데 보스 커버리지가 좁은 항목 ${suspects.length}개 (전체 ${totalBosses}보스)\n`);
  for (const r of suspects) {
    console.log(`  ${String(r.n).padStart(2)}/${totalBosses}  ${r.name}`);
    console.log(`        ${r.where.join(" · ")}`);
  }
} else {
  for (const group of ["표시", "???", "제외"]) {
    const list = rows.filter((r) => r.v === group).sort((a, b) => b.n - a.n);
    if (!list.length) continue;
    console.log(`\n===== ${group} (${list.length}개) =====`);
    for (const r of list) console.log(`  ${String(r.n).padStart(2)}/${totalBosses}  ${r.name}${r.n <= 4 ? ` — ${r.bosses.join(", ")}` : ""}`);
  }
  console.log(`\n소비 아이템 고유 ${rows.length}종`);
}
