/**
 * 보스 드롭 아이템 (src/data/boss_drops.json).
 * 확인된 세트 장신구·방어구만 담는다. 공통 보상(소울·훈장·의지의 결정)과 출처 미확인 보스는 비어 있다.
 */
import raw from "@/data/boss_drops.json";
import rawItems from "@/data/boss_reward_items.json";
import { bossKey, type Difficulty } from "./bossKey";

export type DropSet = "여명" | "칠흑" | "에테르넬" | "기타";

export interface BossDrop {
  name: string;
  slot: string;
  set: DropSet;
}

interface DropFile {
  _meta: { updated: string; sources: string[]; notes: string[]; sets: Record<string, { label: string; tone: string }> };
  drops: Record<string, BossDrop[]>;
}

const file = raw as unknown as DropFile;

export const DROPS_META = file._meta;

export function dropsOf(boss: string, diff: Difficulty | string): BossDrop[] {
  return file.drops[bossKey(boss, String(diff))] ?? [];
}

export function hasDrops(boss: string, diff: Difficulty | string): boolean {
  return dropsOf(boss, diff).length > 0;
}

/** 세트별 칩 색. Tailwind 가 스캔할 수 있게 리터럴 문자열로 둔다. */
export const DROP_SET_STYLE: Record<DropSet, string> = {
  여명: "bg-amber-50 text-amber-900 border-amber-200 dark:bg-amber-950/40 dark:text-amber-200 dark:border-amber-900",
  칠흑: "bg-violet-50 text-violet-900 border-violet-200 dark:bg-violet-950/40 dark:text-violet-200 dark:border-violet-900",
  에테르넬: "bg-yellow-50 text-yellow-900 border-yellow-300 dark:bg-yellow-950/40 dark:text-yellow-100 dark:border-yellow-800",
  기타: "bg-zinc-50 text-zinc-700 border-zinc-200 dark:bg-zinc-900 dark:text-zinc-300 dark:border-zinc-800",
};

export const DROP_SETS: DropSet[] = ["여명", "칠흑", "에테르넬"];

// ---------- 나무위키 '주요 보상' 아이템 + 아이콘 ----------
// scripts/fetch-namu-item-icons.mjs 가 만든다. 주간 결정 보스만. 난이도 구분은 없다.

export interface RewardItem {
  name: string;
  file: string;
  bytes?: number;
}

interface ItemFile {
  _meta: { updated: string; source: string; notes: string[] };
  items: Record<string, RewardItem[]>;
}

const itemFile = rawItems as unknown as ItemFile;
export const REWARD_ITEMS_META = itemFile._meta;

/** URL 에 쓸 수 있게 인코딩 (한글 파일명) */
const encodeFile = (f: string) => f.split("/").map(encodeURIComponent).join("/");

/** 보스의 '주요 보상' 아이템 (난이도 무관). 주간 결정 보스만 수집돼 있다. */
export function rewardItemsOf(boss: string): RewardItem[] {
  return (itemFile.items[boss] ?? []).map((i) => ({ ...i, file: encodeFile(i.file) }));
}

/**
 * 화면에 보여줄 게 있는지. 주간 결정 행만 '주요 보상'으로 폴백한다
 * (일간·월간 난이도 행에 보스 전체 보상을 붙이면 잘못된 인상을 준다).
 */
export function hasAnyDrops(boss: string, diff: Difficulty | string, weekly: boolean): boolean {
  return dropsOf(boss, diff).length > 0 || (weekly && rewardItemsOf(boss).length > 0);
}

const norm = (s: string) => s.replace(/\s+/g, "");

/**
 * 아이템 이름으로 아이콘 파일을 찾는다.
 * boss_drops.json 과 나무위키 표기가 조금씩 달라(컴플리트 언더 컨트롤 / 컴플리트 언더컨트롤,
 * 미트라의 분노 / 미트라의 분노 선택 상자) 공백 제거 후 부분 일치까지 허용한다.
 */
export function itemIconFor(name: string, boss?: string): string | null {
  const target = norm(name);
  const pools = boss ? [itemFile.items[boss] ?? [], ...Object.values(itemFile.items)] : Object.values(itemFile.items);
  for (const pool of pools) {
    for (const it of pool) {
      const n = norm(it.name);
      if (n === target) return encodeFile(it.file);
    }
  }
  for (const pool of pools) {
    for (const it of pool) {
      const n = norm(it.name);
      if (n.includes(target) || target.includes(n)) return encodeFile(it.file);
    }
  }
  return null;
}
