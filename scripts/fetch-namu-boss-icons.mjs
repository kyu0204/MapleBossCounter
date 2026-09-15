/**
 * 나무위키 "보스 몬스터" 문서 상단 보스 목록의 아이콘을 받아 public/bosses/*.png 로 저장한다.
 * 런타임에 외부 요청을 하지 않도록 한 번만 받아 자체 호스팅한다.
 *
 * 주의: 이미지는 넥슨의 게임 아트다. 재배포·상업적 이용의 책임은 사용자에게 있다.
 *
 * 사용:
 *   node scripts/fetch-namu-boss-icons.mjs --inspect   # 문서에서 찾은 (보스 ↔ 이미지) 후보만 출력
 *   node scripts/fetch-namu-boss-icons.mjs             # 실제 다운로드 + src/data/boss_icons.json 갱신
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import path from "node:path";

const PAGE = "https://namu.wiki/w/%EC%9C%8C(%EB%A9%94%EC%9D%B4%ED%94%8C%EC%8A%A4%ED%86%A0%EB%A6%AC)/%EB%B3%B4%EC%8A%A4%20%EB%AA%AC%EC%8A%A4%ED%84%B0";
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";
const OUT_DIR = path.join(process.cwd(), "public", "bosses");
const MAP_FILE = path.join(process.cwd(), "src", "data", "boss_icons.json");
const CACHE = path.join(process.cwd(), ".cache-namu.html");
const inspect = process.argv.includes("--inspect");

/** 가격표 보스명 → 나무위키 문서 제목에서 찾을 키워드 */
const DOC_KEY = {
  "가디언 엔젤 슬라임": "가디언 엔젤 슬라임",
  "진 힐라": "힐라",
  "선택받은 세렌": "세렌",
  "감시자 칼로스": "칼로스",
  "최초의 대적자": "최초의 대적자",
  "찬란한 흉성": "흉성",
  "시즌 보스 메이린": "메이린",
  "검은 마법사": "검은 마법사",
  "반 레온": "반 레온",
  블러디퀸: "블러디 퀸",
  핑크빈: "핑크빈",
  시그너스: "시그너스",
};

const slug = (s) => s.replace(/\s+/g, "-");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const decode = (s) =>
  s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#x2F;/g, "/")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCharCode(parseInt(n, 16)));

async function loadPage() {
  if (existsSync(CACHE)) return readFileSync(CACHE, "utf8");
  const res = await fetch(PAGE, { headers: { "User-Agent": UA, "Accept-Language": "ko-KR,ko;q=0.9" }, signal: AbortSignal.timeout(30000) });
  if (!res.ok) throw new Error(`문서 로드 실패 ${res.status}`);
  const html = await res.text();
  writeFileSync(CACHE, html);
  return html;
}

/**
 * 상단 보스 목록 틀의 카드 구조:
 *   <a class='...' href='/w/스우/보스 몬스터' title='스우/보스 몬스터'>
 *     <div ...><img ... data-src='//i.namu.wiki/...' alt='...'> ... <br>스우<br><span>노멀</span> · <span>하드</span></div>
 *   </a>
 * - 이미지가 지연 로딩이라 실제 URL 은 data-src 에 있다 (src 는 투명 svg placeholder).
 * - 속성이 작은따옴표다.
 * - 카드 사이 간격용 'ë³´ìŠ¤ ê³µë°±'(보스 공백) 이미지는 건너뛴다.
 */
function extractPairs(html) {
  const pairs = [];
  const anchorRe = /<a\b[^>]*?href=['"](\/w\/[^'"]+)['"][^>]*>([\s\S]*?)<\/a>/g;
  let m;
  while ((m = anchorRe.exec(html))) {
    const href = decode(m[1]);
    const inner = m[2];
    // 카드 안의 모든 이미지 중 '공백' 스페이서가 아닌 첫 번째
    let src = null;
    const imgRe = /<img\b[^>]*>/g;
    let im;
    while ((im = imgRe.exec(inner))) {
      const tag = im[0];
      const alt = tag.match(/\balt=['"]([^'"]*)['"]/)?.[1] ?? "";
      if (alt.includes("공백")) continue;
      const u = tag.match(/\bdata-src=['"]([^'"]*i\.namu\.wiki[^'"]*)['"]/) ?? tag.match(/\bsrc=['"]([^'"]*i\.namu\.wiki[^'"]*)['"]/);
      if (u) {
        src = u[1].startsWith("//") ? "https:" + u[1] : u[1];
        break;
      }
    }
    if (!src) continue;
    const title = decodeURIComponent(href.replace(/^\/w\//, "")).replace(/_/g, " ");
    // 카드에 표시되는 보스 이름 (난이도 span 앞의 텍스트)
    const text = decode(inner.replace(/<[^>]+>/g, "\n"))
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean);
    const DIFFS = ["이지", "노멀", "노말", "하드", "카오스", "익스트림"];
    const label = text.filter((t) => !DIFFS.includes(t) && t !== "·" && !/^[·\s]+$/.test(t)).pop() ?? "";
    pairs.push({ title, label, src, at: m.index });
  }
  return pairs;
}

function bestPair(pairs, boss) {
  const key = DOC_KEY[boss] ?? boss;
  const norm = (s) => s.replace(/\s+/g, "");
  const nk = norm(key);
  const nb = norm(boss);
  const scored = pairs
    .map((p) => {
      const t = norm(p.title.split("/")[0]); // "스우/보스 몬스터" → "스우"
      const l = norm(p.label);
      let score = 0;
      if (l === nb || t === nb) score = 120;
      else if (l === nk || t === nk) score = 100;
      else if (l.startsWith(nk) || t.startsWith(nk)) score = 70;
      else if (l.includes(nk) || t.includes(nk)) score = 50;
      else return null;
      // 문서 상단(보스 목록 틀)에 가까울수록 가산
      score += Math.max(0, 20 - p.at / 20000);
      return { p, score };
    })
    .filter(Boolean)
    .sort((a, b) => b.score - a.score);
  return scored[0]?.p ?? null;
}

const prices = JSON.parse(readFileSync(path.join(process.cwd(), "src", "data", "boss_crystal_prices.json"), "utf8"));
const bosses = Object.keys(prices.prices);

const html = await loadPage();
const pairs = extractPairs(html);
console.log(`앵커-이미지 쌍 ${pairs.length}개 발견\n`);

const map = {};
let ok = 0;
const missed = [];
for (const boss of bosses) {
  const hit = bestPair(pairs, boss);
  if (!hit) {
    missed.push(boss);
    continue;
  }
  map[boss] = { source: "namu", doc: hit.title, src: hit.src, file: `/bosses/${slug(boss)}.png` };
  console.log(`OK   ${boss.padEnd(14)} ← ${hit.title}`);
  ok++;
}
if (missed.length) console.log(`\nMISS (${missed.length}): ${missed.join(", ")}`);

if (inspect) {
  console.log(`\n--inspect 모드: 다운로드 안 함. ${ok}/${bosses.length}`);
  process.exit(0);
}

mkdirSync(OUT_DIR, { recursive: true });
for (const [boss, e] of Object.entries(map)) {
  try {
    const res = await fetch(e.src, { headers: { "User-Agent": UA, Referer: "https://namu.wiki/" }, signal: AbortSignal.timeout(25000) });
    if (!res.ok) {
      console.log(`  이미지 실패 ${boss} ${res.status}`);
      delete map[boss];
      continue;
    }
    const buf = Buffer.from(await res.arrayBuffer());
    const ext = (res.headers.get("content-type") ?? "").includes("webp") ? ".webp" : (res.headers.get("content-type") ?? "").includes("gif") ? ".gif" : ".png";
    const file = `${slug(boss)}${ext}`;
    writeFileSync(path.join(OUT_DIR, file), buf);
    map[boss].file = `/bosses/${file}`;
    map[boss].bytes = buf.length;
  } catch (err) {
    console.log(`  이미지 예외 ${boss} ${err?.name ?? err}`);
    delete map[boss];
  }
  await sleep(120);
}

/**
 * 손으로 넣은 아이콘은 지우지 않는다.
 * 이 스크립트는 가격표에 있는 보스만 훑으므로, 티어표에만 있고 결정 가격이 없는 보스
 * (예: 시즌 보스 카이)는 여기서 절대 안 잡힌다. 그런 항목은 source 가 "namu" 가 아니다.
 */
const kept = {};
if (existsSync(MAP_FILE)) {
  const prev = JSON.parse(readFileSync(MAP_FILE, "utf8"));
  for (const [boss, e] of Object.entries(prev)) {
    if (e?.source === "namu" || map[boss]) continue;
    if (!existsSync(path.join(process.cwd(), "public", decodeURIComponent(e.file).replace(/^\//, "")))) continue;
    kept[boss] = e;
  }
}
if (Object.keys(kept).length) console.log(`\n손으로 넣은 ${Object.keys(kept).length}개 유지: ${Object.keys(kept).join(", ")}`);

writeFileSync(MAP_FILE, JSON.stringify({ ...map, ...kept }, null, 2) + "\n");
console.log(`\n${Object.keys(map).length + Object.keys(kept).length}개 저장 → public/bosses, ${MAP_FILE}`);
