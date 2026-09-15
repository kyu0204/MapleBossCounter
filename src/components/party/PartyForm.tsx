"use client";

import { useState, useTransition } from "react";
import { createParty, updateParty, resolveNickname, type PartyInput } from "@/actions/parties";
import { crystalPrice } from "@/lib/maple/prices";
import type { Difficulty } from "@/lib/maple/bossKey";
import { fmtPower } from "@/lib/maple/format";
import { DAY_LABEL, DAY_ORDER } from "@/lib/maple/partySchedule";
import { CharacterAvatar } from "@/components/character/CharacterAvatar";
import { BossPickerModal } from "./BossPickerModal";

export interface PartyFormInitial extends PartyInput {
  id?: number;
}

type MemberState = { nick: string; status: "idle" | "checking" | "ok" | "fail"; info?: string; imageUrl?: string | null; linked?: boolean };

/** 다중 조회는 이름을 쉼표로 이어 붙인다 (maplescouter 가 스스로 그렇게 링크한다) */
const multiResultUrl = (names: string[]) => `https://maplescouter.com/ko/multi-result?name=${encodeURIComponent(names.join(","))}`;

export function PartyForm({ initial, myCharacters, today }: { initial?: PartyFormInitial; myCharacters: string[]; today: string }) {
  const [boss, setBoss] = useState(initial?.boss ?? "");
  const [diff, setDiff] = useState<string>(initial?.difficulty ?? "");
  const [name, setName] = useState(initial?.name ?? "");
  const [dayOfWeek, setDayOfWeek] = useState<number | null>(initial?.dayOfWeek ?? null);
  const [hour, setHour] = useState<number | null>(initial?.hour ?? null);
  const [minute, setMinute] = useState<number | null>(initial?.minute ?? null);
  const [repeats, setRepeats] = useState(initial?.repeats ?? true);
  const [memo, setMemo] = useState(initial?.memo ?? "");
  const [members, setMembers] = useState<MemberState[]>((initial?.members ?? []).map((n) => ({ nick: n, status: "idle" })));
  const [leader, setLeader] = useState(initial?.leader ?? initial?.members?.[0] ?? "");
  const [draft, setDraft] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const price = boss && diff ? crystalPrice(boss, diff, today) : null;
  const size = Math.max(1, members.length);
  const perPerson = price == null ? null : Math.floor(price / size);
  const ready = !!boss && !!diff && members.length > 0;

  function pick(b: string, d: Difficulty) {
    setBoss(b);
    setDiff(d);
    setMsg(null);
  }

  function addMember(nick: string) {
    const n = nick.trim();
    if (!n || members.some((m) => m.nick === n) || members.length >= 6) return;
    setMembers((ms) => [...ms, { nick: n, status: "checking" }]);
    if (!leader) setLeader(n);
    setDraft("");
    start(async () => {
      const r = await resolveNickname(n);
      setMembers((ms) =>
        ms.map((m) =>
          m.nick === n
            ? {
                ...m,
                status: r.ok ? "ok" : "fail",
                info: r.ok && r.data ? `${r.data.world} · ${r.data.cls} · Lv.${r.data.level}` : r.message,
                imageUrl: r.data?.imageUrl ?? null,
                linked: r.data?.linked,
              }
            : m,
        ),
      );
    });
  }

  function submit() {
    setMsg(null);
    const payload: PartyInput = {
      name,
      boss,
      difficulty: diff,
      world: "",
      dayOfWeek,
      hour,
      minute: hour == null ? null : (minute ?? 0),
      repeats,
      memo,
      members: members.map((m) => m.nick),
      leader,
    };
    start(async () => {
      const r = initial?.id ? await updateParty(initial.id, payload) : await createParty(payload);
      if (r) setMsg(r.message);
    });
  }

  return (
    <div className="card space-y-5 text-sm">
      {/* 보스 — 고른 결과만 놓고, 누르면 모달에서 고친다 */}
      <div className="space-y-1.5">
        <div className="text-xs text-zinc-500">보스</div>
        <BossPickerModal boss={boss} diff={diff} today={today} onPick={pick} />
      </div>

      {/* 일정 — 요일·시각 모두 안 정해도 된다 */}
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <div className="text-xs text-zinc-500">요일 (선택)</div>
          <div className="flex flex-wrap gap-1">
            {DAY_ORDER.map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => setDayOfWeek(dayOfWeek === d ? null : d)}
                aria-pressed={dayOfWeek === d}
                className={`rounded-md border px-2.5 py-1 ${dayOfWeek === d ? "border-orange-400 bg-orange-50 font-medium text-orange-800 dark:border-orange-700 dark:bg-orange-950/40 dark:text-orange-200" : "border-zinc-200 text-zinc-600 hover:border-zinc-300 dark:border-zinc-700 dark:text-zinc-300"}`}
              >
                {DAY_LABEL[d]}
              </button>
            ))}
            {dayOfWeek != null && (
              <button type="button" className="btn-ghost text-xs" onClick={() => setDayOfWeek(null)}>
                해제
              </button>
            )}
          </div>
        </div>

        <div className="space-y-1.5">
          <div className="text-xs text-zinc-500">시간 (선택)</div>
          <div className="flex items-center gap-1.5">
            <input
              type="number"
              min={0}
              max={23}
              value={hour ?? ""}
              onChange={(e) => setHour(e.target.value === "" ? null : Math.min(23, Math.max(0, Number(e.target.value))))}
              className="w-16 rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-2 py-1 text-center tabular-nums"
              placeholder="시"
              aria-label="시"
            />
            <span className="text-zinc-400">:</span>
            <input
              type="number"
              min={0}
              max={59}
              step={5}
              value={minute ?? ""}
              onChange={(e) => setMinute(e.target.value === "" ? null : Math.min(59, Math.max(0, Number(e.target.value))))}
              className="w-16 rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-2 py-1 text-center tabular-nums"
              placeholder="분"
              aria-label="분"
            />
            {(hour != null || minute != null) && (
              <button
                type="button"
                className="btn-ghost text-xs"
                onClick={() => {
                  setHour(null);
                  setMinute(null);
                }}
              >
                해제
              </button>
            )}
          </div>
          {hour == null && minute != null && <div className="text-[11px] text-amber-600">시를 비우면 시간은 저장되지 않습니다.</div>}
        </div>
      </div>

      {/* 반복 여부 */}
      <div className="space-y-1.5">
        <div className="text-xs text-zinc-500">반복</div>
        <div className="flex flex-wrap items-center gap-2">
          {([true, false] as const).map((v) => (
            <button
              key={String(v)}
              type="button"
              onClick={() => setRepeats(v)}
              aria-pressed={repeats === v}
              className={`rounded-md border px-3 py-1 ${repeats === v ? "border-orange-400 bg-orange-50 font-medium text-orange-800 dark:border-orange-700 dark:bg-orange-950/40 dark:text-orange-200" : "border-zinc-200 text-zinc-600 hover:border-zinc-300 dark:border-zinc-700 dark:text-zinc-300"}`}
            >
              {v ? "매주 반복" : "이번 주만"}
            </button>
          ))}
          <span className="text-[11px] text-zinc-400">{repeats ? "주간 리셋이 지나도 그대로 남습니다." : "다음 목요일 00:00(KST)에 자동으로 삭제됩니다."}</span>
        </div>
      </div>

      <label className="space-y-1 block">
        <div className="text-xs text-zinc-500">파티 이름 (선택)</div>
        <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="예: 목요일 하드 세렌" />
      </label>

      {/* 구성원 */}
      <div className="space-y-2">
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <span className="text-xs text-zinc-500">구성원 (최대 6)</span>
          <span>
            {size}인격 · 1인 <b>{fmtPower(perPerson)}</b>
          </span>
          {price != null && size > 1 && (
            <span className="text-xs text-zinc-500">
              {fmtPower(price)} ÷ {size}
            </span>
          )}
        </div>

        {/* 구성원 카드와 입력칸을 같은 줄에. 추가하면 카드가 늘면서 입력칸이 뒤로 밀린다. */}
        <div className="flex flex-wrap items-start gap-2">
          {members.map((m) => (
            <div
              key={m.nick}
              className={`relative flex flex-col items-center gap-1 rounded-lg border p-2 w-28 ${m.status === "fail" ? "border-red-300 bg-red-50/50 dark:border-red-900 dark:bg-red-950/20" : "border-zinc-200 dark:border-zinc-800"}`}
              title={m.info}
            >
              <button
                type="button"
                className="absolute right-1 top-1 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200"
                onClick={() => setMembers((ms) => ms.filter((x) => x.nick !== m.nick))}
                aria-label={`${m.nick} 제거`}
              >
                ×
              </button>
              <CharacterAvatar src={m.imageUrl} alt={m.nick} size={72} />
              <button type="button" onClick={() => setLeader(m.nick)} title="리더로 지정" className={`text-xs truncate max-w-full ${leader === m.nick ? "font-semibold" : ""}`}>
                {leader === m.nick && "👑 "}
                {m.nick}
              </button>
              <span className="text-[10px] text-zinc-500 text-center leading-tight">
                {m.status === "checking" ? "확인 중…" : m.status === "fail" ? "확인 안 됨" : (m.info ?? "")}
              </span>
            </div>
          ))}

          {members.length < 6 && (
            <div className="flex flex-col gap-1 w-36">
              <input
                className="rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-2 py-1 text-sm w-full"
                list="my-characters"
                placeholder="닉네임"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addMember(draft);
                  }
                }}
                aria-label="구성원 닉네임"
              />
              <datalist id="my-characters">
                {myCharacters.map((n) => (
                  <option key={n} value={n} />
                ))}
              </datalist>
              <button type="button" className="btn-ghost text-xs" onClick={() => addMember(draft)} disabled={!draft.trim()}>
                추가
              </button>
            </div>
          )}
        </div>
        {members.some((m) => m.status === "fail") && <div className="text-xs text-red-600">확인 안 된 닉네임은 그대로 저장되지만 캐릭터 정보 연결은 안 됩니다.</div>}
      </div>

      <label className="space-y-1 block">
        <div className="text-xs text-zinc-500">메모 (선택)</div>
        <textarea className="input" rows={2} value={memo} onChange={(e) => setMemo(e.target.value)} />
      </label>

      <div className="flex flex-wrap items-center gap-3">
        <button className="btn-primary" disabled={pending || !ready} onClick={submit}>
          {pending ? "저장 중…" : initial?.id ? "수정 저장" : "파티 등록"}
        </button>
        {members.length >= 2 && (
          <a className="btn-ghost" href={multiResultUrl(members.map((m) => m.nick))} target="_blank" rel="noreferrer" title="maplescouter 에서 구성원 환산 주스탯 한 번에 보기 (새 창)">
            환산 주스탯 한 번에 보기
          </a>
        )}
        {!ready && <span className="text-xs text-zinc-500">보스·난이도와 구성원 1명 이상이 필요합니다.</span>}
        {msg && <span className="text-zinc-600 dark:text-zinc-400">{msg}</span>}
      </div>
    </div>
  );
}
