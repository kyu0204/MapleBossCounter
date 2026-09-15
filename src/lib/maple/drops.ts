/**
 * 보스 드롭/보상.
 *
 * 내용의 출처는 나무위키 각 보스 문서 본문 상세표의 "주요 보상" 칸이다 (src/data/boss_reward_items.json).
 * 카테고리는 두 종류:
 *   공통 계열 — 장비 / 소비 / 개인 / 기타 / 공용 / 공통 : 난이도와 무관
 *   난이도 계열 — 이지 / 노멀 / 하드 / 카오스 / 익스트림, 뒤에 "+" 가 붙으면 "그 난이도 이상"
 *
 * 세트 색(여명·칠흑·에테르넬)은 표시용으로만 boss_drops.json 의 이름 목록에서 유추한다.
 */
import rawSets from "@/data/boss_drops.json";
import rawItems from "@/data/boss_reward_items.json";
import { type Difficulty } from "./bossKey";
import { tierOf } from "./tiers";

export type DropSet = "여명" | "칠흑" | "광휘" | "에테르넬" | "기타";

export interface RewardItem {
  name: string;
  file: string;
  w?: number;
  h?: number;
}

export interface RewardGroup {
  /** 화면에 그대로 쓰는 라벨 (장비, 개인, 하드, 노멀+ …) */
  label: string;
  /** 난이도 전용 보상인지 */
  difficultyScoped: boolean;
  items: RewardItem[];
}

interface ItemFile {
  _meta: { updated: string; source: string; difficultyMap: Record<string, Difficulty>; commonCategories: string[]; notes: string[] };
  items: Record<string, Record<string, RewardItem[]>>;
}

const itemFile = rawItems as unknown as ItemFile;
export const REWARD_ITEMS_META = itemFile._meta;

const COMMON = new Set(itemFile._meta.commonCategories ?? ["장비", "소비", "개인", "기타", "공용", "공통"]);
const DIFF_KO = itemFile._meta.difficultyMap ?? {};

const encodeFile = (f: string) => f.split("/").map(encodeURIComponent).join("/");
const norm = (s: string) => s.replace(/\s+/g, "");

// ---------- 세트 색 (표시 전용) ----------

interface SetFile {
  _meta: { updated: string; sources: string[]; notes: string[]; sets: Record<string, { label: string; tone: string }> };
  drops: Record<string, { name: string; slot: string; set: DropSet }[]>;
}
const setFile = rawSets as unknown as SetFile;
export const DROPS_META = setFile._meta;

/** 아이템 이름 → 세트. boss_drops.json 의 이름 목록으로 유추한다(표기 차이 허용). */
const SET_BY_NAME: { key: string; set: DropSet }[] = (() => {
  const out: { key: string; set: DropSet }[] = [];
  const seen = new Set<string>();
  for (const list of Object.values(setFile.drops)) {
    for (const d of list) {
      const k = norm(d.name);
      if (seen.has(k)) continue;
      seen.add(k);
      out.push({ key: k, set: d.set });
    }
  }
  return out;
})();

/**
 * 광휘의 보스 세트 6종. 2024-07-18 MILESTONE 2차로 나온 최상위 장신구 세트로,
 * 세렌·칼로스·카링을 뺀 어센틱포스 보스의 하드(카오스) 이상에서만 뜬다.
 * 이름에 '광휘' 가 안 들어가서 이름만 보고는 알 수 없다.
 * 출처: 나무위키 '광휘의 보스 세트' 문서의 세트 효과표.
 */
const RADIANT_SET = ["근원의 속삭임", "황홀한 악몽", "죽음의 맹세", "불멸의 유산", "오만의 원죄", "굶주리는 핏빛 원혼"].map(norm);

export function setOfItem(name: string): DropSet | null {
  const t = norm(name);
  // 세트 이름이 아이템명에 그대로 들어가는 것들. 상자·조각·선택 상자까지 한 세트로 묶는다.
  if (t.includes("에테르넬")) return "에테르넬";
  if (t.includes("칠흑")) return "칠흑";
  if (t.includes("여명")) return "여명";
  if (RADIANT_SET.includes(t)) return "광휘";
  for (const { key, set } of SET_BY_NAME) if (key === t) return set;
  for (const { key, set } of SET_BY_NAME) if (key.includes(t) || t.includes(key)) return set;
  return null;
}

export const DROP_SET_STYLE: Record<DropSet, string> = {
  여명: "bg-amber-50 text-amber-900 border-amber-200 dark:bg-amber-950/40 dark:text-amber-200 dark:border-amber-900",
  칠흑: "bg-violet-50 text-violet-900 border-violet-200 dark:bg-violet-950/40 dark:text-violet-200 dark:border-violet-900",
  광휘: "bg-cyan-50 text-cyan-900 border-cyan-300 dark:bg-cyan-950/40 dark:text-cyan-100 dark:border-cyan-800",
  에테르넬: "bg-yellow-50 text-yellow-900 border-yellow-300 dark:bg-yellow-950/40 dark:text-yellow-100 dark:border-yellow-800",
  기타: "bg-zinc-50 text-zinc-700 border-zinc-200 dark:bg-zinc-900 dark:text-zinc-300 dark:border-zinc-800",
};
/** 범례에 내는 순서 = 세트가 나온 순서 */
export const DROP_SETS: DropSet[] = ["여명", "칠흑", "광휘", "에테르넬"];

// ---------- 보상 조회 ----------

/** 라벨이 이 (보스, 난이도) 에 해당하는가 */
function labelApplies(boss: string, diff: Difficulty | string, label: string): boolean {
  if (COMMON.has(label)) return true;
  const atLeast = label.endsWith("+");
  const ko = atLeast ? label.slice(0, -1) : label;
  const target = DIFF_KO[ko];
  if (!target) return false;
  if (target === diff) return true;
  if (!atLeast) return false;
  // "노멀 이상" → 같은 보스 안에서 티어가 그 난이도 이상이면 포함
  const here = tierOf(boss, diff)?.rank;
  const base = tierOf(boss, target)?.rank;
  return here != null && base != null && here >= base;
}

/** 보스+난이도에 해당하는 보상을 카테고리 그룹으로 */
export function rewardGroupsOf(boss: string, diff: Difficulty | string): RewardGroup[] {
  const cats = itemFile.items[boss];
  if (!cats) return [];
  const out: RewardGroup[] = [];
  for (const [label, items] of Object.entries(cats)) {
    if (!labelApplies(boss, diff, label)) continue;
    out.push({
      label,
      difficultyScoped: !COMMON.has(label),
      items: items.map((i) => ({ ...i, file: encodeFile(i.file) })),
    });
  }
  // 공통 먼저, 난이도 전용 나중
  return out.sort((a, b) => Number(a.difficultyScoped) - Number(b.difficultyScoped));
}

/**
 * 보스+난이도에 실제로 해당하는 보상만 평평한 목록으로.
 * 카테고리는 필터링에만 쓰고 화면에는 내보내지 않는다 — 행이 이미 난이도별이라 라벨이 중복이다.
 */
export function rewardItemsFor(boss: string, diff: Difficulty | string): RewardItem[] {
  const out: RewardItem[] = [];
  const seen = new Set<string>();
  for (const g of rewardGroupsOf(boss, diff)) {
    for (const it of g.items) {
      if (seen.has(it.name)) continue;
      seen.add(it.name);
      out.push(it);
    }
  }
  return out;
}

/** 보스의 모든 보상 (난이도 무관) */
export function allRewardsOf(boss: string): RewardItem[] {
  return Object.values(itemFile.items[boss] ?? {})
    .flat()
    .map((i) => ({ ...i, file: encodeFile(i.file) }));
}

export function hasRewards(boss: string, diff: Difficulty | string): boolean {
  return rewardGroupsOf(boss, diff).length > 0;
}

/** 이름으로 아이콘 찾기 (표기 차이 허용) */
export function itemIconFor(name: string, boss?: string): string | null {
  const target = norm(name);
  const pools = boss ? [allRewardsOf(boss), ...Object.keys(itemFile.items).map(allRewardsOf)] : Object.keys(itemFile.items).map(allRewardsOf);
  for (const pool of pools) for (const it of pool) if (norm(it.name) === target) return it.file;
  for (const pool of pools) for (const it of pool) if (norm(it.name).includes(target) || target.includes(norm(it.name))) return it.file;
  return null;
}
