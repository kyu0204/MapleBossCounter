/**
 * 경매장에서 보스 물욕템 시세를 받아 src/data/item_prices.json 에 병합한다.
 *
 * 왜 이런 모양인가
 *   - 넥슨 공개 API 에는 시세가 없다. 경매장 웹이 쓰는 내부 API 를 부른다.
 *     문서화된 곳이 아니라 언제든 바뀔 수 있다 — 실패해도 앱은 기존 값으로 돈다.
 *   - 인증은 로그인 쿠키(NPP)다. API 키가 아니라 세션이라 사용자에게 받을 수 없다.
 *     그래서 웹앱이 아니라 여기(CI)에서만 부르고, 결과 JSON 만 앱으로 넘긴다.
 *   - 세션 토큰(_wts)은 3시간짜리다. 매 실행마다 로그인 쿠키로 새로 받는다.
 *     되돌려 저장할 것이 없으므로 시크릿은 NPP 하나면 된다.
 *   - price-info 는 검색 쿼터를 소모하지 않는다 (하루 100회 제한은 새 검색 생성에만 걸린다).
 *
 * 사용:
 *   NEXON_COOKIE='NPP=...; ...' node scripts/fetch-item-prices.mjs [--dry]
 */
import "./_runenv.mjs";
import fs from "node:fs";
import path from "node:path";

const API = "https://api.mskr.nexon.com/v1/market/web";
const ORIGIN = "https://auction.maplestory.nexon.com";
const OUT = path.join("src", "data", "item_prices.json");
const IDS = path.join("src", "data", "auction_ids.json");

const dry = process.argv.includes("--dry");
const WORLD_ID = process.env.NEXON_WORLD_ID ?? "0";

const cookie = process.env.NEXON_COOKIE;
if (!cookie) {
  console.error("NEXON_COOKIE 가 필요하다 (경매장 로그인 쿠키). 브라우저에서 복사해 시크릿에 넣을 것.");
  process.exit(1);
}

/** 쿠키 저장소. 성공 응답의 Set-Cookie 로 _wts 를 갱신한다. */
const jar = new Map();
for (const kv of cookie.split(/;\s*/)) {
  const i = kv.indexOf("=");
  if (i > 0) jar.set(kv.slice(0, i).trim(), kv.slice(i + 1).trim());
}
const cookieHeader = () => [...jar].map(([k, v]) => `${k}=${v}`).join("; ");

function applySetCookie(res) {
  const list = typeof res.headers.getSetCookie === "function" ? res.headers.getSetCookie() : [res.headers.get("set-cookie")].filter(Boolean);
  for (const sc of list ?? []) {
    const [kv, ...attrs] = sc.split(";");
    const i = kv.indexOf("=");
    if (i <= 0) continue;
    const name = kv.slice(0, i).trim();
    const value = kv.slice(i + 1).trim();
    // 인증 실패 응답은 로그인 쿠키를 지우라고 보낸다. 따르면 재발급도 못 하게 된다.
    if (!value || attrs.some((a) => /^\s*max-age=0\s*$/i.test(a))) continue;
    jar.set(name, value);
  }
}

const headers = () => ({
  accept: "application/json",
  origin: ORIGIN,
  referer: `${ORIGIN}/`,
  cookie: cookieHeader(),
  "user-agent": "Mozilla/5.0 maple-board price collector",
});

async function call(url, init = {}) {
  const res = await fetch(url, { ...init, headers: { ...headers(), ...(init.headers ?? {}) } });
  if (res.ok) applySetCookie(res);
  const body = await res.json().catch(() => ({}));
  return { res, body };
}

/** 세션 토큰 재발급. 로그인 쿠키만 있으면 된다. */
async function renewSession() {
  const { res } = await call("https://api.mskr.nexon.com/v1/auth/web-token/session", { method: "POST" });
  if (!res.ok) throw new Error(`세션 재발급 실패 (${res.status}). 로그인 쿠키가 만료됐을 수 있다.`);
}

/** 한 아이템의 시세. 실패하면 null (개별 실패는 전체를 막지 않는다). */
async function priceOf(id) {
  const qs = new URLSearchParams({ worldId: WORLD_ID, royalSpecialType: "0", petGrade: "0", itemCount: "5", isCashEquip: "false" });
  const url = `${API}/items/${id}/price-info?${qs}`;
  let { res, body } = await call(url);
  // 401 + code 12 = 세션 만료. 한 번만 재발급하고 다시 시도한다.
  if (res.status === 401) {
    await renewSession();
    ({ res, body } = await call(url));
  }
  if (!res.ok) return { error: `${res.status} ${body?.error?.name ?? ""}`.trim() };
  const lowest = Number(body.registeredLowestPrice ?? 0);
  const week = Number(body.weekAveragePrice ?? 0);
  return { lowest: lowest || null, weekAverage: week || null };
}

async function main() {
  const ids = JSON.parse(fs.readFileSync(IDS, "utf8")).items;
  const names = Object.keys(ids);
  console.log(`대상 ${names.length}종${dry ? " (--dry: 요청 안 함)" : ""}`);
  if (dry) {
    for (const n of names.slice(0, 5)) console.log(`  ${n} -> ${ids[n]}`);
    return;
  }

  await renewSession();

  const prev = fs.existsSync(OUT) ? JSON.parse(fs.readFileSync(OUT, "utf8")) : { items: {} };
  const items = { ...prev.items };
  const now = new Date().toISOString();
  let ok = 0;
  const failed = [];

  for (const name of names) {
    const r = await priceOf(ids[name]);
    if (r.error || (r.lowest == null && r.weekAverage == null)) {
      // 실패한 것은 이전 값을 그대로 둔다. 값이 사라지는 것보다 오래된 값이 낫다.
      failed.push(`${name}: ${r.error ?? "매물 없음"}`);
      continue;
    }
    // 주간 평균이 있으면 그쪽을 쓴다. 최저가만 보면 급매 하나에 값이 휘청인다.
    items[name] = { meso: r.weekAverage ?? r.lowest, lowest: r.lowest, weekAverage: r.weekAverage, at: now };
    ok++;
    await new Promise((r) => setTimeout(r, 200)); // 예의상 간격
  }

  fs.writeFileSync(OUT, JSON.stringify({ _meta: { updated: now, source: "경매장 price-info", note: "meso = 주간 평균가, 없으면 등록 최저가" }, items }, null, 2) + "\n");
  console.log(`${ok}종 갱신 → ${OUT}`);
  if (failed.length) console.log(`\n실패 ${failed.length}종 (이전 값 유지):\n  ${failed.join("\n  ")}`);
  if (ok === 0) process.exitCode = 1; // 전부 실패면 쿠키 문제로 보고 알린다
}

main().catch((e) => {
  console.error("시세 수집 실패:", e.message);
  process.exit(1);
});
