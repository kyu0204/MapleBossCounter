import Link from "next/link";
import type { PartyWithMembers } from "@/lib/db/queries/parties";
import { crystalPrice } from "@/lib/maple/prices";
import { tierOf } from "@/lib/maple/tiers";
import { DifficultyBadge } from "@/components/boss/DifficultyBadge";
import { TierStars } from "@/components/boss/TierStars";
import { fmtPower } from "@/lib/maple/format";
import { kstDateStr } from "@/lib/maple/kst";
import { BossIcon } from "@/components/boss/BossIcon";
import { CharacterAvatar } from "@/components/character/CharacterAvatar";
import { scheduleLabel } from "@/lib/maple/partySchedule";

export function PartyCard({ party: p }: { party: PartyWithMembers }) {
  const price = crystalPrice(p.boss, p.difficulty, kstDateStr());
  const per = price == null ? null : Math.floor(price / Math.max(1, p.size));
  const schedule = scheduleLabel(p) ?? p.scheduleNote;
  return (
    <Link href={`/parties/${p.id}`} className={`card block hover:border-orange-300 transition text-sm space-y-2`}>
      <div className="flex items-center gap-2">
        <BossIcon boss={p.boss} diff={p.difficulty} size={44} showDiff={false} />
        <span className="flex flex-col gap-0.5 leading-tight min-w-0">
          <span className="flex items-center gap-1.5">
            <DifficultyBadge diff={p.difficulty} size="xs" solid />
            <span className="font-semibold truncate">{p.boss}</span>
          </span>
          <TierStars tier={tierOf(p.boss, p.difficulty)} size={10} />
        </span>
        <span className="ml-auto badge bg-zinc-100 dark:bg-zinc-800">{p.size}인격</span>
      </div>
      {p.name && <div className="text-zinc-600 dark:text-zinc-400">{p.name}</div>}
      <div className="flex flex-wrap gap-2">
        {p.members.map((m) => (
          <span key={m.id} className="flex flex-col items-center gap-0.5 w-14" title={m.characterId ? `${m.linkedWorld ?? ""} Lv.${m.linkedLevel ?? "?"}` : "미확인 닉네임"}>
            <CharacterAvatar src={m.linkedImage} alt="" size={48} className={m.characterId ? "" : "opacity-50"} />
            <span className="text-[10px] truncate max-w-full leading-tight">
              {m.isLeader && "👑"}
              {m.nickname}
            </span>
          </span>
        ))}
      </div>
      <div className="text-xs text-zinc-500">
        결정 {fmtPower(price)} → 1인 {fmtPower(per)}
        {schedule && <span className="ml-2">· {schedule}</span>}
        {!p.repeats && <span className="ml-2 text-amber-600">· 이번 주만</span>}
        {!p.isOwner && <span className="ml-2">· 참여 중</span>}
      </div>
    </Link>
  );
}
