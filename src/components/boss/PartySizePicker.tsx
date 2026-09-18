"use client";

import { DEFAULT_MAX_PARTY } from "@/lib/maple/partySize";

/**
 * 파티 인원 고르기. 1부터 그 보스의 상한까지만 고를 수 있다.
 *
 * 숫자 입력칸은 몇 명까지 되는지 눌러 보기 전엔 모른다. 드롭다운은 열면 고를 수 있는
 * 범위가 그대로 보여서, 3인 보스에 6을 적었다가 잘리는 일이 없다.
 *
 * 버튼 여섯 개를 늘어놓는 안도 있었지만 보스 줄마다 150px 를 먹어 목록이 숫자밭이 됐다.
 * 드롭다운은 클릭 횟수가 같으면서 폭이 3분의 1이라 화면 어디에 놓아도 부담이 없다.
 */
export function PartySizePicker({
  value,
  max = DEFAULT_MAX_PARTY,
  onChange,
  disabled = false,
  label = "파티 인원",
  className = "",
}: {
  value: number;
  max?: number;
  onChange: (n: number) => void;
  disabled?: boolean;
  label?: string;
  className?: string;
}) {
  return (
    <select
      value={value}
      disabled={disabled}
      onChange={(e) => onChange(Number(e.target.value))}
      aria-label={label}
      title={max < DEFAULT_MAX_PARTY ? `이 보스는 최대 ${max}인` : label}
      className={`rounded border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-1 py-0.5 text-xs tabular-nums disabled:opacity-50 ${className}`}
    >
      {Array.from({ length: max }, (_, i) => i + 1).map((n) => (
        <option key={n} value={n}>
          {n}인
        </option>
      ))}
    </select>
  );
}
