"use client";

import { useMemo, useState } from "react";
import type { CalDay, CalendarModel } from "@/lib/maple/calendar";
import { EXPIRY_SOURCE_LABEL } from "@/lib/maple/expiry";
import { timeLabel } from "@/lib/maple/partySchedule";
import { bossFullLabel } from "@/lib/maple/bossMeta";
import { crystalPrice } from "@/lib/maple/prices";
import { fmtPower } from "@/lib/maple/format";
import { BossIcon } from "@/components/boss/BossIcon";
import { CharacterAvatar } from "@/components/character/CharacterAvatar";

const DOW = ["일", "월", "화", "수", "목", "금", "토"];
const dowOf = (date: string) => DOW[new Date(`${date}T00:00:00Z`).getUTCDay()];

const TODO_LABEL: Record<CalendarModel["todos"][number]["kind"], string> = { boss: "보스", monpark: "몬파", dailyquest: "일퀘" };
const TODO_TONE: Record<CalendarModel["todos"][number]["kind"], string> = { boss: "text-amber-600", monpark: "text-violet-600", dailyquest: "text-sky-600" };

/** 결정 실수령 합: 가격 ÷ 인원, 가격 없는 보스는 0 */
function crystalTotal(list: { boss: string; diff: string; party: number }[], priceDate: string): number {
  return list.reduce((s, c) => {
    const p = crystalPrice(c.boss, c.diff, priceDate);
    return s + (p == null ? 0 : Math.floor(p / Math.max(1, c.party)));
  }, 0);
}

/** 캐릭터 필터를 모델에 적용한 사본 */
function filterModel(model: CalendarModel, visible: Set<number>): CalendarModel {
  const keep = (id: number) => visible.has(id);
  return {
    ...model,
    days: model.days.map((d) => ({
      ...d,
      clears: d.clears.filter((c) => keep(c.characterId)),
      parties: d.parties.filter((p) => p.characterIds.length === 0 || p.characterIds.some(keep)),
      expiries: d.expiries.filter((e) => keep(e.characterId)),
    })),
    // 계정 공유 숙제(몬스터파크)는 캐릭터를 꺼도 남는다
    todos: model.todos.filter((t) => t.shared || keep(t.characterId)),
    monthly: model.monthly.filter((m) => keep(m.characterId)),
    upcomingExpiries: model.upcomingExpiries.filter((e) => keep(e.characterId)),
  };
}

/**
 * 이번 주(목~수) 한 줄 + 선택한 날 상세 + 옆 패널(이번 주 남은 것·만료 임박·진행 중 이벤트).
 * 데이터는 서버가 다 만들어 넘긴다. 여기서는 고른 날짜와 보이는 캐릭터만 기억한다.
 */
export function CalendarView({ model: raw }: { model: CalendarModel }) {
  const charMap = useMemo(() => new Map(raw.characters.map((c) => [c.id, c])), [raw.characters]);
  const [visible, setVisible] = useState<Set<number>>(() => new Set(raw.characters.map((c) => c.id)));
  const model = useMemo(() => filterModel(raw, visible), [raw, visible]);
  const days = model.days;
  const [selected, setSelected] = useState<string>(() => (days.some((d) => d.date === model.today) ? model.today : model.weekStart));
  const [view, setView] = useState<"grid" | "list">("grid");
  const day = days.find((d) => d.date === selected) ?? null;
  const weekTotal = crystalTotal(days.flatMap((d) => d.clears.filter((c) => c.cycle === "bossWeekly")), model.today);
  const weekCount = days.reduce((s, d) => s + d.clears.filter((c) => c.cycle === "bossWeekly").length, 0);

  function toggleChar(id: number) {
    setVisible((v) => {
      const next = new Set(v);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    // 달력이 가로를 다 쓰게 옆 패널을 아래로 내렸다. 7칸이 한 줄이라 폭이 곧 칸 크기다.
    <div className="space-y-4">
      <div className="space-y-4 min-w-0">
        <div className="flex flex-wrap items-center gap-1 text-xs">
          {(["grid", "list"] as const).map((v) => (
            <button key={v} type="button" onClick={() => setView(v)} aria-pressed={view === v} className={`rounded-md border px-2.5 py-1 ${view === v ? "border-orange-400 bg-orange-50 font-medium text-orange-800 dark:border-orange-700 dark:bg-orange-950/40 dark:text-orange-200" : "border-zinc-200 text-zinc-600 dark:border-zinc-700 dark:text-zinc-300"}`}>
              {v === "grid" ? "달력" : "잡은 보스 목록"}
            </button>
          ))}
          <span className="ml-2 text-zinc-500">
            이번 주 결정 <b className="text-zinc-800 dark:text-zinc-100 tabular-nums">{fmtPower(weekTotal)}</b> · {weekCount}개
          </span>

          {/* 우상단 캐릭터 토글: 체크된 캐릭터만 칸·패널에 보인다 */}
          <span className="ml-auto flex flex-wrap items-center gap-1">
            {raw.characters.map((c) => {
              const on = visible.has(c.id);
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => toggleChar(c.id)}
                  aria-pressed={on}
                  title={`${c.name} · ${c.cls ?? ""} Lv.${c.level ?? "?"}`}
                  className={`inline-flex items-center gap-1 rounded-md border pl-0.5 pr-2 py-0.5 transition ${on ? "border-orange-400 bg-orange-50 text-orange-900 dark:border-orange-700 dark:bg-orange-950/40 dark:text-orange-100" : "border-zinc-200 text-zinc-400 dark:border-zinc-700 opacity-60"}`}
                >
                  <CharacterAvatar src={c.imageUrl} alt="" size={22} crop="face" className={on ? "" : "grayscale"} />
                  <span className="max-w-[5.5rem] truncate">{c.name}</span>
                </button>
              );
            })}
            {raw.characters.length > 1 && (
              <button type="button" className="btn-ghost text-[10px] py-0.5 px-1.5" onClick={() => setVisible(visible.size === raw.characters.length ? new Set() : new Set(raw.characters.map((c) => c.id)))}>
                {visible.size === raw.characters.length ? "모두 해제" : "모두 선택"}
              </button>
            )}
          </span>
        </div>

        {view === "list" && <ClearList days={days} charMap={charMap} onPick={(d) => { setSelected(d); setView("grid"); }} />}

        <div className={`card p-2 sm:p-3 overflow-x-auto ${view === "list" ? "hidden" : ""}`}>
          {/* 요일 머리글은 칸 순서(목~수)를 그대로 따른다 */}
          <div className="grid grid-cols-7 text-center text-sm text-zinc-500 mb-1 min-w-[56rem]">
            {days.map((d) => {
              const dow = dowOf(d.date);
              return (
                <div key={d.date} className={`py-1 ${dow === "일" ? "text-rose-500" : dow === "토" ? "text-sky-500" : ""} ${d.weeklyReset ? "font-semibold text-orange-600 dark:text-orange-400" : ""}`}>
                  {dow}
                  {d.weeklyReset && <span className="ml-1 text-[10px] font-normal">리셋</span>}
                </div>
              );
            })}
          </div>
          {/* 좁은 화면에서는 칸을 줄이지 않고 가로 스크롤 */}
          <div className="grid grid-cols-7 gap-px bg-zinc-200 dark:bg-zinc-800 rounded-lg overflow-hidden min-w-[56rem]">
            {days.map((d) => (
              <DayCell key={d.date} day={d} today={model.today} todos={model.todos} monthly={model.monthly} selected={d.date === selected} onSelect={() => setSelected(d.date)} charMap={charMap} />
            ))}
          </div>
          <Legend />
        </div>

        {view === "grid" && day && <DayDetail day={day} today={model.today} todos={model.todos} charMap={charMap} />}
      </div>

      <aside className="grid gap-4 md:grid-cols-3 items-start">
        <TodoPanel model={model} charMap={charMap} />
        <ExpiryPanel model={model} charMap={charMap} />
        <EventPanel model={model} />
      </aside>
    </div>
  );
}

type CharMap = Map<number, CalendarModel["characters"][number]>;

/** 어제까지는 기록(잡은 보스)만, 오늘부터는 할 일(남은 숙제·파티·만료·이벤트)만 */
function phaseOf(d: CalDay, today: string): "past" | "today" | "future" {
  return d.date < today ? "past" : d.date === today ? "today" : "future";
}

/**
 * 보스 아이콘 + 난이도 배지. 배지를 아이콘 안에 겹쳐 그리던 것을 옆으로 뺐다 —
 * 아이콘이 커지면 겹친 배지가 그림을 가리고, 작으면 글자가 안 읽혔다.
 */
/** 보스 아이콘. 난이도는 아이콘 우하단에 겹쳐 그린다 (BossIcon 기본). */
/** 칸 안 아이콘 크기. 3열 격자가 칸 폭(약 10rem)에 얼굴과 함께 들어가는 크기다. */
const MARK = 34;
const MARK_COLS = 3;
function BossMark({ boss, diff, size = MARK, muted = false }: { boss: string; diff: string; size?: number; muted?: boolean }) {
  return <BossIcon boss={boss} diff={diff} size={size} className={muted ? "opacity-45 grayscale" : ""} />;
}

/**
 * 캐릭터 한 줄: 큰 테두리 상자 안에 얼굴 + 보스 아이콘 격자.
 * 격자는 3열 고정(아이콘 크기 열 폭)이라 2~3줄로 접히고, 캐릭터가 달라도 열이 맞는다.
 * 잡은 것은 색, 남은 것은 회색. 하나라도 잡았으면 초록 실선, 전부 남았으면 회색 점선.
 */
function CharBossRow({ characterId, done, left = [], monthly, charMap, max = 9 }: { characterId: number; done: { boss: string; diff: string }[]; left?: { boss: string; diff: string }[]; monthly?: CalendarModel["monthly"][number]; charMap: CharMap; max?: number }) {
  const c = charMap.get(characterId);
  const all = [...done.map((b) => ({ ...b, muted: false })), ...left.map((b) => ({ ...b, muted: true }))];
  const hasDone = done.length > 0;
  return (
    <span
      className={`flex flex-col gap-1 rounded-xl border-2 p-1.5 w-fit max-w-full ${hasDone ? "border-emerald-400 bg-emerald-50/40 dark:border-emerald-700 dark:bg-emerald-950/20" : "border-dashed border-zinc-300 dark:border-zinc-600"}`}
      title={`${c?.name ?? ""} · 잡음 ${done.map((b) => bossFullLabel(b.boss, b.diff)).join(", ") || "-"}${left.length ? ` · 남음 ${left.map((b) => bossFullLabel(b.boss, b.diff)).join(", ")}` : ""}`}
    >
      {/* 얼굴은 위 줄에, 격자는 아래 — 옆에 두면 3열이 칸 폭을 넘어 상자 밖으로 나간다 */}
      <span className="flex items-center gap-1.5 min-w-0">
        <CharacterAvatar src={c?.imageUrl} alt={c?.name ?? ""} size={26} crop="face" className={`rounded-md border-2 ${hasDone ? "border-emerald-500" : "border-zinc-300 dark:border-zinc-600"}`} />
        <span className="text-[11px] font-medium truncate">{c?.name}</span>
        {/* 월간 보스(검마) 작은 배지: 이번 달 완료면 색, 아니면 흑백. 난이도는 안 붙인다. 미등록이면 없음 */}
        {monthly && (
          <span className="inline-flex shrink-0" title={`${bossFullLabel(monthly.boss, monthly.diff)} · 이번 달 ${monthly.completed ? "완료" : "미완료"}`}>
            <BossIcon boss={monthly.boss} diff={monthly.diff} size={20} showDiff={false} className={monthly.completed ? "ring-1 ring-emerald-500" : "grayscale opacity-60"} />
          </span>
        )}
        <span className="ml-auto text-[10px] text-zinc-500 tabular-nums shrink-0">{done.length}{left.length ? `/${done.length + left.length}` : ""}</span>
      </span>
      <span className="grid gap-1" style={{ gridTemplateColumns: `repeat(${MARK_COLS}, ${MARK}px)` }}>
        {all.slice(0, max).map((b, i) => (
          <BossMark key={i} boss={b.boss} diff={b.diff} muted={b.muted} />
        ))}
        {all.length > max && (
          <span className="inline-flex items-center justify-center text-xs text-zinc-500" style={{ width: MARK, height: MARK }}>
            +{all.length - max}
          </span>
        )}
      </span>
    </span>
  );
}

function groupByChar<T extends { characterId: number }>(list: T[]): Map<number, T[]> {
  const m = new Map<number, T[]>();
  for (const x of list) (m.get(x.characterId) ?? m.set(x.characterId, []).get(x.characterId)!).push(x);
  return m;
}

function DayCell({ day: d, today, todos, monthly, selected, onSelect, charMap }: { day: CalDay; today: string; todos: CalendarModel["todos"]; monthly: CalendarModel["monthly"]; selected: boolean; onSelect: () => void; charMap: CharMap }) {
  const dow = dowOf(d.date);
  const num = Number(d.date.slice(8, 10));
  const phase = phaseOf(d, today);
  const sunday = phase !== "past" && d.events.some((e) => e.edge === "sunday");
  const clearsByChar = groupByChar(d.clears);
  // 오늘 칸: 남은 등록 보스 (캐릭터별) + 남은 콘텐츠 수
  const remainBoss = phase === "today" ? groupByChar(todos.filter((t) => t.kind === "boss" && t.boss && t.diff).map((t) => ({ characterId: t.characterId, boss: t.boss!, diff: t.diff!, party: t.party ?? 1 }))) : new Map<number, { characterId: number; boss: string; diff: string; party: number }[]>();
  const remainContents = phase === "today" ? todos.filter((t) => t.kind !== "boss").length : 0;
  const rows = [...clearsByChar.keys(), ...[...remainBoss.keys()].filter((id) => !clearsByChar.has(id))];
  // 하단 총액: 그날 잡은 주간 결정 실수령 합 (오늘은 남은 것도 따로)
  const doneTotal = crystalTotal(d.clears.filter((c) => c.cycle === "bossWeekly"), d.date);
  const leftTotal = crystalTotal([...remainBoss.values()].flat(), d.date);

  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={`relative min-h-[17rem] p-2 text-left flex flex-col gap-2 bg-white dark:bg-zinc-900 transition
        ${selected ? "ring-2 ring-inset ring-orange-400" : "hover:bg-orange-50/60 dark:hover:bg-zinc-800"}
        ${sunday ? "bg-yellow-50 dark:bg-yellow-950/20" : ""} ${phase === "past" ? "bg-zinc-50/70 dark:bg-zinc-900/70" : ""}`}
    >
      <div className="flex items-center gap-1.5 text-sm">
        <span className={`tabular-nums font-semibold ${d.isToday ? "rounded-full bg-orange-500 text-white w-6 h-6 inline-flex items-center justify-center" : dow === "일" ? "text-rose-500" : dow === "토" ? "text-sky-500" : ""}`}>{num}</span>
        {d.weeklyReset && <span className="text-[9px] text-orange-600 dark:text-orange-400">주간</span>}
        {d.monthlyReset && <span className="text-[9px] text-violet-600 dark:text-violet-400">월간</span>}
        {sunday && <span className="ml-auto text-[9px] rounded bg-yellow-200 text-yellow-900 px-1 dark:bg-yellow-800 dark:text-yellow-100">썬데이</span>}
      </div>

      {/* 기록: 캐릭터 상자(얼굴 + 보스 격자). 오늘은 잡은 것(색) + 남은 것(회색)이 같은 상자에 */}
      {rows.slice(0, 4).map((id) => (
        <CharBossRow key={id} characterId={id} done={clearsByChar.get(id) ?? []} left={remainBoss.get(id) ?? []} monthly={monthly.find((m) => m.characterId === id)} charMap={charMap} />
      ))}
      {rows.length > 4 && <span className="text-[10px] text-zinc-500">+{rows.length - 4}캐릭</span>}
      {remainContents > 0 && <span className="text-[10px] text-sky-700 dark:text-sky-300">몬파·일퀘 {remainContents}개 남음</span>}

      {phase !== "past" && (
        <>
          {/* 파티: 아이콘 + 시각 */}
          {d.parties.slice(0, 2).map((p) => (
            <span key={p.partyId} className="flex items-center gap-1 text-[10px] text-sky-800 dark:text-sky-200 truncate" title={`${bossFullLabel(p.boss, p.diff)}${p.name ? ` · ${p.name}` : ""}`}>
              <BossMark boss={p.boss} diff={p.diff} size={32} />
              <span className="truncate">{timeLabel(p.hour, p.minute) ?? p.name ?? p.boss}</span>
            </span>
          ))}
          {d.parties.length > 2 && <span className="text-[10px] text-sky-700">+{d.parties.length - 2} 파티</span>}
        </>
      )}

      {/* 하단: 결정 총액 (+ 만료·이벤트) */}
      <span className="mt-auto flex flex-col gap-0.5">
        {(doneTotal > 0 || leftTotal > 0) && (
          <span className="flex items-baseline gap-1.5 text-[11px] tabular-nums border-t border-zinc-100 dark:border-zinc-800 pt-1">
            {doneTotal > 0 && (
              <span className="text-emerald-700 dark:text-emerald-300">
                결정 <b>{fmtPower(doneTotal)}</b>
              </span>
            )}
            {leftTotal > 0 && <span className="text-zinc-500">남음 {fmtPower(leftTotal)}</span>}
          </span>
        )}
        {phase !== "past" && (
          <span className="flex flex-wrap gap-x-1.5 text-[10px]">
            {d.expiries.length > 0 && (
              <span className="text-orange-700 dark:text-orange-300" title={d.expiries.map((e) => e.name).join(", ")}>
                ● 만료 {d.expiries.length}
              </span>
            )}
            {d.events.filter((e) => e.edge !== "sunday").map((e) => (
              <span key={`${e.noticeId}${e.edge}`} className="text-violet-700 dark:text-violet-300 truncate max-w-full" title={e.title}>
                {e.edge === "end" ? "■ 종료" : e.edge === "both" ? "◆" : "▶ 시작"} {e.title.replace(/^\[[^\]]*\]\s*/, "")}
              </span>
            ))}
          </span>
        )}
      </span>
    </button>
  );
}

/** 이번 주에 언제 어떤 보스를 잡았는지 날짜순 목록. 날짜를 누르면 달력의 그 날로 간다. */
function ClearList({ days, charMap, onPick }: { days: CalDay[]; charMap: CharMap; onPick: (date: string) => void }) {
  const withClears = days.filter((d) => d.clears.length > 0);
  const total = withClears.reduce((s, d) => s + d.clears.length, 0);
  // 캐릭터별 개수·결정 합계 (달력 위 요약)
  const perChar = new Map<number, { n: number; value: number }>();
  for (const d of withClears)
    for (const c of d.clears) {
      const e = perChar.get(c.characterId) ?? { n: 0, value: 0 };
      e.n++;
      if (c.cycle === "bossWeekly") e.value += crystalTotal([c], d.date);
      perChar.set(c.characterId, e);
    }
  const weekValue = [...perChar.values()].reduce((s, e) => s + e.value, 0);
  return (
    <div className="card space-y-3 text-sm">
      <div className="flex flex-wrap items-baseline gap-2">
        <h2 className="font-semibold">이번 주 잡은 보스</h2>
        <span className="text-xs text-zinc-500">
          {total}회 · {withClears.length}일 · 결정 <b className="text-zinc-800 dark:text-zinc-100 tabular-nums">{fmtPower(weekValue)}</b>
        </span>
        <span className="ml-auto flex flex-wrap gap-2 text-xs">
          {[...perChar.entries()]
            .sort((a, b) => b[1].value - a[1].value)
            .map(([id, e]) => (
              <span key={id} className="inline-flex items-center gap-1">
                <CharacterAvatar src={charMap.get(id)?.imageUrl} alt="" size={18} crop="face" />
                {charMap.get(id)?.name} <b>{e.n}</b>
                <span className="text-zinc-500 tabular-nums">{fmtPower(e.value)}</span>
              </span>
            ))}
        </span>
      </div>
      {withClears.length === 0 ? (
        <div className="text-xs text-zinc-500">이번 주에 기록된 클리어가 없습니다. 스냅샷이 있는 날만 잡힙니다 — 새로고침이나 스냅샷 잡이 돌아야 쌓입니다.</div>
      ) : (
        <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
          {withClears.map((d) => {
            const byChar = groupByChar(d.clears);
            const dow = dowOf(d.date);
            return (
              <li key={d.date} className="py-2 flex gap-3">
                <button type="button" onClick={() => onPick(d.date)} className="shrink-0 w-16 text-left tabular-nums hover:underline">
                  <span className="font-medium">{d.date.slice(5).replace("-", "/")}</span>
                  <span className={`ml-1 text-xs ${dow === "일" ? "text-rose-500" : dow === "토" ? "text-sky-500" : dow === "목" ? "text-orange-600" : "text-zinc-500"}`}>{dow}</span>
                  {d.weeklyReset && <span className="block text-[10px] text-orange-600">리셋</span>}
                </button>
                <div className="flex-1 min-w-0 space-y-1">
                  {[...byChar.entries()].map(([id, list]) => (
                    <div key={id} className="flex items-center gap-2 flex-wrap">
                      <span className="inline-flex items-center gap-1 text-xs w-24 shrink-0 truncate">
                        <CharacterAvatar src={charMap.get(id)?.imageUrl} alt="" size={20} crop="face" />
                        {charMap.get(id)?.name ?? `#${id}`}
                      </span>
                      {list.map((c, i) => {
                        const p = crystalPrice(c.boss, c.diff, d.date);
                        return (
                          <span key={i} className="inline-flex items-center gap-1.5 text-xs rounded-md border border-zinc-200 dark:border-zinc-700 pl-0.5 pr-1.5 py-0.5">
                            <BossMark boss={c.boss} diff={c.diff} size={44} />
                            {c.boss}
                            {c.cycle === "bossMonthly" && <span className="text-[10px] text-violet-600">월간</span>}
                            {p != null && (
                              <span className="text-[10px] text-zinc-500 tabular-nums">
                                {fmtPower(Math.floor(p / Math.max(1, c.party)))}
                                {c.party > 1 && ` (÷${c.party})`}
                              </span>
                            )}
                          </span>
                        );
                      })}
                    </div>
                  ))}
                </div>
                <span className="shrink-0 text-xs tabular-nums text-emerald-700 dark:text-emerald-300 self-start">{fmtPower(crystalTotal(d.clears.filter((c) => c.cycle === "bossWeekly"), d.date))}</span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function Legend() {
  return (
    <div className="flex flex-wrap gap-x-3 gap-y-1 text-[10px] text-zinc-500 pt-2 px-1">
      <span>목요일 리셋부터 수요일까지 이번 주만</span>
      <span>어제까지 = 기록만 · 오늘부터 = 남은 숙제·일정만</span>
      <span className="text-emerald-700 dark:text-emerald-300">초록 상자 = 그 캐릭이 잡은 보스 (일간 보스 제외) · 점선 상자 = 아직 하나도 안 잡음</span>
      <span>회색 아이콘 = 아직 안 잡은 등록 보스 · 아이콘 우하단 = 난이도</span>
      <span>칸 하단 결정 = 그날 실수령 합 (가격 ÷ 설정 인원)</span>
      <span className="text-sky-700 dark:text-sky-300">아이콘 + 시각 = 고정 파티</span>
      <span className="text-orange-700 dark:text-orange-300">● 기간제 아이템 만료</span>
      <span className="text-violet-700 dark:text-violet-300">▶■ 이벤트 시작·종료</span>
      <span className="text-yellow-800 dark:text-yellow-200">노란 칸 = 썬데이 메이플</span>
    </div>
  );
}

function DayDetail({ day: d, today, todos, charMap }: { day: CalDay; today: string; todos: CalendarModel["todos"]; charMap: CharMap }) {
  const dow = dowOf(d.date);
  const phase = phaseOf(d, today);
  const showPlans = phase !== "past";
  const todosByChar = phase === "today" ? groupByChar(todos) : new Map<number, CalendarModel["todos"]>();
  const empty = !d.clears.length && !todosByChar.size && (!showPlans || (!d.parties.length && !d.expiries.length && !d.events.length));
  const clearsByChar = groupByChar(d.clears);
  return (
    <div className="card space-y-3 text-sm">
      <div className="flex items-baseline gap-2">
        <h2 className="font-semibold">
          {d.date.slice(5).replace("-", "/")} ({dow})
        </h2>
        {d.weeklyReset && <span className="badge bg-orange-100 text-orange-800 dark:bg-orange-950/50 dark:text-orange-200">주간 리셋 00:00</span>}
        {d.monthlyReset && <span className="badge bg-violet-100 text-violet-800 dark:bg-violet-950/50 dark:text-violet-200">월간 리셋</span>}
        {showPlans && d.events.some((e) => e.edge === "sunday") && <span className="badge bg-yellow-200 text-yellow-900 dark:bg-yellow-800 dark:text-yellow-100">썬데이 메이플</span>}
        <span className="ml-auto text-xs text-zinc-400">{phase === "past" ? "기록" : phase === "today" ? "오늘 · 기록 + 남은 숙제" : "예정"}</span>
      </div>
      {empty && <div className="text-zinc-500">{phase === "past" ? "이날 잡은 보스 기록 없음 (스냅샷이 없는 날은 다음 스냅샷 날짜에 몰림)" : "일정 없음"}</div>}

      {todosByChar.size > 0 && (
        <section className="space-y-1">
          <h3 className="text-xs text-zinc-500">남은 숙제 (이번 주 · 수요일까지)</h3>
          {[...todosByChar.entries()].map(([id, list]) => {
            const bosses = list.filter((t) => t.kind === "boss" && t.boss && t.diff);
            const contents = list.filter((t) => t.kind !== "boss");
            return (
              <div key={id} className="flex items-start gap-2">
                <CharacterAvatar src={charMap.get(id)?.imageUrl} alt="" size={28} crop="face" />
                <div className="min-w-0 space-y-0.5">
                  <div className="text-xs font-medium">{charMap.get(id)?.name ?? `#${id}`}</div>
                  {bosses.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {bosses.map((t, i) => (
                        <span key={i} className="inline-flex items-center gap-1 text-xs text-zinc-600 dark:text-zinc-300">
                          <BossMark boss={t.boss!} diff={t.diff!} size={44} muted />
                          {t.boss}
                        </span>
                      ))}
                    </div>
                  )}
                  {contents.length > 0 && (
                    <div className="flex flex-wrap gap-x-2 text-[11px] text-zinc-500">
                      {contents.map((t, i) => (
                        <span key={i}>
                          <span className={TODO_TONE[t.kind]}>{TODO_LABEL[t.kind]}</span> {t.label}
                          {t.progress && <span className="tabular-nums"> {t.progress}</span>}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </section>
      )}

      {showPlans && d.parties.length > 0 && (
        <section className="space-y-1">
          <h3 className="text-xs text-zinc-500">고정 파티</h3>
          {d.parties.map((p) => (
            <div key={p.partyId} className="flex items-center gap-2">
              <BossMark boss={p.boss} diff={p.diff} size={44} />
              <span className="font-medium">{p.boss}</span>
              {p.name && <span className="text-zinc-500">{p.name}</span>}
              <span className="ml-auto text-xs tabular-nums text-zinc-600 dark:text-zinc-300">{timeLabel(p.hour, p.minute) ?? "시간 미정"}</span>
              <span className="badge bg-zinc-100 dark:bg-zinc-800">{p.size}인</span>
              <span className="flex -space-x-1">
                {p.characterIds.map((id) => (
                  <CharacterAvatar key={id} src={charMap.get(id)?.imageUrl} alt={charMap.get(id)?.name ?? ""} size={20} crop="face" />
                ))}
              </span>
            </div>
          ))}
        </section>
      )}

      {clearsByChar.size > 0 && (
        <section className="space-y-1">
          <h3 className="text-xs text-zinc-500">잡은 보스</h3>
          {[...clearsByChar.entries()].map(([id, list]) => (
            <div key={id} className="flex items-start gap-2">
              <CharacterAvatar src={charMap.get(id)?.imageUrl} alt="" size={28} crop="face" />
              <div className="min-w-0">
                <div className="text-xs font-medium">{charMap.get(id)?.name ?? `#${id}`}</div>
                <div className="flex flex-wrap gap-1.5">
                  {list.map((c) => {
                    const p = crystalPrice(c.boss, c.diff, d.date);
                    return (
                      <span key={`${c.boss}|${c.diff}|${c.cycle}`} className="inline-flex items-center gap-1 text-xs">
                        <BossMark boss={c.boss} diff={c.diff} size={44} />
                        {c.boss}
                        {c.cycle === "bossMonthly" && <span className="text-[10px] text-violet-600">월간</span>}
                        {p != null && (
                          <span className="text-[10px] text-zinc-500 tabular-nums">
                            {fmtPower(Math.floor(p / Math.max(1, c.party)))}
                            {c.party > 1 && ` (÷${c.party})`}
                          </span>
                        )}
                      </span>
                    );
                  })}
                </div>
              </div>
            </div>
          ))}
          <div className="text-xs text-right tabular-nums">
            결정 합계 <b className="text-emerald-700 dark:text-emerald-300">{fmtPower(crystalTotal(d.clears.filter((c) => c.cycle === "bossWeekly"), d.date))}</b>
          </div>
        </section>
      )}

      {showPlans && d.expiries.length > 0 && (
        <section className="space-y-1">
          <h3 className="text-xs text-zinc-500">만료</h3>
          {d.expiries.map((e, i) => (
            <ExpiryLine key={i} e={e} charMap={charMap} />
          ))}
        </section>
      )}

      {showPlans && d.events.filter((e) => e.edge !== "sunday").length > 0 && (
        <section className="space-y-1">
          <h3 className="text-xs text-zinc-500">이벤트</h3>
          {d.events
            .filter((e) => e.edge !== "sunday")
            .map((e) => (
              <a key={`${e.noticeId}${e.edge}`} href={e.url} target="_blank" rel="noreferrer" className="flex items-center gap-2 hover:underline">
                <span className={`badge ${e.edge === "end" ? "bg-rose-100 text-rose-800 dark:bg-rose-950/50 dark:text-rose-200" : "bg-violet-100 text-violet-800 dark:bg-violet-950/50 dark:text-violet-200"}`}>
                  {e.edge === "end" ? "종료" : e.edge === "both" ? "당일" : "시작"}
                </span>
                <span className="truncate">{e.title}</span>
              </a>
            ))}
        </section>
      )}
    </div>
  );
}

function ExpiryLine({ e, charMap }: { e: CalDay["expiries"][number]; charMap: CharMap }) {
  return (
    <div className="flex items-center gap-2 text-xs">
      {e.icon ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={e.icon} alt="" className="w-6 h-6 object-contain" loading="lazy" />
      ) : (
        <span className="w-6 h-6 rounded bg-zinc-100 dark:bg-zinc-800 inline-block" />
      )}
      <span className="truncate">{e.name}</span>
      <span className="badge bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">{EXPIRY_SOURCE_LABEL[e.source]}</span>
      <span className="ml-auto tabular-nums text-zinc-500">{e.time}</span>
      <CharacterAvatar src={charMap.get(e.characterId)?.imageUrl} alt={charMap.get(e.characterId)?.name ?? ""} size={20} crop="face" />
    </div>
  );
}

function TodoPanel({ model, charMap }: { model: CalendarModel; charMap: CharMap }) {
  // 계정 공유(몬스터파크)는 캐릭터 줄 밖에 따로 놓는다
  const shared = model.todos.filter((t) => t.shared);
  const byChar = groupByChar(model.todos.filter((t) => !t.shared));
  return (
    <div className="card space-y-2 text-sm">
      <h2 className="font-semibold">
        이번 주 남은 것 <span className="text-xs text-zinc-500 font-normal">주간 보스 · 몬스터파크 · 일일 퀘스트</span>
      </h2>
      {shared.map((t, i) => (
        <div key={i} className="flex items-center justify-between gap-2 text-xs rounded-md bg-violet-50 dark:bg-violet-950/30 px-2 py-1">
          <span>
            <span className={`mr-1 ${TODO_TONE[t.kind]}`}>{TODO_LABEL[t.kind]}</span>
            {t.label} <span className="text-zinc-400">(계정 공유)</span>
          </span>
          {t.progress && <span className="tabular-nums text-zinc-500">{t.progress}</span>}
        </div>
      ))}
      {byChar.size === 0 && shared.length === 0 ? (
        <div className="text-xs text-zinc-500">남은 숙제가 없거나, 이번 주 스케줄러 기록이 없습니다.</div>
      ) : (
        [...byChar.entries()].map(([id, list]) => (
          <div key={id} className="space-y-0.5">
            <div className="flex items-center gap-1.5 text-xs font-medium">
              <CharacterAvatar src={charMap.get(id)?.imageUrl} alt="" size={20} crop="face" />
              {charMap.get(id)?.name}
              <span className="text-zinc-400">{list.length}</span>
            </div>
            <ul className="pl-6 space-y-0.5 text-xs">
              {list.slice(0, 8).map((t, i) => (
                <li key={i} className="flex justify-between gap-2">
                  <span className="truncate">
                    <span className={`mr-1 ${TODO_TONE[t.kind]}`}>{TODO_LABEL[t.kind]}</span>
                    {t.label}
                  </span>
                  {t.progress && <span className="tabular-nums text-zinc-500">{t.progress}</span>}
                </li>
              ))}
              {list.length > 8 && <li className="text-zinc-400">+{list.length - 8}</li>}
            </ul>
          </div>
        ))
      )}
    </div>
  );
}

function ExpiryPanel({ model, charMap }: { model: CalendarModel; charMap: CharMap }) {
  return (
    <div className="card space-y-2 text-sm">
      <h2 className="font-semibold">
        만료 임박 <span className="text-xs text-zinc-500">30일</span>
      </h2>
      {model.upcomingExpiries.length === 0 ? (
        <div className="text-xs text-zinc-500">30일 안에 만료되는 기간제 아이템이 없습니다. (갱신을 누르면 캐시·펫·안드로이드·장비를 받아 옵니다)</div>
      ) : (
        <div className="space-y-1">
          {model.upcomingExpiries.slice(0, 12).map((e, i) => (
            <div key={i} className="flex items-center gap-2 text-xs">
              <span className="tabular-nums text-zinc-500 w-10 shrink-0">{e.date.slice(5).replace("-", "/")}</span>
              <span className="truncate flex-1">{e.name}</span>
              <span className="badge bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">{EXPIRY_SOURCE_LABEL[e.source]}</span>
              <CharacterAvatar src={charMap.get(e.characterId)?.imageUrl} alt="" size={18} crop="face" />
            </div>
          ))}
          {model.upcomingExpiries.length > 12 && <div className="text-xs text-zinc-400">+{model.upcomingExpiries.length - 12}</div>}
        </div>
      )}
    </div>
  );
}

function EventPanel({ model }: { model: CalendarModel }) {
  return (
    <div className="card space-y-2 text-sm">
      <h2 className="font-semibold">진행 중·예정 이벤트</h2>
      {model.activeEvents.length === 0 ? (
        <div className="text-xs text-zinc-500">불러온 이벤트가 없습니다.</div>
      ) : (
        <ul className="space-y-1">
          {model.activeEvents.slice(0, 15).map((e) => (
            <li key={e.noticeId} className="text-xs">
              <a href={e.url} target="_blank" rel="noreferrer" className="hover:underline flex items-start gap-1.5">
                {e.isSunday && <span className="badge bg-yellow-200 text-yellow-900 dark:bg-yellow-800 dark:text-yellow-100 shrink-0">썬데이</span>}
                <span className="min-w-0">
                  <span className="block truncate">{e.title}</span>
                  <span className="text-zinc-500 tabular-nums">
                    {e.start?.slice(5).replace("-", "/")}
                    {e.end && e.end !== e.start && ` ~ ${e.end.slice(5).replace("-", "/")}`}
                  </span>
                </span>
              </a>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
