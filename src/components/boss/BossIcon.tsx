import iconMap from "@/data/boss_icons.json";
import type { Difficulty } from "@/lib/maple/bossKey";
import { bossFullLabel, bossShort, DIFF_SHORT, DIFF_SOLID, DIFF_STYLE } from "@/lib/maple/bossMeta";

/**
 * scripts/fetch-namu-boss-icons.mjs 가 만든다. 파일은 public/bosses 에 자체 호스팅.
 * source 가 "namu" 가 아닌 항목은 손으로 넣은 것이라 원본 주소(src)가 없다.
 */
type IconEntry = { source: string; doc: string; src?: string; file: string; bytes?: number };
const ICONS = iconMap as Record<string, IconEntry>;

export function bossIconFile(boss: string): string | null {
  const f = ICONS[boss]?.file;
  // 한글 파일명이 섞여 있어 URL 로 쓸 때 인코딩해 준다.
  return f ? f.split("/").map(encodeURIComponent).join("/") : null;
}

/**
 * 보스 아이콘. public/bosses 에 받아둔 아이콘이 있으면 그걸, 없으면 약칭 배지로 폴백.
 * 난이도는 테두리 색 + 우하단 난이도 배지로 표시한다.
 */
export function BossIcon({
  boss,
  diff,
  size = 48,
  showDiff = true,
  className = "",
}: {
  boss: string;
  diff: Difficulty | string;
  size?: number;
  /** 우하단 난이도 배지 표시 */
  showDiff?: boolean;
  className?: string;
}) {
  const d = diff as Difficulty;
  const style = DIFF_STYLE[d] ?? DIFF_STYLE.normal;
  const file = bossIconFile(boss);
  const short = bossShort(boss);
  const letter = DIFF_SHORT[d] ?? "";
  return (
    <span
      className={`relative inline-flex items-center justify-center rounded-lg border-2 overflow-hidden shrink-0 ${style.chip} ${className}`}
      style={{ width: size, height: size }}
      title={bossFullLabel(boss, diff)}
    >
      {file ? (
        // 원본 160×153 아트워크. 축소해서 쓰므로 nearest-neighbor(pixelated) 를 쓰면 오히려 계단현상이 생긴다.
        // eslint-disable-next-line @next/next/no-img-element
        <img src={file} alt="" width={160} height={153} className="w-full h-full object-contain" loading="lazy" decoding="async" />
      ) : (
        <span className="font-bold leading-none" style={{ fontSize: Math.max(10, size * 0.4) }}>
          {short.slice(0, 2)}
        </span>
      )}
      {showDiff && letter && (
        <span
          className={`absolute right-0 bottom-0 rounded-tl-md rounded-br-md font-bold leading-none flex items-center justify-center ${DIFF_SOLID[d] ?? DIFF_SOLID.normal}`}
          style={{ fontSize: Math.max(9, size * 0.3), minWidth: Math.max(13, size * 0.38), height: Math.max(13, size * 0.36) }}
        >
          {letter}
        </span>
      )}
    </span>
  );
}
