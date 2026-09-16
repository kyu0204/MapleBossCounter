import { describe, expect, it } from "vitest";
import { forceFor, forceKindOf, FORCE_REQ, requiredForce, sumForces } from "@/lib/maple/force";
import { PRICE_TABLE } from "@/lib/maple/prices";

/** 포스를 보지만 요구치는 없는 보스. 포스 값만 나오고 부족 경고는 없다. */
const NO_REQ = new Set(["스우", "데미안"]);

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
    // 아케인리버 지역이지만 포스를 보지 않는다
    expect(forceKindOf("가디언 엔젤 슬라임")).toBeNull();
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

describe("요구 포스 표의 난이도 칸", () => {
  const bosses = Object.keys(PRICE_TABLE.prices).filter((b) => forceKindOf(b) && !NO_REQ.has(b));

  it("요구 포스가 있는 보스는 모두 표에 있다", () => {
    expect(bosses.filter((b) => !FORCE_REQ[b])).toEqual([]);
  });

  it("빈 칸(null)이 남아 있지 않다", () => {
    // 모르는 칸을 null 로 두는 건 허용하지만, 지금은 전부 채운 상태다.
    // 새 보스·난이도가 들어와 비어 있으면 여기서 잡힌다.
    const blank = Object.entries(FORCE_REQ).flatMap(([b, diffs]) =>
      Object.entries(diffs)
        .filter(([, v]) => v == null)
        .map(([d]) => `${b} ${d}`),
    );
    expect(blank).toEqual([]);
  });

  it("보스마다 가격표에 있는 난이도가 빠짐없이 들어 있다", () => {
    // 칸이 없으면 그 난이도는 조용히 "모름" 이 된다. 채워 넣을 자리를 눈에 보이게 둔다.
    const missing = bosses.flatMap((b) => Object.keys(PRICE_TABLE.prices[b]).filter((d) => !(d in FORCE_REQ[b])).map((d) => `${b} ${d}`));
    expect(missing).toEqual([]);
  });

  it("가격표에 없는 난이도를 적어 두지 않는다", () => {
    const extra = bosses.flatMap((b) => Object.keys(FORCE_REQ[b]).filter((d) => !(d in PRICE_TABLE.prices[b])).map((d) => `${b} ${d}`));
    expect(extra).toEqual([]);
  });

  it("스우·데미안은 표에 없다", () => {
    expect(FORCE_REQ["스우"]).toBeUndefined();
    expect(FORCE_REQ["데미안"]).toBeUndefined();
  });
});

describe("보스별 요구 포스", () => {
  it("난이도마다 값이 다르면 난이도별로 갈라 낸다", () => {
    expect(requiredForce("카링", "normal")).toBe(330);
    expect(requiredForce("카링", "extreme")).toBe(480);
    expect(requiredForce("감시자 칼로스", "normal")).toBe(300);
    expect(requiredForce("감시자 칼로스", "extreme")).toBe(440);
  });

  it("낮은 난이도는 낮은 요구치를 쓴다", () => {
    // 이지 윌에 하드 윌 값을 물려 쓰면 멀쩡한 사람이 부족으로 뜬다
    expect(requiredForce("윌", "easy")).toBe(560);
    expect(requiredForce("윌", "hard")).toBe(760);
    expect(requiredForce("진 힐라", "normal")).toBe(820);
    expect(requiredForce("진 힐라", "hard")).toBe(900);
    expect(requiredForce("감시자 칼로스", "easy")).toBe(200);
    expect(requiredForce("감시자 칼로스", "chaos")).toBe(330);
  });

  it("난이도가 올라가면 요구치도 내려가지 않는다", () => {
    const order = ["easy", "normal", "hard", "chaos", "extreme"];
    for (const [boss, diffs] of Object.entries(FORCE_REQ)) {
      const vals = order.filter((d) => diffs[d] != null).map((d) => diffs[d]!);
      for (let i = 1; i < vals.length; i++) expect(vals[i], `${boss} ${order[i]}`).toBeGreaterThanOrEqual(vals[i - 1]);
    }
  });

  it("세렌은 난이도가 아니라 페이즈로 갈려서 세 난이도가 같다", () => {
    expect(requiredForce("선택받은 세렌", "normal")).toBe(200);
    expect(requiredForce("선택받은 세렌", "hard")).toBe(200);
    expect(requiredForce("선택받은 세렌", "extreme")).toBe(200);
  });

  it("요구 포스가 없는 보스는 null 이다", () => {
    expect(requiredForce("스우", "hard")).toBeNull();
    expect(requiredForce("데미안", "hard")).toBeNull();
    expect(requiredForce("자쿰", "chaos")).toBeNull();
  });

  it("요구치가 없어도 포스 값 자체는 보는 보스가 있다", () => {
    // 요구치가 없는 것(스우)과 포스와 무관한 것(자쿰)은 다르다
    expect(forceKindOf("스우")).toBe("arcane");
    expect(requiredForce("스우", "hard")).toBeNull();
    expect(forceKindOf("자쿰")).toBeNull();
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
