import Link from "next/link";
import type { PartyWithMembers } from "@/lib/db/queries/parties";
import { crystalPrice } from "@/lib/maple/prices";
import { tierLabel, tierOf } from "@/lib/maple/tiers";
import { fmtPower } from "@/lib/maple/format";
import { kstDateStr } from "@/lib/maple/kst";
import { BossIcon } from "@/components/boss/BossIcon";

export function PartyCard({ party: p }: { party: PartyWithMembers }) {
  const price = crystalPrice(p.boss, p.difficulty, kstDateStr());
  const per = price == null ? null : Math.floor(price / Math.max(1, p.size));
  return (
    <Link href={`/parties/${p.id}`} className="card block hover:border-orange-300 transition text-sm space-y-2">
      <div className="flex items-center gap-2">
        <BossIcon boss={p.boss} diff={p.difficulty} size={32} />
        <span className="font-semibold">
          {p.boss} <span className="text-xs text-zinc-500">{p.difficulty}</span>
        </span>
        <span className="text-xs text-zinc-500">{tierLabel(tierOf(p.boss, p.difficulty))}</span>
        <span className="ml-auto badge bg-zinc-100 dark:bg-zinc-800">{p.size}인격</span>
      </div>
      {p.name && <div className="text-zinc-600 dark:text-zinc-400">{p.name}</div>}
      <div className="flex flex-wrap gap-1">
        {p.members.map((m) => (
          <span key={m.id} className={`badge ${m.characterId ? "bg-green-50 text-green-800 dark:bg-green-900/30 dark:text-green-200" : "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300"}`} title={m.characterId ? `연결됨${m.linkedWorld ? ` · ${m.linkedWorld}` : ""}` : "미확인 닉네임"}>
            {m.isLeader && "👑 "}
            {m.nickname}
            {m.linkedLevel != null && <span className="opacity-60"> {m.linkedLevel}</span>}
          </span>
        ))}
      </div>
      <div className="text-xs text-zinc-500">
        결정 {fmtPower(price)} → 1인 {fmtPower(per)}
        {p.scheduleNote && <span className="ml-2">· {p.scheduleNote}</span>}
        {!p.isOwner && <span className="ml-2">· 참여 중</span>}
      </div>
    </Link>
  );
}
