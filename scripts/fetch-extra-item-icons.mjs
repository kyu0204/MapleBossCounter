/**
 * 보스 문서의 '주요 보상' 칸에 아이콘이 없어 글자로만 나오던 아이템들의 아이콘을 모은다.
 *
 * 보스 문서 인포박스에는 장비 위주로만 아이콘이 붙어 있어서, 큐브·상자·연마석 같은
 * 소비/교환 아이템은 이름만 남는다. 그 아이템들은 각자 전용 문서(큐브·특수 스킬 반지·솔 에르다)나
 * 다른 보스 문서에 아이콘 카드가 있으므로 거기서 가져온다.
 *
 * 결과:
 *   public/items/*.png|webp          — 아이콘 (원본 크기 그대로)
 *   src/data/extra_item_icons.json   — { 아이템명: { file, w, h, source } }
 *
 * 나무위키 아이콘 카드 구조: <img alt='item …'> 뒤에 곧바로 이름 텍스트가 온다.
 * alt 는 20자쯤에서 잘리므로(예: "item 큐브 브론즈 에디셔널...") 캡션 텍스트로 맞춘다.
 *
 * 사용:
 *   node scripts/fetch-extra-item-icons.mjs --inspect   # 매칭만 확인
 *   node scripts/fetch-extra-item-icons.mjs             # 다운로드 + JSON 갱신
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import path from "node:path";

const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";
const OUT_DIR = path.join(process.cwd(), "public", "items");
const OUT_JSON = path.join(process.cwd(), "src", "data", "extra_item_icons.json");
const CACHE_DIR = path.join(process.cwd(), ".cache-namu-items");
const BOSS_CACHE = path.join(process.cwd(), ".cache-namu-bosses");
const inspect = process.argv.includes("--inspect");

/**
 * name    — boss_rewards.json 에 들어가는 이름
 * doc     — 나무위키 문서 (bossDoc 이면 보스 문서 캐시를 재사용한다)
 * caption — 아이콘 바로 뒤 텍스트로 찾는다
 * alt     — img 의 alt 로 찾는다. 뒤에 설명문이 붙어 캡션이 안 잡히는 카드용.
 *           나무위키 alt 는 20자쯤에서 "..." 로 잘리므로 잘린 그대로 적는다.
 */
const SPECS = [
  // 메멘토 큐브 3종: 큐브 문서에는 접두어 없이 "실버 큐브" 로만 적혀 있다
  { name: "메멘토 실버 큐브", doc: "큐브(메이플스토리)", caption: "실버 큐브" },
  { name: "메멘토 골드 큐브", doc: "큐브(메이플스토리)", caption: "골드 큐브" },
  { name: "메멘토 브론즈 에디셔널 큐브", doc: "큐브(메이플스토리)", caption: "브론즈 에디셔널 큐브" },
  { name: "주문의 흔적", doc: "큐브(메이플스토리)", caption: "주문의 흔적" },

  // 보스 반지 상자 5종 + 연마석 2종
  { name: "생명의 보스 반지 상자", doc: "특수 스킬 반지", caption: "생명의 보스 반지 상자" },
  { name: "백옥의 보스 반지 상자", doc: "특수 스킬 반지", caption: "백옥의 보스 반지 상자" },
  { name: "녹옥의 보스 반지 상자", doc: "특수 스킬 반지", caption: "녹옥의 보스 반지 상자" },
  { name: "홍옥의 보스 반지 상자", doc: "특수 스킬 반지", caption: "홍옥의 보스 반지 상자" },
  { name: "흑옥의 보스 반지 상자", doc: "특수 스킬 반지", caption: "흑옥의 보스 반지 상자" },

  // 솔 에르다의 기운: 문서에 희미한(10)·보통(200)·짙은(500) 3종이 있다. 보스 보상은 충전량 표기라 보통 등급 아이콘을 쓴다.
  { name: "솔 에르다의 기운", doc: "솔 에르다", alt: "솔 에르다의 기운 (200)" },

  // 검은 마법사 전용. 다른 보스 문서에는 없다.
  { name: "창세의 뱃지", bossDoc: "검은 마법사", alt: "창세의 뱃지" },
  { name: "익셉셔널 해머 (벨트)", bossDoc: "검은 마법사", alt: "익셉셔널 해머 (벨트)" },

  // --- 아래는 없어도 화면에 아이콘이 나온다 (더 정확한 아이콘으로 바꿔 주는 것뿐) ---
  // 보스 문서에는 무기·방어구가 "○○ 장비 상자" 아이콘 하나로 묶여 있어 지금은 둘이 같은 그림을 쓴다
  { name: "아케인셰이드 방어구 상자", bossDoc: "더스크", alt: "item 아케인셰이드 방어구 ..." },
  { name: "아케인셰이드 무기 상자", bossDoc: "더스크", alt: "item 아케인셰이드 무기 상..." },
  { name: "앱솔랩스 방어구 상자", bossDoc: "데미안", alt: "item 앱솔랩스 방어구 상자" },
  { name: "앱솔랩스 무기 상자", bossDoc: "데미안", alt: "item 앱솔랩스 무기 상자" },
];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const slug = (s) => s.replace(/[\\/:*?"<>|]/g, "").replace(/\s+/g, "-");
const decode = (s) =>
  s
    .replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"').replace(/&#x2F;/g, "/")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCharCode(parseInt(n, 16)));
const squash = (s) => s.replace(/\s+/g, " ").trim();

async function docHtml(doc) {
  mkdirSync(CACHE_DIR, { recursive: true });
  const cache = path.join(CACHE_DIR, `${slug(doc)}.html`);
  if (existsSync(cache)) return readFileSync(cache, "utf8");
  const url = `https://namu.wiki/w/${encodeURIComponent(doc).replace(/%2F/g, "/")}`;
  try {
    const res = await fetch(url, { headers: { "User-Agent": UA, "Accept-Language": "ko-KR,ko;q=0.9" }, signal: AbortSignal.timeout(30000) });
    if (!res.ok) { console.log(`  문서 ${doc}: HTTP ${res.status}`); return null; }
    const html = await res.text();
    writeFileSync(cache, html);
    await sleep(400);
    return html;
  } catch (e) {
    console.log(`  문서 ${doc}: ${e?.name ?? e}`);
    return null;
  }
}

function bossHtml(boss) {
  const f = path.join(BOSS_CACHE, `${slug(boss)}.html`);
  return existsSync(f) ? readFileSync(f, "utf8") : null;
}

/** 문서 안의 i.namu.wiki 아이콘과 그 alt·바로 뒤 캡션 */
function iconCards(html) {
  const cards = [];
  for (const m of html.matchAll(/<img\b[^>]*>/g)) {
    const src = (m[0].match(/\bdata-src=['"]([^'"]+)['"]/) ?? m[0].match(/\bsrc=['"]([^'"]+)['"]/))?.[1] ?? "";
    if (!src.includes("i.namu.wiki")) continue;
    const end = m.index + m[0].length;
    const caption = squash(
      decode(html.slice(end, end + 300).replace(/<[^>]+>/g, "|")).split("|").map((t) => t.trim()).filter(Boolean)[0] ?? "",
    );
    const alt = squash(decode(m[0].match(/\balt=['"]([^'"]*)['"]/)?.[1] ?? ""));
    cards.push({ src: src.startsWith("//") ? "https:" + src : src, caption, alt });
  }
  return cards;
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

// ---------- 매칭 ----------

const htmlCache = new Map();
const matched = [];
const missed = [];
for (const spec of SPECS) {
  const src = spec.bossDoc ?? spec.doc;
  if (!htmlCache.has(src)) htmlCache.set(src, spec.bossDoc ? bossHtml(spec.bossDoc) : await docHtml(spec.doc));
  const html = htmlCache.get(src);
  if (!html) { missed.push(`${spec.name} (문서 ${src} 없음)`); continue; }
  const want = spec.alt ?? spec.caption;
  const hit = iconCards(html).find((c) => (spec.alt ? c.alt === spec.alt : c.caption === spec.caption));
  if (!hit) { missed.push(`${spec.name} (${spec.alt ? "alt" : "캡션"} "${want}" 없음)`); continue; }
  matched.push({ ...spec, src: hit.src, source: src });
  console.log(`OK   ${spec.name.padEnd(20)} ← ${src} / "${want}"`);
}
for (const m of missed) console.log(`MISS ${m}`);
console.log(`\n매칭 ${matched.length}/${SPECS.length}`);

if (inspect) { console.log("--inspect: 다운로드 안 함"); process.exit(0); }

// ---------- 다운로드 ----------

mkdirSync(OUT_DIR, { recursive: true });

/** 이미 받아 둔 것은 건너뛴다 (i.namu.wiki 는 연속 요청에 403 code:8 을 준다) */
const out = existsSync(OUT_JSON) ? (JSON.parse(readFileSync(OUT_JSON, "utf8")).items ?? {}) : {};
for (const [name, v] of Object.entries(out)) {
  if (!existsSync(path.join(process.cwd(), "public", v.file.replace(/^\//, "")))) delete out[name];
}

function saveJson() {
  writeFileSync(
    OUT_JSON,
    JSON.stringify(
      {
        _meta: {
          updated: new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10),
          source: "나무위키 아이템 전용 문서 및 보스 문서의 아이콘 카드",
          notes: [
            "보스 인포박스에 아이콘이 없는 소비·교환 아이템을 따로 모은 것이다.",
            "메멘토 큐브는 큐브 문서에 접두어 없이 '실버/골드/브론즈 에디셔널 큐브' 로 적혀 있다.",
            "영롱한 달빛 포션과 에리온의 조각은 나무위키에 아이콘 카드가 없어 여기에 없다 (짧은 라벨로 표시).",
            "i.namu.wiki 는 연속 다운로드에 403(code:8)을 주고 오래 막아 두기도 한다. 1분 안에 못 받으면 접고 손으로 받을 목록을 낸다.",
            "아이콘 원저작권은 넥슨. public/items 에 자체 호스팅하며 런타임에 외부 요청을 하지 않는다.",
            "재수집: node scripts/fetch-extra-item-icons.mjs",
          ],
        },
        items: out,
      },
      null,
      2,
    ) + "\n",
  );
}

/**
 * 한 번만, 1분 안에 끝낸다.
 * i.namu.wiki 는 연속 다운로드에 403(code:8)을 주고 몇 시간씩 막아 두기도 한다.
 * 기다리며 재시도해 봐야 소용이 없으므로, 안 되면 바로 접고 손으로 받을 목록을 낸다.
 */
const DEADLINE_MS = 60_000;
const startedAt = Date.now();
const left = () => DEADLINE_MS - (Date.now() - startedAt);

const todo = matched.filter((it) => !out[it.name]);
const failed = [];
for (const it of todo) {
  if (left() <= 0) { failed.push(it); continue; }
  try {
    const res = await fetch(it.src, {
      headers: { "User-Agent": UA, Referer: "https://namu.wiki/" },
      signal: AbortSignal.timeout(Math.min(10_000, Math.max(1_000, left()))),
    });
    if (!res.ok) { failed.push(it); console.log(`  실패 ${it.name} HTTP ${res.status}`); continue; }
    const buf = Buffer.from(await res.arrayBuffer());
    const ct = res.headers.get("content-type") ?? "";
    const ext = ct.includes("webp") ? ".webp" : ct.includes("gif") ? ".gif" : ".png";
    const file = `${slug(it.name)}${ext}`;
    writeFileSync(path.join(OUT_DIR, file), buf);
    out[it.name] = { file: `/items/${file}`, ...dim(buf), source: it.source };
    saveJson(); // 중간에 막혀도 받은 만큼은 남는다
    console.log(`  받음 ${it.name} (${buf.length}바이트)`);
  } catch (e) {
    failed.push(it);
    console.log(`  예외 ${it.name} ${e?.name ?? e}`);
  }
  await sleep(300);
}

if (failed.length) {
  console.log(`\n${Math.round((Date.now() - startedAt) / 1000)}초 안에 못 받은 ${failed.length}개. 브라우저로 열어 저장한 뒤`);
  console.log(`node scripts/import-item-icons.mjs --from <받은 폴더> 로 넣어라.\n`);
  for (const it of failed) console.log(`${it.name}\n  파일명: ${slug(it.name)}.png 또는 .webp (받은 형식대로)\n  주소: ${it.src}\n`);
}

saveJson();
console.log(`\n${Object.keys(out).length}/${matched.length}개 보유 → public/items, ${OUT_JSON}`);
