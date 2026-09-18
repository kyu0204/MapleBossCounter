"use client";

import { DEFAULT_MAX_PARTY } from "@/lib/maple/partySize";

/**
 * 파티 인원 고르기. 1부터 그 보스의 상한까지만 고를 수 있다.
 *
 * 숫자 입력칸은 몇 명까지 되는지 눌러 보기 전엔 모른다. 고를 수 있는 범위를 미리
 * 보여 주면 3인 보스에 6을 적었다가 잘리는 일이 없다.
 *
 * 모양이 둘이다.
 *   buttons  자리가 넉넉한 곳 (비교 화면 머리). 한 번 클릭으로 끝난다.
 *   compact  보스 줄처럼 좁은 곳. 버튼 여섯 개는 줄마다 150px 를 먹어서 목록이
 *            숫자밭이 된다. 같은 한 번 클릭이면서 폭은 3분의 1이다.
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
  /** 좁은 자리용. 드롭다운으로 낸다 */
  compact?: boolean;
  label?: string;
}) {
  const sizes = Array.from({ length: max }, (_, i) => i + 1);

  if (compact) {
    return (
      <select
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(Number(e.target.value))}
        aria-label={label}
        className="rounded border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-1 py-0.5 text-xs tabular-nums disabled:opacity-50"
      >
        {sizes.map((n) => (
          <option key={n} value={n}>
            {n}인
          </option>
        ))}
      </select>
    );
  }

  return (
    <span className="inline-flex items-center gap-0.5" role="group" aria-label={label}>
      {sizes.map((n) => {
        const on = n === value;
        return (
          <button
            key={n}
            type="button"
            disabled={disabled}
            aria-pressed={on}
            onClick={() => onChange(n)}
            title={`${n}인격`}
            className={`w-7 h-7 rounded border text-xs tabular-nums leading-none transition disabled:opacity-40 disabled:cursor-not-allowed ${
              on
                ? "border-zinc-800 bg-zinc-800 text-white dark:border-zinc-200 dark:bg-zinc-200 dark:text-zinc-900 font-semibold"
                : "border-zinc-200 text-zinc-500 hover:border-zinc-400 dark:border-zinc-700 dark:text-zinc-400 dark:hover:border-zinc-500"
            }`}
          >
            {n}
          </button>
        );
      })}
      <span className="text-xs text-zinc-500 ml-1">인격</span>
    </span>
  );
}
