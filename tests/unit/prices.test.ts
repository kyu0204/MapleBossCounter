import { describe, expect, it } from "vitest";
import { crystalPrice, crystalCycle, isWeeklyCrystal, priceChangeDates, weeklyCandidates } from "@/lib/maple/prices";
import { tierOf, tierLabel, TIER_MAP, GRADE_COLOR } from "@/lib/maple/tiers";
import { fmtPower } from "@/lib/maple/format";
import { parseBossKey, normalizeBossList } from "@/lib/maple/bossKey";
import { kstDateStr, weekStartOf, lastWednesdayKst, addDays } from "@/lib/maple/kst";

describe("crystalPrice", () => {
  it("날짜 분기: 9/17 전후", () => {
    expect(crystalPrice("듄켈", "hard", "2026-09-16")).toBe(94_400_000);
    expect(crystalPrice("듄켈", "hard", "2026-09-17")).toBe(89_600_000);
    expect(crystalPrice("스우", "hard", "2026-09-16")).toBe(51_500_000);
    expect(crystalPrice("스우", "hard", "2026-09-17")).toBe(48_900_000);
  });
  it("검은 마법사는 10/1 적용", () => {
    expect(crystalPrice("검은 마법사", "hard", "2026-09-30")).toBe(665_000_000);
    expect(crystalPrice("검은 마법사", "hard", "2026-10-01")).toBe(465_000_000);
  });
  it("고정가 / 미확인 / 없는 보스", () => {
    expect(crystalPrice("카링", "extreme", "2026-01-01")).toBe(5_387_000_000);
    expect(crystalPrice("매그너스", "normal", "2026-09-14")).toBe(1_160_000);
    expect(crystalPrice("혼테일", "chaos", "2026-09-14")).toBeNull();
    expect(crystalPrice("없는보스", "hard", "2026-09-14")).toBeNull();
  });
  it("변경 시점 목록", () => {
    expect(priceChangeDates()).toEqual(["2026-09-17", "2026-10-01"]);
  });
  it("weeklyCandidates 는 일간·월간 결정 제외", () => {
    const all = weeklyCandidates("2026-09-17");
    expect(all.length).toBeGreaterThan(40);
    expect(all.some((c) => c.boss === "검은 마법사")).toBe(false);
    expect(all.some((c) => c.boss === "매그너스" && c.diff === "normal")).toBe(false);
    expect(all.some((c) => c.boss === "매그너스" && c.diff === "hard")).toBe(true);
    expect(isWeeklyCrystal("자쿰", "chaos")).toBe(true);
    expect(isWeeklyCrystal("자쿰", "normal")).toBe(false);
    expect(crystalCycle("검은 마법사", "hard")).toBe("monthly");
    const only = weeklyCandidates("2026-09-17", new Set(["듄켈|hard"]));
    expect(only).toEqual([{ boss: "듄켈", diff: "hard", price: 89_600_000 }]);
  });
});

describe("tiers", () => {
  it("rank 계산", () => {
    expect(tierOf("카링", "extreme")).toMatchObject({ grade: "금", stars: 9, rank: 32 });
    expect(tierOf("자쿰", "easy")).toMatchObject({ grade: "납", stars: 1, rank: 1 });
    expect(tierOf("선택받은 세렌", "hard")).toMatchObject({ grade: "은", stars: 9, rank: 23 });
    expect(tierOf("찬란한 흉성", "normal")!.rank).toBeLessThan(tierOf("카링", "normal")!.rank);
    expect(tierOf("스우", "extreme")!.rank).toBe(tierOf("찬란한 흉성", "normal")!.rank);
  });
  it("텍스트 라벨에 등급 이름이 없고 별 개수로만 표시된다", () => {
    // 등급은 이름 대신 색(UI) / 원형 이모지(텍스트)로만 구분한다
    expect(tierLabel(tierOf("듄켈", "hard"))).toBe("⚪★★★★★");
    expect(tierLabel(tierOf("카링", "extreme"))).toBe("🟡" + "★".repeat(9));
    expect(tierLabel(tierOf("자쿰", "easy"))).toBe("⚫★");
    expect(tierLabel(null)).toBe("티어없음");
    for (const t of Object.values(TIER_MAP)) expect(tierLabel(t)).not.toMatch(/금|은|동|납/);
    expect(tierOf("없는보스", "hard")).toBeNull();
    expect(Object.keys(TIER_MAP).length).toBeGreaterThanOrEqual(80);
  });
  it("등급마다 색이 다르다", () => {
    const colors = new Set(Object.values(GRADE_COLOR));
    expect(colors.size).toBe(4);
    expect(GRADE_COLOR[tierOf("카링", "extreme")!.grade]).toBe(GRADE_COLOR["금"]);
    expect(GRADE_COLOR[tierOf("듄켈", "hard")!.grade]).toBe(GRADE_COLOR["은"]);
  });
});

describe("format", () => {
  it("fmtPower", () => {
    expect(fmtPower(156_920_000)).toBe("1억 5692만");
    expect(fmtPower(89_600_000)).toBe("8960만");
    expect(fmtPower(5_387_000_000)).toBe("53억 8700만");
    expect(fmtPower(100_000_000)).toBe("1억");
    expect(fmtPower(999)).toBe("999");
    expect(fmtPower(null)).toBe("-");
  });
});

describe("bossKey", () => {
  it("parse", () => {
    expect(parseBossKey("진 힐라 hard")).toEqual({ boss: "진 힐라", diff: "hard" });
    expect(parseBossKey("선택받은 세렌 extreme")).toEqual({ boss: "선택받은 세렌", diff: "extreme" });
    expect(parseBossKey("듄켈")).toBeNull();
    expect(parseBossKey("듄켈 ultra")).toBeNull();
  });
  it("normalizeBossList 세 표기", () => {
    expect(normalizeBossList(["듄켈 hard"])).toMatchObject([{ key: "듄켈 hard", party: null }]);
    expect(normalizeBossList([{ boss: "듄켈 hard", party: 2 }])).toMatchObject([{ key: "듄켈 hard", party: 2 }]);
    expect(normalizeBossList({ "듄켈 hard": 3 })).toMatchObject([{ key: "듄켈 hard", party: 3 }]);
    expect(normalizeBossList(undefined)).toEqual([]);
  });
});

describe("kst", () => {
  it("weekStartOf: 목요일 기준", () => {
    expect(weekStartOf("2026-09-14")).toBe("2026-09-10"); // 월 → 지난 목
    expect(weekStartOf("2026-09-10")).toBe("2026-09-10"); // 목 자신
    expect(weekStartOf("2026-09-09")).toBe("2026-09-03"); // 수 → 전주 목
  });
  it("lastWednesdayKst / kstDateStr 고정 시각", () => {
    const monKst = Date.parse("2026-09-14T03:00:00+09:00");
    expect(kstDateStr(0, monKst)).toBe("2026-09-14");
    expect(kstDateStr(-1, monKst)).toBe("2026-09-13");
    expect(lastWednesdayKst(monKst)).toBe("2026-09-09");
    const thuKst = Date.parse("2026-09-17T01:00:00+09:00");
    expect(lastWednesdayKst(thuKst)).toBe("2026-09-16");
    expect(addDays("2026-09-30", 1)).toBe("2026-10-01");
  });
});
