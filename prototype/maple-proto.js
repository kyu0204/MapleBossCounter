#!/usr/bin/env node
/**
 * 메이플 파티 결성 보드 — 넥슨 Open API 조회 프로토타입 v2
 *
 * v2 변경점: 전투력 대표값 로직 개선
 *  - 최대 전투력 기록 시 당시 착용 장비 구성(해시)을 함께 저장
 *  - 갱신 시 현재 장비 프리셋 1/2/3 + 착용 구성과 대조:
 *      · 저장된 구성이 존재 → 세팅 유지 중 → 최대치 유지 (드메템 착용과 무관)
 *      · 어디에도 없음     → 세팅 변경됨 → 최대치 무효화, 현재 값으로 재설정
 *
 * 사용법
 *  export NEXON_API_KEY=발급받은키
 *  node maple-proto.js char 알전임    # 조회 + 전투력/세팅 기록
 *  node maple-proto.js log 알전임     # 기록 확인
 *  node maple-proto.js my-list       # 내 계정 캐릭터 목록 (키 소유 계정 한정)
 */

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const BASE = "https://open.api.nexon.com";
const API_KEY = process.env.NEXON_API_KEY;
const LOG_FILE = path.join(__dirname, "power_log.json");

// ---------- API 호출 공통 ----------

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function nx(endpoint, params = {}, retry = 2) {
  const qs = new URLSearchParams(params).toString();
  const url = `${BASE}${endpoint}${qs ? "?" + qs : ""}`;
  const res = await fetch(url, { headers: { "x-nxopen-api-key": API_KEY } });
  const body = await res.json();
  if (!res.ok) {
    const msg = body?.error?.message || res.statusText;
    const name = body?.error?.name || res.status;
    // OPENAPI00007 = 호출 한도(5건/초). 잠깐 쉬고 재시도.
    if (name === "OPENAPI00007" && retry > 0) { await sleep(1200); return nx(endpoint, params, retry - 1); }
    throw new Error(`[${name}] ${msg} (${endpoint})`);
  }
  return body;
}

const getOcid = async (name) =>
  (await nx("/maplestory/v1/id", { character_name: name })).ocid;
const getBasic = (ocid) => nx("/maplestory/v1/character/basic", { ocid });
const getEquipment = (ocid) => nx("/maplestory/v1/character/item-equipment", { ocid });
const getMyCharacterList = () => nx("/maplestory/v1/character/list");
const getScheduler = (ocid, date) =>
  nx("/maplestory/v1/scheduler/character-state", date ? { ocid, date } : { ocid });

async function getCombatPower(ocid) {
  const stat = await nx("/maplestory/v1/character/stat", { ocid });
  const row = (stat.final_stat || []).find((s) => s.stat_name === "전투력");
  return row ? Number(row.stat_value) : null;
}

// ---------- 장비 구성 해시 ----------
// 전투력에 영향을 주는 필드만 추려서 해시. 외형/캐시 요소는 제외해
// 코디 변경으로 무효화가 오발동하지 않게 한다.

function normalizeItem(it) {
  return {
    slot: it.item_equipment_slot,
    name: it.item_name,
    star: it.starforce ?? "0",
    total: it.item_total_option ?? null, // 주문서+스타포스 반영 최종 수치
    pot: [it.potential_option_grade, it.potential_option_1, it.potential_option_2, it.potential_option_3],
    add: [it.additional_potential_option_grade, it.additional_potential_option_1, it.additional_potential_option_2, it.additional_potential_option_3],
    soul: it.soul_name ?? null,
  };
}

function hashItemList(list) {
  const norm = (list || [])
    .map(normalizeItem)
    .sort((a, b) => (a.slot > b.slot ? 1 : -1));
  return crypto.createHash("sha1").update(JSON.stringify(norm)).digest("hex").slice(0, 16);
}

/** 착용 + 프리셋 1/2/3 각각의 구성 해시 */
function setupHashes(equip) {
  return {
    equipped: hashItemList(equip.item_equipment),
    p1: hashItemList(equip.item_equipment_preset_1),
    p2: hashItemList(equip.item_equipment_preset_2),
    p3: hashItemList(equip.item_equipment_preset_3),
  };
}

// ---------- 결정석 가격표 ----------
// boss_crystal_prices.json: prices[보스명][난이도] = {old,new,new_from} | {price} | null
// 보스명·난이도는 스케줄러 API의 content_name / difficulty 값과 동일하게 맞춘다.

const PRICE_FILE = path.join(__dirname, "boss_crystal_prices.json");
const PRICE_TABLE = (() => {
  try { return JSON.parse(fs.readFileSync(PRICE_FILE, "utf8")); } catch { return { _meta: {}, prices: {} }; }
})();

/** 기준일(YYYY-MM-DD)에 유효한 결정석 가격. 미확인이면 null. */
function crystalPrice(bossName, difficulty, dateISO) {
  const entry = PRICE_TABLE.prices?.[bossName]?.[difficulty];
  if (!entry) return null;
  if ("price" in entry) return entry.price;
  if (entry.new_from && dateISO >= entry.new_from) return entry.new;
  return entry.old ?? null;
}

// ---------- 로그 저장소 ----------
// { [ocid]: { name, entries: [{ts, power}],
//             best: { power, ts, setupHash } | null } }

function loadLog() {
  try { return JSON.parse(fs.readFileSync(LOG_FILE, "utf8")); } catch { return {}; }
}
function saveLog(log) {
  fs.writeFileSync(LOG_FILE, JSON.stringify(log, null, 2));
}

// ---------- 대표 전투력 갱신 로직 (핵심) ----------

function updateBest(rec, power, hashes) {
  const now = new Date().toISOString();
  let note = null;

  // 1) 기존 최대치의 세팅이 아직 존재하는지 검사
  if (rec.best) {
    const alive = Object.values(hashes).includes(rec.best.setupHash);
    if (!alive) {
      note = `세팅 변경 감지 → 기존 최대치 ${rec.best.power.toLocaleString()} 무효화, 현재 값으로 재설정`;
      rec.best = null;
    }
  }

  // 2) 최대치 갱신 (무효화됐다면 현재 관측값이 새 기준이 됨)
  if (!rec.best || power > rec.best.power) {
    rec.best = { power, ts: now, setupHash: hashes.equipped };
    if (!note) note = "최대 전투력 갱신";
  }

  rec.entries.push({ ts: now, power });
  return note;
}

// ---------- 출력 유틸 ----------

function fmtPower(n) {
  if (n == null) return "-";
  if (n >= 100_000_000) {
    const eok = Math.floor(n / 100_000_000);
    const man = Math.floor((n % 100_000_000) / 10_000);
    return man > 0 ? `${eok}억 ${man}만` : `${eok}억`;
  }
  if (n >= 10_000) return `${Math.floor(n / 10_000)}만`;
  return String(n);
}

// ---------- 커맨드 ----------

async function cmdChar(name) {
  const ocid = await getOcid(name);
  const [basic, power, equip] = await Promise.all([
    getBasic(ocid), getCombatPower(ocid), getEquipment(ocid),
  ]);
  const hashes = setupHashes(equip);

  const log = loadLog();
  if (!log[ocid]) log[ocid] = { name: basic.character_name, entries: [], best: null };
  const rec = log[ocid];
  rec.name = basic.character_name;
  const note = updateBest(rec, power, hashes);
  saveLog(log);

  const wearingBest = hashes.equipped === rec.best.setupHash;
  console.log(`\n${basic.character_name}  (${basic.world_name} · ${basic.character_class} · Lv.${basic.character_level})`);
  console.log(`  대표 전투력 : ${fmtPower(rec.best.power)} (${rec.best.ts.slice(0, 10)} 기준)`);
  console.log(`  현재 측정값 : ${fmtPower(power)}${wearingBest ? "" : "  ※ 대표값과 다른 세팅 착용 중"}`);
  if (note) console.log(`  변경 사항   : ${note}`);
  console.log(`  maplescouter: https://maplescouter.com/ko/result?name=${encodeURIComponent(basic.character_name)}`);
  console.log("");
}

async function cmdLog(name) {
  const log = loadLog();
  const rec = Object.values(log).find((c) => c.name === name);
  if (!rec) return console.log(`기록 없음: ${name} — 먼저 'char ${name}' 로 조회하세요.`);
  console.log(`\n${rec.name} — 대표 전투력 ${fmtPower(rec.best?.power)} (${rec.best?.ts.slice(0, 10)} 기준)`);
  for (const e of rec.entries.slice(-10)) {
    console.log(`  ${e.ts.slice(0, 16).replace("T", " ")}  ${fmtPower(e.power)}`);
  }
  console.log("");
}

async function cmdSched(name, date) {
  const ocid = await getOcid(name);
  let s;
  try {
    s = await getScheduler(ocid, date);
  } catch (e) {
    // date 지정 조회는 해당 날짜에 캐릭터 기록이 없으면 OPENAPI00004(400)로 응답함 (실측).
    if (date && e.message.startsWith("[OPENAPI00004]")) {
      return console.log(`${name}: ${date} 스케줄러 기록 없음 (해당 날짜 미접속, 또는 조회 범위(어제~13일 전) 밖)`);
    }
    throw e;
  }
  if (!s) return console.log("스케줄러 데이터 없음 (최근 14일 내 접속 기록이 없을 수 있음)");

  // 가격 기준일: date 지정 조회면 그 날, 실시간이면 오늘
  const priceDate = (s.date || new Date().toISOString()).slice(0, 10);

  console.log(`\n${s.character_name} 스케줄러 (기준일: ${s.date ?? "실시간"})`);
  console.log(`  주간 보스: ${s.weekly_boss_clear_count} / ${s.weekly_boss_clear_limit_count} 클리어\n`);

  const bosses = (s.boss_contents || []).sort((a, b) => a.list_order_no - b.list_order_no);
  const revenue = { bossDaily: 0, bossWeekly: 0, bossMonthly: 0 };
  const crystals = { bossDaily: 0, bossWeekly: 0, bossMonthly: 0 };
  const unpriced = [];
  for (const b of bosses) {
    const isDone = String(b.complete_flag) === "true";
    const done = isDone ? "✅" : "⬜";
    const reg = String(b.registration_flag) === "true" ? "" : " (스케줄러 미등록)";
    let priceTag = "";
    if (isDone) {
      const p = crystalPrice(b.content_name, b.difficulty, priceDate);
      crystals[b.cycle] = (crystals[b.cycle] || 0) + 1;
      if (p == null) { unpriced.push(`${b.content_name} ${b.difficulty}`); priceTag = "  (가격 미등록)"; }
      else { revenue[b.cycle] = (revenue[b.cycle] || 0) + p; priceTag = `  ${fmtPower(p)}`; }
    }
    console.log(`  ${done} [${b.cycle}] ${b.content_name} · ${b.difficulty}${reg}${priceTag}`);
  }

  // 결정석 수익 추정. 등록 여부와 무관하게 complete_flag 기준 (실측: 등록 난이도와 클리어 난이도는 독립).
  console.log(`\n  결정석 수익 추정 (${priceDate} 가격, 솔로 기준·전량 판매 가정. 파티는 인원수로 나뉨):`);
  console.log(`    주간 ${crystals.bossWeekly}개  ${fmtPower(revenue.bossWeekly)}`);
  if (crystals.bossDaily) console.log(`    일간 ${crystals.bossDaily}개  ${fmtPower(revenue.bossDaily)}`);
  if (crystals.bossMonthly) console.log(`    월간 ${crystals.bossMonthly}개  ${fmtPower(revenue.bossMonthly)}`);
  console.log(`    합계  ${fmtPower(revenue.bossWeekly + revenue.bossDaily + revenue.bossMonthly)}`);
  if (unpriced.length) console.log(`    ※ 가격 미등록: ${unpriced.join(", ")} — boss_crystal_prices.json 에 추가 필요`);
  if (PRICE_TABLE._meta?.weekly_world_sale_limit) {
    console.log(`    ※ 월드당 주간 판매 한도 ${PRICE_TABLE._meta.weekly_world_sale_limit}개 (계정 내 전 캐릭터 합산)`);
  }

  printContents("일간 콘텐츠", s.daily_contents);
  printContents("주간 콘텐츠", s.weekly_contents);
  console.log("");
}

/** daily_contents / weekly_contents 공용 출력. type: "contents"(횟수형) | "quest"(퀘스트 상태형) */
function printContents(title, list) {
  const items = list || [];
  if (!items.length) return;
  console.log(`\n  ${title}:`);
  for (const c of items) {
    const reg = String(c.registration_flag) === "true" ? "" : " (스케줄러 미등록)";
    if (c.type === "quest") {
      // quest_state 는 문자열 "0"/"1"/"2" 로 관측됨. 공식 문서에 의미 명시 없어
      // 0=미완료, 1=진행중, 2=완료 로 추정 (완료된 일일 퀘스트가 2, 누적형 주간 퀘스트가 1 로 관측).
      const state = { "0": "⬜ 미완료", "1": "🔄 진행중", "2": "✅ 완료" }[String(c.quest_state)] ?? `상태 ${c.quest_state}`;
      console.log(`    [퀘스트] ${c.content_name}: ${state}${reg}`);
    } else {
      const max = c.max_count > 0 ? `/${c.max_count}` : "";
      console.log(`    ${c.content_name}: ${c.now_count}${max}${reg}`);
    }
  }
}

async function cmdMyList() {
  const { account_list } = await getMyCharacterList();
  for (const acc of account_list || []) {
    console.log(`\n계정 ${acc.account_id}`);
    for (const c of acc.character_list || []) {
      console.log(`  ${c.character_name}  (${c.world_name} · ${c.character_class} · Lv.${c.character_level})`);
    }
  }
  console.log("");
}

// ---------- 주간 결정 90개 최적 배분 ----------
//
// 모델 (사용자 가정): "노말 스우 이상을 잡는 캐릭터는 그 아래를 모두 잡을 수 있다"
//   → 캐릭터마다 '상한 보스'(실측 클리어 중 티어 최고)를 두고,
//     상한 티어(rank) 이하인 모든 (보스, 난이도)를 클리어 가능으로 본다. 티어는 boss_tiers.json(나무위키).
//     가격 기준이던 v1 은 익스트림(가격 낮고 난이도 높음)을 예외 처리해야 했는데 티어 기준으로 그 예외가 사라짐.
// 제약:
//   · 캐릭터당 주간 보스 클리어 한도 (weekly_boss_clear_limit_count, 기본 12)
//   · 캐릭터·보스 조합당 난이도 1개
//   · 월드당 주간 결정 판매 한도 (기본 90) — 일간/월간 결정은 한도 밖
// 제약이 (캐릭터·보스) ⊂ 캐릭터 ⊂ 월드 로 중첩(laminar)이라 가격 내림차순 그리디가 최적.
//
// 상한 산정: 어제 + 지난주 마지막 날(수요일) 스케줄러 스냅샷에서 complete_flag=true 인 주간 보스 중 최고가.
//
// 설정: plan_config.json
// {
//   "default_party": 1,                       // 기본 파티 인원. 결정 판매가 = 가격 ÷ 인원
//   "characters": {
//     "알전임":   { "party": 1, "bosses": ["최초의 대적자 normal", { "boss": "감시자 칼로스 normal", "party": 2 }], "auto": true },
//     "봉풀르르": { "ceiling": "진 힐라 hard", "party": 2 },   // 상한만 지정 → 자동 배분
//     "공군은21개월": { "skip": true }
//   }
// }
//   bosses : 고정 픽. 맵 { "보스 난이도": 인원 } 권장. 배열("보스 난이도" 문자열 / { boss, party })도 허용. 항상 포함(한도·중복만 검사).
//   auto   : 고정 픽 외 남은 슬롯을 상한 모델로 자동 채움. 기본값: bosses 없으면 true, 있으면 false.
//   ceiling: 상한 수동 지정(실측보다 우선). party: 캐릭터 기본 인원(없으면 default_party).

const PLAN_CONFIG_FILE = path.join(__dirname, "plan_config.json");

// ---------- 보스 티어 (boss_tiers.json, 나무위키 기준) ----------
// "보스 난이도" → { grade: "금", stars: 2, rank: 25 }. rank 는 1(납★)~32(금★★★★★★★★★).
// 상한 판정을 가격이 아닌 티어로 한다: 상한 rank 이하의 (보스, 난이도)만 클리어 가능으로 본다.
const TIER_FILE = path.join(__dirname, "boss_tiers.json");
const TIER_MAP = (() => {
  try {
    const t = JSON.parse(fs.readFileSync(TIER_FILE, "utf8"));
    const map = {};
    for (const [grade, stars] of Object.entries(t.tiers || {})) {
      for (const [n, list] of Object.entries(stars)) {
        for (const key of list) map[key] = { grade, stars: Number(n), rank: (t.rank_base?.[grade] ?? 0) + Number(n) };
      }
    }
    return map;
  } catch { return {}; }
})();
const tierOf = (boss, diff) => TIER_MAP[`${boss} ${diff}`] ?? null;
const tierLabel = (t) => (t ? `${t.grade}★${t.stars}` : "티어없음");

/**
 * bosses 세 가지 표기 모두 [{key, party, raw}] 로 통일:
 *   배열-문자열  ["진 힐라 hard"]
 *   배열-객체    [{ "boss": "진 힐라 hard", "party": 2 }]
 *   객체(맵)     { "진 힐라 hard": 2, "듄켈 hard": 1 }   ← 가장 짧음. 값 = 인원
 */
function normalizeBossList(bosses) {
  if (!bosses) return [];
  if (Array.isArray(bosses)) {
    return bosses.map((raw) => typeof raw === "string" ? { key: raw, party: null, raw } : { key: raw?.boss, party: raw?.party, raw });
  }
  if (typeof bosses === "object") return Object.entries(bosses).map(([key, party]) => ({ key, party, raw: { [key]: party } }));
  return [];
}

/** "진 힐라 hard" → { boss: "진 힐라", diff: "hard" } (보스명 공백 허용, 마지막 토큰이 난이도) */
function parseBossKey(str) {
  const s = String(str).trim();
  const cut = s.lastIndexOf(" ");
  if (cut < 0) return null;
  return { boss: s.slice(0, cut), diff: s.slice(cut + 1) };
}

function kstDateStr(offsetDays = 0) {
  return new Date(Date.now() + 9 * 3600e3 + offsetDays * 864e5).toISOString().slice(0, 10);
}
/** 지난주 마지막 날(수요일) — 주간 리셋은 목요일 00:00 KST */
function lastWednesdayKst() {
  const now = new Date(Date.now() + 9 * 3600e3);
  const sinceThu = (now.getUTCDay() - 4 + 7) % 7; // 이번 주 목요일로부터 며칠 지났나
  return kstDateStr(-(sinceThu + 1));
}

/** 가격표에서 주간 보스 후보 (보스, 난이도, 가격) 전체. weeklySet 이 있으면 그것으로 필터. */
function weeklyCandidates(priceDate, weeklySet) {
  const out = [];
  for (const [boss, diffs] of Object.entries(PRICE_TABLE.prices || {})) {
    for (const diff of Object.keys(diffs)) {
      if (weeklySet && !weeklySet.has(`${boss}|${diff}`)) continue;
      const p = crystalPrice(boss, diff, priceDate);
      if (p != null) out.push({ boss, diff, price: p });
    }
  }
  return out;
}

async function cmdPlan(opts) {
  const limit = opts.limit ?? 90;
  const priceDate = opts.date ?? kstDateStr();
  const minLevel = opts.minLevel ?? 235; // 노말 스우 입장 190이지만 결정 수익 의미 있는 구간만
  const config = (() => { try { return JSON.parse(fs.readFileSync(PLAN_CONFIG_FILE, "utf8")); } catch { return {}; } })();
  const defaultParty = Number(config.default_party) || 1;
  const charCfg = config.characters || {};
  const snapDates = [...new Set([kstDateStr(-1), lastWednesdayKst()])];
  const warn = [];

  const { account_list } = await getMyCharacterList();
  const chars = (account_list || []).flatMap((a) => a.character_list || [])
    // 설정에 명시된 캐릭터는 레벨 무관 포함, 나머지는 minLevel 이상
    .filter((c) => !charCfg[c.character_name]?.skip && (charCfg[c.character_name] || c.character_level >= minLevel));
  console.log(`\n대상 캐릭터 ${chars.length}명, 스냅샷 ${snapDates.join(", ")}, 가격 기준 ${priceDate}, 월드 한도 ${limit}개, 기본 인원 ${defaultParty}인`);

  const weeklySet = new Set();
  const profiles = [];
  for (const c of chars) {
    const cfg = charCfg[c.character_name] || {};
    const party = Number(cfg.party) || defaultParty;
    await sleep(220);
    let ocid;
    try { ocid = await getOcid(c.character_name); } catch { warn.push(`${c.character_name}: ocid 조회 실패`); continue; }
    let cap = 12, best = null;
    const cleared = new Map();
    for (const d of snapDates) {
      await sleep(220);
      let s;
      try { s = await getScheduler(ocid, d); } catch { continue; }
      if (s.weekly_boss_clear_limit_count) cap = s.weekly_boss_clear_limit_count;
      for (const b of s.boss_contents || []) {
        if (b.cycle === "bossWeekly") weeklySet.add(`${b.content_name}|${b.difficulty}`);
        if (b.cycle !== "bossWeekly" || String(b.complete_flag) !== "true") continue;
        const p = crystalPrice(b.content_name, b.difficulty, priceDate);
        cleared.set(`${b.content_name}|${b.difficulty}`, p);
        // 상한 = 실측 클리어 중 티어(rank) 최고. 티어 미배정 보스는 상한 산정에서 제외.
        const t = tierOf(b.content_name, b.difficulty);
        if (t && (!best || t.rank > best.rank)) best = { boss: b.content_name, diff: b.difficulty, price: p, rank: t.rank, tier: t };
      }
    }
    if (cfg.ceiling) {
      const k = parseBossKey(cfg.ceiling);
      const t = k && tierOf(k.boss, k.diff);
      if (t) best = { ...k, price: crystalPrice(k.boss, k.diff, priceDate), rank: t.rank, tier: t, manual: true };
      else warn.push(`${c.character_name}: 수동 상한 "${cfg.ceiling}" 티어표에 없음 — 무시`);
    }

    // 고정 픽 (사용자 지정 보스). 가격 ÷ 인원 = 실수령.
    const fixed = [];
    const seenBoss = new Set();
    for (const { key, party: rawParty, raw } of normalizeBossList(cfg.bosses)) {
      const k = parseBossKey(key);
      if (!k) { warn.push(`${c.character_name}: 보스 표기 오류 "${JSON.stringify(raw)}"`); continue; }
      const p = crystalPrice(k.boss, k.diff, priceDate);
      if (p == null) { warn.push(`${c.character_name}: "${k.boss} ${k.diff}" 가격표에 없음 — 제외`); continue; }
      if (seenBoss.has(k.boss)) { warn.push(`${c.character_name}: ${k.boss} 중복 지정 — 첫 항목만 사용`); continue; }
      seenBoss.add(k.boss);
      const pp = Number(rawParty) || party;
      fixed.push({ ...k, price: p, party: pp, value: Math.floor(p / pp), fixed: true });
    }
    if (fixed.length > cap) warn.push(`${c.character_name}: 고정 픽 ${fixed.length}개 > 주간 한도 ${cap}개 — 상위 ${cap}개만 사용`);
    fixed.sort((a, b) => b.value - a.value);
    const fixedUsed = fixed.slice(0, cap);

    const auto = cfg.auto ?? !fixedUsed.length;
    profiles.push({
      name: c.character_name, world: c.world_name, level: c.character_level, cls: c.character_class,
      cap, party, ceiling: best, cleared, clearedCount: cleared.size, fixed: fixedUsed, auto,
    });
    process.stdout.write(".");
  }
  console.log("");

  const candidates = weeklyCandidates(priceDate, weeklySet.size ? weeklySet : null);
  if (!candidates.length) return console.log("주간 보스 가격 데이터 없음");

  const byWorld = {};
  for (const p of profiles) (byWorld[p.world ?? "?"] ??= []).push(p);

  for (const [world, list] of Object.entries(byWorld)) {
    console.log(`\n══════ ${world} ══════`);
    const perChar = new Map(list.map((p) => [p.name, [...p.fixed]]));
    let count = list.reduce((s, p) => s + p.fixed.length, 0);
    if (count > limit) warn.push(`${world}: 고정 픽 합계 ${count}개가 월드 한도 ${limit}개 초과`);

    // 자동 후보: 상한 티어 이하 보스마다 실수령 최고 난이도 1개, 고정 픽에 이미 있는 보스는 제외. 정렬 기준은 실수령(가격 ÷ 인원).
    const pool = [];
    const noTier = new Set();
    for (const p of list) {
      if (!p.auto || !p.ceiling) continue;
      const fixedBosses = new Set(p.fixed.map((f) => f.boss));
      const bestPerBoss = {};
      for (const c of candidates) {
        if (fixedBosses.has(c.boss)) continue;
        const t = tierOf(c.boss, c.diff);
        if (!t) { noTier.add(`${c.boss} ${c.diff}`); continue; }
        if (t.rank > p.ceiling.rank) continue;
        if (!bestPerBoss[c.boss] || c.price > bestPerBoss[c.boss].price) bestPerBoss[c.boss] = c;
      }
      for (const c of Object.values(bestPerBoss)) pool.push({ char: p, ...c, party: p.party, value: Math.floor(c.price / p.party) });
    }
    if (noTier.size) warn.push(`티어표에 없어 자동 배분에서 제외: ${[...noTier].join(", ")}`);
    pool.sort((a, b) => b.value - a.value);
    for (const item of pool) {
      if (count >= limit) break;
      const picks = perChar.get(item.char.name);
      if (picks.length >= item.char.cap) continue;
      picks.push(item); count++;
    }

    const rows = list
      .map((p) => { const picks = perChar.get(p.name); return { p, picks, value: picks.reduce((s, x) => s + x.value, 0), gross: picks.reduce((s, x) => s + x.price, 0) }; })
      .filter((r) => r.picks.length)
      .sort((a, b) => b.value - a.value);
    if (!rows.length) { console.log("  배분 대상 없음 (상한 미파악 + 고정 픽 없음)"); continue; }

    let worldValue = 0, worldGross = 0;
    for (const { p, picks, value, gross } of rows) {
      worldValue += value; worldGross += gross;
      const src = p.ceiling ? `상한 ${p.ceiling.boss} ${p.ceiling.diff} (${tierLabel(p.ceiling.tier)}) [${p.ceiling.manual ? "수동" : `실측 ${p.clearedCount}클`}]` : "상한 없음";
      const mode = p.fixed.length ? (p.auto ? `고정 ${p.fixed.length} + 자동` : "고정만") : "자동";
      console.log(`\n  ${p.name} (${p.cls} Lv.${p.level}) ${src} · ${mode} · 기본 ${p.party}인 — ${picks.length}개 실수령 ${fmtPower(value)}`);
      for (const x of picks) {
        const split = x.party > 1 ? ` ÷ ${x.party}인 = ${fmtPower(x.value)}` : "";
        console.log(`      ${x.fixed ? "📌" : "  "} ${x.boss} · ${x.diff} (${tierLabel(tierOf(x.boss, x.diff))})  ${fmtPower(x.price)}${split}`);
      }
    }
    const idle = list.filter((p) => !perChar.get(p.name).length).map((p) => p.name);
    console.log(`\n  ▶ ${world} 합계: 결정 ${count}/${limit}개, 실수령 ${fmtPower(worldValue)} (결정 정가 합 ${fmtPower(worldGross)})`);
    if (count < limit) console.log(`  ※ 한도 미달 ${limit - count}개 — 캐릭터 추가 또는 상한 상향 필요`);
    if (idle.length) console.log(`  ※ 배분 0개: ${idle.join(", ")} (상한 미파악이면 plan_config.json 에 ceiling 또는 bosses 지정)`);
  }
  if (warn.length) { console.log("\n경고:"); for (const w of warn) console.log(`  - ${w}`); }
  console.log("");
}

// ---------- plan init: 스케줄러 등록 기반으로 plan_config.json 자동 생성 ----------
//
// 캐릭터마다 인게임 스케줄러에 등록된 주간 보스(registration_flag=true)를 고정 픽으로 넣는다.
// 등록이 없으면 최근 클리어 최고가를 ceiling 으로. 둘 다 없으면 _note 로 표시.
// 기존 파일이 있으면 plan_config.backup.json 으로 백업하고, party/skip/auto 는 이어받는다.

async function cmdPlanInit(opts) {
  const minLevel = opts.minLevel ?? 235;
  const defaultParty = opts.party ?? 1;
  const priceDate = kstDateStr();
  let prev = {};
  if (fs.existsSync(PLAN_CONFIG_FILE)) {
    try { prev = JSON.parse(fs.readFileSync(PLAN_CONFIG_FILE, "utf8")); } catch { prev = {}; }
    const bak = path.join(__dirname, "plan_config.backup.json");
    fs.copyFileSync(PLAN_CONFIG_FILE, bak);
    console.log(`기존 설정 백업: ${path.basename(bak)}`);
  }
  const prevChars = prev.characters || {};

  const { account_list } = await getMyCharacterList();
  const chars = (account_list || []).flatMap((a) => a.character_list || [])
    .filter((c) => c.character_level >= minLevel || prevChars[c.character_name])
    .sort((a, b) => b.character_level - a.character_level);
  console.log(`대상 ${chars.length}명 (Lv.${minLevel}+ 또는 기존 설정에 있음). 스케줄러 등록 보스 수집 중`);

  const characters = {};
  const summary = [];
  for (const c of chars) {
    const name = c.character_name;
    const keep = prevChars[name] || {};
    const entry = {};
    if (keep.skip) { characters[name] = { skip: true }; summary.push(`${name}: skip (유지)`); continue; }
    if (keep.party) entry.party = keep.party;

    await sleep(220);
    let registered = [], best = null, cap = 12;
    try {
      const ocid = await getOcid(name);
      await sleep(220);
      const s = await getScheduler(ocid);
      if (s.weekly_boss_clear_limit_count) cap = s.weekly_boss_clear_limit_count;
      for (const b of s.boss_contents || []) {
        if (b.cycle !== "bossWeekly") continue;
        const key = `${b.content_name} ${b.difficulty}`;
        const p = crystalPrice(b.content_name, b.difficulty, priceDate);
        if (String(b.registration_flag) === "true") registered.push({ key, p: p ?? 0 });
        if (String(b.complete_flag) === "true" && p != null && (!best || p > best.p)) best = { key, p };
      }
    } catch (e) {
      entry._note = `조회 실패: ${e.message}`;
    }

    if (registered.length) {
      // 같은 보스에 여러 난이도 등록돼 있으면 가격 높은 쪽만
      const byBoss = {};
      for (const r of registered) {
        const boss = parseBossKey(r.key).boss;
        if (!byBoss[boss] || r.p > byBoss[boss].p) byBoss[boss] = r;
      }
      const picked = Object.values(byBoss).sort((a, b) => b.p - a.p);
      if (picked.length > cap) entry._note = `등록 ${picked.length}개 > 한도 ${cap}개. 상위 ${cap}개만 넣음`;
      entry.bosses = Object.fromEntries(picked.slice(0, cap).map((r) => [r.key, entry.party ?? defaultParty]));
      entry.auto = keep.auto ?? picked.length < cap; // 등록이 한도 미만이면 나머지 자동 채움
      summary.push(`${name}: 등록 ${picked.length}개${entry.auto ? " + auto" : ""}`);
    } else if (best) {
      entry.ceiling = keep.ceiling ?? best.key;
      summary.push(`${name}: 등록 없음 → ceiling ${entry.ceiling}`);
    } else {
      if (keep.ceiling) { entry.ceiling = keep.ceiling; summary.push(`${name}: ceiling ${keep.ceiling} (유지)`); }
      else { entry._note = (entry._note ? entry._note + " / " : "") + "등록·클리어 이력 없음. ceiling 또는 bosses 직접 지정"; summary.push(`${name}: 이력 없음`); }
    }
    characters[name] = entry;
    process.stdout.write(".");
  }
  console.log("");

  const out = {
    _설명: [
      "plan init 으로 생성. 인게임 스케줄러 등록 보스가 bosses 에 들어감. 값 = 파티 인원 (실수령 = 가격 ÷ 인원).",
      "bosses 는 { \"보스 난이도\": 인원 } 맵. 보스 추가/삭제/인원 변경은 이 맵만 고치면 됨.",
      "auto: true 면 bosses 외 남는 슬롯을 자동 채움. ceiling: 상한 보스 수동 지정. skip: 제외. _note 는 안내용(무시됨).",
      "다시 생성: node maple-proto.js plan init   (기존 party/skip/auto/ceiling 은 이어받음)",
    ],
    default_party: prev.default_party ?? defaultParty,
    characters,
  };
  fs.writeFileSync(PLAN_CONFIG_FILE, JSON.stringify(out, null, 2));
  console.log(`\n${path.basename(PLAN_CONFIG_FILE)} 생성 완료 (${Object.keys(characters).length}명)`);
  for (const s of summary) console.log(`  ${s}`);
  console.log(`\n다음: 파일에서 인원(값)만 고친 뒤  node maple-proto.js plan --date ${priceDate}`);
}

// ---------- 엔트리 ----------

(async () => {
  if (!API_KEY) {
    console.error("NEXON_API_KEY 환경변수를 설정하세요. (https://openapi.nexon.com 에서 발급)");
    process.exit(1);
  }
  const [cmd, arg] = process.argv.slice(2);
  try {
    const arg2 = process.argv[4];
    if (cmd === "char" && arg) await cmdChar(arg);
    else if (cmd === "log" && arg) await cmdLog(arg);
    else if (cmd === "sched" && arg) await cmdSched(arg, arg2);
    else if (cmd === "my-list") await cmdMyList();
    else if (cmd === "plan") {
      // plan [--limit 90] [--date YYYY-MM-DD] [--min-level 235]
      // plan init [--min-level 235] [--party 1]
      const flags = process.argv.slice(3);
      const get = (k) => { const i = flags.indexOf(k); return i >= 0 ? flags[i + 1] : undefined; };
      const minLevel = get("--min-level") ? Number(get("--min-level")) : undefined;
      if (arg === "init") await cmdPlanInit({ minLevel, party: get("--party") ? Number(get("--party")) : undefined });
      else await cmdPlan({ limit: get("--limit") ? Number(get("--limit")) : undefined, date: get("--date"), minLevel });
    }
    else {
      console.log("사용법:");
      console.log("  node maple-proto.js char <닉네임>          조회 + 전투력/세팅 기록");
      console.log("  node maple-proto.js log <닉네임>           기록 확인");
      console.log("  node maple-proto.js sched <닉네임> [날짜]   보스 클리어/스케줄러 조회 (날짜: YYYY-MM-DD, 최근 13일까지)");
      console.log("  node maple-proto.js my-list               내 계정 캐릭터 목록");
      console.log("  node maple-proto.js plan init [--min-level 235] [--party 1]");
      console.log("                                            스케줄러 등록 보스로 plan_config.json 자동 생성");
      console.log("  node maple-proto.js plan [--limit 90] [--date YYYY-MM-DD] [--min-level 235]");
      console.log("                                            주간 결정 한도 내 최대 수익 보스 배분 (설정: plan_config.json)");
    }
  } catch (e) {
    console.error("오류:", e.message);
    process.exit(1);
  }
})();
