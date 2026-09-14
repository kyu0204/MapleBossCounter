/**
 * 결정석 가격표 (src/data/boss_crystal_prices.json).
 * entry 형식 A: { old, new, new_from }  — new_from(YYYY-MM-DD)부터 new 적용
 * entry 형식 B: { price }               — 변경 이력 없음
 * null: 가격 미확인
 *
 * 표의 값은 솔로(1인) 판매가. 실수령 = 가격 ÷ 파티 인원.
 */
import raw from "@/data/boss_crystal_prices.json";
import type { Difficulty } from "./bossKey";

type ChangeEntry = { old: number; new: number; new_from: string };
type FixedEntry = { price: number };
export type PriceEntry = ChangeEntry | FixedEntry | null;

export interface PriceTable {
  _meta: {
    updated?: string;
    sources?: string[];
    notes?: string[];
    weekly_world_sale_limit?: number | null;
    difficulty_map?: Record<string, string>;
    /** 월간 결정 (주간 한도·플래너 대상 아님) */
    monthly?: string[];
    /** 일간 결정 (주간 한도·플래너 대상 아님) */
    daily?: string[];
  };
  prices: Record<string, Partial<Record<Difficulty, PriceEntry>>>;
}

export const PRICE_TABLE = raw as unknown as PriceTable;

const NON_WEEKLY = new Set([...(PRICE_TABLE._meta?.monthly ?? []), ...(PRICE_TABLE._meta?.daily ?? [])]);

export type CrystalCycle = "weekly" | "daily" | "monthly";

/** 가격표 기준 결정 주기. 스케줄러 API 의 cycle(bossWeekly/bossDaily/bossMonthly) 과 대응. */
export function crystalCycle(boss: string, diff: string): CrystalCycle {
  const k = `${boss} ${diff}`;
  if (PRICE_TABLE._meta?.monthly?.includes(k)) return "monthly";
  if (PRICE_TABLE._meta?.daily?.includes(k)) return "daily";
  return "weekly";
}

export function isWeeklyCrystal(boss: string, diff: string): boolean {
  return !NON_WEEKLY.has(`${boss} ${diff}`);
}

/** 기준일(YYYY-MM-DD)에 유효한 결정석 가격. 미확인이면 null. */
export function crystalPrice(boss: string, diff: string, dateISO: string): number | null {
  const entry = PRICE_TABLE.prices?.[boss]?.[diff as Difficulty];
  if (!entry) return null;
  if ("price" in entry) return entry.price;
  if (entry.new_from && dateISO >= entry.new_from) return entry.new;
  return entry.old ?? null;
}

export interface Candidate {
  boss: string;
  diff: Difficulty;
  price: number;
}

/**
 * 주간 결정 후보 (보스, 난이도, 가격). 일간·월간 결정은 제외.
 * weeklySet("boss|diff")이 있으면 추가로 그것으로 필터 (스케줄러 응답에서 모은 실제 주간 행).
 */
export function weeklyCandidates(priceDate: string, weeklySet?: Set<string> | null): Candidate[] {
  const out: Candidate[] = [];
  for (const [boss, diffs] of Object.entries(PRICE_TABLE.prices ?? {})) {
    for (const diff of Object.keys(diffs) as Difficulty[]) {
      if (!isWeeklyCrystal(boss, diff)) continue;
      if (weeklySet && !weeklySet.has(`${boss}|${diff}`)) continue;
      const p = crystalPrice(boss, diff, priceDate);
      if (p != null) out.push({ boss, diff, price: p });
    }
  }
  return out;
}

/** 가격 변경 시점 목록 (기준일 토글용). 오름차순, 중복 제거. */
export function priceChangeDates(): string[] {
  const set = new Set<string>();
  for (const diffs of Object.values(PRICE_TABLE.prices ?? {})) {
    for (const e of Object.values(diffs)) {
      if (e && "new_from" in e) set.add(e.new_from);
    }
  }
  return [...set].sort();
}
