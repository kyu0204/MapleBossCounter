import { describe, expect, it } from "vitest";
import { buildCalendar, deriveDailyClears, expandParties, weekRange, type SnapshotLite } from "@/lib/maple/calendar";
import { collectExpiries } from "@/lib/maple/expiry";
import { isSundayMaple, parseEventNotices } from "@/lib/maple/notices";
import { parseNexonDate, kstDateOf } from "@/lib/maple/nexonDate";
import type { BossClearRow } from "@/lib/maple/scheduler";

const row = (boss: string, diff: string, completed: boolean, cycle: BossClearRow["cycle"] = "bossWeekly"): BossClearRow => ({
  boss,
  diff: diff as BossClearRow["diff"],
  cycle,
  registered: true,
  completed,
  order: 0,
  tier: null,
});

describe("nexonDate", () => {
  it("+09:00 / 오프셋 없음 / expired / null", () => {
    expect(parseNexonDate("2026-09-17T00:00+09:00")).toBe("2026-09-16T15:00:00.000Z");
    expect(parseNexonDate("2026-09-17T09:00")).toBe("2026-09-17T00:00:00.000Z");
    expect(parseNexonDate("expired")).toBeNull();
    expect(parseNexonDate(null)).toBeNull();
    expect(kstDateOf("2026-09-16T15:00:00.000Z")).toBe("2026-09-17");
  });
});

describe("weekRange", () => {
  it("목요일부터 수요일까지, 다른 요일이 와도 그 주의 목요일로 맞춘다", () => {
    expect(weekRange("2026-09-17")).toEqual({ from: "2026-09-17", to: "2026-09-23" }); // 목
    expect(weekRange("2026-09-20")).toEqual({ from: "2026-09-17", to: "2026-09-23" }); // 일
    expect(weekRange("2026-09-23")).toEqual({ from: "2026-09-17", to: "2026-09-23" }); // 수
    expect(weekRange("2026-10-03")).toEqual({ from: "2026-10-01", to: "2026-10-07" }); // 달을 넘긴 주
  });
});

describe("deriveDailyClears", () => {
  it("같은 주 안에서는 차분, 주가 바뀌면 다시 셈, dated 가 realtime 보다 우선", () => {
    const snaps: SnapshotLite[] = [
      // 2026-09-17 목 (주 시작)
      { characterId: 1, date: "2026-09-17", kind: "dated", bosses: [row("스우", "hard", true), row("데미안", "hard", false)] },
      { characterId: 1, date: "2026-09-18", kind: "realtime", bosses: [row("스우", "hard", true), row("데미안", "hard", true)] },
      { characterId: 1, date: "2026-09-18", kind: "dated", bosses: [row("스우", "hard", true), row("데미안", "hard", true), row("루시드", "hard", true)] },
      // 다음 주 목요일: 스우 다시 잡음
      { characterId: 1, date: "2026-09-24", kind: "dated", bosses: [row("스우", "hard", true)] },
    ];
    const m = deriveDailyClears(snaps);
    expect(m.get("2026-09-17")?.map((c) => c.boss)).toEqual(["스우"]);
    expect(m.get("2026-09-18")?.map((c) => c.boss).sort()).toEqual(["데미안", "루시드"]);
    expect(m.get("2026-09-24")?.map((c) => c.boss)).toEqual(["스우"]);
  });

  it("월간 보스는 달이 바뀌어야 다시 센다", () => {
    const snaps: SnapshotLite[] = [
      { characterId: 2, date: "2026-09-20", kind: "dated", bosses: [row("검은 마법사", "hard", true, "bossMonthly")] },
      { characterId: 2, date: "2026-09-24", kind: "dated", bosses: [row("검은 마법사", "hard", true, "bossMonthly")] }, // 새 주지만 같은 달
      { characterId: 2, date: "2026-10-01", kind: "dated", bosses: [row("검은 마법사", "hard", true, "bossMonthly")] },
    ];
    const m = deriveDailyClears(snaps);
    expect(m.get("2026-09-20")?.length).toBe(1);
    expect(m.get("2026-09-24")).toBeUndefined();
    expect(m.get("2026-10-01")?.length).toBe(1);
  });
});

describe("expandParties", () => {
  it("반복 파티는 매주, 이번 주만 파티는 그 주(목~수)에만", () => {
    const m = expandParties(
      [
        { id: 1, name: null, boss: "스우", difficulty: "hard", dayOfWeek: 4, hour: 21, minute: 0, repeats: true, weekStart: "2026-09-10", size: 3, characterIds: [1] },
        { id: 2, name: "한번", boss: "루시드", difficulty: "hard", dayOfWeek: 6, hour: null, minute: null, repeats: false, weekStart: "2026-09-17", size: 2, characterIds: [1] },
        { id: 3, name: "요일없음", boss: "윌", difficulty: "hard", dayOfWeek: null, hour: null, minute: null, repeats: true, weekStart: null, size: 2, characterIds: [1] },
      ],
      "2026-09-01",
      "2026-09-30",
    );
    const thursdays = [...m.entries()].filter(([, v]) => v.some((p) => p.partyId === 1)).map(([d]) => d);
    expect(thursdays).toEqual(["2026-09-03", "2026-09-10", "2026-09-17", "2026-09-24"]);
    const once = [...m.entries()].filter(([, v]) => v.some((p) => p.partyId === 2)).map(([d]) => d);
    expect(once).toEqual(["2026-09-19"]); // 09-17(목) 주의 토요일
    expect([...m.values()].flat().some((p) => p.partyId === 3)).toBe(false);
  });
});

describe("collectExpiries", () => {
  it("캐시·펫·안드로이드·장비·칭호에서 만료일만, 중복 제거, 옵션 만료 분리", () => {
    const rows = collectExpiries({
      cash: {
        cash_item_equipment_base: [
          { cash_item_equipment_slot: "모자", cash_item_name: "펫 모자", date_expire: "2026-10-01T00:00+09:00", date_option_expire: null },
          { cash_item_equipment_slot: "라벨", cash_item_name: "라벨링", date_expire: null, date_option_expire: "2026-10-05T00:00+09:00" },
          { cash_item_equipment_slot: "영구", cash_item_name: "영구템", date_expire: null },
          { cash_item_equipment_slot: "만료", cash_item_name: "만료템", date_expire: "expired" },
        ],
        cash_item_equipment_preset_1: [{ cash_item_equipment_slot: "모자", cash_item_name: "펫 모자", date_expire: "2026-10-01T00:00+09:00" }],
      },
      pet: { pet_1_name: "루나", pet_1_date_expire: "2026-11-01T00:00+09:00", pet_2_name: "영구펫", pet_2_date_expire: null },
      android: { android_cash_item_equipment: [{ cash_item_name: "안드 옷", date_expire: "2026-09-30T00:00+09:00" }] },
      equip: { item_equipment: [{ item_equipment_slot: "무기", item_name: "기간제 무기", date_expire: "2026-12-31T23:59+09:00" }], title: { title_name: "칭호A", date_expire: "2026-10-10T00:00+09:00" } },
    });
    expect(rows.map((r) => `${r.source}:${r.name}`)).toEqual(["android:안드 옷", "cash:펫 모자", "cash:라벨링 (옵션)", "title:칭호A", "pet:루나", "equip:기간제 무기"]);
    expect(rows[1].expireAt).toBe("2026-09-30T15:00:00.000Z");
  });
});

describe("notices", () => {
  it("썬데이 판정과 파싱", () => {
    expect(isSundayMaple("[이벤트] 썬데이 메이플 (9/28)")).toBe(true);
    expect(isSundayMaple("스페셜 썬데이 메이플")).toBe(true);
    expect(isSundayMaple("코인샵 오픈")).toBe(false);
    const ev = parseEventNotices({
      event_notice: [
        { title: "썬데이 메이플", url: "https://x/1", notice_id: 1, date: "2026-09-25T10:00+09:00", date_event_start: "2026-09-27T00:00+09:00", date_event_end: "2026-09-27T23:59+09:00" },
        { title: "가을 이벤트", url: "https://x/2", notice_id: 2, date: null, date_event_start: "2026-09-10T00:00+09:00", date_event_end: "2026-10-07T23:59+09:00" },
        { title: "깨진", url: "", notice_id: 3 },
      ],
    });
    expect(ev.map((e) => e.noticeId)).toEqual([1, 2]);
    expect(ev[0].isSunday).toBe(true);
  });
});

describe("buildCalendar", () => {
  it("이번 주 목~수 7칸: 리셋 표시, 이벤트 시작·종료, 썬데이, 만료, 30일 내 만료·진행 중 이벤트", () => {
    const model = buildCalendar({
      weekStart: "2026-09-17",
      today: "2026-09-20",
      characters: [{ id: 1, name: "알전임", imageUrl: null, level: 287, cls: "아크메이지" }],
      snapshots: [{ characterId: 1, date: "2026-09-17", kind: "dated", bosses: [row("스우", "hard", true)] }],
      parties: [],
      expiries: [
        { characterId: 1, source: "cash", name: "이번주만료", icon: null, expireAt: "2026-09-21T15:00:00.000Z" }, // KST 09-22 00:00
        { characterId: 1, source: "cash", name: "곧만료", icon: null, expireAt: "2026-09-29T15:00:00.000Z" }, // KST 09-30 — 주 밖, 30일 안
        { characterId: 1, source: "pet", name: "먼만료", icon: null, expireAt: "2026-12-01T00:00:00.000Z" },
      ],
      events: [
        { noticeId: 1, title: "썬데이 메이플", url: "u1", eventStart: "2026-09-19T15:00:00.000Z", eventEnd: "2026-09-20T14:59:00.000Z", isSunday: true },
        { noticeId: 2, title: "가을 이벤트", url: "u2", eventStart: "2026-09-16T15:00:00.000Z", eventEnd: "2026-09-22T14:59:00.000Z", isSunday: false },
        { noticeId: 3, title: "지난주 이벤트", url: "u3", eventStart: "2026-09-09T15:00:00.000Z", eventEnd: "2026-09-15T14:59:00.000Z", isSunday: false },
      ],
      todos: [],
    });
    const days = model.days;
    const at = (d: string) => days.find((x) => x.date === d)!;
    expect(model.weekStart).toBe("2026-09-17");
    expect(model.weekEnd).toBe("2026-09-23");
    expect(days.map((d) => d.date)).toEqual(["2026-09-17", "2026-09-18", "2026-09-19", "2026-09-20", "2026-09-21", "2026-09-22", "2026-09-23"]);
    expect(at("2026-09-17").weeklyReset).toBe(true);
    expect(days.filter((d) => d.weeklyReset).length).toBe(1);
    expect(at("2026-09-17").clears.map((c) => c.boss)).toEqual(["스우"]);
    expect(at("2026-09-20").events[0].edge).toBe("sunday");
    expect(at("2026-09-17").events[0].edge).toBe("start");
    expect(at("2026-09-22").events[0].edge).toBe("end");
    expect(at("2026-09-22").expiries.map((e) => e.name)).toEqual(["이번주만료"]);
    // 주 밖 만료는 칸에는 없고 30일 목록에는 있다
    expect(model.upcomingExpiries.map((e) => e.name)).toEqual(["이번주만료", "곧만료"]);
    // 지난주에 끝난 이벤트는 진행 중 목록에서 빠진다
    expect(model.activeEvents.map((e) => e.noticeId)).toEqual([1, 2]);
    expect(at("2026-09-20").isToday).toBe(true);
  });

  it("달을 넘기는 주에는 월간 리셋 칸이 생긴다", () => {
    const model = buildCalendar({ weekStart: "2026-10-01", today: "2026-10-02", characters: [], snapshots: [], parties: [], expiries: [], events: [], todos: [] });
    expect(model.days[0].monthlyReset).toBe(true);
    expect(model.days[0].weeklyReset).toBe(true);
  });
});

describe("deriveDailyClears — 일간 제외·인원", () => {
  it("일간 보스는 빠지고, partyOf 로 분배 인원이 붙는다", () => {
    const m = deriveDailyClears(
      [{ characterId: 1, date: "2026-09-24", kind: "dated", bosses: [row("스우", "hard", true), row("피에르", "normal", true, "bossDaily"), row("검은 마법사", "hard", true, "bossMonthly")] }],
      (_id, boss) => (boss === "스우" ? 3 : 1),
    );
    const list = m.get("2026-09-24")!;
    expect(list.map((c) => c.boss)).toEqual(["스우", "검은 마법사"]);
    expect(list[0].party).toBe(3);
    expect(list[1].party).toBe(1);
  });
});
