import type { Difficulty } from "@/lib/maple/bossKey";
import { dropsOf, itemIconFor, rewardItemsOf, DROP_SET_STYLE, type BossDrop, type DropSet } from "@/lib/maple/drops";
import { isWeeklyCrystal } from "@/lib/maple/prices";

function ItemIcon({ src, size = 22 }: { src: string | null; size?: number }) {
  if (!src) return null;
  return (
    // 나무위키 아이템 아이콘(대략 30~45px). 확대하지 않으므로 기본 렌더링.
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt="" className="object-contain shrink-0" style={{ width: size, height: size }} loading="lazy" decoding="async" />
  );
}

/** 드롭 아이템 칩 하나. 아이템명이 이미 세트명으로 시작하면 세트 라벨을 겹쳐 쓰지 않는다. */
export function DropChip({ drop, boss, showSet = true, iconSize = 22 }: { drop: BossDrop; boss?: string; showSet?: boolean; iconSize?: number }) {
  const redundant = drop.name.startsWith(drop.set);
  const icon = itemIconFor(drop.name, boss);
  return (
    <span className={`inline-flex items-center gap-1 rounded border pl-0.5 pr-1.5 py-0.5 text-[11px] leading-tight ${DROP_SET_STYLE[drop.set] ?? DROP_SET_STYLE.기타}`} title={`${drop.set} · ${drop.slot}`}>
      <ItemIcon src={icon} size={iconSize} />
      {showSet && drop.set !== "기타" && !redundant && <span className="font-bold opacity-70">{drop.set}</span>}
      <span className="font-medium">{drop.name}</span>
    </span>
  );
}

/** 나무위키 '주요 보상' 아이템 칩 (난이도 구분 없음) */
export function RewardChip({ name, file, iconSize = 22 }: { name: string; file: string; iconSize?: number }) {
  return (
    <span className="inline-flex items-center gap-1 rounded border border-zinc-200 bg-zinc-50 pl-0.5 pr-1.5 py-0.5 text-[11px] leading-tight text-zinc-700 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300" title={name}>
      <ItemIcon src={file} size={iconSize} />
      <span className="font-medium">{name}</span>
    </span>
  );
}

/**
 * 보스+난이도의 드롭.
 * 난이도별로 확인된 세트 아이템(boss_drops.json)이 있으면 그걸, 없으면 나무위키 '주요 보상'을 보여준다.
 */
const norm = (s: string) => s.replace(/\s+/g, "");

export function DropList({ boss, diff, iconSize = 22, className = "" }: { boss: string; diff: Difficulty | string; iconSize?: number; className?: string }) {
  // 1) 난이도별로 확인된 세트 아이템 (세트 색 표시)
  const drops = dropsOf(boss, diff);
  // 2) 나무위키 '주요 보상' — 주간 결정 보스만 수집했으므로 일간·월간 행에는 붙이지 않는다.
  //    세트 칩과 이름이 겹치는 것은 빼서 같은 아이템이 두 번 나오지 않게 한다.
  const rewards = (isWeeklyCrystal(boss, diff) ? rewardItemsOf(boss) : []).filter(
    (r) => !drops.some((d) => norm(r.name).includes(norm(d.name)) || norm(d.name).includes(norm(r.name))),
  );
  if (!drops.length && !rewards.length) return null;
  return (
    <span className={`flex flex-wrap gap-1 ${className}`}>
      {drops.map((d) => (
        <DropChip key={d.name} drop={d} boss={boss} iconSize={iconSize} />
      ))}
      {rewards.map((r) => (
        <RewardChip key={r.name} name={r.name} file={r.file} iconSize={iconSize} />
      ))}
    </span>
  );
}

export type { DropSet };
