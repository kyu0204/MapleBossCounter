import { describe, expect, it } from "vitest";
import { allBoxContentNames, boxInfo, boxValueOf } from "@/lib/maple/boxes";
import { compareRow } from "@/lib/maple/compare";
import { marketPriceOf } from "@/lib/maple/itemPrices";

const DATE = "2026-09-18";

describe("상자 구성", () => {
  it("에테르넬 상자는 직업군 5개를 곱해 펼친다", () => {
    const box = boxInfo("갈망의 에테르넬 방어구 상자")!;
    // 장갑·신발·망토 3부위 × 5직업군
    expect(box.contents).toHaveLength(15);
    expect(box.contents.map((c) => c.name)).toContain("에테르넬 파이렛글러브");
    expect(box.kind).toBe("choice");
  });

  it("상자마다 고를 수 있는 부위가 다르다", () => {
    const upper = boxInfo("의지의 에테르넬 방어구 상자")!;
    expect(upper.contents.map((c) => c.name)).toContain("에테르넬 나이트헬름");
    expect(upper.contents.map((c) => c.name)).not.toContain("에테르넬 나이트글러브");
  });

  it("고를 수 있는 상자는 구성품 최고가가 상자 값이다", () => {
    const box = boxInfo("갈망의 에테르넬 방어구 상자")!;
    expect(boxValueOf("갈망의 에테르넬 방어구 상자")).toBe(box.max);
    expect(box.max).toBeGreaterThan(0);
  });

  it("못 고르는 상자는 값을 세우지 않는다", () => {
    // 칠흑 상자는 13억짜리부터 52억짜리까지 나온다. 하나를 고르면 그게 곧 추측이다.
    expect(boxValueOf("혼돈의 칠흑 장신구 상자")).toBeNull();
    const box = boxInfo("혼돈의 칠흑 장신구 상자")!;
    expect(box.kind).toBe("random");
    expect(box.max).toBeGreaterThan(box.min!);
  });

  it("반지 상자는 시세가 잡히는 두 반지만 들고 있다", () => {
    const box = boxInfo("생명의 보스 반지 상자")!;
    expect(box.contents.map((c) => c.name)).toEqual(["리스트레인트 링", "컨티뉴어스 링"]);
    expect(box.unknownCount).toBe(0);
  });

  it("상자가 아니면 null", () => {
    expect(boxInfo("루즈 컨트롤 머신 마크")).toBeNull();
    expect(boxValueOf("루즈 컨트롤 머신 마크")).toBeNull();
  });

  it("구성품 시세는 전부 받아 둬야 한다", () => {
    const missing = allBoxContentNames().filter((n) => marketPriceOf(n) == null);
    expect(missing).toEqual([]);
  });
});

describe("상자가 붙은 보상 줄", () => {
  it("고를 수 있는 상자는 단가가 서고 출처가 box 다", () => {
    // 유피테르 하드: 갈망의 에테르넬 방어구 상자
    const r = compareRow("유피테르", "hard", 1, DATE, {});
    const l = r.random.find((x) => x.name === "갈망의 에테르넬 방어구 상자")!;
    expect(l.priceFrom).toBe("box");
    expect(l.unitPrice).toBe(boxValueOf("갈망의 에테르넬 방어구 상자"));
  });

  it("직접 넣은 값이 상자 값을 이긴다", () => {
    const r = compareRow("유피테르", "hard", 1, DATE, { "갈망의 에테르넬 방어구 상자": { meso: 7, chance: 100 } });
    const l = r.random.find((x) => x.name === "갈망의 에테르넬 방어구 상자")!;
    expect(l.priceFrom).toBe("manual");
    expect(l.unitPrice).toBe(7);
  });

  it("못 고르는 상자는 값이 안 서지만 구성은 들고 있다", () => {
    const r = compareRow("카링", "hard", 1, DATE, {});
    const l = r.random.find((x) => x.name === "혼돈의 칠흑 장신구 상자")!;
    expect(l.unitPrice).toBeUndefined();
    expect(l.box?.kind).toBe("random");
    expect(l.box?.contents.length).toBe(7);
  });
});
