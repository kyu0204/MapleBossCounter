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
  /**
   * 같은 보스·난이도로 등록된 파티의 실제 구성원 수.
   * 값이 있으면 party 가 곧 이 값이다 — 손으로 적어 둔 숫자보다 실제 파티가 맞다.
   */
  linkedSize?: number;
}

export interface MergedPickValue {
  party: number;
  source: PickSource;
  linkedSize?: number;
}

/**
 * 직접 고른 픽과 파티 유래 픽을 합친다.
 * 같은 보스를 양쪽에서 고르면 직접 고른 쪽이 이긴다 — 캐릭터·보스당 난이도는 하나다.
 *
 * 다만 인원은 다르다. 같은 보스·난이도로 파티를 등록해 뒀으면 그 파티의 구성원 수가
 * 실제 인원이므로 손으로 적어 둔 값 대신 그것을 쓴다(linkedSize). 파티에서 사람이
 * 들고 나면 실수령도 따라 바뀐다. 난이도가 다른 파티는 다른 판이라 인원을 끌어오지 않는다.
 */
export function mergePicks(picks: Record<string, number>, partyPicks: Record<string, number>): Record<string, MergedPickValue> {
  const out: Record<string, MergedPickValue> = {};
  const bossesTaken = new Set(Object.keys(picks).map((k) => parseBossKey(k)?.boss));
  for (const [k, v] of Object.entries(picks)) {
    const live = partyPicks[k];
    out[k] = live != null ? { party: live, source: "config", linkedSize: live } : { party: v, source: "config" };
  }
  for (const [k, v] of Object.entries(partyPicks)) {
    const b = parseBossKey(k)?.boss;
    if (b && bossesTaken.has(b)) continue;
    out[k] = { party: v, source: "party", linkedSize: v };
  }
  return out;
}

/**
 * 결정 값싼 보스부터.
 *
 * 기준은 **솔로(1인격) 원가**다. 인원으로 나눈 값으로 줄을 세우면 같은 보스가 인원
 * 설정에 따라 오르내려서 목록이 들썩인다. 원가로 세우면 순서가 고정된다.
 *
 * 티어 rank 대신 가격을 쓰는 이유는 둘이 항상 같지 않아서다. 실제로 도는 순서는
 * 값싼 것부터에 가깝다.
 *
 * 가격이 없는 보스(시즌 보스 등)는 맨 뒤로 보낸다. 0 으로 치면 제일 앞에 온다.
 * 값이 같으면 티어, 그다음 이름으로 갈라 순서를 고정한다.
 */
export function sortKeysByPrice(keys: string[], priceDate: string): string[] {
  const priceOf = (k: string) => {
    const r = parseBossKey(k);
    if (!r) return Number.POSITIVE_INFINITY;
    return crystalPrice(r.boss, r.diff, priceDate) ?? Number.POSITIVE_INFINITY;
  };
  const rank = (k: string) => {
    const r = parseBossKey(k);
    return r ? tierOf(r.boss, r.diff)?.rank ?? 0 : 0;
  };
  return [...keys].sort((a, b) => priceOf(a) - priceOf(b) || rank(a) - rank(b) || a.localeCompare(b, "ko"));
}

/** 합친 픽을 화면에 쓰기 좋은 배열로. 솔로 결정가 오름차순. */
export function toPickList(merged: Record<string, MergedPickValue>, priceDate: string): MergedPick[] {
  return sortKeysByPrice(Object.keys(merged), priceDate).flatMap((key) => {
    const r = parseBossKey(key);
    if (!r) return [];
    return [{ key, boss: r.boss, diff: r.diff, party: merged[key].party, source: merged[key].source, linkedSize: merged[key].linkedSize }];
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
