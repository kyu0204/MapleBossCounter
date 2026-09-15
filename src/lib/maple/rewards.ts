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

// ---------- 파티 분배 ----------

/**
 * 파티원끼리 나눠 갖는 보상인지.
 *
 * 조각·편린류와 큐브는 파티 한 몫이 떨어져 인원수로 나뉜다.
 * 솔 에르다의 기운이나 주문의 흔적처럼 각자에게 들어오는 것은 나누지 않는다.
 */
export function isSharedReward(name: string): boolean {
  return /조각|편린|큐브/.test(name);
}

/**
 * 여러 캐릭터를 합친 화면에 낼 항목인지.
 *
 * 주문의 흔적과 메멘토 큐브만 남긴다. 둘은 계정에서 같이 쓰는 재화라 캐릭터를
 * 가로질러 더한 값이 그대로 쓸 수 있는 양이 된다.
 *
 * 솔 에르다의 기운, 조각·편린류, 물방울석·영혼석·에너지 코어 같은 것은 그 캐릭터에
 * 묶인 성장 재료다. 합쳐 봐야 어디에도 못 쓰는 숫자라 오히려 오해를 부른다.
 * 캐릭터별 값은 캐릭터 상세에서 본다.
 *
 * 뺄 것을 열거하는 대신 남길 것만 적는다. 새 보상이 생겨도 조용히 합계에
 * 섞여 들지 않는다.
 */
export function isAccountWideReward(name: string): boolean {
  return name === "주문의 흔적" || name.includes("큐브");
}

export interface RewardAmount {
  /** 화면 표기. 범위면 양끝을 각각 나눈 "2~5" 꼴 */
  text: string;
  /** 합산에 쓰는 값. 범위면 최대값 */
  value: number;
  shared: boolean;
}

/** 소수점은 버린다 — 나눠 떨어지지 않으면 못 받는다 */
const share = (n: number, party: number) => Math.floor(n / Math.max(1, party));

/** 인원수를 반영한 실제 수량 */
export function rewardAmount(r: Pick<DisplayReward, "name" | "count" | "range">, party: number): RewardAmount {
  const count = r.count ?? 1;
  const shared = isSharedReward(r.name);
  if (!shared || party <= 1) return { text: r.range ?? String(count), value: count, shared };
  if (r.range) {
    const [lo, hi] = r.range.split("~").map((s) => Number(s.trim()));
    if (Number.isFinite(lo) && Number.isFinite(hi)) {
      const a = share(lo, party);
      const b = share(hi, party);
      return { text: a === b ? String(b) : `${a}~${b}`, value: b, shared };
    }
  }
  const v = share(count, party);
  return { text: String(v), value: v, shared };
}

export interface RewardTotal {
  name: string;
  icon?: string;
  w?: number;
  h?: number;
  short?: string;
  /** 인원 분배까지 반영한 합 */
  total: number;
  shared: boolean;
}

/**
 * 여러 보스의 확정 보상을 아이템별로 합친다.
 * 조각·큐브는 보스마다 인원수로 나눈 뒤 더한다 — 먼저 더하고 나누면 실제보다 많아진다.
 */
export function aggregateFixedRewards(picks: { boss: string; diff: Difficulty | string; party: number }[], priceDate: string): RewardTotal[] {
  const acc = new Map<string, RewardTotal>();
  for (const p of picks) {
    for (const r of rewardRowsFor(p.boss, p.diff, priceDate).fixed) {
      const { value, shared } = rewardAmount(r, p.party);
      if (value <= 0) continue;
      const hit = acc.get(r.name);
      if (hit) hit.total += value;
      else acc.set(r.name, { name: r.name, icon: r.icon, w: r.w, h: r.h, short: r.short, total: value, shared });
    }
  }
  return [...acc.values()].sort((a, b) => b.total - a.total);
}

/** 큐브 수량이 패치로 바뀌는 행인지 (안내용) */
export function cubesChangeOn(boss: string, diff: Difficulty | string): boolean {
  const cubes = file.bosses[boss]?.[String(diff)]?.cubes;
  return Object.values(cubes ?? {}).some((c) => c.before !== c.after);
}
