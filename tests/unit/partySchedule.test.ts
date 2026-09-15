import { describe, expect, it } from "vitest";
import { scheduleLabel, isPartyExpired, DAY_LABEL, DAY_ORDER } from "@/lib/maple/partySchedule";

describe("파티 일정 표기", () => {
  it("요일과 시각을 따로 비워도 된다", () => {
    expect(scheduleLabel({ dayOfWeek: 4, hour: 21, minute: 0 })).toBe("목 21:00");
    expect(scheduleLabel({ dayOfWeek: 4, hour: 9, minute: 5 })).toBe("목 09:05");
    expect(scheduleLabel({ dayOfWeek: 4, hour: null, minute: null })).toBe("목요일");
    expect(scheduleLabel({ dayOfWeek: null, hour: 21, minute: 30 })).toBe("21:30");
    expect(scheduleLabel({ dayOfWeek: null, hour: null, minute: null })).toBeNull();
  });

  it("시를 안 정하면 분만으로는 시각을 만들지 않는다", () => {
    // 분 단독은 뜻이 없다. 폼에서도 저장할 때 같이 버린다.
    expect(scheduleLabel({ dayOfWeek: null, hour: null, minute: 30 })).toBeNull();
    expect(scheduleLabel({ dayOfWeek: 1, hour: null, minute: 30 })).toBe("월요일");
  });

  it("분을 비우면 정각으로 본다", () => {
    expect(scheduleLabel({ dayOfWeek: null, hour: 22, minute: null })).toBe("22:00");
  });

  it("요일 버튼은 주간 리셋(목)부터 늘어놓는다", () => {
    expect(DAY_ORDER.map((d) => DAY_LABEL[d])).toEqual(["목", "금", "토", "일", "월", "화", "수"]);
    expect(new Set(DAY_ORDER).size).toBe(7);
  });
});

describe("일회성 파티 만료", () => {
  // 주간 리셋은 목 00:00 KST. 2026-09-10 과 2026-09-17 이 목요일이다.
  const thisWeek = Date.parse("2026-09-15T12:00:00+09:00"); // 주 시작 2026-09-10

  it("반복 파티는 만료되지 않는다", () => {
    expect(isPartyExpired({ repeats: true, weekStart: "2026-09-03" }, thisWeek)).toBe(false);
  });

  it("이번 주에 만든 일회성 파티는 살아 있다", () => {
    expect(isPartyExpired({ repeats: false, weekStart: "2026-09-10" }, thisWeek)).toBe(false);
  });

  it("지난 주 일회성 파티는 만료된다", () => {
    expect(isPartyExpired({ repeats: false, weekStart: "2026-09-03" }, thisWeek)).toBe(true);
  });

  it("주간 리셋 직전과 직후에 갈린다", () => {
    const beforeReset = Date.parse("2026-09-16T23:59:00+09:00"); // 아직 이번 주
    const afterReset = Date.parse("2026-09-17T00:01:00+09:00"); // 새 주
    expect(isPartyExpired({ repeats: false, weekStart: "2026-09-10" }, beforeReset)).toBe(false);
    expect(isPartyExpired({ repeats: false, weekStart: "2026-09-10" }, afterReset)).toBe(true);
  });

  it("주 정보가 없는 옛 데이터는 살아 있는 것으로 본다", () => {
    // 만료 판정 근거가 없는데 지워 버리면 예전 파티가 조용히 사라진다
    expect(isPartyExpired({ repeats: false, weekStart: null }, thisWeek)).toBe(false);
  });
});
