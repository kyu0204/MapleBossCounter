import { describe, expect, it } from "vitest";
import { clampParty, maxPartyFor } from "@/lib/maple/partySize";
import { PRICE_TABLE } from "@/lib/maple/prices";

describe("보스별 최대 파티 인원", () => {
  it("기본은 6인", () => {
    expect(maxPartyFor("스우", "hard")).toBe(6);
    expect(maxPartyFor("루시드", "hard")).toBe(6);
    expect(maxPartyFor("선택받은 세렌", "extreme")).toBe(6);
  });

  it("익스트림 스우만 2인이다 (다른 난이도는 6인)", () => {
    expect(maxPartyFor("스우", "extreme")).toBe(2);
    expect(maxPartyFor("스우", "normal")).toBe(6);
    expect(maxPartyFor("스우", "hard")).toBe(6);
  });

  it("3인 보스는 난이도와 무관하다", () => {
    for (const boss of ["최초의 대적자", "벨로나", "찬란한 흉성", "림보", "발드릭스", "유피테르"]) {
      for (const diff of ["easy", "normal", "hard", "extreme"]) {
        expect(maxPartyFor(boss, diff)).toBe(3);
      }
    }
  });

  it("이름이 가격표와 어긋나지 않는다", () => {
    // 오타가 나면 조용히 6인으로 떨어진다. 이름이 실재하는지 확인한다.
    for (const boss of ["최초의 대적자", "벨로나", "찬란한 흉성", "림보", "발드릭스", "유피테르", "스우"]) {
      expect(PRICE_TABLE.prices[boss], boss).toBeDefined();
    }
  });
});

describe("입력값 자르기", () => {
  it("상한을 넘으면 상한으로", () => {
    expect(clampParty("유피테르", "hard", 6)).toBe(3);
    expect(clampParty("스우", "extreme", 5)).toBe(2);
  });

  it("범위 안이면 그대로", () => {
    expect(clampParty("유피테르", "hard", 2)).toBe(2);
    expect(clampParty("루시드", "hard", 6)).toBe(6);
  });

  it("1 미만과 이상한 값은 1", () => {
    expect(clampParty("루시드", "hard", 0)).toBe(1);
    expect(clampParty("루시드", "hard", -3)).toBe(1);
    expect(clampParty("루시드", "hard", NaN)).toBe(1);
  });

  it("소수는 반올림한다", () => {
    expect(clampParty("루시드", "hard", 2.6)).toBe(3);
  });
});
