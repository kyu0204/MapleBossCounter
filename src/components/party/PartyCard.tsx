import Link from "next/link";
import type { PartyWithMembers } from "@/lib/db/queries/parties";
import { crystalPrice } from "@/lib/maple/prices";
import { DifficultyBadge } from "@/components/boss/DifficultyBadge";
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
      {/*
        왼쪽은 보스(아이콘·난이도·이름·인원), 오른쪽은 파티 정보(제목·일정·반복).
        티어 별은 뺐다 — 이미 고른 파티라 등급을 견줄 일이 없다.
      */}
      <div className="flex items-center gap-3">
        <BossIcon boss={p.boss} diff={p.difficulty} size={56} showDiff={false} />
        <span className="flex flex-col gap-1 leading-tight min-w-0 shrink-0">
          <span className="flex items-center gap-1.5 min-w-0">
            <DifficultyBadge diff={p.difficulty} size="xs" solid />
            <span className="font-semibold truncate">{p.boss}</span>
          </span>
          <span className="badge w-fit bg-zinc-100 dark:bg-zinc-800">{p.size}인격</span>
        </span>
        <span className="ml-auto flex flex-col items-end gap-1 leading-tight min-w-0 text-right">
          {p.name && <span className="text-zinc-600 dark:text-zinc-400 truncate max-w-full">{p.name}</span>}
          {schedule ? <span className="text-xs text-zinc-600 dark:text-zinc-300">{schedule}</span> : <span className="text-xs text-zinc-400">시간 미정</span>}
          <span className={`text-xs ${p.repeats ? "text-zinc-500" : "text-amber-600"}`}>{p.repeats ? "매주 반복" : "이번 주만"}</span>
        </span>
      </div>
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
        {!p.isOwner && <span className="ml-2">· 참여 중</span>}
      </div>
    </Link>
  );
}
