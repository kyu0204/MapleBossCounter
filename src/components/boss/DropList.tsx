import type { Difficulty } from "@/lib/maple/bossKey";
import { DROP_SET_STYLE } from "@/lib/maple/drops";
import { rewardsFor, type DisplayReward } from "@/lib/maple/rewards";

/**
 * 보상 칩. 아이콘이 있으면 아이콘만(원본 크기), 없으면 짧은 라벨.
 * 전체 이름은 마우스 오버로 본다. 개수는 ×N 으로 붙인다.
 */
export function RewardChip({ reward }: { reward: DisplayReward }) {
  const tone = reward.set ? DROP_SET_STYLE[reward.set] : DROP_SET_STYLE.기타;
  const label = reward.count && reward.count > 1 ? `${reward.name} ×${reward.range ?? reward.count}` : reward.name;
  return (
    <span className={`inline-flex items-center gap-1 rounded border px-1 py-0.5 leading-none ${tone}`} title={label}>
      {reward.icon ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={reward.icon} alt="" width={reward.w} height={reward.h} style={{ width: reward.w, height: reward.h }} className="object-contain shrink-0" loading="lazy" decoding="async" />
      ) : (
        <span className="text-[11px] font-medium px-0.5">{reward.short ?? reward.name}</span>
      )}
      {reward.count && reward.count > 1 && (
        <span className="text-[11px] font-bold tabular-nums pr-0.5">×{reward.range ?? reward.count}</span>
      )}
    </span>
  );
}

/**
 * 보스+난이도의 보상.
 * 표시하는 행 자체가 난이도별로 나뉘어 있으므로 난이도 라벨은 붙이지 않는다.
 * 출처: 나무위키 보스 문서의 난이도별 보상 섹션.
 */
export function DropList({ boss, diff, priceDate, className = "" }: { boss: string; diff: Difficulty | string; priceDate: string; className?: string }) {
  const items = rewardsFor(boss, diff, priceDate);
  if (!items.length) return null;
  return (
    <span className={`flex flex-wrap items-center gap-1 ${className}`}>
      {items.map((r) => (
        <RewardChip key={r.name} reward={r} />
      ))}
    </span>
  );
}
