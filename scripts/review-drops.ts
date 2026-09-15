/**
 * 보상 테이블 점검용 덤프. 티어 높은 순으로 (보스, 난이도)와 현재 저장된 보상을 출력한다.
 * 사용: npx tsx scripts/review-drops.ts [시작순번] [개수]
 */
import "./_bootstrap";

async function main() {
  const { PRICE_TABLE, crystalPrice, isWeeklyCrystal } = await import("../src/lib/maple/prices");
  const { tierOf, tierLabel } = await import("../src/lib/maple/tiers");
  const { rewardItemsFor } = await import("../src/lib/maple/drops");
  const { fmtPower } = await import("../src/lib/maple/format");
  const { kstDateStr } = await import("../src/lib/maple/kst");

  const from = Number(process.argv[2] ?? 1);
  const count = Number(process.argv[3] ?? 999);
  const date = kstDateStr();

  const rows: { boss: string; diff: string; rank: number }[] = [];
  for (const [boss, diffs] of Object.entries(PRICE_TABLE.prices)) {
    for (const diff of Object.keys(diffs)) {
      if (!isWeeklyCrystal(boss, diff)) continue;
      const t = tierOf(boss, diff);
      if (!t) continue;
      rows.push({ boss, diff, rank: t.rank });
    }
  }
  rows.sort((a, b) => b.rank - a.rank || a.boss.localeCompare(b.boss));

  console.log(`주간 결정 보스 ${rows.length}행 (티어 높은 순). ${from}번부터 ${Math.min(count, rows.length - from + 1)}개\n`);
  rows.slice(from - 1, from - 1 + count).forEach((r, i) => {
    const n = from + i;
    const items = rewardItemsFor(r.boss, r.diff);
    const price = crystalPrice(r.boss, r.diff, date);
    console.log(`${String(n).padStart(2)}. ${tierLabel(tierOf(r.boss, r.diff)).padEnd(12)} ${r.boss} ${r.diff}  (결정 ${fmtPower(price)})`);
    console.log(`    ${items.length ? items.map((x) => x.name).join(" / ") : "— 없음"}`);
  });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
