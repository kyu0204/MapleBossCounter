/**
 * 손으로 받아 둔 아이템 아이콘을 프로젝트에 반입한다.
 *
 * i.namu.wiki 는 스크립트 요청을 403(code:8)으로 막는다 (60초/300초/900초 간격 네 라운드 전부 실패).
 * 브라우저로는 열리므로, 받아 둔 파일을 폴더에 모아 이 스크립트로 반입한다.
 *
 * 하는 일:
 *   <받은 폴더>/<이름>.<확장자>  →  public/items/<아이템명>.<확장자>
 *   원본 픽셀 크기를 파일에서 직접 읽어 src/data/extra_item_icons.json 에 병합
 *
 * 파일 이름은 아래 ALIAS 의 키이거나 아이템 정식 이름이면 된다.
 * 목록에 없는 파일은 건드리지 않는다 (보스 아이콘이 같은 폴더에 섞여 있어도 안전하다).
 *
 * 사용:
 *   node scripts/import-item-icons.mjs --from "C:/Users/SSAFY/Downloads/maple_boss" --dry
 *   node scripts/import-item-icons.mjs --from "C:/Users/SSAFY/Downloads/maple_boss"
 *   node scripts/build-boss-rewards.mjs      # 반입 후 데이터 재생성
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync } from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const OUT_DIR = path.join(ROOT, "public", "items");
const OUT_JSON = path.join(ROOT, "src", "data", "extra_item_icons.json");
const dry = process.argv.includes("--dry");
const verbose = process.argv.includes("--verbose");
const fromArg = process.argv[process.argv.indexOf("--from") + 1];
const INBOX = process.argv.includes("--from") && fromArg ? path.resolve(fromArg) : path.join(ROOT, ".item-icons-inbox");

/** 아이템 → 출처 (기록용) */
const SOURCE = {
  "메멘토 실버 큐브": "나무위키 큐브(메이플스토리)",
  "메멘토 골드 큐브": "나무위키 큐브(메이플스토리)",
  "메멘토 브론즈 에디셔널 큐브": "나무위키 큐브(메이플스토리)",
  "주문의 흔적": "나무위키 큐브(메이플스토리)",
  "솔 에르다의 기운": "나무위키 솔 에르다",
  "생명의 보스 반지 상자": "나무위키 특수 스킬 반지",
  "백옥의 보스 반지 상자": "나무위키 특수 스킬 반지",
  "녹옥의 보스 반지 상자": "나무위키 특수 스킬 반지",
  "홍옥의 보스 반지 상자": "나무위키 특수 스킬 반지",
  "흑옥의 보스 반지 상자": "나무위키 특수 스킬 반지",
  "영롱한 달빛 포션": "사용자 제공",
  "에리온의 조각": "사용자 제공",
  // 2026-09-17 패치 신규 드롭 (4단계)
  "1단계 소울 에테르": "사용자 제공",
  "2단계 소울 에테르": "사용자 제공",
  "3단계 소울 에테르": "사용자 제공",
  "4단계 소울 에테르": "사용자 제공",
  // 검은 마법사 전용 (월간 보스라 뒤늦게 수집했다)
  "창세의 뱃지": "나무위키 검은 마법사/보스 몬스터",
  "익셉셔널 해머 (벨트)": "나무위키 검은 마법사/보스 몬스터",
  // 아래 넷은 없어도 화면에 아이콘이 나온다. 지금은 무기·방어구가 "○○ 장비 상자" 그림을 같이 쓴다.
  "아케인셰이드 방어구 상자": "나무위키 더스크",
  "아케인셰이드 무기 상자": "나무위키 더스크",
  "앱솔랩스 방어구 상자": "나무위키 데미안",
  "앱솔랩스 무기 상자": "나무위키 데미안",
};

/** 파일 이름으로 써도 되는 짧은 별칭 */
const ALIAS = {
  실버: "메멘토 실버 큐브",
  골드: "메멘토 골드 큐브",
  브론즈: "메멘토 브론즈 에디셔널 큐브",
  에르다: "솔 에르다의 기운",
  에리온: "에리온의 조각",
  달빛: "영롱한 달빛 포션",
  생명: "생명의 보스 반지 상자",
  백옥: "백옥의 보스 반지 상자",
  녹옥: "녹옥의 보스 반지 상자",
  홍옥: "홍옥의 보스 반지 상자",
  흑옥: "흑옥의 보스 반지 상자",
  창세: "창세의 뱃지",
  해머벨트: "익셉셔널 해머 (벨트)",
  아케인방어구: "아케인셰이드 방어구 상자",
  아케인무기: "아케인셰이드 무기 상자",
  앱솔방어구: "앱솔랩스 방어구 상자",
  앱솔무기: "앱솔랩스 무기 상자",
  소울1: "1단계 소울 에테르",
  소울2: "2단계 소울 에테르",
  소울3: "3단계 소울 에테르",
  소울4: "4단계 소울 에테르",
};

const slug = (s) => s.replace(/[\\/:*?"<>|]/g, "").replace(/\s+/g, "-");
const norm = (s) => s.replace(/[\s-]/g, "");

/** 파일명(확장자 뗀 것) → 아이템 정식 이름 */
const lookup = new Map();
for (const n of Object.keys(SOURCE)) lookup.set(norm(n), n);
for (const [a, n] of Object.entries(ALIAS)) lookup.set(norm(a), n);

const OK_EXT = new Set([".png", ".webp", ".gif", ".jpg", ".jpeg"]);

/** 원본 픽셀 크기. 화면에서 축소하지 않고 이 크기로 그린다. */
function dim(buf) {
  if (buf.length >= 24 && buf.readUInt32BE(0) === 0x89504e47) return { w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) };
  if (buf.length >= 30 && buf.toString("ascii", 0, 4) === "RIFF" && buf.toString("ascii", 8, 12) === "WEBP") {
    const f = buf.toString("ascii", 12, 16);
    if (f === "VP8 ") return { w: buf.readUInt16LE(26) & 0x3fff, h: buf.readUInt16LE(28) & 0x3fff };
    if (f === "VP8X") return { w: (buf.readUIntLE(24, 3) & 0xffffff) + 1, h: (buf.readUIntLE(27, 3) & 0xffffff) + 1 };
    if (f === "VP8L") { const b = buf.readUInt32LE(21); return { w: (b & 0x3fff) + 1, h: ((b >> 14) & 0x3fff) + 1 }; }
  }
  if (buf.length >= 10 && buf.toString("ascii", 0, 3) === "GIF") return { w: buf.readUInt16LE(6), h: buf.readUInt16LE(8) };
  if (buf.length >= 4 && buf[0] === 0xff && buf[1] === 0xd8) {
    let i = 2;
    while (i + 9 < buf.length) {
      if (buf[i] !== 0xff) { i++; continue; }
      const m = buf[i + 1];
      if (m >= 0xc0 && m <= 0xcf && m !== 0xc4 && m !== 0xc8 && m !== 0xcc) return { h: buf.readUInt16BE(i + 5), w: buf.readUInt16BE(i + 7) };
      i += 2 + buf.readUInt16BE(i + 2);
    }
  }
  return {};
}

if (!existsSync(INBOX)) {
  console.log(`폴더가 없다: ${INBOX}`);
  console.log(`--from 으로 받은 폴더를 지정하거나 ${path.join(ROOT, ".item-icons-inbox")} 를 만들어라.`);
  process.exit(1);
}

const taken = [];
const bad = [];
let ignored = 0;
for (const f of readdirSync(INBOX)) {
  if (f.startsWith(".")) continue;
  const ext = path.extname(f).toLowerCase();
  const name = lookup.get(norm(path.basename(f, path.extname(f))));
  if (!name) { ignored++; if (verbose) console.log(`무시 ${f}`); continue; }
  if (!OK_EXT.has(ext)) { bad.push(`${f} — 지원하지 않는 확장자 ${ext}`); continue; }
  const buf = readFileSync(path.join(INBOX, f));
  const d = dim(buf);
  // 크기를 못 읽으면 넣지 않는다. w/h 가 없으면 화면에서 칩 크기가 튄다.
  if (!d.w || !d.h) { bad.push(`${f} — 크기를 못 읽었다 (손상됐거나 다른 형식)`); continue; }
  if (taken.some((t) => t.name === name)) { bad.push(`${f} — ${name} 이 이미 들어왔다 (중복)`); continue; }
  taken.push({ name, file: `${slug(name)}${ext}`, buf, ...d });
}

for (const t of taken) console.log(`OK   ${t.name.padEnd(22)} ${t.file.padEnd(30)} ${`${t.w}x${t.h}`.padEnd(7)} ${(t.buf.length / 1024).toFixed(1)}KB`);
for (const b of bad) console.log(`오류 ${b}`);
if (ignored) console.log(`목록에 없는 파일 ${ignored}개는 건드리지 않았다${verbose ? "" : " (--verbose 로 이름 확인)"}.`);

const missing = Object.keys(SOURCE).filter((n) => !taken.some((t) => t.name === n));
if (missing.length) console.log(`\n아직 없는 ${missing.length}종: ${missing.join(", ")}`);

if (!taken.length) { console.log("\n반입할 것이 없다."); process.exit(0); }
if (dry) { console.log("\n--dry: 아무것도 쓰지 않았다."); process.exit(0); }

mkdirSync(OUT_DIR, { recursive: true });

// 기존 등록분에 병합한다. fetch-extra-item-icons.mjs 도 같은 파일을 쓰므로 덮어쓰면 안 된다.
let prev = { items: {} };
if (existsSync(OUT_JSON)) { try { prev = JSON.parse(readFileSync(OUT_JSON, "utf8")); } catch { /* 깨졌으면 새로 쓴다 */ } }
const items = { ...(prev.items ?? {}) };
for (const t of taken) {
  writeFileSync(path.join(OUT_DIR, t.file), t.buf);
  items[t.name] = { file: `/items/${t.file}`, w: t.w, h: t.h, source: SOURCE[t.name] };
}

writeFileSync(
  OUT_JSON,
  JSON.stringify(
    {
      _meta: {
        updated: new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10),
        source: "보스 인포박스에 아이콘이 없는 소비·교환 아이템. 나무위키 아이템 문서 또는 사용자 제공.",
        notes: [
          "i.namu.wiki 가 스크립트 요청을 403(code:8)으로 막아, 브라우저로 받은 파일을 손으로 반입한다.",
          "메멘토 큐브는 나무위키 큐브 문서에 접두어 없이 '실버/골드/브론즈 에디셔널 큐브' 로 적혀 있다.",
          "w/h 는 원본 픽셀 크기 — 화면에서 축소하지 않고 그대로 쓴다.",
          "아이콘 원저작권은 넥슨. public/items 에 자체 호스팅하며 런타임에 외부 요청을 하지 않는다.",
          "반입: node scripts/import-item-icons.mjs --from <폴더>  →  node scripts/build-boss-rewards.mjs",
        ],
      },
      items,
    },
    null,
    2,
  ) + "\n",
);

console.log(`\n${taken.length}개 반입 → public/items (등록 ${Object.keys(items).length}종), ${OUT_JSON}`);
console.log("다음: node scripts/build-boss-rewards.mjs");
