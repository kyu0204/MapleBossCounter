/**
 * 나무위키 각 보스 문서의 "주요 보상" 항목에서 드롭 아이템 이름 + 아이콘을 수집한다.
 * 주간 결정 보스만 대상 (일간·월간 제외).
 *
 * 결과:
 *   public/items/*.png|webp        — 아이템 아이콘 (자체 호스팅, 런타임 외부 요청 없음)
 *   src/data/boss_reward_items.json — { 보스명: [{ name, file }] }
 *
 * 주의: 이미지 원저작권은 넥슨. 재배포 책임은 배포자에게.
 *
 * 사용:
 *   node scripts/fetch-namu-item-icons.mjs --inspect   # 수집될 항목만 출력
 *   node scripts/fetch-namu-item-icons.mjs             # 실제 다운로드
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import path from "node:path";

const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";
const OUT_DIR = path.join(process.cwd(), "public", "items");
const OUT_JSON = path.join(process.cwd(), "src", "data", "boss_reward_items.json");
const CACHE_DIR = path.join(process.cwd(), ".cache-namu-bosses");
const inspect = process.argv.includes("--inspect");

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const slug = (s) => s.replace(/[\\/:*?"<>|]/g, "").replace(/\s+/g, "-");
const decode = (s) =>
  s
    .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"')
    .replace(/&#x2F;/g, "/").replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCharCode(parseInt(n, 16)));

// "주요 보상" 다음 인포박스 칸으로 넘어갔다고 보는 단어들
const STOP = ["BGM", "등장", "테마곡", "관련 문서", "둘러보기", "표기", "패턴", "공략", "스토리", "여담", "역사"];

const prices = JSON.parse(readFileSync(path.join(process.cwd(), "src", "data", "boss_crystal_prices.json"), "utf8"));
const icons = JSON.parse(readFileSync(path.join(process.cwd(), "src", "data", "boss_icons.json"), "utf8"));
const nonWeekly = new Set([...(prices._meta.daily ?? []), ...(prices._meta.monthly ?? [])]);

/** 주간 결정 난이도가 하나라도 있는 보스만 */
const weeklyBosses = Object.entries(prices.prices)
  .filter(([boss, diffs]) => Object.keys(diffs).some((d) => !nonWeekly.has(`${boss} ${d}`)))
  .map(([boss]) => boss);

async function pageHtml(boss) {
  const doc = icons[boss]?.doc;
  if (!doc) return null;
  mkdirSync(CACHE_DIR, { recursive: true });
  const cache = path.join(CACHE_DIR, `${slug(boss)}.html`);
  if (existsSync(cache)) return readFileSync(cache, "utf8");
  const url = `https://namu.wiki/w/${encodeURIComponent(doc).replace(/%2F/g, "/")}`;
  try {
    const res = await fetch(url, { headers: { "User-Agent": UA, "Accept-Language": "ko-KR,ko;q=0.9" }, signal: AbortSignal.timeout(30000) });
    if (!res.ok) { console.log(`  ${boss}: 문서 ${res.status} (${doc})`); return null; }
    const html = await res.text();
    writeFileSync(cache, html);
    await sleep(400);
    return html;
  } catch (e) {
    console.log(`  ${boss}: ${e?.name ?? e}`);
    return null;
  }
}

/**
 * "주요 보상" 칸의 아이템 카드에서 (아이템명, 아이콘 URL) 을 뽑는다.
 * 카드 구조: <div style='display:inline-block;margin:2px;width:calc(...)'> …<img data-src=…>… <br>아이템명 </div>
 * alt 는 나무위키 파일명("eqp 모자 루타비스 피에르 …")이라 못 쓴다. 마지막 <br> 뒤 텍스트가 진짜 이름.
 */
function extractRewards(html) {
  const start = html.indexOf("주요 보상</strong>");
  if (start < 0) return [];
  // 다음 인포박스 라벨(<strong>) 직전까지가 이 칸
  const nextLabel = html.indexOf("<strong", start + 20);
  const region = html.slice(start, nextLabel > 0 ? nextLabel : start + 14000);

  const out = [];
  const seen = new Set();
  const cards = region.split(/<div style='display:inline-block;margin:2px;width:calc\(/).slice(1);
  for (const card of cards) {
    const u =
      card.match(/\bdata-src=['"]([^'"]*i\.namu\.wiki[^'"]*)['"]/) ??
      card.match(/<noscript>[\s\S]*?<img\b[^>]*\bsrc=['"]([^'"]*i\.namu\.wiki[^'"]*)['"]/);
    if (!u) continue;
    // 이름은 "<br>텍스트</div>" 패턴의 첫 매치. split 으로 잘린 마지막 카드는 뒤쪽이 따라붙으므로
    // lastIndexOf 로 찾으면 엉뚱한 곳을 집는다.
    const name = decode(card.match(/<br\b[^>]*>\s*([^<]+?)\s*<\/div>/)?.[1] ?? "").replace(/\s+/g, " ").trim();
    if (!name || STOP.some((s) => name.includes(s))) continue;
    if (seen.has(name)) continue;
    seen.add(name);
    out.push({ name, src: u[1].startsWith("//") ? "https:" + u[1] : u[1] });
  }
  return out;
}

const result = {};
let items = 0;
for (const boss of weeklyBosses) {
  const html = await pageHtml(boss);
  if (!html) continue;
  const rewards = extractRewards(html);
  if (!rewards.length) { console.log(`MISS ${boss} — 주요 보상 항목 없음`); continue; }
  result[boss] = rewards;
  items += rewards.length;
  console.log(`OK   ${boss.padEnd(14)} ${rewards.map((r) => r.name).join(", ")}`);
}
console.log(`\n보스 ${Object.keys(result).length}/${weeklyBosses.length}, 아이템 ${items}개`);

if (inspect) {
  console.log("--inspect: 다운로드 안 함");
  process.exit(0);
}

mkdirSync(OUT_DIR, { recursive: true });
const final = {};
for (const [boss, rewards] of Object.entries(result)) {
  const list = [];
  for (const r of rewards) {
    try {
      const res = await fetch(r.src, { headers: { "User-Agent": UA, Referer: "https://namu.wiki/" }, signal: AbortSignal.timeout(25000) });
      if (!res.ok) { console.log(`  이미지 실패 ${boss}/${r.name} ${res.status}`); continue; }
      const buf = Buffer.from(await res.arrayBuffer());
      const ct = res.headers.get("content-type") ?? "";
      const ext = ct.includes("webp") ? ".webp" : ct.includes("gif") ? ".gif" : ".png";
      const file = `${slug(r.name)}${ext}`;
      writeFileSync(path.join(OUT_DIR, file), buf);
      list.push({ name: r.name, file: `/items/${file}`, bytes: buf.length });
    } catch (e) {
      console.log(`  이미지 예외 ${boss}/${r.name} ${e?.name ?? e}`);
    }
    await sleep(120);
  }
  if (list.length) final[boss] = list;
}

writeFileSync(
  OUT_JSON,
  JSON.stringify(
    {
      _meta: {
        updated: new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10),
        source: "나무위키 각 보스 문서의 '주요 보상' 항목",
        notes: [
          "주간 결정 보스만 수집한다 (일간·월간 제외).",
          "아이콘 원저작권은 넥슨. public/items 에 자체 호스팅하며 런타임에 외부 요청을 하지 않는다.",
          "난이도 구분은 없다 — 해당 보스의 대표 보상이다. 난이도별 드롭은 boss_drops.json 이 담당.",
          "재수집: node scripts/fetch-namu-item-icons.mjs",
        ],
      },
      items: final,
    },
    null,
    2,
  ) + "\n",
);
console.log(`\n${Object.values(final).flat().length}개 저장 → public/items, ${OUT_JSON}`);
