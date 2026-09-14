/**
 * 스케줄러 API 응답 파싱 + 결정 수익 추정.
 * 실측 사실:
 *  - boss_contents 행 목록은 고정이 아님(등록 상태에 따라 56→80행). 있는 행만 다룬다.
 *  - registration_flag 와 complete_flag 는 행 단위로 독립. 수익/상한은 complete_flag 만 쓴다.
 *  - quest_state 는 "0"/"1"/"2" 문자열. 0=미완료, 1=진행중, 2=완료 (관측 기반 추정).
 */
import type { Difficulty } from "./bossKey";
import { crystalPrice } from "./prices";
import { tierOf, type Tier } from "./tiers";

export type BossCycle = "bossDaily" | "bossWeekly" | "bossMonthly";

export interface RawBossRow {
  content_name: string;
  difficulty: string;
  cycle: string;
  registration_flag: string | boolean;
  complete_flag: string | boolean;
  list_order_no?: number;
}

export interface RawContentRow {
  content_name: string;
  type: "contents" | "quest" | string;
  registration_flag: string | boolean;
  now_count: number;
  max_count: number;
  quest_state: string | null;
}

export interface RawScheduler {
  date: string | null;
  character_name: string;
  world_name: string;
  character_level: number;
  character_class: string;
  daily_contents?: RawContentRow[];
  weekly_contents?: RawContentRow[];
  boss_contents?: RawBossRow[];
  weekly_boss_clear_count: number;
  weekly_boss_clear_limit_count: number;
}

export interface BossClearRow {
  boss: string;
  diff: Difficulty;
  cycle: BossCycle;
  registered: boolean;
  completed: boolean;
  order: number;
  tier: Tier | null;
}

export interface ContentRow {
  name: string;
  kind: "contents" | "quest";
  registered: boolean;
  now: number;
  max: number;
  /** quest 전용 */
  questState: "todo" | "progress" | "done" | "unknown" | null;
}

export interface ParsedSnapshot {
  date: string | null;
  name: string;
  world: string;
  level: number;
  cls: string;
  weeklyClearCount: number;
  weeklyLimit: number;
  bosses: BossClearRow[];
  daily: ContentRow[];
  weekly: ContentRow[];
}

const T = (v: unknown) => String(v) === "true";

function parseContent(c: RawContentRow): ContentRow {
  const kind = c.type === "quest" ? "quest" : "contents";
  let questState: ContentRow["questState"] = null;
  if (kind === "quest") {
    questState = ({ "0": "todo", "1": "progress", "2": "done" } as const)[String(c.quest_state)] ?? "unknown";
  }
  return { name: c.content_name, kind, registered: T(c.registration_flag), now: c.now_count ?? 0, max: c.max_count ?? 0, questState };
}

export function parseSnapshot(raw: RawScheduler): ParsedSnapshot {
  const bosses: BossClearRow[] = (raw.boss_contents ?? [])
    .map((b) => ({
      boss: b.content_name,
      diff: b.difficulty as Difficulty,
      cycle: b.cycle as BossCycle,
      registered: T(b.registration_flag),
      completed: T(b.complete_flag),
      order: b.list_order_no ?? 0,
      tier: tierOf(b.content_name, b.difficulty),
    }))
    .sort((a, b) => a.order - b.order);
  return {
    date: raw.date ?? null,
    name: raw.character_name,
    world: raw.world_name,
    level: raw.character_level,
    cls: raw.character_class,
    weeklyClearCount: raw.weekly_boss_clear_count ?? 0,
    weeklyLimit: raw.weekly_boss_clear_limit_count ?? 12,
    bosses,
    daily: (raw.daily_contents ?? []).map(parseContent),
    weekly: (raw.weekly_contents ?? []).map(parseContent),
  };
}

export interface RevenueLine {
  boss: string;
  diff: Difficulty;
  cycle: BossCycle;
  price: number | null;
  party: number;
  /** price ÷ party (floor). price null 이면 null */
  value: number | null;
}

export interface RevenueSummary {
  lines: RevenueLine[];
  byCycle: Record<BossCycle, { count: number; gross: number; value: number }>;
  totalGross: number;
  totalValue: number;
  unpriced: string[];
}

/**
 * 클리어된 보스의 결정 수익 추정. 등록 여부와 무관하게 completed 기준.
 * partyOf(boss, diff) 로 인원 지정. 없으면 1인(솔로).
 */
export function estimateRevenue(
  bosses: BossClearRow[],
  priceDate: string,
  partyOf: (boss: string, diff: string) => number = () => 1,
): RevenueSummary {
  const byCycle: RevenueSummary["byCycle"] = {
    bossDaily: { count: 0, gross: 0, value: 0 },
    bossWeekly: { count: 0, gross: 0, value: 0 },
    bossMonthly: { count: 0, gross: 0, value: 0 },
  };
  const lines: RevenueLine[] = [];
  const unpriced: string[] = [];
  for (const b of bosses) {
    if (!b.completed) continue;
    const price = crystalPrice(b.boss, b.diff, priceDate);
    const party = Math.max(1, partyOf(b.boss, b.diff) || 1);
    const value = price == null ? null : Math.floor(price / party);
    lines.push({ boss: b.boss, diff: b.diff, cycle: b.cycle, price, party, value });
    const c = byCycle[b.cycle] ?? (byCycle[b.cycle] = { count: 0, gross: 0, value: 0 });
    c.count++;
    if (price == null) unpriced.push(`${b.boss} ${b.diff}`);
    else {
      c.gross += price;
      c.value += value!;
    }
  }
  const totalGross = Object.values(byCycle).reduce((s, c) => s + c.gross, 0);
  const totalValue = Object.values(byCycle).reduce((s, c) => s + c.value, 0);
  return { lines, byCycle, totalGross, totalValue, unpriced };
}

/** 실측 클리어 중 티어 최고 행 (상한 산정용). 티어 미배정 보스는 제외. */
export function highestClearedTier(bosses: BossClearRow[]): BossClearRow | null {
  let best: BossClearRow | null = null;
  for (const b of bosses) {
    if (!b.completed || b.cycle !== "bossWeekly" || !b.tier) continue;
    if (!best || b.tier.rank > best.tier!.rank) best = b;
  }
  return best;
}
