import Link from "next/link";
import type { PartyWithMembers } from "@/lib/db/queries/parties";
import { crystalPrice } from "@/lib/maple/prices";
import { DifficultyBadge } from "@/components/boss/DifficultyBadge";
import { fmtPower } from "@/lib/maple/format";
import { kstDateStr } from "@/lib/maple/kst";
import { BossIcon } from "@/components/boss/BossIcon";
import { CharacterAvatar } from "@/components/character/CharacterAvatar";
import { dayLabel, timeLabel } from "@/lib/maple/partySchedule";

export function PartyCard({ party: p }: { party: PartyWithMembers }) {
  const price = crystalPrice(p.boss, p.difficulty, kstDateStr());
  const per = price == null ? null : Math.floor(price / Math.max(1, p.size));
  const day = dayLabel(p.dayOfWeek);
  const time = timeLabel(p.hour, p.minute);
  return (
    <Link href={`/parties/${p.id}`} className={`card block hover:border-orange-300 transition text-sm space-y-2`}>
      {/*
        한 줄: 보스 · 제목 · 요일 · 시간 · 반복 · 인원.
        제목만 남는 자리를 먹고 나머지는 오른쪽에 붙어, 카드를 여럿 훑을 때 같은 자리에서 읽힌다.
        티어 별은 뺐다 — 이미 고른 파티라 등급을 견줄 일이 없다.
      */}
      <div className="flex items-center gap-2 min-w-0">
        <BossIcon boss={p.boss} diff={p.difficulty} size={56} showDiff={false} />
        <DifficultyBadge diff={p.difficulty} size="xs" solid />
        <span className="font-semibold whitespace-nowrap">{p.boss}</span>
        <span className="text-zinc-500 dark:text-zinc-400 truncate flex-1 min-w-0">{p.name}</span>
        <span className="flex items-center gap-1.5 shrink-0">
          {day ? (
            <span className="badge bg-sky-50 text-sky-800 dark:bg-sky-950/50 dark:text-sky-200">{day}</span>
          ) : (
            <span className="badge bg-zinc-100 text-zinc-400 dark:bg-zinc-800">요일 미정</span>
          )}
          {time && <span className="text-xs tabular-nums text-zinc-600 dark:text-zinc-300">{time}</span>}
          <span className={`badge ${p.repeats ? "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300" : "bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-200"}`}>
            {p.repeats ? "매주" : "이번 주만"}
          </span>
          <span className="badge bg-zinc-100 dark:bg-zinc-800">{p.size}인격</span>
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
