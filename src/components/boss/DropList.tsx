import type { Difficulty } from "@/lib/maple/bossKey";
import { rewardGroupsOf, setOfItem, DROP_SET_STYLE, type RewardItem } from "@/lib/maple/drops";
import { DIFF_LABEL, DIFF_SHORT, DIFF_SOLID } from "@/lib/maple/bossMeta";

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

/** 카테고리 라벨. 난이도 카테고리는 난이도 배지 색으로 */
function CategoryLabel({ label, difficultyScoped }: { label: string; difficultyScoped: boolean }) {
  if (!difficultyScoped) {
    return <span className="text-[11px] font-bold text-zinc-500 shrink-0 w-9 text-right">{label}</span>;
  }
  const atLeast = label.endsWith("+");
  const ko = atLeast ? label.slice(0, -1) : label;
  const diff = ({ 이지: "easy", 노멀: "normal", 노말: "normal", 하드: "hard", 카오스: "chaos", 익스트림: "extreme" } as Record<string, Difficulty>)[ko];
  return (
    <span className="shrink-0 w-9 text-right" title={`${DIFF_LABEL[diff] ?? ko}${atLeast ? " 이상" : ""} 전용`}>
      <span className={`inline-flex items-center justify-center rounded px-1 py-px text-[10px] font-bold ${DIFF_SOLID[diff] ?? DIFF_SOLID.normal}`}>
        {DIFF_SHORT[diff] ?? ko}
        {atLeast && "+"}
      </span>
    </span>
  );
}

/**
 * 보스+난이도의 보상. 공통 카테고리(장비/소비/개인…)를 먼저, 난이도 전용을 뒤에.
 * 출처: 나무위키 보스 문서 '주요 보상'.
 */
export function DropList({ boss, diff, className = "" }: { boss: string; diff: Difficulty | string; className?: string }) {
  const groups = rewardGroupsOf(boss, diff);
  if (!groups.length) return null;
  return (
    <span className={`flex flex-col gap-1 ${className}`}>
      {groups.map((g) => (
        <span key={g.label} className="flex items-start gap-1.5">
          <CategoryLabel label={g.label} difficultyScoped={g.difficultyScoped} />
          <span className="flex flex-wrap gap-1">
            {g.items.map((it) => (
              <RewardChip key={it.name} item={it} />
            ))}
          </span>
        </span>
      ))}
    </span>
  );
}
