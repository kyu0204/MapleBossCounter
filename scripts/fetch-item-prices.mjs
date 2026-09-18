/**
 * 보스 물욕템 시세를 받아 src/data/item_prices.json 에 쓴다.
 *
 * 출처: 메이플증권(mitemprice.kr). 스카니아(본 서버) 기준.
 *
 * 왜 여기서 가져오나
 *   경매장 내부 API 를 직접 부르는 길도 있었지만 그건 로그인 쿠키를 요구한다. 세션을
 *   CI 에 두면 해외 IP 에서 매일 접속하는 모양이 되고, 쿠키가 새면 계정 자체가 위험하다.
 *   그 사이트는 이미 공개된 페이지에 시세를 싣고 있고 robots.txt 가 "/" 를 허용한다.
 *   ("/api.php" 등은 막아 두었으므로 부르지 않는다. 사람이 보는 페이지만 읽는다.)
 *   그래서 이 스크립트에는 자격증명이 하나도 안 들어간다.
 *
 * 두 단계로 받는다
 *   1. 메인 페이지 한 장 — 인기 아이템 수십 종이 한 번에 실려 있다. 억 단위 표기.
 *   2. 메인에 없는 보상만 개별 페이지(itempricetab.php?name=...) 로 확인한다.
 *      여기는 메소 단위 원값이라 더 정확하다. 요청 사이를 띄운다.
 *
 * 기록이 아예 없는 아이템(로이드·상자류 등 거래 불가)은 noMarket 에 날짜와 함께
 * 남긴다. 다음 실행 때 RECHECK_DAYS 안이면 다시 묻지 않는다 — 없는 것을 매일
 * 다시 물을 이유가 없다.
 *
 * 사용: node scripts/fetch-item-prices.mjs [--dry] [--all]
 *   --dry  파일을 쓰지 않고 결과만 출력
 *   --all  noMarket 유예를 무시하고 전부 다시 확인
 */
import fs from "node:fs";
import path from "node:path";

const HOST = "https://mitemprice.kr";
const SERVER = "scania";
const OUT = path.join("src", "data", "item_prices.json");
const dry = process.argv.includes("--dry");
const all = process.argv.includes("--all");

/** 개별 페이지 요청 간격(ms). 남의 서버다 — 몰아치지 않는다. */
const GAP_MS = 1200;
/** 시세 기록이 없던 아이템을 며칠 뒤에 다시 물을지. */
const RECHECK_DAYS = 7;

// HTTP 헤더는 ASCII 만 담을 수 있다. 한글이나 em dash 를 넣으면 요청 자체가 실패한다.
const UA = "maple-board/1.0 price reader (+https://github.com/kyu0204/MapleBossCounter; once a day, public pages only)";

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

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function get(url) {
  const res = await fetch(url, { headers: { accept: "text/html", "user-agent": UA } });
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  return res.text();
}

/** 메인 페이지: <img alt="이름">이름</td><td>12.34</td> — 숫자는 억 단위다. */
function parseMain(html) {
  const out = new Map();
  for (const [, raw, eok] of html.matchAll(/alt="([^"]+)"[^>]*>\s*\1\s*<\/td>\s*<td[^>]*>([\d.]+)<\/td>/g)) {
    const meso = Math.round(Number(eok) * 100_000_000);
    if (Number.isFinite(meso) && meso > 0) out.set(ALIAS[raw] ?? raw, { meso, raw });
  }
  return out;
}

/**
 * 개별 페이지: 최신 가격과 가격 내역 표.
 *
 * 없는 이름을 넣어도 200 이 오고 제목만 그 이름으로 바뀐다. 그래서 상태 코드가 아니라
 * 내역 표에 행이 있는지로 판단한다.
 */
function parseItem(html) {
  const rows = [...html.matchAll(/<tr><td>(\d{4}-\d{2}-\d{2})<\/td><td>([\d,]+)<\/td>/g)];
  if (rows.length === 0) return null;
  const meso = Number(rows[0][2].replace(/,/g, ""));
  if (!Number.isFinite(meso) || meso <= 0) return null;
  return { meso, date: rows[0][1], days: rows.length };
}

/**
 * 시세가 필요한 이름 전부.
 *
 * 보스의 랜덤 보상이 첫째다. 여기에 상자 구성품을 더한다 — 상자는 그 자체로 거래가
 * 안 돼 시세가 없고, 안에서 나오는 물건 값으로 상자를 보기 때문이다 (src/lib/maple/boxes.ts).
 */
function wantedRewards() {
  const rewards = JSON.parse(fs.readFileSync(path.join("src", "data", "boss_rewards.json"), "utf8"));
  const want = new Set();
  for (const diffs of Object.values(rewards.bosses)) {
    for (const v of Object.values(diffs)) {
      for (const r of v.rewards ?? []) if (!r.fixed) want.add(r.name);
    }
  }

  const boxes = JSON.parse(fs.readFileSync(path.join("src", "data", "box_contents.json"), "utf8"));
  for (const def of Object.values(boxes.boxes)) {
    if (def.items) {
      for (const n of def.items) want.add(n);
      continue;
    }
    // 에테르넬은 직업군 5개 × 부위라 이름을 다 적지 않고 여기서 펼친다.
    for (const parts of Object.values(boxes.eternelArmor)) {
      for (const p of def.parts ?? []) if (parts[p]) want.add(parts[p]);
    }
  }
  return want;
}

function daysBetween(a, b) {
  return Math.abs(new Date(a) - new Date(b)) / 86_400_000;
}

async function main() {
  const now = new Date().toISOString();
  const today = now.slice(0, 10);
  const prev = fs.existsSync(OUT) ? JSON.parse(fs.readFileSync(OUT, "utf8")) : {};
  const prevNoMarket = prev.noMarket ?? {};

  const want = wantedRewards();
  const main = parseMain(await get(`${HOST}/`));
  if (main.size === 0) throw new Error("메인 페이지 표를 못 읽었다. 구조가 바뀐 것으로 보인다.");

  const items = {};
  const extra = {};
  for (const [name, v] of main) {
    const bucket = want.has(name) ? items : extra;
    bucket[name] = { meso: v.meso, at: now, src: "main" };
  }

  // 메인에 없는 보상만 개별 페이지로 확인한다.
  const missing = [...want].filter((n) => !items[n]);
  const skipped = [];
  const noMarket = {};
  const found = [];
  for (const name of missing) {
    const last = prevNoMarket[name];
    if (!all && last && daysBetween(today, last) < RECHECK_DAYS) {
      noMarket[name] = last;
      skipped.push(name);
      continue;
    }
    let hit = null;
    try {
      hit = parseItem(await get(`${HOST}/itempricetab.php?name=${encodeURIComponent(name)}&server=${SERVER}`));
    } catch (e) {
      console.warn(`  ! ${name}: ${e.message}`);
    }
    if (hit) {
      items[name] = { meso: hit.meso, at: now, src: "item", quotedOn: hit.date };
      found.push({ name, ...hit });
    } else {
      noMarket[name] = today;
    }
    await sleep(GAP_MS);
  }

  const counts = `메인 ${main.size}행 (보상 ${Object.keys(items).length - found.length}종, 그 외 ${Object.keys(extra).length}종) · 개별 조회 ${missing.length - skipped.length}건에서 ${found.length}종 · 시세 없음 ${Object.keys(noMarket).length}종(유예 ${skipped.length}종 포함)`;
  console.log(counts);
  for (const f of found) console.log(`  + ${f.name}: ${f.meso.toLocaleString()} 메소 (${f.quotedOn ?? f.date}, ${f.days}일치)`);

  if (dry) {
    console.log("\n[--dry] 파일을 쓰지 않는다.");
    return;
  }

  // 이번에 못 받은 것은 이전 값을 지킨다. 값이 사라지는 것보다 오래된 값이 낫다.
  const merged = {
    _meta: {
      updated: now,
      source: "메이플증권(mitemprice.kr) · 스카니아 기준",
      note: "메인 페이지는 억 단위 표기를 메소로 환산한 값, 개별 페이지는 메소 원값이다. 참고용이다.",
    },
    items: { ...(prev.items ?? {}), ...items },
    // 보상 목록에 없어 화면에서 쓰지 않는 값. 나중에 쓸 수 있어 받아만 둔다.
    extra: { ...(prev.extra ?? {}), ...extra },
    // 사이트에 기록이 없던 것. 날짜는 마지막으로 확인한 날이다.
    noMarket,
  };
  fs.writeFileSync(OUT, JSON.stringify(merged, null, 2) + "\n");
  console.log(`→ ${OUT}`);
}

main().catch((e) => {
  console.error("시세 수집 실패:", e.message);
  process.exit(1);
});
