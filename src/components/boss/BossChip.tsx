import type { Difficulty } from "@/lib/maple/bossKey";
import { bossFullLabel, bossTag, DIFF_STYLE } from "@/lib/maple/bossMeta";
import { tierLabel, tierOf } from "@/lib/maple/tiers";
import { fmtPower } from "@/lib/maple/format";
import { BossIcon } from "./BossIcon";

/**
 * 보스 한 건을 아이콘 + 약칭(하세렌) 으로 보여주는 칩.
 * price/party 를 주면 실수령까지 한 줄에 붙인다.
 */
export function BossChip({
  boss,
  diff,
  price,
  party = 1,
  pinned,
  locked,
  iconSize = 32,
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
    <span className={`inline-flex items-center gap-2 rounded-lg border pl-1 pr-2 py-1 ${style.chip}`} title={`${bossFullLabel(boss, diff)} · ${tierLabel(tier)}`}>
      <BossIcon boss={boss} diff={diff} size={iconSize} />
      <span className="flex flex-col leading-tight min-w-0">
        <span className="font-semibold text-sm truncate">
          {pinned && <span className="mr-0.5">📌</span>}
          {locked && <span className="mr-0.5">🔒</span>}
          {bossTag(boss, diff)}
          {party > 1 && <span className="font-normal opacity-70"> {party}인</span>}
        </span>
        {price != null && (
          <span className="text-[11px] opacity-80">
            {fmtPower(value)}
            {party > 1 && <span className="opacity-70"> ({fmtPower(price)}÷{party})</span>}
          </span>
        )}
      </span>
      {right}
      {onRemove && (
        <button type="button" onClick={onRemove} className="ml-0.5 opacity-50 hover:opacity-100 text-sm leading-none" aria-label={`${bossTag(boss, diff)} 제거`}>
          ×
        </button>
      )}
    </span>
  );
}
