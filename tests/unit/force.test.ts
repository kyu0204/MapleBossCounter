import { describe, expect, it } from "vitest";
import { forceFor, forceKindOf, requiredForce, sumForces } from "@/lib/maple/force";

describe("보스별로 보는 포스", () => {
  it("아케인리버 보스는 아케인포스", () => {
    expect(forceKindOf("스우")).toBe("arcane");
    expect(forceKindOf("듄켈")).toBe("arcane");
    // 검은 마법사는 아케인리버의 끝이다
    expect(forceKindOf("검은 마법사")).toBe("arcane");
  });

  it("그란디스 보스는 어센틱포스", () => {
    expect(forceKindOf("선택받은 세렌")).toBe("authentic");
    expect(forceKindOf("유피테르")).toBe("authentic");
    expect(forceKindOf("림보")).toBe("authentic");
  });

  it("구세대 보스와 시즌 보스는 포스와 무관", () => {
    expect(forceKindOf("자쿰")).toBeNull();
    expect(forceKindOf("매그너스")).toBeNull();
    expect(forceKindOf("시즌 보스 메이린")).toBeNull();
  });
});

describe("심볼 포스 합산", () => {
  it("계열별로 갈라 더한다", () => {
    const f = sumForces([
      { symbol_name: "아케인심볼 : 소멸의 여로", symbol_force: "200" },
      { symbol_name: "아케인심볼 : 츄츄 아일랜드", symbol_force: 150 },
      { symbol_name: "어센틱심볼 : 세르니움", symbol_force: "30" },
    ]);
    expect(f).toEqual({ arcane: 350, authentic: 30 });
  });

  it("모르는 이름과 숫자가 아닌 값은 버린다", () => {
    const f = sumForces([
      { symbol_name: "그랜드 어센틱심볼 : 알 수 없음", symbol_force: "999" },
      { symbol_name: "아케인심볼 : 얼음 골짜기", symbol_force: "없음" },
    ]);
    expect(f).toEqual({ arcane: 0, authentic: 0 });
  });

  it("심볼이 없으면 0", () => {
    expect(sumForces(null)).toEqual({ arcane: 0, authentic: 0 });
    expect(sumForces([])).toEqual({ arcane: 0, authentic: 0 });
  });
});

describe("보스별 요구 포스", () => {
  it("난이도마다 값이 다르면 난이도별로 갈라 낸다", () => {
    expect(requiredForce("카링", "normal")).toBe(330);
    expect(requiredForce("카링", "extreme")).toBe(480);
    expect(requiredForce("감시자 칼로스", "normal")).toBe(300);
    expect(requiredForce("감시자 칼로스", "extreme")).toBe(440);
  });

  it("출처가 적지 않은 난이도는 다른 난이도 값을 물려 쓰지 않는다", () => {
    // 하드 윌만 760 이다. 이지·노말 윌에 760 을 물리면 멀쩡한 사람이 부족으로 뜬다
    expect(requiredForce("윌", "hard")).toBe(760);
    expect(requiredForce("윌", "normal")).toBeNull();
    expect(requiredForce("윌", "easy")).toBeNull();
    expect(requiredForce("진 힐라", "hard")).toBe(900);
    expect(requiredForce("진 힐라", "normal")).toBeNull();
    // 칼로스 이지·카오스도 출처에 없다
    expect(requiredForce("감시자 칼로스", "chaos")).toBeNull();
    expect(requiredForce("최초의 대적자", "hard")).toBeNull();
  });

  it("난이도를 가르지 않는 보스는 전 난이도 공통값", () => {
    // 세렌은 난이도가 아니라 페이즈로만 갈린다
    expect(requiredForce("선택받은 세렌", "normal")).toBe(200);
    expect(requiredForce("선택받은 세렌", "hard")).toBe(200);
    expect(requiredForce("선택받은 세렌", "extreme")).toBe(200);
  });

  it("같은 값이라도 있는 난이도에만 붙는다", () => {
    expect(requiredForce("유피테르", "normal")).toBe(810);
    expect(requiredForce("유피테르", "hard")).toBe(810);
    expect(requiredForce("루시드", "hard")).toBe(360);
    expect(requiredForce("루시드", "easy")).toBeNull();
  });

  it("자료가 없는 보스는 null 이다 (짐작해서 채우지 않는다)", () => {
    expect(requiredForce("스우", "hard")).toBeNull();
    expect(requiredForce("듄켈", "hard")).toBeNull();
    expect(requiredForce("찬란한 흉성", "normal")).toBeNull();
    expect(requiredForce("자쿰", "chaos")).toBeNull();
  });
});

describe("캐릭터 값에서 이 보스의 포스 고르기", () => {
  const ch = { arcaneForce: 1320, authenticForce: 450 };

  it("보스 계열에 맞는 값만 고른다", () => {
    expect(forceFor("윌", ch)).toEqual({ kind: "arcane", value: 1320 });
    expect(forceFor("카링", ch)).toEqual({ kind: "authentic", value: 450 });
  });

  it("포스와 무관한 보스는 null", () => {
    expect(forceFor("자쿰", ch)).toBeNull();
  });

  it("조회된 적 없는 캐릭터는 값이 null 이다 (0 이 아니다)", () => {
    expect(forceFor("카링", { arcaneForce: null, authenticForce: null })).toEqual({ kind: "authentic", value: null });
  });
});
