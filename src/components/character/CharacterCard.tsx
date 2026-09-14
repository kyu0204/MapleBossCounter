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
    <div className={`card flex gap-4 ${c.hidden ? "opacity-50" : ""}`}>
      <Link href={`/me/characters/${c.ocid}`} className="shrink-0">
        <CharacterAvatar src={c.imageUrl} alt={c.name} size={112} />
      </Link>
      <div className="flex-1 min-w-0 text-sm space-y-1.5">
        <div className="flex items-baseline gap-2">
          <Link href={`/me/characters/${c.ocid}`} className="font-semibold text-base truncate hover:underline">
            {c.name}
          </Link>
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
        <div className="flex items-center gap-2 pt-1">
          <RefreshButton ocid={c.ocid} />
          <HideToggle ocid={c.ocid} hidden={c.hidden} />
        </div>
      </div>
    </div>
  );
}
