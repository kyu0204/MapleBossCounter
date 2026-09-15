import Link from "next/link";
import type { Character } from "@/lib/db/schema";
import type { ParsedSnapshot, RevenueSummary } from "@/lib/maple/scheduler";
import { fmtPower } from "@/lib/maple/format";
import { RefreshButton } from "./RefreshButton";
import { HideToggle } from "./HideToggle";
import { CharacterAvatar } from "./CharacterAvatar";

export function CharacterCard({ character: c, snapshot, revenue }: { character: Character; snapshot: ParsedSnapshot | null; revenue: RevenueSummary | null }) {
  const wearingBest = c.bestSetupHash != null && c.curSetupHashes?.equipped === c.bestSetupHash;
  return (
    /**
     * 카드 전체가 상세로 가는 링크다.
     *
     * 안에 새로고침·숨기기 버튼이 있어서 카드를 <a> 로 감쌀 수 없다 (버튼 중첩은
     * 잘못된 마크업이고 클릭도 먹지 않는다). 대신 카드를 덮는 링크를 깔고,
     * 버튼 줄만 그 위로 올린다.
     */
    <div className={`card relative flex gap-4 transition hover:border-orange-300 dark:hover:border-orange-800 focus-within:border-orange-400 ${c.hidden ? "opacity-50" : ""}`}>
      {/* z-10: 아바타가 position:relative 라 층을 안 주면 덮개보다 위로 올라와 클릭을 먹는다 */}
      <Link href={`/me/characters/${c.ocid}`} className="absolute inset-0 z-10 rounded-xl" aria-label={`${c.name} 상세 보기`} />
      <CharacterAvatar src={c.imageUrl} alt={c.name} size={112} />
      <div className="flex-1 min-w-0 text-sm space-y-1.5">
        <div className="flex items-baseline gap-2">
          <span className="font-semibold text-base truncate">{c.name}</span>
          <span className="text-xs text-zinc-500 truncate">
            {c.cls} · Lv.{c.level}
          </span>
        </div>
        <div>
          <span className="text-zinc-500">대표 전투력 </span>
          <span className="font-semibold text-base">{fmtPower(c.bestPower)}</span>
          {c.curPower != null && c.curPower !== c.bestPower && (
            <span className="text-xs text-zinc-500 ml-1">
              (현재 {fmtPower(c.curPower)}
              {!wearingBest && " · 다른 세팅"})
            </span>
          )}
        </div>
        <div className="flex items-center gap-3 text-xs text-zinc-600 dark:text-zinc-400">
          <span>
            주간 보스 {snapshot ? `${snapshot.weeklyClearCount}/${snapshot.weeklyLimit}` : "-"}
          </span>
          {revenue && <span>결정 {fmtPower(revenue.totalValue)}</span>}
        </div>
        {/* 덮개(z-10) 보다 위여야 버튼이 눌린다 */}
        <div className="relative z-20 flex items-center gap-2 pt-1 w-fit">
          <RefreshButton ocid={c.ocid} />
          <HideToggle ocid={c.ocid} hidden={c.hidden} />
        </div>
      </div>
    </div>
  );
}
