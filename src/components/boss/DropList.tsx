import type { Difficulty } from "@/lib/maple/bossKey";
import { rewardItemsFor, setOfItem, DROP_SET_STYLE, type RewardItem } from "@/lib/maple/drops";

/** 아이템 아이콘. 원본 크기 그대로 (축소·왜곡 없음). */
export function ItemIcon({ item }: { item: RewardItem }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={item.file}
      alt=""
      width={item.w}
      height={item.h}
      className="object-contain shrink-0"
      style={{ width: item.w, height: item.h }}
      loading="lazy"
      decoding="async"
    />
  );
}

/** 보상 아이템 칩. 세트(여명·칠흑·에테르넬)를 알면 그 색으로. */
export function RewardChip({ item }: { item: RewardItem }) {
  const set = setOfItem(item.name);
  const tone = set ? DROP_SET_STYLE[set] : DROP_SET_STYLE.기타;
  return (
    <span className={`inline-flex items-center gap-1.5 rounded border pl-1 pr-2 py-0.5 text-xs leading-tight ${tone}`} title={set ? `${set} · ${item.name}` : item.name}>
      <ItemIcon item={item} />
      <span className="font-medium">{item.name}</span>
    </span>
  );
}

/**
 * 보스+난이도의 보상 목록.
 * 표시하는 행 자체가 이미 난이도별로 나뉘어 있으므로 난이도 라벨은 붙이지 않는다 —
 * 여기 보이는 것이 곧 그 난이도에서 나오는 것이다.
 * 출처: 나무위키 보스 문서 '주요 보상'.
 */
export function DropList({ boss, diff, className = "" }: { boss: string; diff: Difficulty | string; className?: string }) {
  const items = rewardItemsFor(boss, diff);
  if (!items.length) return null;
  return (
    <span className={`flex flex-wrap gap-1 ${className}`}>
      {items.map((it) => (
        <RewardChip key={it.name} item={it} />
      ))}
    </span>
  );
}
