import type { Difficulty } from "@/lib/maple/bossKey";
import { DIFF_LABEL, DIFF_SHORT, DIFF_SOLID, DIFF_STYLE } from "@/lib/maple/bossMeta";

const SIZE = {
  xs: "text-[10px] px-1 py-px min-w-[16px]",
  sm: "text-[11px] px-1.5 py-0.5 min-w-[20px]",
  md: "text-xs px-2 py-0.5 min-w-[26px]",
  lg: "text-sm px-2.5 py-1 min-w-[32px]",
} as const;

export interface DifficultyBadgeProps {
  diff: Difficulty | string;
  /** 한 글자(이/노/하/카/익) 대신 전체 표기(이지/노말/…) */
  full?: boolean;
  size?: keyof typeof SIZE;
  /** 채워진 색 배지. false 면 연한 배경 + 테두리 */
  solid?: boolean;
  className?: string;
}

/** 난이도 배지. 프로젝트 안의 모든 난이도 표시는 이걸 쓴다. */
export function DifficultyBadge({ diff, full = false, size = "sm", solid = false, className = "" }: DifficultyBadgeProps) {
  const d = diff as Difficulty;
  const label = full ? DIFF_LABEL[d] ?? String(diff) : DIFF_SHORT[d] ?? String(diff);
  const tone = solid ? DIFF_SOLID[d] ?? DIFF_SOLID.normal : `border ${DIFF_STYLE[d]?.chip ?? DIFF_STYLE.normal.chip}`;
  return (
    <span className={`inline-flex items-center justify-center rounded font-bold leading-none whitespace-nowrap ${SIZE[size]} ${tone} ${className}`} title={DIFF_LABEL[d] ?? String(diff)}>
      {label}
    </span>
  );
}

/** 누를 수 있는 난이도 배지 (보스 선택용). 선택되면 솔리드 + 링. */
export function DifficultyButton({
  diff,
  active,
  disabled,
  onClick,
  title,
  size = "md",
}: {
  diff: Difficulty | string;
  active: boolean;
  disabled?: boolean;
  onClick: () => void;
  title?: string;
  size?: keyof typeof SIZE;
}) {
  const d = diff as Difficulty;
  const style = DIFF_STYLE[d] ?? DIFF_STYLE.normal;
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      title={title ?? DIFF_LABEL[d]}
      aria-pressed={active}
      className={`inline-flex items-center justify-center rounded font-bold leading-none whitespace-nowrap transition disabled:opacity-40 disabled:cursor-not-allowed ${SIZE[size]} ${
        active
          ? `${DIFF_SOLID[d] ?? DIFF_SOLID.normal} ring-2 ring-offset-1 ${style.ring} ring-offset-white dark:ring-offset-zinc-900`
          : "border border-zinc-200 text-zinc-500 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800"
      }`}
    >
      {DIFF_SHORT[d] ?? String(diff)}
    </button>
  );
}
