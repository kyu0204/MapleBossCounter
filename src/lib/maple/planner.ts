/**
 * 주간 결정 최적 배분 (프로토타입 cmdPlan 포팅, 순수 함수).
 *
 * 모델: 캐릭터마다 '상한 보스'(실측 클리어 중 티어 최고, 또는 수동)를 두고
 *       상한 티어(rank) 이하인 모든 (보스, 난이도)를 클리어 가능으로 본다.
 * 제약: 캐릭터당 주간 보스 한도(cap, 기본 12) · 캐릭터·보스당 난이도 1개 · 월드당 결정 한도(worldLimit).
 *       제약이 (캐릭터·보스) ⊂ 캐릭터 ⊂ 월드 로 중첩(laminar)이라 실수령 내림차순 그리디가 최적.
 * 실수령 = 가격 ÷ 파티 인원 (floor).
 */
import { bossKey, normalizeBossList, parseBossKey, type Difficulty } from "./bossKey";
import { crystalPrice, isWeeklyCrystal, type Candidate } from "./prices";
import { tierOf, type Tier } from "./tiers";
import type { BossClearRow } from "./scheduler";

// ---------- 설정 (plan_config.json 구조) ----------

export interface CharPlanConfig {
  skip?: boolean;
  auto?: boolean;
  party?: number;
  ceiling?: string; // "보스 난이도"
  bosses?: unknown; // { "보스 난이도": 인원 } | 배열 표기
  _note?: string;
}

export interface PlanConfig {
  default_party?: number;
  world_limit?: number;
  characters: Record<string, CharPlanConfig>; // key: 캐릭터 식별자 (닉네임 또는 ocid)
}

// ---------- 프로필 ----------

export interface Ceiling {
  boss: string;
  diff: Difficulty;
  rank: number;
  tier: Tier;
  price: number | null;
  manual: boolean;
}

export interface FixedPick {
  boss: string;
  diff: Difficulty;
  price: number;
  party: number;
  value: number;
  /** 어디서 왔는지: 사용자 설정 | 파티 등록 */
  source?: "config" | "party";
}

export interface PlanProfile {
  charId: string;
  name: string;
  cls?: string;
  level?: number;
  world?: string;
  cap: number;
  party: number;
  auto: boolean;
  ceiling: Ceiling | null;
  fixed: FixedPick[];
  clearedCount: number;
  /** 상한 산정 근거 */
  ceilingSource: "measured" | "manual" | null;
}

export interface BuildProfileInput {
  charId: string;
  name: string;
  cls?: string;
  level?: number;
  world?: string;
  cfg: CharPlanConfig | undefined;
  defaultParty: number;
  priceDate: string;
  /** 스냅샷들(이번 주 최신 + 지난주 최종 등)에서 모은 주간 보스 행 */
  snapshotBosses: BossClearRow[][];
  /** 스냅샷의 weekly_boss_clear_limit_count (없으면 12) */
  cap?: number;
  /** 파티 등록에서 유래한 고정 픽 (boss diff → 인원) */
  partyPicks?: Record<string, number>;
}

export interface BuildProfileResult {
  profile: PlanProfile;
  warnings: string[];
}

export function buildProfile(input: BuildProfileInput): BuildProfileResult {
  const { charId, name, cfg = {}, defaultParty, priceDate } = input;
  const warnings: string[] = [];
  const party = Number(cfg.party) || defaultParty || 1;
  const cap = input.cap && input.cap > 0 ? input.cap : 12;

  // 상한: 실측 클리어 중 티어 최고
  let best: Ceiling | null = null;
  const cleared = new Set<string>();
  for (const rows of input.snapshotBosses) {
    for (const b of rows) {
      if (b.cycle !== "bossWeekly" || !b.completed) continue;
      cleared.add(`${b.boss}|${b.diff}`);
      const t = tierOf(b.boss, b.diff);
      if (t && (!best || t.rank > best.rank)) {
        best = { boss: b.boss, diff: b.diff, rank: t.rank, tier: t, price: crystalPrice(b.boss, b.diff, priceDate), manual: false };
      }
    }
  }
  if (cfg.ceiling) {
    const k = parseBossKey(cfg.ceiling);
    const t = k && tierOf(k.boss, k.diff);
    if (k && t) best = { ...k, rank: t.rank, tier: t, price: crystalPrice(k.boss, k.diff, priceDate), manual: true };
    else warnings.push(`${name}: 수동 상한 "${cfg.ceiling}" 티어표에 없음 — 무시`);
  }

  // 고정 픽: 파티 유래 + 설정. 같은 보스면 설정이 우선.
  const fixed: FixedPick[] = [];
  const seenBoss = new Set<string>();
  const addFixed = (boss: string, diff: Difficulty, pp: number, source: FixedPick["source"]) => {
    if (!isWeeklyCrystal(boss, diff)) {
      // 일간/월간 결정은 주간 한도·배분 대상이 아님. 파티 유래는 조용히 스킵, 설정은 안내.
      if (source === "config") warnings.push(`${name}: "${boss} ${diff}" 는 주간 결정이 아니라 플래너에서 제외`);
      return;
    }
    const p = crystalPrice(boss, diff, priceDate);
    if (p == null) { warnings.push(`${name}: "${boss} ${diff}" 가격표에 없음 — 제외`); return; }
    if (seenBoss.has(boss)) { warnings.push(`${name}: ${boss} 중복 지정 — 첫 항목만 사용`); return; }
    seenBoss.add(boss);
    fixed.push({ boss, diff, price: p, party: pp, value: Math.floor(p / pp), source });
  };
  for (const { key, party: rawParty, raw } of normalizeBossList(cfg.bosses)) {
    const k = parseBossKey(key);
    if (!k) { warnings.push(`${name}: 보스 표기 오류 ${JSON.stringify(raw)}`); continue; }
    addFixed(k.boss, k.diff, Number(rawParty) || party, "config");
  }
  for (const [key, pp] of Object.entries(input.partyPicks ?? {})) {
    const k = parseBossKey(key);
    if (!k) continue;
    if (seenBoss.has(k.boss)) continue; // 설정 우선, 경고 없이 스킵
    addFixed(k.boss, k.diff, Math.max(1, pp), "party");
  }
  if (fixed.length > cap) warnings.push(`${name}: 고정 픽 ${fixed.length}개 > 주간 한도 ${cap}개 — 실수령 상위 ${cap}개만 사용`);
  fixed.sort((a, b) => b.value - a.value);
  const fixedUsed = fixed.slice(0, cap);

  // auto 기본값: 사용자가 bosses 를 직접 지정했으면 false, 아니면 true.
  // 파티 등록에서 유래한 고정 픽만 있는 경우는 "나머지 자동 채움" 이 자연스러우므로 true 유지.
  const configFixedCount = fixed.filter((f) => f.source === "config").length;
  const auto = cfg.auto ?? configFixedCount === 0;
  return {
    profile: {
      charId, name, cls: input.cls, level: input.level, world: input.world,
      cap, party, auto, ceiling: best, fixed: fixedUsed, clearedCount: cleared.size,
      ceilingSource: best ? (best.manual ? "manual" : "measured") : null,
    },
    warnings,
  };
}

// ---------- 배분 ----------

export interface PlanPick {
  boss: string;
  diff: Difficulty;
  price: number;
  party: number;
  value: number;
  fixed: boolean;
  source?: FixedPick["source"];
  tier: Tier | null;
}

export interface PlanRow {
  charId: string;
  picks: PlanPick[];
  value: number;
  gross: number;
}

export interface PlanInput {
  priceDate: string;
  worldLimit: number;
  candidates: Candidate[];
  profiles: PlanProfile[];
}

export interface PlanOutput {
  rows: PlanRow[];
  count: number;
  worldValue: number;
  worldGross: number;
  idle: string[];
  warnings: string[];
}

export function allocatePlan(input: PlanInput): PlanOutput {
  const { worldLimit, candidates, profiles } = input;
  const warnings: string[] = [];
  const perChar = new Map<string, PlanPick[]>();
  let count = 0;

  for (const p of profiles) {
    const picks: PlanPick[] = p.fixed.map((f) => ({ ...f, fixed: true, tier: tierOf(f.boss, f.diff) }));
    perChar.set(p.charId, picks);
    count += picks.length;
  }
  if (count > worldLimit) warnings.push(`고정 픽 합계 ${count}개가 월드 한도 ${worldLimit}개 초과`);

  // 자동 후보: 상한 티어 이하 보스마다 가격 최고 난이도 1개, 고정 픽 보스 제외. 정렬 기준 실수령.
  type PoolItem = PlanPick & { charId: string };
  const pool: PoolItem[] = [];
  const noTier = new Set<string>();
  for (const p of profiles) {
    if (!p.auto || !p.ceiling) continue;
    const fixedBosses = new Set(p.fixed.map((f) => f.boss));
    const bestPerBoss: Record<string, Candidate> = {};
    for (const c of candidates) {
      if (fixedBosses.has(c.boss)) continue;
      const t = tierOf(c.boss, c.diff);
      if (!t) { noTier.add(bossKey(c.boss, c.diff)); continue; }
      if (t.rank > p.ceiling.rank) continue;
      if (!bestPerBoss[c.boss] || c.price > bestPerBoss[c.boss].price) bestPerBoss[c.boss] = c;
    }
    for (const c of Object.values(bestPerBoss)) {
      pool.push({ charId: p.charId, boss: c.boss, diff: c.diff, price: c.price, party: p.party, value: Math.floor(c.price / p.party), fixed: false, tier: tierOf(c.boss, c.diff) });
    }
  }
  if (noTier.size) warnings.push(`티어표에 없어 자동 배분에서 제외: ${[...noTier].join(", ")}`);

  pool.sort((a, b) => b.value - a.value);
  const capOf = new Map(profiles.map((p) => [p.charId, p.cap]));
  for (const item of pool) {
    if (count >= worldLimit) break;
    const picks = perChar.get(item.charId)!;
    if (picks.length >= (capOf.get(item.charId) ?? 12)) continue;
    const { charId: _omit, ...pick } = item;
    void _omit;
    picks.push(pick);
    count++;
  }

  const rows: PlanRow[] = profiles
    .map((p) => {
      const picks = [...perChar.get(p.charId)!].sort((a, b) => b.value - a.value);
      return { charId: p.charId, picks, value: picks.reduce((s, x) => s + x.value, 0), gross: picks.reduce((s, x) => s + x.price, 0) };
    })
    .filter((r) => r.picks.length)
    .sort((a, b) => b.value - a.value);

  const idle = profiles.filter((p) => !perChar.get(p.charId)!.length).map((p) => p.charId);
  return {
    rows,
    count,
    worldValue: rows.reduce((s, r) => s + r.value, 0),
    worldGross: rows.reduce((s, r) => s + r.gross, 0),
    idle,
    warnings,
  };
}

// ---------- 스케줄러 등록 기반 설정 생성 (cmdPlanInit 포팅) ----------

export interface InitFromRegistrationInput {
  name: string;
  keep: CharPlanConfig | undefined;
  defaultParty: number;
  priceDate: string;
  /** 실시간 스냅샷의 주간 보스 행 */
  bosses: BossClearRow[] | null;
  cap?: number;
}

/**
 * 인게임 스케줄러 등록(registered)을 고정 픽으로, 없으면 클리어 최고 티어를 ceiling 으로.
 * 기존 party/skip/auto/ceiling 은 keep 에서 이어받는다.
 */
export function initCharConfigFromRegistration(input: InitFromRegistrationInput): { cfg: CharPlanConfig; summary: string } {
  const { name, keep = {}, defaultParty, priceDate, bosses } = input;
  const cap = input.cap && input.cap > 0 ? input.cap : 12;
  if (keep.skip) return { cfg: { skip: true }, summary: `${name}: skip (유지)` };
  const cfg: CharPlanConfig = {};
  if (keep.party) cfg.party = keep.party;
  if (!bosses) {
    if (keep.ceiling) { cfg.ceiling = keep.ceiling; return { cfg, summary: `${name}: 조회 실패, ceiling ${keep.ceiling} (유지)` }; }
    cfg._note = "조회 실패";
    return { cfg, summary: `${name}: 조회 실패` };
  }

  const weekly = bosses.filter((b) => b.cycle === "bossWeekly");
  const registered = weekly.filter((b) => b.registered).map((b) => ({ key: bossKey(b.boss, b.diff), boss: b.boss, p: crystalPrice(b.boss, b.diff, priceDate) ?? 0 }));
  let best: { key: string; rank: number } | null = null;
  for (const b of weekly) {
    if (b.completed && b.tier && (!best || b.tier.rank > best.rank)) best = { key: bossKey(b.boss, b.diff), rank: b.tier.rank };
  }

  if (registered.length) {
    const byBoss: Record<string, (typeof registered)[number]> = {};
    for (const r of registered) if (!byBoss[r.boss] || r.p > byBoss[r.boss].p) byBoss[r.boss] = r;
    const picked = Object.values(byBoss).sort((a, b) => b.p - a.p);
    if (picked.length > cap) cfg._note = `등록 ${picked.length}개 > 한도 ${cap}개. 상위 ${cap}개만 넣음`;
    cfg.bosses = Object.fromEntries(picked.slice(0, cap).map((r) => [r.key, cfg.party ?? defaultParty]));
    cfg.auto = keep.auto ?? picked.length < cap;
    return { cfg, summary: `${name}: 등록 ${picked.length}개${cfg.auto ? " + auto" : ""}` };
  }
  if (best) {
    cfg.ceiling = keep.ceiling ?? best.key;
    return { cfg, summary: `${name}: 등록 없음 → ceiling ${cfg.ceiling}` };
  }
  if (keep.ceiling) { cfg.ceiling = keep.ceiling; return { cfg, summary: `${name}: ceiling ${keep.ceiling} (유지)` }; }
  cfg._note = "등록·클리어 이력 없음. ceiling 또는 bosses 직접 지정";
  return { cfg, summary: `${name}: 이력 없음` };
}
