/**
 * 시세는 잡혔는데 아이콘이 없는 아이템의 아이콘을 받아 온다.
 *
 * 출처: 메이플증권(mitemprice.kr) 이 시세표에 쓰는 이미지. robots.txt 가 "/" 를 허용한다.
 * 아이콘 원저작권은 넥슨이다. 받은 파일은 public/items 에 두고 런타임에는 외부로
 * 요청하지 않는다 — 나머지 아이콘과 같은 규칙이다.
 *
 * 왜 필요하나
 *   에테르넬 방어구 35종과 특수 반지 2종은 보스가 직접 주는 보상이 아니라 상자 속이라
 *   나무위키 보스 문서에서 아이콘을 못 긁었다. 시세 탭에서 이름만 늘어놓으면 무엇이
 *   무엇인지 눈에 안 들어온다.
 *
 * 쓰기: node scripts/fetch-price-icons.mjs [--dry]
 */
import fs from "node:fs";
import path from "node:path";

const HOST = "https://mitemprice.kr";
const D = (f) => path.join("src", "data", f);
const OUT_DIR = path.join("public", "items");
const OUT_JSON = D("extra_item_icons.json");
const dry = process.argv.includes("--dry");
const GAP_MS = 400;
const UA = "maple-board/1.0 icon reader (+https://github.com/kyu0204/MapleBossCounter; one-off, public page only)";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** PNG/WebP 헤더에서 원본 픽셀 크기를 읽는다. 크기를 모르면 화면에서 아이콘이 튄다. */
function dim(buf) {
  if (buf.readUInt32BE(0) === 0x89504e47) return { w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) };
  if (buf.toString("ascii", 0, 4) === "RIFF") {
    const f = buf.toString("ascii", 12, 16);
    if (f === "VP8 ") return { w: buf.readUInt16LE(26) & 0x3fff, h: buf.readUInt16LE(28) & 0x3fff };
    if (f === "VP8X") return { w: (buf.readUIntLE(24, 3) & 0xffffff) + 1, h: (buf.readUIntLE(27, 3) & 0xffffff) + 1 };
    if (f === "VP8L") {
      const b = buf.readUInt32LE(21);
      return { w: (b & 0x3fff) + 1, h: ((b >> 14) & 0x3fff) + 1 };
    }
  }
  return {};
}

// ---------- 무엇이 비었는지 ----------

const prices = JSON.parse(fs.readFileSync(D("item_prices.json"), "utf8"));
const rewards = JSON.parse(fs.readFileSync(D("boss_rewards.json"), "utf8"));
const boxes = JSON.parse(fs.readFileSync(D("box_contents.json"), "utf8"));
const extra = fs.existsSync(OUT_JSON) ? JSON.parse(fs.readFileSync(OUT_JSON, "utf8")) : { items: {} };

const known = new Set(Object.keys(extra.items));
for (const diffs of Object.values(rewards.bosses)) {
  for (const v of Object.values(diffs)) {
    for (const r of v.rewards ?? []) if (r.icon) known.add(r.name);
    for (const c of Object.values(v.cubes ?? {})) if (c.icon) known.add(c.name);
  }
}

/** 에테르넬은 사이트가 직업군 폴더로 나눠 둬서, 이름만으로는 경로를 못 만든다. */
const eternelGroup = new Map();
for (const [group, parts] of Object.entries(boxes.eternelArmor)) {
  for (const name of Object.values(parts)) eternelGroup.set(name, group);
}

/** 사이트 폴더 이름이 우리 직업군 이름과 다른 경우. */
const GROUP_DIR = { 마법사: "법사" };

/** 그 사이트에서 이 아이템 이미지가 있을 법한 자리들. 위에서부터 시도한다. */
function candidates(name) {
  const g = eternelGroup.get(name);
  if (g) return [`image/에테르넬/${GROUP_DIR[g] ?? g}/${name}.png`, `image/에테르넬/${g}/${name}.png`];
  return [`image/그외/${name}.png`, `image/칠흑/${name}.png`, `image/마라벨/${name}.png`];
}

const missing = Object.keys(prices.items).filter((n) => !known.has(n));
console.log(`시세 ${Object.keys(prices.items).length}종 중 아이콘 없는 것 ${missing.length}종`);
if (missing.length === 0) process.exit(0);

// ---------- 받기 ----------

const added = {};
const failed = [];
for (const name of missing) {
  let saved = false;
  for (const rel of candidates(name)) {
    const url = `${HOST}/${rel.split("/").map(encodeURIComponent).join("/")}`;
    let buf;
    try {
      const res = await fetch(url, { headers: { accept: "image/*", "user-agent": UA } });
      if (!res.ok) continue;
      buf = Buffer.from(await res.arrayBuffer());
    } catch (e) {
      console.warn(`  ! ${name}: ${e.message}`);
      continue;
    }
    const { w, h } = dim(buf);
    if (!w || !h) {
      console.warn(`  ! ${name}: 이미지 크기를 못 읽었다 (${buf.length}바이트)`);
      continue;
    }
    const file = `${name.replace(/\s+/g, "-")}.png`;
    if (!dry) {
      fs.mkdirSync(OUT_DIR, { recursive: true });
      fs.writeFileSync(path.join(OUT_DIR, file), buf);
    }
    added[name] = { file: `/items/${file}`, w, h, source: "메이플증권(mitemprice.kr)" };
    console.log(`OK   ${name.padEnd(22)} ${w}x${h}  ← ${rel}`);
    saved = true;
    break;
  }
  if (!saved) failed.push(name);
  await sleep(GAP_MS);
}

if (failed.length) console.log(`\n못 받은 것 ${failed.length}종: ${failed.join(", ")}`);

if (dry) {
  console.log("\n[--dry] 파일을 쓰지 않는다.");
  process.exit(0);
}

// 손으로 반입한 아이콘과 같은 파일을 쓴다. 덮어쓰지 말고 병합한다.
extra.items = { ...extra.items, ...added };
extra._meta = { ...(extra._meta ?? {}), updated: new Date().toISOString().slice(0, 10) };
fs.writeFileSync(OUT_JSON, JSON.stringify(extra, null, 2) + "\n");
console.log(`\n→ ${OUT_JSON} (${Object.keys(added).length}종 추가)`);
console.log("보상 아이콘 색인에도 반영하려면: node scripts/build-boss-rewards.mjs");
