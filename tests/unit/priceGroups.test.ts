import { describe, expect, it } from "vitest";
import { allPrices } from "@/lib/maple/itemPrices";
import { groupByPriceGroup, PRICE_GROUPS, priceGroupOf } from "@/lib/maple/priceGroups";

describe("시세 묶음", () => {
  it("세트 이름이 들어간 것은 그 세트로", () => {
    expect(priceGroupOf("루즈 컨트롤 머신 마크")).toBe("칠흑");
    expect(priceGroupOf("에테르넬 아처케이프")).toBe("에테르넬");
    expect(priceGroupOf("데이브레이크 펜던트")).toBe("여명");
    // 이름에 '광휘' 가 안 들어간다. 세트 목록으로만 알 수 있다.
    expect(priceGroupOf("죽음의 맹세")).toBe("광휘");
  });

  it("세트가 없는 것은 쓰임으로 떨어진다", () => {
    expect(priceGroupOf("익셉셔널 해머 (귀고리)")).toBe("해머");
    expect(priceGroupOf("3단계 소울 에테르")).toBe("에테르");
    expect(priceGroupOf("신념의 연마석")).toBe("연마석");
    expect(priceGroupOf("리스트레인트 링")).toBe("반지");
    expect(priceGroupOf("영롱한 달빛 포션")).toBe("기타");
  });

  it("묶음 키는 전부 PRICE_GROUPS 에 있다", () => {
    const known = new Set(PRICE_GROUPS.map((g) => g.key));
    for (const [name] of allPrices()) expect(known.has(priceGroupOf(name)), name).toBe(true);
  });

  it("묶어도 아이템이 새거나 겹치지 않는다", () => {
    const rows = allPrices();
    const grouped = groupByPriceGroup(rows, ([n]) => n);
    const flat = grouped.flatMap(([, list]) => list.map(([n]) => n));
    expect(new Set(flat).size).toBe(rows.length);
  });

  it("빈 묶음은 내지 않는다", () => {
    const grouped = groupByPriceGroup([["루즈 컨트롤 머신 마크", 1]] as [string, number][], ([n]) => n);
    expect(grouped).toHaveLength(1);
    expect(grouped[0][0].key).toBe("칠흑");
  });
});
