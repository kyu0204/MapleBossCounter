/**
 * 수집본(boss_rewards_raw.json)에서 화면에 낼 보상만 골라 src/data/boss_rewards.json 을 만든다.
 *
 * 선정 기준 (2026-09-15 확정)
 *   표시: 장비 아이템 전부 / 에테르넬·칠흑 장신구·보스 반지 상자 / 연마석 /
 *         아케인셰이드·앱솔랩스 상자 / 선택 상자 / 익셉셔널 해머 / 영롱한 달빛 포션
 *   수치: 솔 에르다의 기운, 파편·조각, 에리온의 조각, 메멘토 큐브 3종 → 아이콘 × 개수
 *   제외: 훈장·물약·경험치 쿠폰·주문서 교환권·혼돈 주문서·태초의 정수·소울 조각·메이린 치장품,
 *         강렬한 힘의 결정(가격표에 있음)과 가격 변동 이력, 소제목(주문서/기타)
 *
 * 큐브는 2026-09-17 패치 전/후 값을 함께 담아 가격표처럼 기준일로 고른다.
 *
 * 사용: node scripts/build-boss-rewards.mjs [--dry]
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const dry = process.argv.includes("--dry");
const D = (f) => path.join(process.cwd(), "src", "data", f);
const raw = JSON.parse(readFileSync(D("boss_rewards_raw.json"), "utf8"));
const iconFile = JSON.parse(readFileSync(D("boss_reward_items.json"), "utf8"));
const prices = JSON.parse(readFileSync(D("boss_crystal_prices.json"), "utf8"));
/** 보스 인포박스에 아이콘이 없어 따로 모은 것 (scripts/fetch-extra-item-icons.mjs) */
const extraIcons = existsSync(D("extra_item_icons.json")) ? JSON.parse(readFileSync(D("extra_item_icons.json"), "utf8")) : { items: {} };

const KO2EN = { 이지: "easy", 노멀: "normal", 노말: "normal", 하드: "hard", 카오스: "chaos", 익스트림: "extreme" };
const PATCH_DATE = "2026-09-17";

// ---------- 선정 규칙 ----------

const KEEP = [
  /에테르넬/, /칠흑 장신구/, /보스 반지 상자/, /연마석/,
  /아케인셰이드/, /앱솔랩스/, /선택 상자/, /익셉셔널 해머/, /영롱한 달빛 포션/,
];
const DROP = [
  // 어둠의 흔적은 검은 마법사 전용 재화인데 쓸모가 좁아 화면에 내지 않기로 했다.
  /^어둠의 흔적/,
  /명예의 훈장/, /경험치 50%/, /경험 축적/, /물약$/, /주문서 교환권/, /혼돈 주문서/, /태초의 정수/,
  /소울 조각/, /소울 상자/, /^주문서$/, /^기타$/, /^장비$/, /교환권$/,
  /최초 격파/, /최초 1회/, /운명의 인도/, /메이플홈/, /커스텀 배경/,
  /강렬한 힘의 결정/, /^가격 변동/, /메소/, /^\d/, /마일리지/,
  // 매주 받는 보상이 아니다: 누적 처치 보상, 캐시 치장품.
  // 최초 격파 훈장은 위 /최초 격파/ 가 원문 괄호까지 보고 거른다.
  // "(훈장" 전체를 막으면 안 된다 — 불멸의 유산·익셉셔널 해머(훈장)는 매주 나오는 드롭이다.
  /누적\s*\d+회/, /캐시\s*(모자|장비|아이템)/,
  // 원문에 메이린 하드 상자가 "운명의" 와 "메이린의" 두 이름으로 적혀 있다. 같은 상자다.
  // 둘 다 두면 값이 두 번 잡혀 그 보스가 실제보다 후해 보인다. 메이린 쪽만 남긴다.
  /^운명의 에테르넬 방어구 상자/,
];
const isKeep = (n) => KEEP.some((r) => r.test(n));
/**
 * 원문에는 "악몽의 주인 격파자 (훈장, 최초 격파 보상)" 처럼 괄호 안에 조건이 붙는다.
 * 이름만 보면 걸러지지 않으므로 괄호를 떼기 전 원문에도 같은 규칙을 적용한다.
 */
const isDrop = (n, rawText = n) => DROP.some((r) => r.test(n) || r.test(rawText));

/** 수치로 낼 항목 */
const COUNTED = [
  { re: /^솔 에르다의 기운/, name: "솔 에르다의 기운" },
  { re: /^에리온의 조각/, name: "에리온의 조각" },
  { re: /조각\s*\d|편린\s*\d|영혼석\s*\d|에너지 코어.*\d/, name: null }, // 이름은 원문 유지
];

/**
 * 괄호가 설명이 아니라 이름의 일부인 경우.
 * 익셉셔널 해머는 익스트림 보스마다 부위가 다르고(세렌 얼굴장식, 칼로스 눈장식,
 * 대적자 훈장, 카링 귀고리) 부위별로 아이콘도 따로다. 괄호를 떼면 한 아이템으로 뭉친다.
 */
const KEEP_PAREN = [/^익셉셔널 해머\s*\((?:훈장|귀고리|눈장식|얼굴장식|반지|벨트|어깨장식|포켓)\)/];

const baseName = (s) => {
  for (const re of KEEP_PAREN) {
    const m = s.match(re);
    if (m) return m[0].replace(/\s+/g, " ").trim();
  }
  return s.replace(/\s*\([^)]*\)/g, "").replace(/\s+/g, " ").trim();
};

/** "뒤틀린 갈망의 편린 2개" → { name:"뒤틀린 갈망의 편린", count:2 } / "솔 에르다의 기운: 450" → 450 */
function splitCount(s) {
  const t = baseName(s);
  let m = t.match(/^(.*?)[:\s]\s*([\d,]+)\s*개$/);
  if (m) return { name: m[1].trim(), count: Number(m[2].replace(/,/g, "")) };
  m = t.match(/^(.*?):\s*([\d,]+)$/);
  if (m) return { name: m[1].trim(), count: Number(m[2].replace(/,/g, "")) };
  // "파멸의 조각: 5~10개" 처럼 콜론으로 이어지는 경우도 있다
  m = t.match(/^(.*?)[:\s]\s*(\d+)~(\d+)개$/);
  if (m) return { name: m[1].replace(/:$/, "").trim(), count: Number(m[3]), range: `${m[2]}~${m[3]}` };
  return { name: t.replace(/:$/, "").trim(), count: 1 };
}

// ---------- 큐브 (패치 전/후) ----------

const BRONZE_OVERRIDE = { "검은 마법사 hard": 24 };
const CUBE_PATCH = {
  "데미안 hard": { silver: 0, gold: 0 }, "스우 hard": { silver: 0, gold: 0 },
  "진 힐라 normal": { silver: 0, gold: 0 }, "루시드 hard": { silver: 1, gold: 0 },
  "더스크 chaos": { silver: 1, gold: 0 }, "가디언 엔젤 슬라임 chaos": { silver: 1, gold: 0 },
  "윌 hard": { silver: 1, gold: 0 }, "듄켈 hard": { silver: 1, gold: 0 },
  "진 힐라 hard": { silver: 1, gold: 0 }, "선택받은 세렌 normal": { silver: 2, gold: 0 },
  "벨로나 easy": { silver: 0, gold: 2 }, "감시자 칼로스 normal": { silver: 0, gold: 3 },
  "최초의 대적자 normal": { silver: 0, gold: 3 }, "찬란한 흉성 normal": { silver: 0, gold: 3 },
  "카링 normal": { silver: 0, gold: 3 }, "검은 마법사 hard": { silver: 8, gold: 0 },
};

function cubesOf(key, fixedLines) {
  const pick = (kind) => {
    const m = fixedLines.map((s) => s.match(new RegExp(`메멘토 ${kind} 큐브 (\\d+)개`))).find(Boolean);
    return m ? Number(m[1]) : 0;
  };
  const before = { silver: pick("실버"), gold: pick("골드"), bronze: BRONZE_OVERRIDE[key] ?? pick("브론즈 에디셔널") };
  const p = CUBE_PATCH[key];
  const after = { silver: p ? p.silver : before.silver, gold: p ? p.gold : before.gold, bronze: before.bronze };
  return { before, after, changed: !!p };
}

const CUBE_LABEL = { silver: "메멘토 실버 큐브", gold: "메멘토 골드 큐브", bronze: "메멘토 브론즈 에디셔널 큐브" };

/**
 * 아이콘이 없는 항목의 짧은 라벨. 이름을 마우스 오버로 숨기는 설계라 식별 가능한 라벨은 있어야 한다.
 *
 * 지금은 336건 전부 아이콘이 있어 실제로 쓰이지 않는다. 보스 인포박스(boss_reward_items.json)와
 * 손으로 반입한 아이템 아이콘(extra_item_icons.json)이 다 덮는다.
 * 새 보상이 추가됐는데 아이콘을 못 구한 경우를 위한 대비책으로 남겨 둔다.
 */
const SHORT = [
  [/^메멘토 실버 큐브$/, "실버큐브"],
  [/^메멘토 골드 큐브$/, "골드큐브"],
  [/^메멘토 브론즈 에디셔널 큐브$/, "브론즈에디"],
  [/^솔 에르다의 기운$/, "솔에르다"],
  [/^에리온의 조각$/, "에리온"],
  [/^주문의 흔적$/, "주문흔적"],
  [/^(.+)의 보스 반지 상자$/, "$1반지"],
  [/^생명의 연마석$/, "생명연마석"],
  [/^신념의 연마석$/, "신념연마석"],
  [/^아케인셰이드 (방어구|무기) 상자$/, "아케인$1"],
  [/^앱솔랩스 (방어구|무기) 상자$/, "앱솔$1"],
  [/^영롱한 달빛 포션$/, "달빛포션"],
  [/^(.+) 에테르넬 방어구 상자$/, "에테르넬"],
  [/^혼돈의 칠흑 장신구 상자$/, "칠흑장신구"],
  [/^메이린의 칠흑 장신구 상자$/, "칠흑장신구"],
  [/^익셉셔널 해머.*$/, "익셉해머"],
  [/^(\d)단계 소울 에테르$/, "소울에테$1"],
];
function shortOf(name) {
  for (const [re, rep] of SHORT) if (re.test(name)) return name.replace(re, rep);
  return name.length <= 6 ? name : name.slice(0, 5) + "…";
}

// ---------- 아이콘 ----------

/**
 * 나무위키가 무기·방어구 상자를 아이콘 하나에 "○○ 장비 상자" 로 묶어 적어 둔 경우.
 * 보상 목록에는 무기/방어구가 따로 적히므로 같은 아이콘을 쓴다.
 */
const ICON_ALIAS = [
  [/^아케인셰이드 (방어구|무기) 상자$/, "아케인셰이드 장비 상자"],
  [/^앱솔랩스 (방어구|무기) 상자$/, "앱솔랩스 장비 상자"],
];

const iconIndex = [];
for (const cats of Object.values(iconFile.items ?? {})) {
  for (const list of Object.values(cats)) {
    for (const it of list) iconIndex.push({ key: it.name.replace(/\s+/g, ""), item: it });
  }
}
for (const [name, it] of Object.entries(extraIcons.items ?? {})) {
  iconIndex.push({ key: name.replace(/\s+/g, ""), item: { name, file: it.file, w: it.w, h: it.h } });
}

function lookup(name) {
  const t = name.replace(/\s+/g, "");
  const exact = iconIndex.find((x) => x.key === t);
  if (exact) return exact.item;
  const part = iconIndex.find((x) => x.key.includes(t) || t.includes(x.key));
  return part?.item ?? null;
}
function findIcon(name) {
  const direct = lookup(name);
  if (direct) return direct;
  for (const [re, alias] of ICON_ALIAS) if (re.test(name)) return lookup(alias);
  return null;
}

// ---------- 빌드 ----------

const out = {};
const missingIcon = new Map();
for (const [boss, modes] of Object.entries(raw.bosses)) {
  for (const [mode, v] of Object.entries(modes)) {
    const diff = KO2EN[mode];
    if (!diff) continue;
    if (!prices.prices[boss]?.[diff] && prices.prices[boss]?.[diff] !== null) continue;
    const key = `${boss} ${diff}`;

    const rewards = [];
    /**
     * fixed=true 는 잡으면 무조건 주는 것, false 는 확률로 떨어지는 것.
     * 나무위키 보상 칸의 분류를 그대로 쓴다: '고정' 은 확정, '장비'·'소비' 는 드롭이다.
     */
    const push = (name, count, fixed, extra = {}) => {
      if (rewards.some((r) => r.name === name)) return;
      const ic = findIcon(name);
      if (!ic) missingIcon.set(name, (missingIcon.get(name) ?? 0) + 1);
      rewards.push({
        name,
        ...(count > 1 ? { count } : {}),
        ...(fixed ? { fixed: true } : {}),
        ...(ic ? { icon: ic.file, w: ic.w, h: ic.h } : { short: shortOf(name) }),
        ...extra,
      });
    };

    // 고정: 수치류만 (큐브는 아래에서 패치 반영해 따로). 확정 보상이라 먼저 담는다.
    for (const s of v.고정 ?? []) {
      const n = baseName(s);
      if (n.includes("큐브")) continue;
      if (isDrop(n, s)) continue;
      const counted = COUNTED.some((c) => c.re.test(n)) || /\d+\s*개$/.test(n);
      if (!counted) continue;
      const { name, count, range } = splitCount(s);
      push(name, count, true, range ? { range } : {});
    }
    // 장비: 전부
    for (const s of v.장비 ?? []) {
      const n = baseName(s);
      if (isDrop(n, s) || n.length < 2) continue;
      const { name, count } = splitCount(s);
      push(name, count, false);
    }
    // 소비: KEEP 만
    for (const s of v.소비 ?? []) {
      const n = baseName(s);
      if (!isKeep(n) || isDrop(n, s)) continue;
      const { name, count } = splitCount(s);
      push(name, count, false);
    }
    // 큐브
    const cube = cubesOf(key, v.고정 ?? []);
    const cubes = {};
    for (const k of ["silver", "gold", "bronze"]) {
      if (!cube.before[k] && !cube.after[k]) continue;
      const ic = findIcon(CUBE_LABEL[k]);
      if (!ic) missingIcon.set(CUBE_LABEL[k], (missingIcon.get(CUBE_LABEL[k]) ?? 0) + 1);
      cubes[k] = {
        name: CUBE_LABEL[k],
        before: cube.before[k],
        after: cube.after[k],
        ...(ic ? { icon: ic.file, w: ic.w, h: ic.h } : { short: shortOf(CUBE_LABEL[k]) }),
      };
    }

    if (!rewards.length && !Object.keys(cubes).length) continue;
    out[boss] ??= {};
    out[boss][diff] = { rewards, ...(Object.keys(cubes).length ? { cubes } : {}) };
  }
}

/**
 * 보상 섹션이 없어 아무것도 못 긁었지만 큐브 수량은 확실한 행.
 *
 * 검은 마법사 — 월간 보스라 주간 수집에서 빠졌다. 패치표 + 사용자 실측값.
 *
 * 구형 보스 5종 — 나무위키 문서에 보상 섹션 자체가 없다. 대신 큐브 문서의
 * "보스 난이도별 메멘토 큐브 획득량" 표에 브론즈 에디셔널 1개로 적혀 있다.
 * 그 표는 이미 갖고 있던 27행과 하나도 어긋나지 않아 신뢰할 만하다.
 *
 * 매그너스만 표에서 카오스 칸에 적혀 있는데 매그너스에는 카오스가 없다.
 * 표 각주가 "동별 3티어부터 금별 3티어까지 적용된다" 이고 매그너스 하드는
 * 벨룸 카오스와 같은 동별 4티어이므로, 열이 밀린 것으로 보고 하드로 넣는다.
 * (동별 2티어인 자쿰 카오스가 표에 없는 것도 이 범위 규칙과 맞는다.)
 */
const ONE_BRONZE = { bronze: { before: 1, after: 1 } };
const CUBE_ONLY = {
  "검은 마법사 hard": { silver: { before: 0, after: 8 }, gold: { before: 8, after: 0 }, bronze: { before: 24, after: 24 } },
  "매그너스 hard": ONE_BRONZE,
  "피에르 chaos": ONE_BRONZE,
  "반반 chaos": ONE_BRONZE,
  "블러디퀸 chaos": ONE_BRONZE,
  "파풀라투스 chaos": ONE_BRONZE,
};
for (const [key, spec] of Object.entries(CUBE_ONLY)) {
  const cut = key.lastIndexOf(" ");
  const boss = key.slice(0, cut);
  const diff = key.slice(cut + 1);
  if (out[boss]?.[diff]) continue;
  const cubes = {};
  for (const [k, v] of Object.entries(spec)) {
    if (!v.before && !v.after) continue;
    const ic = findIcon(CUBE_LABEL[k]);
    cubes[k] = { name: CUBE_LABEL[k], before: v.before, after: v.after, ...(ic ? { icon: ic.file, w: ic.w, h: ic.h } : { short: shortOf(CUBE_LABEL[k]) }) };
  }
  out[boss] ??= {};
  out[boss][diff] = { rewards: [], cubes };
}

/**
 * 패치노트로 새로 생긴 드롭. 나무위키 수집본(boss_rewards_raw.json)에는 아직 없어서
 * 여기에 손으로 적는다. 다음 수집 때 문서에 반영돼 들어오면 중복되지 않게 이름으로 거른다.
 *
 * 2026-09-17 — 소울 에테르 4단계. 낮은 확률 드롭이라 fixed 를 붙이지 않는다.
 * 난이도는 패치노트에 적힌 것만 넣는다. 대적자·카링은 이지가 빠져 있다.
 */
const EXTRA_DROPS = [
  { name: "1단계 소울 에테르", at: { "최초의 대적자": ["normal", "hard", "extreme"], 카링: ["normal", "hard", "extreme"] } },
  { name: "2단계 소울 에테르", at: { 벨로나: ["normal", "hard"], "찬란한 흉성": ["normal", "hard"] } },
  { name: "3단계 소울 에테르", at: { 림보: ["normal", "hard"], 발드릭스: ["normal", "hard"] } },
  { name: "4단계 소울 에테르", at: { 유피테르: ["normal", "hard"] } },
];
for (const { name, at } of EXTRA_DROPS) {
  for (const [boss, diffs] of Object.entries(at)) {
    for (const diff of diffs) {
      const row = out[boss]?.[diff];
      if (!row) {
        console.warn(`[extra] ${boss} ${diff} 행이 없어 ${name} 를 못 넣었다`);
        continue;
      }
      if (row.rewards.some((r) => r.name === name)) continue; // 수집본에 이미 들어왔으면 그대로 둔다
      const ic = findIcon(name);
      row.rewards.push({ name, ...(ic ? { icon: ic.file, w: ic.w, h: ic.h } : { short: shortOf(name) }) });
    }
  }
}

/**
 * 아이콘 칸 크기. 아이콘 원본은 23x20 부터 40x41 까지 제각각인데 축소하면 계단현상이 난다.
 * 그래서 크기는 건드리지 않고, 제일 큰 아이콘이 들어갈 만한 칸을 만들어 그 안에 가운데 정렬한다.
 */
const iconBox = { w: 0, h: 0 };
for (const row of Object.values(out).flatMap((m) => Object.values(m))) {
  for (const r of [...row.rewards, ...Object.values(row.cubes ?? {})]) {
    if (r.w > iconBox.w) iconBox.w = r.w;
    if (r.h > iconBox.h) iconBox.h = r.h;
  }
}

const payload = {
  _meta: {
    updated: new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10),
    source: "나무위키 보스 문서의 난이도별 보상 섹션 (수집본: boss_rewards_raw.json)",
    cubePatchDate: PATCH_DATE,
    iconBox,
    notes: [
      "표시 대상만 걸러 담았다. 훈장·물약·경험치·주문서 교환권 등 모든 보스 공통 소모품은 제외.",
      "강렬한 힘의 결정은 가격표(boss_crystal_prices.json)에 있으므로 여기서 제외.",
      "rewards 의 fixed 는 잡으면 무조건 주는 확정 보상이라는 뜻이다. 없으면 확률 드롭. 큐브는 전부 확정이다.",
      "cubes 의 before/after 는 2026-09-17 패치 전/후 수량. 화면에서 기준일로 고른다.",
      "iconBox 는 전체 아이콘 중 가장 큰 가로·세로. 아이콘은 원본 크기로 두고 이 칸에 가운데 정렬한다.",
      "검은 마법사(월간)는 보상 섹션을 긁지 않았고 큐브 수량만 담았다. 브론즈 에디셔널 24개는 사용자 실측 확인값.",
      "매그너스·피에르·반반·블러디퀸·파풀라투스는 문서에 보상 섹션이 없어 큐브 수량만 담았다. 출처는 나무위키 큐브 문서의 보스별 획득량 표.",
      "재생성: node scripts/build-boss-rewards.mjs",
    ],
  },
  bosses: out,
};

if (!dry) writeFileSync(D("boss_rewards.json"), JSON.stringify(payload, null, 2) + "\n");

const rows = Object.values(out).flatMap((m) => Object.values(m));
console.log(`보스 ${Object.keys(out).length}종, 난이도 ${rows.length}행, 보상 ${rows.reduce((s, r) => s + r.rewards.length, 0)}건${dry ? " (dry)" : " → src/data/boss_rewards.json"}`);
if (missingIcon.size) {
  console.log(`\n아이콘 없는 항목 ${missingIcon.size}종:`);
  for (const [n, c] of [...missingIcon].sort((a, b) => b[1] - a[1])) console.log(`  ${String(c).padStart(2)}회  ${n}`);
}
