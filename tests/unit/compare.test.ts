import { describe, expect, it } from "vitest";
import { compareRow, compareRows, itemsIn } from "@/lib/maple/compare";
import { crystalPrice } from "@/lib/maple/prices";

const DATE = "2026-09-17";

describe("한 보스의 값어치", () => {
  it("값을 하나도 안 매기면 결정만 남는다", () => {
    const r = compareRow("유피테르", "hard", 1, DATE, {});
    expect(r.crystal).toBe(crystalPrice("유피테르", "hard", DATE));
    expect(r.fixedValue).toBe(0);
    expect(r.randomValue).toBe(0);
    expect(r.total).toBe(r.crystal);
    expect(r.hasUnpriced).toBe(true);
  });

  it("결정은 인원수로 나뉜다", () => {
    const solo = compareRow("유피테르", "hard", 1, DATE, {});
    const duo = compareRow("유피테르", "hard", 2, DATE, {});
    expect(duo.crystal).toBe(Math.floor(solo.crystal! / 2));
  });

  it("확정 보상은 수량 × 단가", () => {
    // 솔 에르다의 기운은 각자에게 들어와 인원수로 안 나뉜다
    const r = compareRow("유피테르", "hard", 1, DATE, { "솔 에르다의 기운": { meso: 100 } });
    const sol = r.fixed.find((l) => l.name === "솔 에르다의 기운")!;
    expect(sol.value).toBe(sol.amount * 100);
    expect(sol.unpriced).toBe(false);
  });

  it("안 나뉘는 확정 보상은 인원이 늘어도 수량이 그대로다", () => {
    const solo = compareRow("유피테르", "hard", 1, DATE, {});
    const duo = compareRow("유피테르", "hard", 2, DATE, {});
    const amt = (r: typeof solo) => r.fixed.find((l) => l.name === "솔 에르다의 기운")!.amount;
    expect(amt(duo)).toBe(amt(solo));
  });

  it("조각·큐브는 인원수로 나뉜 뒤 곱해진다", () => {
    const solo = compareRow("루시드", "hard", 1, DATE, { "메멘토 실버 큐브": { meso: 1000 } });
    const duo = compareRow("루시드", "hard", 2, DATE, { "메멘토 실버 큐브": { meso: 1000 } });
    const s = solo.fixed.find((l) => l.name === "메멘토 실버 큐브")!;
    const d = duo.fixed.find((l) => l.name === "메멘토 실버 큐브")!;
    // 1개짜리는 2인격이면 0개 (나눠 떨어지지 않으면 못 받는다)
    expect(s.amount).toBe(1);
    expect(d.amount).toBe(0);
    expect(d.value).toBe(0);
  });

  it("랜덤은 단가 × 확률이 기대값이다", () => {
    const r = compareRow("유피테르", "hard", 1, DATE, { "4단계 소울 에테르": { meso: 1_000_000_000, chance: 5 } });
    const soul = r.random.find((l) => l.name === "4단계 소울 에테르")!;
    expect(soul.value).toBe(50_000_000);
    expect(soul.unpriced).toBe(false);
  });

  it("확률만 넣거나 단가만 넣으면 기대값은 0이고 미입력으로 남는다", () => {
    const onlyPrice = compareRow("유피테르", "hard", 1, DATE, { "4단계 소울 에테르": { meso: 1_000_000_000 } });
    const onlyChance = compareRow("유피테르", "hard", 1, DATE, { "4단계 소울 에테르": { chance: 5 } });
    for (const r of [onlyPrice, onlyChance]) {
      const soul = r.random.find((l) => l.name === "4단계 소울 에테르")!;
      expect(soul.value).toBe(0);
      expect(soul.unpriced).toBe(true);
    }
  });

  it("랜덤은 수량을 곱하지 않는다 (떴을 때 개수 × 회당 확률은 이중 계산)", () => {
    const r = compareRow("유피테르", "hard", 1, DATE, { "4단계 소울 에테르": { meso: 100, chance: 100 } });
    const soul = r.random.find((l) => l.name === "4단계 소울 에테르")!;
    expect(soul.value).toBe(100);
  });

  it("가격표에 없는 보스는 결정이 null 이고 합계에서 0으로 친다", () => {
    const r = compareRow("시즌 보스 메이린", "hard", 1, DATE, {});
    expect(r.crystal).toBeNull();
    expect(r.total).toBe(r.fixedValue + r.randomValue);
  });
});

describe("비교표 정렬", () => {
  const picks = [
    { boss: "유피테르", diff: "hard", party: 1 },
    { boss: "루시드", diff: "hard", party: 1 },
    { boss: "카링", diff: "normal", party: 1 },
  ];

  it("기본은 합계 내림차순", () => {
    const rows = compareRows(picks, DATE, {});
    for (let i = 1; i < rows.length; i++) expect(rows[i - 1].total).toBeGreaterThanOrEqual(rows[i].total);
  });

  it("랜덤 기준으로 바꾸면 기대값 높은 쪽이 앞에 온다", () => {
    const values = { "4단계 소울 에테르": { meso: 1_000_000_000, chance: 10 } };
    const rows = compareRows(picks, DATE, values, "random");
    expect(rows[0].boss).toBe("유피테르");
  });

  it("같은 값이면 이름순이라 순서가 흔들리지 않는다", () => {
    const a = compareRows(picks, DATE, {}, "random");
    const b = compareRows([...picks].reverse(), DATE, {}, "random");
    expect(a.map((r) => r.boss)).toEqual(b.map((r) => r.boss));
  });
});

describe("값 입력 칸에 쓸 아이템 목록", () => {
  it("확정·랜덤 여부를 표시한다", () => {
    const items = itemsIn([{ boss: "유피테르", diff: "hard" }], DATE);
    const sol = items.find((i) => i.name === "솔 에르다의 기운");
    const soul = items.find((i) => i.name === "4단계 소울 에테르");
    expect(sol?.asFixed).toBe(true);
    expect(soul?.asRandom).toBe(true);
    expect(soul?.asFixed).toBe(false);
  });

  it("여러 보스에 걸쳐도 아이템은 한 번만 나온다", () => {
    const items = itemsIn(
      [
        { boss: "유피테르", diff: "hard" },
        { boss: "림보", diff: "hard" },
      ],
      DATE,
    );
    const names = items.map((i) => i.name);
    expect(new Set(names).size).toBe(names.length);
  });
});
