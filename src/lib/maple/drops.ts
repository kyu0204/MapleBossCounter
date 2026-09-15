/**
 * 보스 드롭 아이템 (src/data/boss_drops.json).
 * 확인된 세트 장신구·방어구만 담는다. 공통 보상(소울·훈장·의지의 결정)과 출처 미확인 보스는 비어 있다.
 */
import raw from "@/data/boss_drops.json";
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
