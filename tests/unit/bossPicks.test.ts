import { describe, expect, it } from "vitest";
import { mergePicks, picksTotals, splitByCleared, sortKeysByTier, toPickList } from "@/lib/maple/bossPicks";
import { crystalPrice } from "@/lib/maple/prices";

const DATE = "2026-09-15";
const names = (list: { key: string }[]) => list.map((p) => p.key);

describe("직접 고른 픽 + 파티 유래 픽 합치기", () => {
  it("파티 유래는 따라 들어오고 출처가 구분된다", () => {
    const m = mergePicks({ "유피테르 hard": 2 }, { "카링 normal": 3 });
    expect(m["유피테르 hard"]).toEqual({ party: 2, source: "config" });
    expect(m["카링 normal"]).toEqual({ party: 3, source: "party" });
  });

  it("같은 보스를 양쪽에서 고르면 직접 고른 쪽이 이긴다", () => {
    // 캐릭터·보스당 난이도는 하나여야 하므로 파티 유래 노멀은 버린다
    const m = mergePicks({ "카링 hard": 1 }, { "카링 normal": 4 });
    expect(Object.keys(m)).toEqual(["카링 hard"]);
    expect(m["카링 hard"].source).toBe("config");
  });

  it("빈 입력이면 빈 결과", () => {
    expect(mergePicks({}, {})).toEqual({});
  });
});

describe("정렬과 합계", () => {
  it("티어 높은 보스가 앞에 온다", () => {
    const sorted = sortKeysByTier(["스우 normal", "유피테르 hard", "진 힐라 hard"]);
    expect(sorted[0]).toBe("유피테르 hard"); // 금별 9티어
    expect(sorted[sorted.length - 1]).toBe("스우 normal"); // 동별 5티어
  });

  it("실수령은 인원으로 나눈 값의 합, 정가 합은 나누지 않는다", () => {
    const list = toPickList(mergePicks({ "유피테르 hard": 2, "카링 normal": 1 }, {}));
    const t = picksTotals(list, DATE);
    const jupiter = crystalPrice("유피테르", "hard", DATE)!;
    const karing = crystalPrice("카링", "normal", DATE)!;
    expect(t.count).toBe(2);
    expect(t.gross).toBe(jupiter + karing);
    expect(t.value).toBe(Math.floor(jupiter / 2) + karing);
  });

  it("가격이 없는 보스는 합계에서 빠지지만 개수에는 남는다", () => {
    const list = toPickList(mergePicks({ "시즌 보스 메이린 hard": 1 }, {}));
    const t = picksTotals(list, DATE);
    expect(t.count).toBe(1);
    expect(t.gross).toBe(0);
  });
});

describe("이번 주 갈 보스 — 간 것과 안 간 것", () => {
  const list = toPickList(mergePicks({ "유피테르 hard": 1, "카링 normal": 1, "진 힐라 hard": 1 }, {}));

  it("클리어한 보스는 남은 목록에서 빠진다", () => {
    const { remaining, done } = splitByCleared(list, ["카링 normal"]);
    expect(names(done)).toEqual(["카링 normal"]);
    expect(names(remaining)).not.toContain("카링 normal");
    expect(remaining.length + done.length).toBe(list.length);
  });

  it("클리어 기록이 없으면 전부 남는다", () => {
    const { remaining, done } = splitByCleared(list, []);
    expect(remaining.length).toBe(3);
    expect(done).toEqual([]);
  });

  it("전부 클리어하면 남은 것이 없다", () => {
    const { remaining, done } = splitByCleared(list, names(list));
    expect(remaining).toEqual([]);
    expect(done.length).toBe(3);
  });

  it("고르지 않은 보스를 클리어해도 목록에 끼어들지 않는다", () => {
    const { remaining, done } = splitByCleared(list, ["스우 hard"]);
    expect(remaining.length).toBe(3);
    expect(done).toEqual([]);
  });

  it("남은 것만의 실수령은 전체보다 작거나 같다", () => {
    const { remaining } = splitByCleared(list, ["유피테르 hard"]);
    expect(picksTotals(remaining, DATE).value).toBeLessThan(picksTotals(list, DATE).value);
  });
});
