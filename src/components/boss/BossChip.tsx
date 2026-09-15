import type { Difficulty } from "@/lib/maple/bossKey";
import { bossFullLabel, bossShort, DIFF_STYLE } from "@/lib/maple/bossMeta";
import { tierOf } from "@/lib/maple/tiers";
import { fmtPower } from "@/lib/maple/format";
import { BossIcon } from "./BossIcon";
import { DifficultyBadge } from "./DifficultyBadge";
import { TierStars } from "./TierStars";

/**
 * 보스 한 건: 아이콘 + 난이도 배지 + 보스 약칭 + 실수령.
 * price/party 를 주면 실수령까지 한 줄에 붙인다.
 */
export function BossChip({
  boss,
  diff,
  price,
  party = 1,
  pinned,
  locked,
  iconSize = 44,
  onRemove,
  right,
}: {
  boss: string;
  diff: Difficulty | string;
  price?: number | null;
  party?: number;
  /** 고정 픽 표시 */
  pinned?: boolean;
  /** 파티 등록 유래라 여기서 못 지움 */
  locked?: boolean;
  iconSize?: number;
  onRemove?: () => void;
  right?: React.ReactNode;
}) {
  const style = DIFF_STYLE[diff as Difficulty] ?? DIFF_STYLE.normal;
  const tier = tierOf(boss, diff);
  const value = price == null ? null : Math.floor(price / Math.max(1, party));
  return (
    <span className={`inline-flex items-center gap-2 rounded-lg border pl-1 pr-2 py-1 ${style.chip}`} title={bossFullLabel(boss, diff)}>
      <BossIcon boss={boss} diff={diff} size={iconSize} showDiff={false} />
      <span className="flex flex-col gap-0.5 leading-tight min-w-0">
        <span className="flex items-center gap-1 font-semibold text-sm truncate">
          {pinned && <span title="고정 픽">📌</span>}
          {locked && <span title="파티 등록에서 자동 포함">🔒</span>}
          <DifficultyBadge diff={diff} size="xs" solid />
          {bossShort(boss)}
          {party > 1 && <span className="font-normal opacity-70">{party}인</span>}
        </span>
        <span className="flex items-center gap-1.5 text-[11px] opacity-80">
          <TierStars tier={tier} size={10} />
          {price != null && (
            <>
              {fmtPower(value)}
              {party > 1 && <span className="opacity-70">({fmtPower(price)}÷{party})</span>}
            </>
          )}
        </span>
      </span>
      {right}
      {onRemove && (
        <button type="button" onClick={onRemove} className="ml-0.5 opacity-50 hover:opacity-100 text-sm leading-none" aria-label={`${bossShort(boss)} 제거`}>
          ×
        </button>
      )}
    </span>
  );
}
