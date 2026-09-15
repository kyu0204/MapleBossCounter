import type { Difficulty } from "@/lib/maple/bossKey";
import { dropsOf, DROP_SET_STYLE, type BossDrop } from "@/lib/maple/drops";

/** 드롭 아이템 칩 하나. 아이템명이 이미 세트명으로 시작하면 세트 라벨을 겹쳐 쓰지 않는다. */
export function DropChip({ drop, showSet = true }: { drop: BossDrop; showSet?: boolean }) {
  const redundant = drop.name.startsWith(drop.set);
  return (
    <span className={`inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-[11px] leading-tight ${DROP_SET_STYLE[drop.set] ?? DROP_SET_STYLE.기타}`} title={`${drop.set} · ${drop.slot}`}>
      {showSet && drop.set !== "기타" && !redundant && <span className="font-bold opacity-70">{drop.set}</span>}
      <span className="font-medium">{drop.name}</span>
    </span>
  );
}

/** 보스+난이도의 드롭 목록. 없으면 아무것도 그리지 않는다. */
export function DropList({ boss, diff, className = "" }: { boss: string; diff: Difficulty | string; className?: string }) {
  const drops = dropsOf(boss, diff);
  if (!drops.length) return null;
  return (
    <span className={`flex flex-wrap gap-1 ${className}`}>
      {drops.map((d) => (
        <DropChip key={d.name} drop={d} />
      ))}
    </span>
  );
}
