import { describe, expect, it } from "vitest";
import { existsSync } from "node:fs";
import path from "node:path";
import rawItems from "@/data/boss_reward_items.json";
import { rewardGroupsOf, rewardItemsFor, allRewardsOf, hasRewards, itemIconFor, setOfItem, REWARD_ITEMS_META, DROP_SET_STYLE } from "@/lib/maple/drops";
import { PRICE_TABLE } from "@/lib/maple/prices";
import { tierOf } from "@/lib/maple/tiers";

const file = rawItems as unknown as { items: Record<string, Record<string, { name: string; file: string; w?: number; h?: number }[]>> };
const bosses = Object.keys(file.items);
const nonWeekly = new Set([...(PRICE_TABLE._meta.daily ?? []), ...(PRICE_TABLE._meta.monthly ?? [])]);
const isWeeklyBoss = (boss: string) => Object.keys(PRICE_TABLE.prices[boss] ?? {}).some((d) => !nonWeekly.has(`${boss} ${d}`));
const COMMON = ["장비", "소비", "개인", "기타", "공용", "공통"];
const DIFFS = ["이지", "노멀", "노말", "하드", "카오스", "익스트림"];

describe("boss_reward_items.json 무결성", () => {
  it("수집 대상은 가격표의 주간 결정 보스뿐이고, 빠진 보스가 없다", () => {
    for (const b of bosses) expect(isWeeklyBoss(b), `${b} 는 주간 보스가 아님`).toBe(true);
    const missing = Object.keys(PRICE_TABLE.prices).filter((b) => isWeeklyBoss(b) && allRewardsOf(b).length === 0);
    expect(missing).toEqual([]);
  });

  it("카테고리 라벨은 공통 계열이거나 난이도(+이상) 표기다", () => {
    const bad: string[] = [];
    for (const [boss, cats] of Object.entries(file.items)) {
      for (const label of Object.keys(cats)) {
        const ko = label.endsWith("+") ? label.slice(0, -1) : label;
        if (!COMMON.includes(ko) && !DIFFS.includes(ko)) bad.push(`${boss}/${label}`);
      }
    }
    expect(bad).toEqual([]);
  });

  it("아이콘 파일이 실제로 있고, URL 인코딩되며, 원본 크기를 갖는다", () => {
    const root = path.join(__dirname, "..", "..", "public");
    const problems: string[] = [];
    for (const b of bosses) {
      for (const it of allRewardsOf(b)) {
        if (!it.file.startsWith("/items/")) problems.push(`${b}/${it.name}: 경로`);
        if (/[가-힣]/.test(it.file)) problems.push(`${b}/${it.name}: 미인코딩`);
        if (!it.w || !it.h) problems.push(`${b}/${it.name}: 크기 없음`);
        if (!existsSync(path.join(root, decodeURIComponent(it.file)))) problems.push(`${b}/${it.name}: 파일 없음`);
      }
    }
    expect(problems).toEqual([]);
  });

  it("아이템 이름에 본문·스탯 찌꺼기가 섞이지 않는다", () => {
    const junk: string[] = [];
    for (const b of bosses) {
      for (const it of allRewardsOf(b)) {
        if (it.name.length < 3 || it.name.length > 30) junk.push(`${b}/${it.name}: 길이`);
        if (/레벨|HP|MONSTER|페이즈|체력|넉백|스토리 모드/.test(it.name)) junk.push(`${b}/${it.name}: 본문`);
        if (/\d+$/.test(it.name)) junk.push(`${b}/${it.name}: 숫자 꼬리`);
        if (it.name.endsWith(":")) junk.push(`${b}/${it.name}: 라벨`);
      }
    }
    expect(junk).toEqual([]);
  });
});

describe("난이도별 보상 필터", () => {
  it("유피테르: 나무위키 표기 그대로 (장비/소비/개인 + 하드 전용)", () => {
    const hard = rewardGroupsOf("유피테르", "hard");
    const byLabel = Object.fromEntries(hard.map((g) => [g.label, g.items.map((i) => i.name)]));
    expect(byLabel["장비"]).toEqual(["유피테르로이드"]);
    expect(byLabel["소비"]).toEqual(["놀라운 긍정의 혼돈 주문서 60%"]);
    expect(byLabel["개인"]).toEqual(["뒤틀린 갈망의 편린"]);
    expect(byLabel["하드"]).toEqual(expect.arrayContaining(["갈망의 에테르넬 방어구 상자", "오만의 원죄"]));
    // 공통 카테고리가 난이도 전용보다 앞에 온다
    expect(hard.findIndex((g) => g.label === "장비")).toBeLessThan(hard.findIndex((g) => g.label === "하드"));
  });

  it("난이도 전용 보상은 그 난이도에서만 나온다", () => {
    const normalNames = rewardGroupsOf("유피테르", "normal").flatMap((g) => g.items.map((i) => i.name));
    expect(normalNames).toContain("유피테르로이드"); // 공통
    expect(normalNames).not.toContain("오만의 원죄"); // 하드 전용
  });

  it("화면용 목록은 카테고리 없이 평평하고, 중복이 없다", () => {
    // 행 자체가 난이도별이므로 라벨 없이 해당 아이템만 낸다
    const hard = rewardItemsFor("유피테르", "hard").map((i) => i.name);
    expect(hard).toEqual(["유피테르로이드", "놀라운 긍정의 혼돈 주문서 60%", "뒤틀린 갈망의 편린", "갈망의 에테르넬 방어구 상자", "오만의 원죄"]);
    expect(new Set(hard).size).toBe(hard.length);
    expect(rewardItemsFor("유피테르", "normal").map((i) => i.name)).not.toContain("오만의 원죄");
    // 모든 보스·난이도에서 이름 중복이 없어야 한다
    for (const b of bosses) {
      for (const d of Object.keys(PRICE_TABLE.prices[b] ?? {})) {
        const names = rewardItemsFor(b, d).map((i) => i.name);
        expect(new Set(names).size, `${b} ${d}`).toBe(names.length);
      }
    }
  });

  it("'노멀+'(노멀 이상)은 노멀과 그 위 난이도에 모두 적용된다", () => {
    const labels = Object.keys(file.items["카링"] ?? {});
    expect(labels).toContain("노멀+");
    const at = (d: string) => rewardGroupsOf("카링", d).flatMap((g) => g.items.map((i) => i.name));
    expect(at("normal")).toContain("카링로이드");
    expect(at("hard")).toContain("카링로이드");
    expect(at("extreme")).toContain("카링로이드");
    // 이지는 노멀보다 낮으므로 제외
    expect(tierOf("카링", "easy")!.rank).toBeLessThan(tierOf("카링", "normal")!.rank);
    expect(at("easy")).not.toContain("카링로이드");
    // 익스트림 전용
    expect(at("extreme")).toContain("익셉셔널 해머 (귀고리)");
    expect(at("hard")).not.toContain("익셉셔널 해머 (귀고리)");
  });

  it("hasRewards 는 보상이 있는 행에서만 참", () => {
    expect(hasRewards("유피테르", "hard")).toBe(true);
    expect(hasRewards("검은 마법사", "hard")).toBe(false); // 월간이라 수집 대상 아님
  });
});

describe("아이콘·세트 표시", () => {
  it("이름으로 아이콘을 찾고, 표기 차이를 흡수한다", () => {
    expect(itemIconFor("오만의 원죄")).toBeTruthy();
    expect(itemIconFor("컴플리트 언더 컨트롤")).toBeTruthy(); // 나무위키: 컴플리트 언더컨트롤
    expect(itemIconFor("존재하지 않는 아이템")).toBeNull();
  });

  it("세트 아이템은 세트 색을 얻고, 나머지는 색이 없다", () => {
    expect(setOfItem("갈망의 에테르넬 방어구 상자")).toBe("에테르넬");
    expect(setOfItem("데이브레이크 펜던트")).toBe("여명");
    expect(setOfItem("고통의 근원")).toBe("칠흑");
    expect(setOfItem("놀라운 긍정의 혼돈 주문서 60%")).toBeNull();
    for (const s of ["여명", "칠흑", "에테르넬", "기타"] as const) expect(DROP_SET_STYLE[s]).toContain("bg-");
  });

  it("출처와 기준일이 기록돼 있다", () => {
    expect(REWARD_ITEMS_META.updated).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(REWARD_ITEMS_META.source).toContain("나무위키");
  });
});
