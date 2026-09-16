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
  // 클리어 집계는 기록이 있는 사람만 분모로 센다. 모르는 사람을 "안 감"으로 묶으면 숫자가 거짓이 된다.
  const known = p.members.filter((m) => m.cleared != null).length;
  const doneCount = p.members.filter((m) => m.cleared).length;
  return (
    <Link href={`/parties/${p.id}`} className={`card block hover:border-orange-300 transition text-sm space-y-2`}>
      {/*
        한 줄: 보스 · 제목 · 요일 · 시간 · 반복 · 인원.
        제목만 남는 자리를 먹고 나머지는 오른쪽에 붙어, 카드를 여럿 훑을 때 같은 자리에서 읽힌다.
        티어 별은 뺐다 — 이미 고른 파티라 등급을 견줄 일이 없다.
      */}
      <div className="flex items-center gap-2 min-w-0">
        <BossIcon boss={p.boss} diff={p.difficulty} size={72} showDiff={false} />
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
          <span
            key={m.id}
            className="flex flex-col items-center gap-0.5 w-16"
            title={
              (m.characterId ? `${m.linkedWorld ?? ""} Lv.${m.linkedLevel ?? "?"}` : "미확인 닉네임") +
              (m.cleared == null ? " · 클리어 여부 모름 (스케줄러 기록 없음)" : m.cleared ? " · 이번 주 클리어" : " · 아직 안 감")
            }
          >
            {/* 클리어한 사람은 초록 테두리. 모름은 표시하지 않는다 — 안 간 것처럼 보이면 안 된다. */}
            <CharacterAvatar
              src={m.linkedImage}
              alt=""
              size={64}
              crop="face"
              className={`${m.characterId ? "" : "opacity-50"} ${m.cleared ? "ring-2 ring-emerald-500 ring-offset-1 ring-offset-white dark:ring-offset-zinc-900" : ""}`}
            />
            <span className="text-[11px] truncate max-w-full leading-tight">{m.nickname}</span>
          </span>
        ))}
      </div>
      <div className="text-xs text-zinc-500">
        결정 {fmtPower(price)} → 1인 {fmtPower(per)}
        {known > 0 && (
          <span className="ml-2">
            · 클리어 <b className="text-emerald-600 dark:text-emerald-400">{doneCount}</b>/{known}
            {known < p.size && <span className="text-zinc-400"> ({p.size - known}명 기록 없음)</span>}
          </span>
        )}
        {!p.isOwner && <span className="ml-2">· 참여 중</span>}
      </div>
    </Link>
  );
}
