/**
 * 나무위키 각 보스 문서 본문의 상세 정보표 "주요 보상" 칸에서
 * 카테고리(장비/소비/개인)·난이도(이지/노멀/하드/카오스/익스트림)별 보상과 아이콘을 수집한다.
 * 주간 결정 보스만 대상 (일간·월간 제외).
 *
 * 나무위키 표기 예 (유피테르):
 *   주요 보상
 *     장비: 유피테르로이드
 *     소비: 놀라운 긍정의 혼돈 주문서 60%
 *     개인: 뒤틀린 갈망의 편린
 *     하드: 갈망의 에테르넬 방어구 상자, 오만의 원죄
 *
 * 결과:
 *   public/items/*.png|webp         — 아이템 아이콘 (자체 호스팅, 원본 크기 그대로)
 *   src/data/boss_reward_items.json — { 보스: { 카테고리: [{ name, file, w, h }] } }
 *
 * 주의: 이미지 원저작권은 넥슨. 재배포 책임은 배포자에게.
 *
 * 사용:
 *   node scripts/fetch-namu-item-icons.mjs --inspect   # 파싱 결과만 출력
 *   node scripts/fetch-namu-item-icons.mjs             # 아이콘 다운로드 + JSON 갱신
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync, rmSync, readdirSync } from "node:fs";
import path from "node:path";

const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";
const OUT_DIR = path.join(process.cwd(), "public", "items");
const OUT_JSON = path.join(process.cwd(), "src", "data", "boss_reward_items.json");
const CACHE_DIR = path.join(process.cwd(), ".cache-namu-bosses");
const inspect = process.argv.includes("--inspect");

/**
 * 나무위키 보상표의 라벨은 형식이 제각각이다:
 *   "장비:" "소비:" "개인:" "기타:"  (분류)
 *   "공통:" "공통"                   (난이도 무관)
 *   "하드:" "카오스"                 (해당 난이도 전용)
 *   "노멀 이상:" "하드 이상:"        (그 난이도부터)
 * 태그를 '|' 로 바꾼 뒤, 한 구획이 통째로 라벨인 경우만 인정한다.
 * (그래야 "카오스 자쿰의 투구" 같은 아이템 이름을 라벨로 오인하지 않는다.)
 */
const COMMON = ["장비", "소비", "개인", "기타", "공용", "공통"];
const DIFF_KO = { 이지: "easy", 노멀: "normal", 노말: "normal", 하드: "hard", 카오스: "chaos", 익스트림: "extreme" };
const DIFF_NAMES = Object.keys(DIFF_KO);
const LABEL_ALT = [...COMMON, ...DIFF_NAMES.map((d) => `${d}(?:\\s*이상)?`)].join("|");
const LABEL_RE = new RegExp(`\\|\\s*(${LABEL_ALT})\\s*:?\\s*(?=\\|)`, "g");
/** 보상 칸의 끝: &nbsp; 가 여러 번 이어지면 표가 끝나고 본문이다 */
const CELL_END = /(?:&nbsp;\s*){3,}/;
/** 평문으로 편 뒤, 여기부터는 본문/몬스터 스탯표다. 태그를 '|' 로 바꿔 놨으므로 구분자에 | 도 포함. */
// 주의: 아이콘 마커에 i.namu.wiki URL 이 들어 있으므로 여기에 넣으면 안 된다 (전부 잘려 나간다).
const TEXT_END = /\d+\.\d*\.[\s|]|MONSTER|레벨\s*\d|HP\s*[\d#]|스토리 모드/;
/** 아이템 이름으로 볼 수 없는 것 */
function isJunkName(n) {
  if (!n || n.length > 30 || n.length < 3) return true; // 실제 아이템명은 3자 이상 ("넉백" 같은 본문 단어 제외)
  if (/^\?+$/.test(n)) return true;
  if (n.endsWith(":")) return true; // "재료:" 같은 하위 라벨
  if (/레벨|HP|MONSTER|base64|svg|namu\.wiki|페이즈|체력|등급|적용|비슷|처럼|즉사|방해|패턴|공격|넉백|경직/.test(n)) return true;
  if (/^\d/.test(n) || /\d+(억|조|만)/.test(n)) return true;
  if (/\d+$/.test(n)) return true; // "노멀은 700" 같은 본문 꼬리
  if (new RegExp(`^(${[...COMMON, ...DIFF_NAMES].join("|")})$`).test(n)) return true;
  return false;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const slug = (s) => s.replace(/[\\/:*?"<>|]/g, "").replace(/\s+/g, "-");
const decode = (s) =>
  s
    .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&nbsp;/g, " ")
    .replace(/&#x2F;/g, "/").replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCharCode(parseInt(n, 16)));

const prices = JSON.parse(readFileSync(path.join(process.cwd(), "src", "data", "boss_crystal_prices.json"), "utf8"));
const icons = JSON.parse(readFileSync(path.join(process.cwd(), "src", "data", "boss_icons.json"), "utf8"));
const nonWeekly = new Set([...(prices._meta.daily ?? []), ...(prices._meta.monthly ?? [])]);
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
    if (!res.ok) { console.log(`  ${boss}: 문서 ${res.status}`); return null; }
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
 * 본문 상세표의 '주요 보상' 칸을 찾는다.
 * 인포박스에도 같은 라벨이 있으므로, 뒤에 카테고리 라벨(장비:/개인:/하드: …)이 오는 쪽을 고른다.
 */
function findRewardCell(html) {
  const found = [];
  let i = -1;
  while ((i = html.indexOf("주요 보상", i + 1)) >= 0) found.push(i);
  // 뒤쪽(본문 상세표)부터 본다. 인포박스에는 분류 라벨이 없다.
  for (const at of [...found].reverse()) {
    let cell = html.slice(at, at + 20000);
    const cut = cell.search(CELL_END);
    if (cut > 0) cell = cell.slice(0, cut);
    const piped = cell.replace(/<[^>]+>/g, "|");
    LABEL_RE.lastIndex = 0;
    if (LABEL_RE.test(piped)) return cell;
  }
  return null;
}

/** 아이콘 뒤 텍스트에서 아이템 이름 후보를 뽑는다. 본문이 시작되면 거기서 끊는다. */
function splitNames(text) {
  const cut = text.search(TEXT_END);
  const head = cut >= 0 ? text.slice(0, cut) : text;
  return head
    .split(/[,/]/)
    .map((t) => t.replace(/\s+/g, " ").trim())
    .filter((t) => !isJunkName(t));
}

/** 카테고리 → [{name, src}] */
function parseRewards(cell) {
  // 아이콘을 마커로 치환, 나머지 태그는 구획 구분자 '|' 로.
  let s = cell.replace(/<img\b[^>]*>/g, (tag) => {
    const src = (tag.match(/\bdata-src=['"]([^'"]+)['"]/) ?? tag.match(/\bsrc=['"]([^'"]+)['"]/))?.[1] ?? "";
    if (!src.includes("i.namu.wiki")) return "|";
    return `|${src.startsWith("//") ? "https:" + src : src}|`;
  });
  s = s.replace(/<[^>]+>/g, "|");
  s = decode(s);
  // 각주 표시 [파편] [설명] [19] 등 제거
  s = s.replace(/\[[^\][]{0,20}\]/g, " ").replace(/[ \t]+/g, " ");
  // noscript 로 같은 아이콘이 연달아 두 번 나온다
  s = s.replace(/([^]+)(\s*\|)*\s*\1/g, "$1");
  // 표가 끝나고 본문/스탯표가 시작되는 지점에서 자른다
  const stop = s.search(TEXT_END);
  if (stop > 0) s = s.slice(0, stop);

  const out = {};
  LABEL_RE.lastIndex = 0;
  const marks = [...s.matchAll(LABEL_RE)];
  if (!marks.length) return out;
  for (let i = 0; i < marks.length; i++) {
    // "노멀 이상" 은 그 난이도부터 전부 → "노멀+" 로 표기해 구분을 남긴다
    const rawLabel = marks[i][1].trim();
    const label = /\s*이상$/.test(rawLabel) ? `${rawLabel.replace(/\s*이상$/, "")}+` : rawLabel;
    const from = marks[i].index + marks[i][0].length;
    const to = i + 1 < marks.length ? marks[i + 1].index : s.length;
    const chunk = s.slice(from, to);
    const items = [];
    // 아이콘 마커 기준으로 자르고, 마커 뒤 텍스트를 이름으로 본다.
    // 보상표 항목은 예외 없이 아이콘을 갖는다 → 아이콘 없는 토막은 본문이므로 버린다.
    const parts = chunk.split(/([^]+)/);
    for (let p = 1; p < parts.length; p += 2) {
      const src = parts[p];
      const after = (parts[p + 1] ?? "").replace(/\|/g, " ");
      const name = splitNames(after)[0] ?? "";
      if (!name) continue;
      if (items.some((x) => x.name === name)) continue;
      items.push({ name, src });
    }
    if (items.length) out[label] = items;
  }
  return out;
}

const parsed = {};
let itemCount = 0;
for (const boss of weeklyBosses) {
  const html = await pageHtml(boss);
  if (!html) continue;
  const cell = findRewardCell(html);
  if (!cell) { console.log(`MISS ${boss} — 상세 보상표 없음`); continue; }
  const cats = parseRewards(cell);
  if (!Object.keys(cats).length) { console.log(`MISS ${boss} — 파싱 결과 없음`); continue; }
  parsed[boss] = cats;
  itemCount += Object.values(cats).flat().length;
  const summary = Object.entries(cats).map(([c, items]) => `${c}: ${items.map((i) => i.name).join(", ")}`).join(" | ");
  console.log(`OK   ${boss.padEnd(13)} ${summary}`);
}
console.log(`\n보스 ${Object.keys(parsed).length}/${weeklyBosses.length}, 아이템 ${itemCount}개`);

if (inspect) {
  console.log("--inspect: 다운로드 안 함");
  process.exit(0);
}

function dim(buf) {
  if (buf.readUInt32BE(0) === 0x89504e47) return { w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) };
  if (buf.toString("ascii", 0, 4) === "RIFF") {
    const f = buf.toString("ascii", 12, 16);
    if (f === "VP8 ") return { w: buf.readUInt16LE(26) & 0x3fff, h: buf.readUInt16LE(28) & 0x3fff };
    if (f === "VP8X") return { w: (buf.readUIntLE(24, 3) & 0xffffff) + 1, h: (buf.readUIntLE(27, 3) & 0xffffff) + 1 };
    if (f === "VP8L") { const b = buf.readUInt32LE(21); return { w: (b & 0x3fff) + 1, h: ((b >> 14) & 0x3fff) + 1 }; }
  }
  return {};
}

// 이전 수집분 정리 (이름 규칙이 바뀌므로)
if (existsSync(OUT_DIR)) for (const f of readdirSync(OUT_DIR)) rmSync(path.join(OUT_DIR, f), { force: true });
mkdirSync(OUT_DIR, { recursive: true });

const cacheBySrc = new Map();
const final = {};
for (const [boss, cats] of Object.entries(parsed)) {
  const outCats = {};
  for (const [cat, items] of Object.entries(cats)) {
    const list = [];
    for (const it of items) {
      let meta = cacheBySrc.get(it.src);
      if (!meta) {
        try {
          const res = await fetch(it.src, { headers: { "User-Agent": UA, Referer: "https://namu.wiki/" }, signal: AbortSignal.timeout(25000) });
          if (!res.ok) { console.log(`  이미지 실패 ${boss}/${it.name} ${res.status}`); continue; }
          const buf = Buffer.from(await res.arrayBuffer());
          const ct = res.headers.get("content-type") ?? "";
          const ext = ct.includes("webp") ? ".webp" : ct.includes("gif") ? ".gif" : ".png";
          const file = `${slug(it.name)}${ext}`;
          writeFileSync(path.join(OUT_DIR, file), buf);
          meta = { file: `/items/${file}`, ...dim(buf) };
          cacheBySrc.set(it.src, meta);
        } catch (e) {
          console.log(`  이미지 예외 ${boss}/${it.name} ${e?.name ?? e}`);
          continue;
        }
        await sleep(120);
      }
      list.push({ name: it.name, file: meta.file, w: meta.w, h: meta.h });
    }
    if (list.length) outCats[cat] = list;
  }
  if (Object.keys(outCats).length) final[boss] = outCats;
}

writeFileSync(
  OUT_JSON,
  JSON.stringify(
    {
      _meta: {
        updated: new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10),
        source: "나무위키 각 보스 문서 본문 상세표의 '주요 보상' 칸",
        difficultyMap: DIFF_KO,
        commonCategories: COMMON,
        notes: [
          "주간 결정 보스만 수집한다 (일간·월간 제외).",
          "장비·소비·개인은 난이도 공통, 이지/노멀/하드/카오스/익스트림은 해당 난이도 전용 보상이다.",
          "아이콘 원저작권은 넥슨. public/items 에 자체 호스팅하며 런타임에 외부 요청을 하지 않는다.",
          "w/h 는 원본 픽셀 크기 — 화면에서 축소하지 않고 그대로 쓴다.",
          "재수집: node scripts/fetch-namu-item-icons.mjs",
        ],
      },
      items: final,
    },
    null,
    2,
  ) + "\n",
);
const n = Object.values(final).flatMap((c) => Object.values(c).flat()).length;
console.log(`\n${n}개 저장 → public/items (${readdirSync(OUT_DIR).length} 파일), ${OUT_JSON}`);
