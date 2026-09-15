/**
 * 보스 보상 (표시용, src/data/boss_rewards.json).
 *
 * 내용은 나무위키 보스 문서의 난이도별 보상 섹션에서 골라 담았다.
 * 모든 보스에 깔리는 소모품(훈장·물약·경험치·주문서 교환권 등)과
 * 강렬한 힘의 결정(가격표에 있음)은 제외돼 있다.
 *
 * 메멘토 큐브는 2026-09-17 패치 전/후 수량을 함께 갖고 있어 기준일로 고른다.
 */
import raw from "@/data/boss_rewards.json";
import type { Difficulty } from "./bossKey";
import { setOfItem, type DropSet } from "./drops";

export interface RewardEntry {
  name: string;
  /** 1 이면 생략 */
  count?: number;
  /** "5~10" 처럼 범위로 적힌 경우 원문 */
  range?: string;
  /** 잡으면 무조건 주는 확정 보상. 없으면 확률 드롭이다. */
  fixed?: boolean;
  /** 아이콘이 있으면 원본 크기와 함께 */
  icon?: string;
  w?: number;
  h?: number;
  /** 아이콘이 없을 때 쓰는 짧은 라벨 */
  short?: string;
}

interface CubeEntry {
  name: string;
  before: number;
  after: number;
  icon?: string;
  w?: number;
  h?: number;
  short?: string;
}

interface RewardsFile {
  _meta: { updated: string; source: string; cubePatchDate: string; iconBox: { w: number; h: number }; notes: string[] };
  bosses: Record<string, Record<string, { rewards: RewardEntry[]; cubes?: Record<string, CubeEntry> }>>;
}

const file = raw as unknown as RewardsFile;
export const REWARDS_META = file._meta;

/**
 * 아이콘 칸 크기 = 전체 아이콘 중 가장 큰 가로·세로.
 * 아이콘 원본이 23x20 부터 40x41 까지 제각각이라, 줄이면 계단현상이 난다.
 * 크기는 그대로 두고 이 칸 안에 가운데 정렬해서 줄을 맞춘다.
 */
export const ICON_BOX = file._meta.iconBox;

const encodeFile = (f: string) => f.split("/").map(encodeURIComponent).join("/");

/** 표시용 보상 한 건 */
export interface DisplayReward extends RewardEntry {
  set: DropSet | null;
}

/**
 * 보스+난이도의 보상 목록. 큐브는 기준일에 맞는 수량으로 합쳐 넣는다.
 * priceDate 가 패치일 이후면 변경 수량을, 아니면 기존 수량을 쓴다.
 */
export function rewardsFor(boss: string, diff: Difficulty | string, priceDate: string): DisplayReward[] {
  const row = file.bosses[boss]?.[String(diff)];
  if (!row) return [];
  const after = priceDate >= file._meta.cubePatchDate;
  const out: DisplayReward[] = row.rewards.map((r) => ({
    ...r,
    icon: r.icon ? encodeFile(r.icon) : undefined,
    set: setOfItem(r.name),
  }));
  for (const c of Object.values(row.cubes ?? {})) {
    const count = after ? c.after : c.before;
    if (!count) continue;
    // 큐브는 잡으면 무조건 주는 확정 보상이다
    out.push({ name: c.name, count, fixed: true, icon: c.icon ? encodeFile(c.icon) : undefined, w: c.w, h: c.h, short: c.short, set: null });
  }
  return out;
}

/**
 * 확정 보상과 확률 드롭을 나눠서 준다. 화면에서 두 줄로 보여준다.
 * 확정 안에서는 큐브가 뒤로 가도록 원래 순서를 유지한다 (수집본 순서 = 나무위키 표기 순서).
 */
export function rewardRowsFor(
  boss: string,
  diff: Difficulty | string,
  priceDate: string,
): { fixed: DisplayReward[]; random: DisplayReward[] } {
  const all = rewardsFor(boss, diff, priceDate);
  return { fixed: all.filter((r) => r.fixed), random: all.filter((r) => !r.fixed) };
}

export function hasRewardsFor(boss: string, diff: Difficulty | string, priceDate: string): boolean {
  return rewardsFor(boss, diff, priceDate).length > 0;
}

/** 큐브 수량이 패치로 바뀌는 행인지 (안내용) */
export function cubesChangeOn(boss: string, diff: Difficulty | string): boolean {
  const cubes = file.bosses[boss]?.[String(diff)]?.cubes;
  return Object.values(cubes ?? {}).some((c) => c.before !== c.after);
}
