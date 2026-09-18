/**
 * 보스 랜덤 보상 이름 → 경매장 아이템 id 매핑을 만든다. 한 번 돌리고 커밋하는 스크립트다.
 *
 * 왜 미리 만들어 두나 — 이름으로 매번 찾으면 사전(4.75MB)을 들고 다녀야 하고, 이름이
 * 조금 바뀌면 조용히 매칭이 끊긴다. 매핑을 파일로 굳혀 두면 무엇이 빠졌는지 눈에 보인다.
 *
 * 확정 보상은 넣지 않는다. 주문의 흔적·큐브·조각은 교환 불가라 시세 자체가 없고,
 * 화면에서도 값을 안 매기고 개수로만 견준다.
 *
 * 사용:
 *   node scripts/build-auction-ids.mjs --dict <MapleAuction>/data/snippets.json
 *
 * snippets.json 은 경매장 사이트가 쓰는 아이템 사전이다 (MapleAuction 이 CDN 에서 받아 캐싱).
 */
import fs from "node:fs";
import path from "node:path";

const args = process.argv.slice(2);
const dictPath = args[args.indexOf("--dict") + 1];
if (!args.includes("--dict") || !dictPath) {
  console.error("사용법: node scripts/build-auction-ids.mjs --dict <snippets.json 경로>");
  process.exit(1);
}

const dict = JSON.parse(fs.readFileSync(dictPath, "utf8"));
const byName = new Map();
for (const d of dict) {
  // 같은 이름이 여럿이면 매핑이 애매해진다. 첫 것만 두고 아래에서 경고한다.
  if (!byName.has(d.nameOrigin)) byName.set(d.nameOrigin, []);
  byName.get(d.nameOrigin).push(d);
}

const rewards = JSON.parse(fs.readFileSync(path.join("src", "data", "boss_rewards.json"), "utf8"));
const randomNames = new Set();
for (const diffs of Object.values(rewards.bosses)) {
  for (const v of Object.values(diffs)) {
    for (const r of v.rewards ?? []) if (!r.fixed) randomNames.add(r.name);
  }
}

const items = {};
const missing = [];
const ambiguous = [];
for (const name of [...randomNames].sort((a, b) => a.localeCompare(b, "ko"))) {
  const hits = byName.get(name);
  if (!hits) {
    missing.push(name);
    continue;
  }
  if (hits.length > 1) ambiguous.push(`${name} (${hits.length}건)`);
  items[name] = hits[0].encryptedItemId;
}

const out = {
  _meta: {
    updated: new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10),
    note: "보스 랜덤 보상 → 경매장 아이템 id. scripts/build-auction-ids.mjs 로 생성.",
    matched: Object.keys(items).length,
    total: randomNames.size,
    missing,
  },
  items,
};

fs.writeFileSync(path.join("src", "data", "auction_ids.json"), JSON.stringify(out, null, 2) + "\n");
console.log(`랜덤 보상 ${randomNames.size}종 중 ${Object.keys(items).length}종 매칭 → src/data/auction_ids.json`);
if (ambiguous.length) console.log(`\n동명 여러 건 (첫 것을 썼다. 확인 필요):\n  ${ambiguous.join("\n  ")}`);
if (missing.length) console.log(`\n사전에 없음 (거래 불가이거나 신규):\n  ${missing.join("\n  ")}`);
