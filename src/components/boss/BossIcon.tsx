import iconMap from "@/data/boss_icons.json";
import type { Difficulty } from "@/lib/maple/bossKey";
import { bossFullLabel, bossShort, DIFF_SHORT, DIFF_STYLE } from "@/lib/maple/bossMeta";

/** scripts/fetch-namu-boss-icons.mjs 가 만든다. 파일은 public/bosses 에 자체 호스팅. */
type IconEntry = { source: string; doc: string; src: string; file: string; bytes?: number };
const ICONS = iconMap as Record<string, IconEntry>;

export function bossIconFile(boss: string): string | null {
  const f = ICONS[boss]?.file;
  // 한글 파일명이 섞여 있어 URL 로 쓸 때 인코딩해 준다.
  return f ? f.split("/").map(encodeURIComponent).join("/") : null;
}

/**
 * 보스 아이콘. public/bosses 에 받아둔 몹 아이콘이 있으면 그걸, 없으면 약칭 첫 글자 배지로 폴백.
 * 난이도는 테두리 색 + 우하단 글자(이/노/하/카/익)로 표시한다.
 */
export function BossIcon({ boss, diff, size = 36, className = "" }: { boss: string; diff: Difficulty | string; size?: number; className?: string }) {
  const style = DIFF_STYLE[diff as Difficulty] ?? DIFF_STYLE.normal;
  const file = bossIconFile(boss);
  const short = bossShort(boss);
  const d = DIFF_SHORT[diff as Difficulty] ?? "";
  return (
    <span
      className={`relative inline-flex items-center justify-center rounded-md border-2 overflow-hidden shrink-0 ${style.chip} ${className}`}
      style={{ width: size, height: size }}
      title={bossFullLabel(boss, diff)}
    >
      {file ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={file} alt="" className="w-full h-full object-contain [image-rendering:pixelated]" loading="lazy" />
      ) : (
        <span className="font-bold leading-none" style={{ fontSize: Math.max(10, size * 0.42) }}>
          {short.slice(0, 2)}
        </span>
      )}
      {d && (
        <span
          className={`absolute right-0 bottom-0 ${style.dot} text-white font-bold leading-none rounded-tl px-[3px] py-[1px]`}
          style={{ fontSize: Math.max(8, size * 0.28) }}
        >
          {d}
        </span>
      )}
    </span>
  );
}
