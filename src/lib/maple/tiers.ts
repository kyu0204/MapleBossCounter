/**
 * 보스 티어 (src/data/boss_tiers.json, 나무위키 기준).
 * 등급 = 색(금>은>동>납) + 별 개수. rank 는 1(납★)~32(금★★★★★★★★★).
 * 상한 판정은 가격이 아닌 티어로: 상한 rank 이하의 (보스, 난이도)만 클리어 가능으로 본다.
 */
import raw from "@/data/boss_tiers.json";

export type Grade = "금" | "은" | "동" | "납";
export interface Tier {
  grade: Grade;
  stars: number;
  rank: number;
}

interface TierFile {
  _meta?: unknown;
  tiers: Record<Grade, Record<string, string[]>>;
  rank_base: Record<Grade, number>;
}

const file = raw as unknown as TierFile;

export const TIER_MAP: Record<string, Tier> = (() => {
  const map: Record<string, Tier> = {};
  for (const [grade, stars] of Object.entries(file.tiers ?? {}) as [Grade, Record<string, string[]>][]) {
    for (const [n, list] of Object.entries(stars)) {
      for (const key of list) {
        map[key] = { grade, stars: Number(n), rank: (file.rank_base?.[grade] ?? 0) + Number(n) };
      }
    }
  }
  return map;
})();

export function tierOf(boss: string, diff: string): Tier | null {
  return TIER_MAP[`${boss} ${diff}`] ?? null;
}

export function tierLabel(t: Tier | null | undefined): string {
  return t ? `${t.grade}★${t.stars}` : "티어없음";
}

/** 티어표 전체 키를 rank 내림차순으로 (상한 드롭다운용). */
export function tierKeysByRank(): { key: string; tier: Tier }[] {
  return Object.entries(TIER_MAP)
    .map(([key, tier]) => ({ key, tier }))
    .sort((a, b) => b.tier.rank - a.tier.rank);
}
