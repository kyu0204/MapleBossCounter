/**
 * 캐릭터가 "이번 주 갈 보스"로 고른 목록을 다루는 순수 함수들.
 *
 * 고른 보스는 플래너와 같은 저장소(plan_configs 의 characters[ocid].bosses)에 있고,
 * 파티 등록에서 자동으로 따라 들어오는 픽이 따로 있다. 둘을 합치는 규칙과 합계 계산이
 * 캐릭터 페이지("이번 주 갈 보스" 카드, "보스 - 설정" 카드)와 플래너에서 같아야 해서
 * 한 곳에 모아 둔다.
 */
import { parseBossKey, type Difficulty } from "./bossKey";
import { crystalPrice } from "./prices";
import { tierOf } from "./tiers";

/** config = 직접 고른 것, party = 파티 등록에서 자동으로 들어온 것 */
export type PickSource = "config" | "party";

export interface MergedPick {
  key: string;
  boss: string;
  diff: Difficulty;
  party: number;
  source: PickSource;
}

/**
 * 직접 고른 픽과 파티 유래 픽을 합친다.
 * 같은 보스를 양쪽에서 고르면 직접 고른 쪽이 이긴다 — 캐릭터·보스당 난이도는 하나다.
 */
export function mergePicks(picks: Record<string, number>, partyPicks: Record<string, number>): Record<string, { party: number; source: PickSource }> {
  const out: Record<string, { party: number; source: PickSource }> = {};
  const bossesTaken = new Set(Object.keys(picks).map((k) => parseBossKey(k)?.boss));
  for (const [k, v] of Object.entries(picks)) out[k] = { party: v, source: "config" };
  for (const [k, v] of Object.entries(partyPicks)) {
    const b = parseBossKey(k)?.boss;
    if (b && bossesTaken.has(b)) continue;
    out[k] = { party: v, source: "party" };
  }
  return out;
}

/** 티어 높은 보스부터 */
export function sortKeysByTier(keys: string[]): string[] {
  const rank = (k: string) => {
    const r = parseBossKey(k);
    return r ? tierOf(r.boss, r.diff)?.rank ?? 0 : 0;
  };
  return [...keys].sort((a, b) => rank(b) - rank(a));
}

/** 합친 픽을 화면에 쓰기 좋은 배열로. 티어 내림차순. */
export function toPickList(merged: Record<string, { party: number; source: PickSource }>): MergedPick[] {
  return sortKeysByTier(Object.keys(merged)).flatMap((key) => {
    const r = parseBossKey(key);
    if (!r) return [];
    return [{ key, boss: r.boss, diff: r.diff, party: merged[key].party, source: merged[key].source }];
  });
}

export interface PickTotals {
  count: number;
  /** 파티 인원으로 나눈 실수령 합 */
  value: number;
  /** 정가 합 */
  gross: number;
}

export function picksTotals(picks: MergedPick[], priceDate: string): PickTotals {
  let value = 0;
  let gross = 0;
  for (const p of picks) {
    const price = crystalPrice(p.boss, p.diff, priceDate);
    if (price == null) continue;
    gross += price;
    value += Math.floor(price / Math.max(1, p.party));
  }
  return { count: picks.length, value, gross };
}

/**
 * 고른 보스를 아직 안 간 것과 이미 간 것으로 나눈다.
 * 클리어 판정은 인게임 스케줄러의 complete_flag 기준이다 (등록 여부와 무관).
 */
export function splitByCleared(picks: MergedPick[], cleared: Iterable<string>): { remaining: MergedPick[]; done: MergedPick[] } {
  const set = new Set(cleared);
  const remaining: MergedPick[] = [];
  const done: MergedPick[] = [];
  for (const p of picks) (set.has(p.key) ? done : remaining).push(p);
  return { remaining, done };
}
