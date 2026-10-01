/**
 * 계정 캘린더 모델 (순수 함수). 서버가 만들어 클라이언트에 JSON 으로 넘긴다.
 *
 * 이번 주(목~수) 한 줄만 만든다. 달 단위 그리드는 없앴다 — 주간 리셋이 지난 기록은
 * 이 화면에서 볼 일이 없고, 지난주까지 그리면 "이번 주 뭐 남았나" 가 묻힌다.
 *
 * 하루 칸에 들어가는 것:
 *   clears   그날 새로 잡은 보스 (스냅샷 차분)
 *   parties  그날 도는 고정 파티 (요일 반복 / 이번 주만)
 *   expiries 그날 만료되는 기간제 아이템
 *   events   그날 시작·종료하는 이벤트, 썬데이 메이플
 *   marks    주간 리셋(목), 월간 리셋(1일)
 */
import { addDays, dayOfWeek, weekStartOf } from "./kst";
import { kstDateOf } from "./nexonDate";
import type { BossClearRow } from "./scheduler";
import type { ExpirySource } from "./expiry";

export interface CalChar {
  id: number;
  name: string;
  imageUrl: string | null;
  level: number | null;
  cls: string | null;
}

export interface CalClear {
  characterId: number;
  boss: string;
  diff: string;
  cycle: string;
  /** 결정 분배 인원 (파티 등록·갈 보스 설정 기준, 없으면 1) */
  party: number;
}

export interface CalParty {
  partyId: number;
  name: string | null;
  boss: string;
  diff: string;
  hour: number | null;
  minute: number | null;
  size: number;
  /** 이 계정 캐릭터 중 구성원인 캐릭터 */
  characterIds: number[];
}

export interface CalExpiry {
  characterId: number;
  source: ExpirySource;
  name: string;
  icon: string | null;
  /** KST "HH:mm" */
  time: string;
}

export interface CalEvent {
  noticeId: number;
  title: string;
  url: string;
  /** 이 칸에서의 역할 */
  edge: "start" | "end" | "both" | "sunday";
}

export interface CalDay {
  date: string;
  isToday: boolean;
  weeklyReset: boolean;
  monthlyReset: boolean;
  clears: CalClear[];
  parties: CalParty[];
  expiries: CalExpiry[];
  events: CalEvent[];
}

/**
 * 남은 숙제. 세 가지만 다룬다 — 주간 보스, 몬스터파크, 일일 퀘스트.
 * 몬스터파크는 계정 공유(shared)라 캐릭터 무관하게 한 줄이다. characterId 는 기록을 준 캐릭터.
 */
export interface CalTodo {
  characterId: number;
  kind: "boss" | "monpark" | "dailyquest";
  label: string;
  /** 계정 전체에 하나 (몬스터파크) */
  shared?: boolean;
  /** "3/5" 같은 진행 표기 */
  progress: string | null;
  /** kind=boss 일 때 아이콘용 */
  boss?: string;
  diff?: string;
  /** kind=boss 일 때 결정 분배 인원 */
  party?: number;
}

/** 월간 보스(검은 마법사) 상태. 등록한 캐릭터만 들어 있다 */
export interface CalMonthly {
  characterId: number;
  boss: string;
  diff: string;
  /** 이번 달 완료 여부 */
  completed: boolean;
}

export interface CalendarModel {
  /** 이번 주 시작(목요일) */
  weekStart: string;
  /** 이번 주 끝(수요일) */
  weekEnd: string;
  today: string;
  /** 목~수 7칸 */
  days: CalDay[];
  characters: CalChar[];
  /** 이번 주 남은 것 (오늘 기준, 최신 realtime 스냅샷) */
  todos: CalTodo[];
  /** 캐릭터별 월간 보스 상태 (등록한 캐릭터만) */
  monthly: CalMonthly[];
  /** 진행 중·예정 이벤트 (오늘 기준) */
  activeEvents: { noticeId: number; title: string; url: string; start: string | null; end: string | null; isSunday: boolean }[];
  /** 앞으로 30일 안 만료 */
  upcomingExpiries: (CalExpiry & { date: string })[];
}

/** 주 시작(목요일) → 그 주의 목~수 범위 */
export function weekRange(weekStart: string): { from: string; to: string } {
  const from = weekStartOf(weekStart); // 목요일이 아닌 날짜가 와도 그 주의 목요일로 맞춘다
  return { from, to: addDays(from, 6) };
}

export interface SnapshotLite {
  characterId: number;
  date: string;
  kind: "realtime" | "dated";
  bosses: BossClearRow[];
}

/**
 * 스냅샷 차분으로 "그날 잡은 보스" 를 만든다.
 *
 * dated 스냅샷은 그날 끝의 상태(그 주 누적)다. D 에 completed 인데 같은 주의 직전 스냅샷에서
 * 아니었으면 D 에 잡은 것. 주의 첫 스냅샷이면 그 이전 상태를 모르므로 completed 전부를
 * 그날로 친다 (목요일 리셋 직후라 대개 맞다). 같은 날 realtime 과 dated 가 같이 있으면 dated 우선.
 * 월간 보스는 주 리셋과 무관하므로 달 단위로 같은 논리를 적용한다.
 * 일간 보스는 뺀다 — 매일 도는 잡보스라 캘린더에 적을 가치가 없고 칸만 채운다.
 */
export function deriveDailyClears(snaps: SnapshotLite[], partyOf: (characterId: number, boss: string, diff: string) => number = () => 1): Map<string, CalClear[]> {
  const out = new Map<string, CalClear[]>();
  const byChar = new Map<number, SnapshotLite[]>();
  for (const s of snaps) (byChar.get(s.characterId) ?? byChar.set(s.characterId, []).get(s.characterId)!).push(s);

  for (const [characterId, list] of byChar) {
    // 날짜별 하나만: dated 우선
    const perDate = new Map<string, SnapshotLite>();
    for (const s of list) {
      const cur = perDate.get(s.date);
      if (!cur || (cur.kind === "realtime" && s.kind === "dated")) perDate.set(s.date, s);
    }
    const dates = [...perDate.keys()].sort();
    let prev: SnapshotLite | null = null;
    for (const d of dates) {
      const s = perDate.get(d)!;
      const prevSet = new Set<string>();
      if (prev) {
        const sameWeek = weekStartOf(prev.date) === weekStartOf(d);
        const sameMonth = prev.date.slice(0, 7) === d.slice(0, 7);
        for (const b of prev.bosses) {
          if (!b.completed) continue;
          const carry = b.cycle === "bossMonthly" ? sameMonth : b.cycle === "bossWeekly" ? sameWeek : prev.date === d;
          if (carry) prevSet.add(`${b.boss}|${b.diff}|${b.cycle}`);
        }
      }
      for (const b of s.bosses) {
        if (!b.completed || b.cycle === "bossDaily") continue;
        const k = `${b.boss}|${b.diff}|${b.cycle}`;
        if (prevSet.has(k)) continue;
        (out.get(d) ?? out.set(d, []).get(d)!).push({ characterId, boss: b.boss, diff: b.diff, cycle: b.cycle, party: Math.max(1, partyOf(characterId, b.boss, b.diff) || 1) });
      }
      prev = s;
    }
  }
  return out;
}

export interface PartyLite {
  id: number;
  name: string | null;
  boss: string;
  difficulty: string;
  dayOfWeek: number | null;
  hour: number | null;
  minute: number | null;
  repeats: boolean;
  weekStart: string | null;
  size: number;
  characterIds: number[];
}

/** 요일 있는 파티를 [from, to] 안의 날짜에 펼친다. 반복이 아니면 만든 주(목~수)에만. */
export function expandParties(parties: PartyLite[], from: string, to: string): Map<string, CalParty[]> {
  const out = new Map<string, CalParty[]>();
  for (const p of parties) {
    if (p.dayOfWeek == null) continue;
    let d = from;
    while (d <= to) {
      if (dayOfWeek(d) === p.dayOfWeek) {
        const ok = p.repeats || !p.weekStart || weekStartOf(d) === p.weekStart;
        if (ok) (out.get(d) ?? out.set(d, []).get(d)!).push({ partyId: p.id, name: p.name, boss: p.boss, diff: p.difficulty, hour: p.hour, minute: p.minute, size: p.size, characterIds: p.characterIds });
      }
      d = addDays(d, 1);
    }
  }
  for (const list of out.values()) list.sort((a, b) => (a.hour ?? 99) * 60 + (a.minute ?? 0) - ((b.hour ?? 99) * 60 + (b.minute ?? 0)));
  return out;
}

export interface ExpiryLite {
  characterId: number;
  source: ExpirySource;
  name: string;
  icon: string | null;
  expireAt: string;
}

export interface EventLite {
  noticeId: number;
  title: string;
  url: string;
  eventStart: string | null;
  eventEnd: string | null;
  isSunday: boolean;
}

export interface BuildInput {
  /** 이번 주 시작(목요일). 다른 요일이 와도 그 주의 목요일로 맞춘다 */
  weekStart: string;
  today: string;
  characters: CalChar[];
  snapshots: SnapshotLite[];
  parties: PartyLite[];
  expiries: ExpiryLite[];
  events: EventLite[];
  todos: CalTodo[];
  monthly?: CalMonthly[];
  /** 결정 분배 인원. 없으면 전부 1인 */
  partyOf?: (characterId: number, boss: string, diff: string) => number;
}

export function buildCalendar(input: BuildInput): CalendarModel {
  const { from, to } = weekRange(input.weekStart);
  const clears = deriveDailyClears(input.snapshots, input.partyOf);
  const parties = expandParties(input.parties, from, to);

  const expByDate = new Map<string, CalExpiry[]>();
  for (const e of input.expiries) {
    const d = kstDateOf(e.expireAt);
    if (d < from || d > to) continue;
    (expByDate.get(d) ?? expByDate.set(d, []).get(d)!).push({ characterId: e.characterId, source: e.source, name: e.name, icon: e.icon, time: new Date(Date.parse(e.expireAt) + 9 * 3600e3).toISOString().slice(11, 16) });
  }

  const evByDate = new Map<string, CalEvent[]>();
  const push = (d: string, ev: CalEvent) => {
    if (d < from || d > to) return;
    (evByDate.get(d) ?? evByDate.set(d, []).get(d)!).push(ev);
  };
  for (const e of input.events) {
    const s = e.eventStart ? kstDateOf(e.eventStart) : null;
    const en = e.eventEnd ? kstDateOf(e.eventEnd) : null;
    if (e.isSunday) {
      // 썬데이 메이플은 기간 안의 일요일마다 표시. 기간이 없으면 공지 다음 일요일.
      let d = s ?? en;
      const last = en ?? s;
      if (!d || !last) continue;
      while (d <= last) {
        if (dayOfWeek(d) === 0) push(d, { noticeId: e.noticeId, title: e.title, url: e.url, edge: "sunday" });
        d = addDays(d, 1);
      }
      continue;
    }
    if (s && en && s === en) push(s, { noticeId: e.noticeId, title: e.title, url: e.url, edge: "both" });
    else {
      if (s) push(s, { noticeId: e.noticeId, title: e.title, url: e.url, edge: "start" });
      if (en) push(en, { noticeId: e.noticeId, title: e.title, url: e.url, edge: "end" });
    }
  }

  const days: CalDay[] = [];
  for (let d = from; d <= to; d = addDays(d, 1)) {
    days.push({
      date: d,
      isToday: d === input.today,
      weeklyReset: dayOfWeek(d) === 4,
      monthlyReset: d.endsWith("-01"),
      clears: clears.get(d) ?? [],
      parties: parties.get(d) ?? [],
      expiries: expByDate.get(d) ?? [],
      events: evByDate.get(d) ?? [],
    });
  }

  const todayIso = input.today;
  const in30 = addDays(todayIso, 30);
  const upcomingExpiries = input.expiries
    .map((e) => ({ characterId: e.characterId, source: e.source, name: e.name, icon: e.icon, time: new Date(Date.parse(e.expireAt) + 9 * 3600e3).toISOString().slice(11, 16), date: kstDateOf(e.expireAt) }))
    .filter((e) => e.date >= todayIso && e.date <= in30)
    .sort((a, b) => (a.date + a.time < b.date + b.time ? -1 : 1));

  const activeEvents = input.events
    .filter((e) => {
      const s = e.eventStart ? kstDateOf(e.eventStart) : null;
      const en = e.eventEnd ? kstDateOf(e.eventEnd) : s;
      return !!s && (en ?? s) >= todayIso;
    })
    .map((e) => ({ noticeId: e.noticeId, title: e.title, url: e.url, start: e.eventStart ? kstDateOf(e.eventStart) : null, end: e.eventEnd ? kstDateOf(e.eventEnd) : null, isSunday: e.isSunday }))
    .sort((a, b) => ((a.end ?? "9") < (b.end ?? "9") ? -1 : 1));

  return { weekStart: from, weekEnd: to, today: input.today, days, characters: input.characters, todos: input.todos, monthly: input.monthly ?? [], activeEvents, upcomingExpiries };
}
