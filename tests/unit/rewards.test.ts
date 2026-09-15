import { describe, expect, it } from "vitest";
import { existsSync } from "node:fs";
import path from "node:path";
import rawRewards from "@/data/boss_rewards.json";
import { rewardsFor, rewardRowsFor, hasRewardsFor, cubesChangeOn, REWARDS_META, ICON_BOX, isSharedReward, rewardAmount, aggregateFixedRewards } from "@/lib/maple/rewards";
import { PRICE_TABLE } from "@/lib/maple/prices";

interface Entry {
  name: string;
  icon?: string;
  short?: string;
  count?: number;
  w?: number;
  h?: number;
}
const file = rawRewards as unknown as {
  bosses: Record<string, Record<string, { rewards: Entry[]; cubes?: Record<string, Entry & { before: number; after: number }> }>>;
};
const BEFORE = "2026-09-16";
const AFTER = "2026-09-17";
const names = (boss: string, diff: string, date = AFTER) => rewardsFor(boss, diff, date).map((r) => r.name);

describe("boss_rewards.json 무결성", () => {
  it("모든 보스·난이도가 가격표에 실재한다", () => {
    const bad: string[] = [];
    for (const [boss, diffs] of Object.entries(file.bosses)) {
      for (const diff of Object.keys(diffs)) {
        if (!(diff in (PRICE_TABLE.prices[boss] ?? {}))) bad.push(`${boss} ${diff}`);
      }
    }
    expect(bad).toEqual([]);
  });

  it("보상과 큐브 전부 아이콘이 있다 (이름은 마우스 오버용)", () => {
    // 짧은 글자 라벨은 아이콘을 못 구했을 때의 대체 수단이다. 지금은 전부 아이콘이 있다.
    // 새 보상이 추가됐는데 아이콘이 없으면 여기서 잡힌다.
    const bad: string[] = [];
    for (const [boss, diffs] of Object.entries(file.bosses)) {
      for (const [diff, row] of Object.entries(diffs)) {
        for (const r of [...row.rewards, ...Object.values(row.cubes ?? {})]) {
          if (!r.icon) bad.push(`${boss} ${diff} / ${r.name}`);
        }
      }
    }
    expect(bad).toEqual([]);
  });

  it("손으로 반입한 12종이 모두 붙어 있다", () => {
    const withIcon = new Map<string, string>();
    for (const diffs of Object.values(file.bosses)) {
      for (const row of Object.values(diffs)) {
        for (const r of row.rewards) if (r.icon) withIcon.set(r.name, r.icon);
        for (const c of Object.values(row.cubes ?? {})) if (c.icon) withIcon.set(c.name, c.icon);
      }
    }
    for (const n of [
      "메멘토 실버 큐브", "메멘토 골드 큐브", "메멘토 브론즈 에디셔널 큐브",
      "주문의 흔적", "솔 에르다의 기운", "에리온의 조각", "영롱한 달빛 포션",
      "생명의 보스 반지 상자", "백옥의 보스 반지 상자", "녹옥의 보스 반지 상자",
      "홍옥의 보스 반지 상자", "흑옥의 보스 반지 상자",
    ]) {
      expect(withIcon.get(n), n).toBeTruthy();
    }
    // 반지 상자 5종은 서로 다른 그림이어야 한다
    const rings = ["생명", "백옥", "녹옥", "홍옥", "흑옥"].map((k) => withIcon.get(`${k}의 보스 반지 상자`));
    expect(new Set(rings).size).toBe(5);
  });

  it("아이콘에 원본 픽셀 크기가 함께 있다 (화면에서 축소하지 않는다)", () => {
    const bad: string[] = [];
    for (const [boss, diffs] of Object.entries(file.bosses)) {
      for (const [diff, row] of Object.entries(diffs)) {
        for (const r of [...row.rewards, ...Object.values(row.cubes ?? {})] as { name: string; icon?: string; w?: number; h?: number }[]) {
          if (r.icon && (!r.w || !r.h)) bad.push(`${boss} ${diff} / ${r.name}`);
        }
      }
    }
    expect(bad).toEqual([]);
  });

  it("아이콘 파일이 public 에 실제로 있다", () => {
    const root = path.join(__dirname, "..", "..", "public");
    const missing: string[] = [];
    for (const [boss, diffs] of Object.entries(file.bosses)) {
      for (const [diff, row] of Object.entries(diffs)) {
        for (const r of [...row.rewards, ...Object.values(row.cubes ?? {})]) {
          if (r.icon && !existsSync(path.join(root, r.icon))) missing.push(`${boss} ${diff} / ${r.name}`);
        }
      }
    }
    expect(missing).toEqual([]);
  });

  it("제외하기로 한 공통 소모품·결정석이 들어 있지 않다", () => {
    const banned = /명예의 훈장|반짝이는|경험 축적|경험치 50%|주문서 교환권|혼돈 주문서|태초의 정수|소울 조각|강렬한 힘의 결정|가격 변동|^주문서$|^기타$/;
    const found: string[] = [];
    for (const [boss, diffs] of Object.entries(file.bosses)) {
      for (const [diff, row] of Object.entries(diffs)) {
        for (const r of row.rewards) if (banned.test(r.name)) found.push(`${boss} ${diff} / ${r.name}`);
      }
    }
    expect(found).toEqual([]);
  });

  it("매주 받는 보상이 아닌 것은 뺀다 — 최초 격파 훈장·칭호, 누적 처치 보상", () => {
    const all = Object.entries(file.bosses).flatMap(([boss, diffs]) =>
      Object.entries(diffs).flatMap(([diff, row]) => row.rewards.map((r) => `${boss} ${diff} / ${r.name}`)),
    );
    for (const n of ["악몽의 주인 격파자", "진실을 꿰뚫는 자", "미궁의 깊이를 아는 자", "가디언 엔젤 크라운"]) {
      expect(all.filter((x) => x.includes(n))).toEqual([]);
    }
    // 반대로 훈장이라도 매주 나오는 드롭은 남아 있어야 한다
    expect(names("최초의 대적자", "hard")).toContain("불멸의 유산");
    expect(names("최초의 대적자", "extreme")).toContain("불멸의 유산");
  });

  it("익셉셔널 해머는 익스트림 보스마다 부위가 다르고 아이콘도 따로다", () => {
    const hammer = (boss: string) => rewardsFor(boss, "extreme", AFTER).find((r) => r.name.startsWith("익셉셔널 해머"));
    const slots = {
      "선택받은 세렌": "얼굴장식",
      "감시자 칼로스": "눈장식",
      "최초의 대적자": "훈장",
      카링: "귀고리",
    };
    const icons = new Set<string>();
    for (const [boss, slot] of Object.entries(slots)) {
      const h = hammer(boss);
      expect(h, boss).toBeDefined();
      expect(h!.name).toBe(`익셉셔널 해머 (${slot})`);
      icons.add(h!.icon!);
    }
    expect(icons.size).toBe(4); // 네 부위가 같은 아이콘으로 뭉치지 않는다
  });

  it("범위 수량은 콜론으로 이어져 있어도 파싱된다 (파멸의 조각: 5~10개)", () => {
    const r = rewardsFor("벨룸", "chaos", AFTER).find((x) => x.name === "파멸의 조각");
    expect(r).toBeDefined();
    expect(r!.range).toBe("5~10");
    expect(r!.count).toBe(10);
    expect(r!.name.endsWith(":")).toBe(false);
  });

  it("살리기로 한 영롱한 달빛 포션은 익스트림 네 곳에만 있다", () => {
    const where: string[] = [];
    for (const [boss, diffs] of Object.entries(file.bosses)) {
      for (const [diff, row] of Object.entries(diffs)) {
        if (row.rewards.some((r) => r.name.includes("영롱한 달빛"))) where.push(`${boss} ${diff}`);
      }
    }
    expect(where.sort()).toEqual(["감시자 칼로스 extreme", "선택받은 세렌 extreme", "최초의 대적자 extreme", "카링 extreme"]);
  });
});

describe("유피테르 — 나무위키 원문과 대조", () => {
  it("하드: 장비 2종 + 에테르넬 상자, 수치류 포함", () => {
    const n = names("유피테르", "hard");
    expect(n).toEqual(expect.arrayContaining(["유피테르로이드", "오만의 원죄", "갈망의 에테르넬 방어구 상자", "솔 에르다의 기운", "뒤틀린 갈망의 편린", "에리온의 조각"]));
    const 편린 = rewardsFor("유피테르", "hard", AFTER).find((r) => r.name === "뒤틀린 갈망의 편린")!;
    expect(편린.count).toBe(2);
    expect(rewardsFor("유피테르", "hard", AFTER).find((r) => r.name === "에리온의 조각")!.count).toBe(360);
    expect(rewardsFor("유피테르", "hard", AFTER).find((r) => r.name === "솔 에르다의 기운")!.count).toBe(750);
  });

  it("노멀: 하드 전용 보상이 없고 수치가 더 낮다", () => {
    const n = names("유피테르", "normal");
    expect(n).toContain("유피테르로이드");
    expect(n).not.toContain("오만의 원죄");
    expect(n).not.toContain("갈망의 에테르넬 방어구 상자");
    expect(rewardsFor("유피테르", "normal", AFTER).find((r) => r.name === "에리온의 조각")!.count).toBe(45);
  });
});

describe("메멘토 큐브 — 2026-09-17 패치 전/후", () => {
  const cubeCount = (boss: string, diff: string, kind: string, date: string) =>
    rewardsFor(boss, diff, date).find((r) => r.name.includes(kind))?.count ?? 0;

  it("하드 스우: 실버 1개가 패치 후 사라진다", () => {
    expect(cubeCount("스우", "hard", "실버", BEFORE)).toBe(1);
    expect(cubeCount("스우", "hard", "실버", AFTER)).toBe(0);
    // 브론즈 에디셔널은 패치 대상이 아니라 그대로
    expect(cubeCount("스우", "hard", "브론즈", BEFORE)).toBe(6);
    expect(cubeCount("스우", "hard", "브론즈", AFTER)).toBe(6);
  });

  it("노멀 카링: 패치로 골드 3개가 새로 생긴다", () => {
    expect(cubeCount("카링", "normal", "골드", BEFORE)).toBe(0);
    expect(cubeCount("카링", "normal", "골드", AFTER)).toBe(3);
  });

  it("노멀 세렌: 골드 1개 → 실버 2개로 바뀐다", () => {
    expect(cubeCount("선택받은 세렌", "normal", "골드", BEFORE)).toBe(1);
    expect(cubeCount("선택받은 세렌", "normal", "실버", BEFORE)).toBe(0);
    expect(cubeCount("선택받은 세렌", "normal", "골드", AFTER)).toBe(0);
    expect(cubeCount("선택받은 세렌", "normal", "실버", AFTER)).toBe(2);
  });

  it("하드 진힐라: 실버 2 → 1", () => {
    expect(cubeCount("진 힐라", "hard", "실버", BEFORE)).toBe(2);
    expect(cubeCount("진 힐라", "hard", "실버", AFTER)).toBe(1);
    expect(cubesChangeOn("진 힐라", "hard")).toBe(true);
    expect(cubesChangeOn("루시드", "normal")).toBe(false);
  });

  it("검은 마법사 하드: 실측 확인한 브론즈 에디셔널 24개", () => {
    expect(cubeCount("검은 마법사", "hard", "브론즈", AFTER)).toBe(24);
    expect(cubeCount("검은 마법사", "hard", "실버", AFTER)).toBe(8);
    expect(cubeCount("검은 마법사", "hard", "골드", AFTER)).toBe(0);
  });

  it("보상 섹션이 없는 구형 보스도 큐브는 나온다 (브론즈 에디셔널 1개)", () => {
    for (const [boss, diff] of [["매그너스", "hard"], ["피에르", "chaos"], ["반반", "chaos"], ["블러디퀸", "chaos"], ["파풀라투스", "chaos"]] as const) {
      const r = rewardsFor(boss, diff, AFTER);
      expect(r.map((x) => x.name), `${boss} ${diff}`).toEqual(["메멘토 브론즈 에디셔널 큐브"]);
      expect(r[0].count).toBe(1);
    }
    // 자쿰 카오스는 동별 2티어라 큐브 지급 범위 밖이다
    expect(rewardsFor("자쿰", "chaos", AFTER)).toEqual([]);
  });

  it("수량이 0 인 큐브는 목록에 나오지 않는다", () => {
    expect(names("스우", "hard", AFTER).some((n) => n.includes("실버"))).toBe(false);
    expect(names("스우", "hard", BEFORE).some((n) => n.includes("실버"))).toBe(true);
  });
});

describe("확정 보상 / 확률 드롭 구분", () => {
  it("나무위키 '고정' 칸과 큐브는 확정, '장비'·'소비' 는 랜덤", () => {
    const { fixed, random } = rewardRowsFor("유피테르", "hard", AFTER);
    expect(fixed.map((r) => r.name)).toEqual(["솔 에르다의 기운", "뒤틀린 갈망의 편린", "에리온의 조각"]);
    expect(random.map((r) => r.name)).toEqual(
      expect.arrayContaining(["유피테르로이드", "오만의 원죄", "갈망의 에테르넬 방어구 상자"]),
    );
    // 장비가 확정으로 새지 않는다
    expect(fixed.some((r) => r.name === "유피테르로이드")).toBe(false);
  });

  it("큐브는 확정 줄에 들어간다", () => {
    const { fixed, random } = rewardRowsFor("벨룸", "chaos", AFTER);
    expect(fixed.map((r) => r.name)).toEqual(["파멸의 조각", "메멘토 브론즈 에디셔널 큐브"]);
    expect(random.map((r) => r.name)).toEqual(["벨룸의 헬름", "카오스 벨룸의 헬름", "기암괴석 의자"]);
  });

  it("큐브만 있는 구형 보스는 확정 줄만 나온다", () => {
    const { fixed, random } = rewardRowsFor("매그너스", "hard", AFTER);
    expect(fixed.map((r) => r.name)).toEqual(["메멘토 브론즈 에디셔널 큐브"]);
    expect(random).toEqual([]);
  });

  it("두 줄을 합치면 전체 보상과 같다", () => {
    for (const [boss, diff] of [["유피테르", "hard"], ["최초의 대적자", "extreme"], ["스우", "normal"]] as const) {
      const { fixed, random } = rewardRowsFor(boss, diff, AFTER);
      expect(fixed.length + random.length, `${boss} ${diff}`).toBe(rewardsFor(boss, diff, AFTER).length);
    }
  });
});

describe("아이콘 칸", () => {
  it("가장 큰 아이콘 크기와 같다", () => {
    let w = 0;
    let h = 0;
    for (const diffs of Object.values(file.bosses)) {
      for (const row of Object.values(diffs)) {
        for (const r of [...row.rewards, ...Object.values(row.cubes ?? {})]) {
          if (r.w && r.w > w) w = r.w;
          if (r.h && r.h > h) h = r.h;
        }
      }
    }
    expect(ICON_BOX).toEqual({ w, h });
  });

  it("칸보다 큰 아이콘은 없다 (원본 크기로 그리므로 넘치면 안 된다)", () => {
    const over: string[] = [];
    for (const [boss, diffs] of Object.entries(file.bosses)) {
      for (const [diff, row] of Object.entries(diffs)) {
        for (const r of [...row.rewards, ...Object.values(row.cubes ?? {})]) {
          if ((r.w ?? 0) > ICON_BOX.w || (r.h ?? 0) > ICON_BOX.h) over.push(`${boss} ${diff} / ${r.name}`);
        }
      }
    }
    expect(over).toEqual([]);
  });
});

describe("파티 분배", () => {
  it("조각·편린·큐브만 나눈다", () => {
    for (const n of ["파멸의 조각", "뒤틀린 갈망의 편린", "메멘토 실버 큐브", "메멘토 브론즈 에디셔널 큐브"]) {
      expect(isSharedReward(n), n).toBe(true);
    }
    // 각자 받는 것은 나누지 않는다
    for (const n of ["솔 에르다의 기운", "주문의 흔적", "에리온의 조각".replace("조각", "기운"), "영롱한 달빛 포션"]) {
      expect(isSharedReward(n), n).toBe(false);
    }
  });

  it("나눗셈은 소수점을 버린다", () => {
    const cube = { name: "메멘토 브론즈 에디셔널 큐브", count: 8 };
    expect(rewardAmount(cube, 1).text).toBe("8");
    expect(rewardAmount(cube, 2).text).toBe("4");
    expect(rewardAmount(cube, 3).text).toBe("2"); // 8/3 = 2.67 → 2
    expect(rewardAmount(cube, 5).text).toBe("1");
    expect(rewardAmount(cube, 6).value).toBe(1);
  });

  it("나누지 않는 항목은 인원과 무관하다", () => {
    const erda = { name: "솔 에르다의 기운", count: 750 };
    expect(rewardAmount(erda, 1).value).toBe(750);
    expect(rewardAmount(erda, 6).value).toBe(750);
    expect(rewardAmount(erda, 6).shared).toBe(false);
  });

  it("범위는 양끝을 각각 나눈다", () => {
    const frag = { name: "파멸의 조각", count: 10, range: "5~10" };
    expect(rewardAmount(frag, 1).text).toBe("5~10");
    expect(rewardAmount(frag, 2).text).toBe("2~5");
    expect(rewardAmount(frag, 2).value).toBe(5);
    // 6명이면 최소 5개로는 한 개도 못 받을 수 있다
    expect(rewardAmount(frag, 6).text).toBe("0~1");
    // 양끝이 같아지면 하나로 합쳐 적는다
    expect(rewardAmount({ name: "파멸의 조각", count: 7, range: "6~7" }, 4).text).toBe("1");
  });

  it("합산은 보스마다 나눈 뒤 더한다 (먼저 더하고 나누면 많아진다)", () => {
    // 브론즈 에디셔널 큐브: 루시드 하드 8개, 윌 하드 8개
    const solo = aggregateFixedRewards(
      [
        { boss: "루시드", diff: "hard", party: 1 },
        { boss: "윌", diff: "hard", party: 1 },
      ],
      AFTER,
    );
    expect(solo.find((r) => r.name === "메멘토 브론즈 에디셔널 큐브")!.total).toBe(16);

    const trio = aggregateFixedRewards(
      [
        { boss: "루시드", diff: "hard", party: 3 },
        { boss: "윌", diff: "hard", party: 3 },
      ],
      AFTER,
    );
    // floor(8/3) + floor(8/3) = 2 + 2 = 4. 먼저 더했다면 floor(16/3) = 5 가 됐을 것이다
    expect(trio.find((r) => r.name === "메멘토 브론즈 에디셔널 큐브")!.total).toBe(4);
    // 솔 에르다의 기운은 나누지 않으므로 인원과 무관하게 같다
    const erdaSolo = solo.find((r) => r.name === "솔 에르다의 기운")!.total;
    expect(trio.find((r) => r.name === "솔 에르다의 기운")!.total).toBe(erdaSolo);
  });

  it("나눠서 0이 되면 합산에서 뺀다", () => {
    // 벨룸 카오스 브론즈 에디셔널 1개를 2명이 나누면 0
    const r = aggregateFixedRewards([{ boss: "벨룸", diff: "chaos", party: 2 }], AFTER);
    expect(r.some((x) => x.name.includes("큐브"))).toBe(false);
    expect(aggregateFixedRewards([{ boss: "벨룸", diff: "chaos", party: 1 }], AFTER).some((x) => x.name.includes("큐브"))).toBe(true);
  });

  it("확정 보상만 합산한다 (확률 드롭은 제외)", () => {
    const r = aggregateFixedRewards([{ boss: "유피테르", diff: "hard", party: 1 }], AFTER);
    const names = r.map((x) => x.name);
    expect(names).toContain("솔 에르다의 기운");
    expect(names).not.toContain("유피테르로이드"); // 장비 = 확률 드롭
    expect(names).not.toContain("오만의 원죄");
  });
});

describe("표시 여부", () => {
  it("보상이 있는 행만 참", () => {
    expect(hasRewardsFor("유피테르", "hard", AFTER)).toBe(true);
    expect(hasRewardsFor("자쿰", "chaos", AFTER)).toBe(false); // 문서에 보상 섹션이 없는 구형 보스
  });

  it("월간 보스인 검은 마법사도 보상이 들어 있다", () => {
    const hard = rewardRowsFor("검은 마법사", "hard", AFTER);
    expect(hard.fixed.map((r) => r.name)).toEqual(
      expect.arrayContaining(["주문의 흔적", "솔 에르다의 기운", "메멘토 실버 큐브", "메멘토 브론즈 에디셔널 큐브"]),
    );
    // 어둠의 흔적은 쓸모가 좁아 빼기로 했다
    expect(hard.fixed.some((r) => r.name.includes("어둠의 흔적"))).toBe(false);
    expect(hard.random.map((r) => r.name)).toContain("창세의 뱃지");
    // 하드는 실측 확인값 그대로
    expect(hard.fixed.find((r) => r.name === "메멘토 브론즈 에디셔널 큐브")!.count).toBe(24);
    expect(hard.fixed.find((r) => r.name === "주문의 흔적")!.count).toBe(800);

    const ext = rewardRowsFor("검은 마법사", "extreme", AFTER);
    expect(ext.fixed.find((r) => r.name === "솔 에르다의 기운")!.count).toBe(600);
    expect(ext.random.map((r) => r.name)).toContain("익셉셔널 해머 (벨트)");
    // 익스트림은 큐브가 없다
    expect(ext.fixed.some((r) => r.name.includes("큐브"))).toBe(false);
  });
  it("출처·기준일이 기록돼 있다", () => {
    expect(REWARDS_META.updated).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(REWARDS_META.cubePatchDate).toBe("2026-09-17");
  });
});
