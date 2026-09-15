import type { Difficulty } from "@/lib/maple/bossKey";
import { DROP_SET_STYLE } from "@/lib/maple/drops";
import { rewardRowsFor, ICON_BOX, type DisplayReward } from "@/lib/maple/rewards";

/**
 * 보상 칩.
 *
 * 아이콘 원본은 23x20 부터 40x41 까지 제각각이다. 줄이면 계단현상이 나므로 크기는 건드리지 않고,
 * 제일 큰 아이콘(ICON_BOX)이 들어갈 칸을 만들어 그 안에 가운데 정렬한다. 그래야 줄이 맞는다.
 * 개수는 칸 오른쪽 아래에 겹쳐 놓는다 — 칸 크기가 개수 유무에 따라 달라지지 않게.
 * 전체 이름은 마우스 오버로 본다.
 */
export function RewardChip({ reward }: { reward: DisplayReward }) {
  const tone = reward.set ? DROP_SET_STYLE[reward.set] : DROP_SET_STYLE.기타;
  const amount = reward.count && reward.count > 1 ? (reward.range ?? String(reward.count)) : null;
  const label = amount ? `${reward.name} ×${amount}` : reward.name;
  return (
    <span
      className={`relative inline-flex items-center justify-center rounded border ${tone}`}
      // content-box: 테두리를 칸 바깥에 둬서 가장 큰 아이콘(= 칸 크기)이 잘리지 않게 한다.
      style={{ width: ICON_BOX.w, height: ICON_BOX.h, boxSizing: "content-box" }}
      title={label}
    >
      {reward.icon ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={reward.icon}
          alt=""
          width={reward.w}
          height={reward.h}
          style={{ width: reward.w, height: reward.h }}
          className="object-contain shrink-0"
          loading="lazy"
          decoding="async"
        />
      ) : (
        <span className="text-[10px] font-medium leading-none text-center px-0.5">{reward.short ?? reward.name}</span>
      )}
      {amount && (
        <span className="absolute -bottom-0.5 -right-0.5 rounded-sm bg-zinc-900/85 px-0.5 text-[10px] font-bold leading-[1.3] text-white tabular-nums dark:bg-zinc-100/90 dark:text-zinc-900">
          {amount}
        </span>
      )}
    </span>
  );
}

function Row({ label, items }: { label: string; items: DisplayReward[] }) {
  if (!items.length) return null;
  return (
    <span className="flex items-start gap-1.5">
      <span className="w-6 shrink-0 pt-1 text-[10px] leading-none text-zinc-400">{label}</span>
      <span className="flex flex-wrap items-center gap-1">
        {items.map((r) => (
          <RewardChip key={r.name} reward={r} />
        ))}
      </span>
    </span>
  );
}

/**
 * 보스+난이도의 보상. 첫 줄은 확정 보상, 둘째 줄은 확률 드롭이다.
 * 표시하는 행 자체가 난이도별로 나뉘어 있으므로 난이도 라벨은 붙이지 않는다.
 * 출처: 나무위키 보스 문서의 난이도별 보상 섹션.
 */
export function DropList({ boss, diff, priceDate, className = "" }: { boss: string; diff: Difficulty | string; priceDate: string; className?: string }) {
  const { fixed, random } = rewardRowsFor(boss, diff, priceDate);
  if (!fixed.length && !random.length) return null;
  return (
    <span className={`flex flex-col gap-1 ${className}`}>
      <Row label="확정" items={fixed} />
      <Row label="랜덤" items={random} />
    </span>
  );
}
