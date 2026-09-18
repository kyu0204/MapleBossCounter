"use client";

import { DEFAULT_MAX_PARTY } from "@/lib/maple/partySize";

/**
 * 파티 인원 고르기. 1부터 그 보스의 상한까지 버튼으로 낸다.
 *
 * 숫자 입력칸은 몇 명까지 되는지 눌러 보기 전엔 모른다. 버튼이면 고를 수 있는 범위가
 * 그대로 보여서, 3인 보스에 6을 적었다가 잘리는 일이 없다.
 *
 * 고른 표시는 색이 아니라 명암으로 한다. 비교 화면에서 색은 이미 보스 편을 가리키고
 * 있어서, 여기까지 색을 쓰면 무슨 뜻인지 헷갈린다.
 */
export function PartySizePicker({
  value,
  max = DEFAULT_MAX_PARTY,
  onChange,
  disabled = false,
  compact = false,
  label = "파티 인원",
}: {
  value: number;
  max?: number;
  onChange: (n: number) => void;
  disabled?: boolean;
  /** 보스 줄 안에 끼워 넣는 작은 형태 */
  compact?: boolean;
  label?: string;
}) {
  const box = compact ? "w-5 h-5 text-[10px]" : "w-7 h-7 text-xs";
  return (
    <span className="inline-flex items-center gap-0.5" role="group" aria-label={label}>
      {Array.from({ length: max }, (_, i) => i + 1).map((n) => {
        const on = n === value;
        return (
          <button
            key={n}
            type="button"
            disabled={disabled}
            aria-pressed={on}
            onClick={() => onChange(n)}
            title={`${n}인격`}
            className={`${box} rounded border tabular-nums leading-none transition disabled:opacity-40 disabled:cursor-not-allowed ${
              on
                ? "border-zinc-800 bg-zinc-800 text-white dark:border-zinc-200 dark:bg-zinc-200 dark:text-zinc-900 font-semibold"
                : "border-zinc-200 text-zinc-500 hover:border-zinc-400 dark:border-zinc-700 dark:text-zinc-400 dark:hover:border-zinc-500"
            }`}
          >
            {n}
          </button>
        );
      })}
      <span className={`text-zinc-500 ${compact ? "text-[10px] ml-0.5" : "text-xs ml-1"}`}>인격</span>
    </span>
  );
}
