import "server-only";
import { and, eq, gte, inArray, isNull, lte } from "drizzle-orm";
import { db } from "@/lib/db";
import { characters, parties, partyMembers, schedulerSnapshots, type Character } from "@/lib/db/schema";
import { buildCalendar, weekRange, type CalTodo, type CalendarModel, type PartyLite, type SnapshotLite } from "@/lib/maple/calendar";
import { parseSnapshot, type RawScheduler } from "@/lib/maple/scheduler";
import { addDays, kstDateStr, thisWeekStartKst } from "@/lib/maple/kst";
import { isPartyExpired } from "@/lib/maple/partySchedule";
import { listOwnedCharacters } from "./characterSync";
import { latestSnapshotsFor } from "./snapshotService";
import { listExpiries } from "./itemExpiry";
import { listEventsBetween } from "./notices";
import { loadPlanConfig } from "./planInput";
import { partyPicksByCharacter } from "./partyLink";
import { bossKey, normalizeBossList } from "@/lib/maple/bossKey";
import { mergePicks } from "@/lib/maple/bossPicks";

/**
 * 결정 분배 인원 조회 함수. 내 캐릭터 화면과 같은 기준 — 직접 고른 보스의 인원(plan_configs)에
 * 파티 등록 인원을 합친다. 어느 쪽에도 없으면 월드 기본 인원, 그것도 없으면 1.
 */
async function partySizeResolver(userId: string, chars: Character[]): Promise<(characterId: number, boss: string, diff: string) => number> {
  const partyPicks = await partyPicksByCharacter(userId);
  const worlds = [...new Set(chars.map((c) => c.world).filter((w): w is string => !!w))];
  const cfgs = new Map(await Promise.all(worlds.map(async (w) => [w, await loadPlanConfig(userId, w)] as const)));
  const perChar = new Map<number, { merged: Record<string, { party: number }>; fallback: number }>();
  for (const c of chars) {
    const cfg = c.world ? cfgs.get(c.world) ?? null : null;
    const fallback = cfg?.default_party ?? 1;
    const saved = Object.fromEntries(normalizeBossList(cfg?.characters?.[c.ocid]?.bosses).map((b) => [b.key, b.party ?? fallback]));
    perChar.set(c.id, { merged: mergePicks(saved, partyPicks.get(c.id) ?? {}), fallback });
  }
  return (characterId, boss, diff) => {
    const e = perChar.get(characterId);
    if (!e) return 1;
    return e.merged[bossKey(boss, diff)]?.party ?? e.fallback;
  };
}

export interface AccountGroup {
  /** 넥슨 account_id. 예전 동기화로 비어 있으면 "" */
  id: string;
  label: string;
  characters: Character[];
}

/**
 * 유저 캐릭터를 넥슨 account_id 로 묶는다. 캐릭터가 많은 계정이 앞.
 * 라벨은 "계정 1, 2…" — account_id 는 긴 해시라 그대로 보여 줄 값이 아니다.
 */
export async function accountGroups(userId: string): Promise<AccountGroup[]> {
  const all = await listOwnedCharacters(userId, false);
  const map = new Map<string, Character[]>();
  for (const c of all) {
    const k = c.accountId ?? "";
    (map.get(k) ?? map.set(k, []).get(k)!).push(c);
  }
  return [...map.entries()]
    .sort((a, b) => b[1].length - a[1].length)
    .map(([id, chars], i) => ({ id, label: `계정 ${i + 1}`, characters: chars.sort((x, y) => (y.level ?? 0) - (x.level ?? 0)) }));
}

/** 몬스터파크: 하루 이 횟수 이상이면 끝난 것으로 본다 (계정 공유) */
const MONPARK_DAILY_DONE = 2;

/**
 * 이번 주 남은 것. 세 가지만 — 최신 realtime 스냅샷 기준.
 *  - 주간 보스: 등록했는데 안 잡은 것 (캐릭터별)
 *  - 몬스터파크: 계정 공유. 오늘 스냅샷 중 하나라도 now ≥ 2 면 완료. 오늘 스냅샷이 없으면 "기록 없음" 으로 남긴다
 *  - 일일 퀘스트: 오늘 스냅샷의 daily_contents 중 type=quest, 등록됨, 완료 아님 (캐릭터별)
 * 에픽 던전·기타 주간 콘텐츠는 뺐다 — 사용자가 챙기는 숙제가 아니다.
 */
async function collectTodos(chars: Character[], partyOf: (characterId: number, boss: string, diff: string) => number): Promise<CalTodo[]> {
  const snaps = await latestSnapshotsFor(chars.map((c) => c.id));
  const weekStart = thisWeekStartKst();
  const today = kstDateStr();
  const out: CalTodo[] = [];
  let monparkSeen = false;
  let monparkDone = false;
  let monparkBest: { characterId: number; now: number; max: number } | null = null;

  for (const c of chars) {
    const s = snaps.get(c.id);
    // 지난주 스냅샷은 이번 주 할 일을 말해 주지 않는다
    if (!s || s.weekStart !== weekStart) continue;
    const p = parseSnapshot(s.raw as RawScheduler);
    for (const b of p.bosses) {
      if (b.cycle !== "bossWeekly" || !b.registered || b.completed) continue;
      out.push({ characterId: c.id, kind: "boss", label: `${b.boss} ${b.diff}`, progress: null, boss: b.boss, diff: b.diff, party: Math.max(1, partyOf(c.id, b.boss, b.diff) || 1) });
    }
    // 일간은 오늘 찍힌 스냅샷일 때만 의미가 있다
    if (s.snapshotDate !== today) continue;
    for (const d of p.daily) {
      if (/몬스터\s*파크/.test(d.name) && d.kind !== "quest") {
        monparkSeen = true;
        if (d.now >= MONPARK_DAILY_DONE) monparkDone = true;
        if (!monparkBest || d.now > monparkBest.now) monparkBest = { characterId: c.id, now: d.now, max: d.max };
        continue;
      }
      if (d.kind !== "quest" || !d.registered || d.questState === "done") continue;
      out.push({ characterId: c.id, kind: "dailyquest", label: d.name.replace(/^\[[^\]]*\]\s*/, ""), progress: d.questState === "progress" ? "진행중" : null });
    }
  }

  if (!monparkDone) {
    const anchor = monparkBest?.characterId ?? chars[0]?.id;
    if (anchor != null) {
      out.unshift({
        characterId: anchor,
        kind: "monpark",
        shared: true,
        label: "몬스터파크",
        progress: monparkSeen ? `${monparkBest?.now ?? 0}/${MONPARK_DAILY_DONE}` : "오늘 기록 없음",
      });
    }
  }
  return out;
}

/** 계정 하나의 이번 주(목~수) 캘린더 모델 */
export async function buildAccountCalendar(userId: string, group: AccountGroup): Promise<CalendarModel> {
  const chars = group.characters;
  const ids = chars.map((c) => c.id);
  const weekStart = thisWeekStartKst();
  const { from, to } = weekRange(weekStart);
  // ISO 비교용 범위: KST 자정 기준으로 하루 여유
  const fromIso = new Date(Date.parse(`${addDays(from, -1)}T15:00:00Z`)).toISOString();
  const toIso = new Date(Date.parse(`${to}T15:00:00Z`)).toISOString();
  const partyOf = await partySizeResolver(userId, chars);

  const [snapRows, partyRows, expiries, events, todos] = await Promise.all([
    ids.length
      ? db
          .select({ characterId: schedulerSnapshots.characterId, snapshotDate: schedulerSnapshots.snapshotDate, kind: schedulerSnapshots.kind, raw: schedulerSnapshots.raw })
          .from(schedulerSnapshots)
          .where(and(inArray(schedulerSnapshots.characterId, ids), gte(schedulerSnapshots.snapshotDate, addDays(from, -7)), lte(schedulerSnapshots.snapshotDate, to)))
      : Promise.resolve([]),
    ids.length
      ? db
          .select({ p: parties, memberCharId: partyMembers.characterId })
          .from(partyMembers)
          .innerJoin(parties, eq(partyMembers.partyId, parties.id))
          .where(inArray(partyMembers.characterId, ids))
      : Promise.resolve([]),
    listExpiries(ids, fromIso, toIso),
    listEventsBetween(fromIso, toIso),
    collectTodos(chars, partyOf),
  ]);

  const snapshots: SnapshotLite[] = snapRows.map((r) => ({ characterId: r.characterId, date: r.snapshotDate, kind: r.kind, bosses: parseSnapshot(r.raw as RawScheduler).bosses }));

  // 파티별 인원(전체 구성원 수)과 이 계정 캐릭터 목록
  const partyIds = [...new Set(partyRows.map((r) => r.p.id))];
  const sizes = new Map<number, number>();
  if (partyIds.length) {
    const ms = await db.select({ partyId: partyMembers.partyId }).from(partyMembers).where(inArray(partyMembers.partyId, partyIds));
    for (const m of ms) sizes.set(m.partyId, (sizes.get(m.partyId) ?? 0) + 1);
  }
  const partyMap = new Map<number, PartyLite>();
  for (const r of partyRows) {
    if (isPartyExpired(r.p)) continue;
    const cur = partyMap.get(r.p.id) ?? {
      id: r.p.id,
      name: r.p.name,
      boss: r.p.boss,
      difficulty: r.p.difficulty,
      dayOfWeek: r.p.dayOfWeek,
      hour: r.p.hour,
      minute: r.p.minute,
      repeats: r.p.repeats,
      weekStart: r.p.weekStart,
      size: sizes.get(r.p.id) ?? 1,
      characterIds: [],
    };
    if (r.memberCharId != null && !cur.characterIds.includes(r.memberCharId)) cur.characterIds.push(r.memberCharId);
    partyMap.set(r.p.id, cur);
  }

  return buildCalendar({
    weekStart,
    today: kstDateStr(),
    characters: chars.map((c) => ({ id: c.id, name: c.name, imageUrl: c.imageUrl, level: c.level, cls: c.cls })),
    snapshots,
    parties: [...partyMap.values()],
    expiries: expiries.map((e) => ({ characterId: e.characterId, source: e.source, name: e.name, icon: e.icon, expireAt: e.expireAt })),
    events: events.map((e) => ({ noticeId: e.noticeId, title: e.title, url: e.url, eventStart: e.eventStart, eventEnd: e.eventEnd, isSunday: e.isSunday })),
    todos,
    partyOf,
  });
}

/** 유저의 캐릭터 중 만료 정보가 오래된 것 (갱신 대상 선별용) */
export async function staleExpiryCharacters(userId: string, accountId: string | null, staleMs: number): Promise<Character[]> {
  const rows = await db
    .select()
    .from(characters)
    .where(and(eq(characters.ownerUserId, userId), isNull(characters.supersededBy), eq(characters.hidden, false)));
  return rows.filter((c) => (accountId == null || (c.accountId ?? "") === accountId) && (!c.expiryFetchedAt || Date.now() - Date.parse(c.expiryFetchedAt) >= staleMs));
}
