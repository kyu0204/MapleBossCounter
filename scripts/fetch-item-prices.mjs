/**
 * 보스 물욕템 시세를 받아 src/data/item_prices.json 에 쓴다.
 *
 * 출처: 메이플증권(mitemprice.kr) 메인 페이지. 스카니아(본 서버) 기준.
 *
 * 왜 여기서 가져오나
 *   경매장 내부 API 를 직접 부르는 길도 있었지만 그건 로그인 쿠키를 요구한다. 세션을
 *   CI 에 두면 해외 IP 에서 매일 접속하는 모양이 되고, 쿠키가 새면 계정 자체가 위험하다.
 *   그 사이트는 이미 공개된 페이지에 시세를 싣고 있고 robots.txt 가 "/" 를 허용한다.
 *   ("/api.php" 는 막아 두었으므로 부르지 않는다. 사람이 보는 페이지만 읽는다.)
 *   그래서 이 스크립트에는 자격증명이 하나도 안 들어간다.
 *
 * 예의
 *   요청은 실행당 한 번뿐이다. 하루 한 번이면 충분한 값이라 더 자주 돌릴 이유가 없다.
 *   User-Agent 에 이 앱이 누구인지 밝힌다 — 브라우저인 척하지 않는다.
 *
 * 사용: node scripts/fetch-item-prices.mjs [--dry]
 */
import fs from "node:fs";
import path from "node:path";

const SRC = "https://mitemprice.kr/";
const OUT = path.join("src", "data", "item_prices.json");
const dry = process.argv.includes("--dry");

/**
 * 사이트 이름 → 우리 보상 이름.
 *
 * 대부분은 이름이 같아 그대로 쓴다. 여기 적는 것은 우리가 "선택 상자" 로 들고 있는데
 * 사이트는 그 안에서 나오는 물건 이름으로 파는 경우다. 상자의 값어치를 그 물건 값으로
 * 보는 셈인데, 상자를 까면 그게 나오므로 비교 목적에는 맞다.
 */
const ALIAS = {
  마도서: "저주받은 마도서 선택 상자",
  "미트라의 분노": "미트라의 분노 선택 상자",
};

async function main() {
  const res = await fetch(SRC, {
    headers: {
      accept: "text/html",
      // HTTP 헤더는 ASCII 만 담을 수 있다. 한글이나 em dash 를 넣으면 요청 자체가 실패한다.
      "user-agent": "maple-board/1.0 price reader (+https://github.com/kyu0204/MapleBossCounter; once a day, public page only)",
    },
  });
  if (!res.ok) throw new Error(`가져오기 실패: ${res.status}`);
  const html = await res.text();

  // <img alt="이름" ...>이름</td><td ...>12.34</td> — 숫자는 억 단위다
  const rows = [...html.matchAll(/alt="([^"]+)"[^>]*>\s*\1\s*<\/td>\s*<td[^>]*>([\d.]+)<\/td>/g)];
  if (rows.length === 0) throw new Error("표를 못 읽었다. 페이지 구조가 바뀐 것으로 보인다.");

  const rewards = JSON.parse(fs.readFileSync(path.join("src", "data", "boss_rewards.json"), "utf8"));
  const wanted = new Set();
  for (const diffs of Object.values(rewards.bosses)) {
    for (const v of Object.values(diffs)) {
      for (const r of v.rewards ?? []) if (!r.fixed) wanted.add(r.name);
    }
  }

  const now = new Date().toISOString();
  const items = {};
  const skipped = [];
  for (const [, rawName, eok] of rows) {
    const name = ALIAS[rawName] ?? rawName;
    if (!wanted.has(name)) {
      skipped.push(rawName);
      continue;
    }
    const meso = Math.round(Number(eok) * 100_000_000);
    if (!Number.isFinite(meso) || meso <= 0) continue;
    items[name] = { meso, at: now };
  }

  console.log(`페이지에서 ${rows.length}행 읽음 → 보스 보상과 맞는 것 ${Object.keys(items).length}종`);
  if (dry) {
    for (const [n, v] of Object.entries(items)) console.log(`  ${n}: ${(v.meso / 100_000_000).toFixed(2)}억`);
    console.log(`\n보상 목록에 없어 건너뛴 것 ${skipped.length}종`);
    return;
  }

  // 이번에 못 받은 것은 이전 값을 지킨다. 값이 사라지는 것보다 오래된 값이 낫다.
  const prev = fs.existsSync(OUT) ? JSON.parse(fs.readFileSync(OUT, "utf8")) : { items: {} };
  const merged = { ...prev.items, ...items };

  fs.writeFileSync(
    OUT,
    JSON.stringify(
      { _meta: { updated: now, source: "메이플증권(mitemprice.kr) · 스카니아 기준", note: "억 단위 표기를 메소로 환산. 값은 참고용이다." }, items: merged },
      null,
      2,
    ) + "\n",
  );
  console.log(`→ ${OUT}`);
  if (Object.keys(items).length === 0) process.exitCode = 1; // 하나도 못 읽으면 구조가 바뀐 것이다
}

main().catch((e) => {
  console.error("시세 수집 실패:", e.message);
  process.exit(1);
});
