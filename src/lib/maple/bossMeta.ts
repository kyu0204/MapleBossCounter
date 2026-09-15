/**
 * 보스 표시용 메타데이터 (약칭·난이도 표기·색). 가격/티어 같은 게임 데이터가 아니라 UI 표기라 코드에 둔다.
 * 인게임·커뮤니티 통용 표기를 따른다: 난이도 한 글자 + 보스 약칭 (하세렌, 카더스크, 익스우).
 */
import type { Difficulty } from "./bossKey";

/**
 * 보스 약칭. 자리가 정말 좁은 곳(아이콘 폴백 글자)에서만 쓴다.
 * 화면 표기의 기본은 풀 네임이다 — bossName() 을 쓴다.
 */
const SHORT: Record<string, string> = {
  매그너스: "매그",
  파풀라투스: "파풀",
  블러디퀸: "블퀸",
  "반 레온": "레온",
  혼테일: "혼테",
  아카이럼: "아카",
  핑크빈: "핑빈",
  시그너스: "시그",
  "가디언 엔젤 슬라임": "가엔슬",
  "진 힐라": "진힐라",
  "선택받은 세렌": "세렌",
  "감시자 칼로스": "칼로스",
  "최초의 대적자": "대적자",
  "찬란한 흉성": "흉성",
  "시즌 보스 메이린": "메이린",
  "검은 마법사": "검마",
};

/** 화면에 내는 보스 이름. 기본은 풀 네임이다. */
export function bossName(boss: string): string {
  return boss;
}

/** 약칭. 아이콘 안 글자처럼 두세 글자만 들어가는 자리에만 쓴다. */
export function bossShort(boss: string): string {
  return SHORT[boss] ?? boss;
}

/** 난이도 한 글자 (이지 → 이, 익스트림 → 익) */
export const DIFF_SHORT: Record<Difficulty, string> = {
  easy: "이",
  normal: "노",
  hard: "하",
  chaos: "카",
  extreme: "익",
};

export const DIFF_LABEL: Record<Difficulty, string> = {
  easy: "이지",
  normal: "노말",
  hard: "하드",
  chaos: "카오스",
  extreme: "익스트림",
};

/** 난이도별 색. 배지 배경·테두리·점 색을 한 벌로 묶는다. */
export const DIFF_STYLE: Record<Difficulty, { chip: string; dot: string; ring: string }> = {
  easy: {
    chip: "bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-200 dark:border-emerald-900",
    dot: "bg-emerald-500",
    ring: "ring-emerald-400",
  },
  normal: {
    chip: "bg-sky-50 text-sky-800 border-sky-200 dark:bg-sky-950/50 dark:text-sky-200 dark:border-sky-900",
    dot: "bg-sky-500",
    ring: "ring-sky-400",
  },
  hard: {
    chip: "bg-amber-50 text-amber-900 border-amber-200 dark:bg-amber-950/50 dark:text-amber-200 dark:border-amber-900",
    dot: "bg-amber-500",
    ring: "ring-amber-400",
  },
  chaos: {
    chip: "bg-rose-50 text-rose-800 border-rose-200 dark:bg-rose-950/50 dark:text-rose-200 dark:border-rose-900",
    dot: "bg-rose-500",
    ring: "ring-rose-400",
  },
  extreme: {
    chip: "bg-violet-50 text-violet-800 border-violet-200 dark:bg-violet-950/50 dark:text-violet-200 dark:border-violet-900",
    dot: "bg-violet-500",
    ring: "ring-violet-400",
  },
};

/** 난이도 배지 색 (배경이 채워진 솔리드 배지용) */
export const DIFF_SOLID: Record<Difficulty, string> = {
  easy: "bg-emerald-500 text-white",
  normal: "bg-sky-500 text-white",
  hard: "bg-amber-500 text-white",
  chaos: "bg-rose-500 text-white",
  extreme: "bg-violet-500 text-white",
};

// ---------- 티어 등급 색 ----------
// 등급 이름(금·은·동·납) 대신 별 색으로만 구분한다. 라이트/다크 양쪽에서 읽히는 금속색.

export { GRADE_COLOR, GRADE_MARK, type Grade } from "./tiers";

/** "하드 선택받은 세렌". 보스 이름은 줄이지 않는다. */
export function bossTag(boss: string, diff: Difficulty | string): string {
  const d = DIFF_LABEL[diff as Difficulty] ?? String(diff);
  return `${d} ${bossName(boss)}`;
}

/** "선택받은 세렌 하드" */
export function bossFullLabel(boss: string, diff: Difficulty | string): string {
  return `${boss} ${DIFF_LABEL[diff as Difficulty] ?? diff}`;
}
