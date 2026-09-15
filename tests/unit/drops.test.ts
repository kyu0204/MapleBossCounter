import { describe, expect, it } from "vitest";
import { existsSync } from "node:fs";
import path from "node:path";
import rawDrops from "@/data/boss_drops.json";
import rawItems from "@/data/boss_reward_items.json";
import { dropsOf, hasDrops, hasAnyDrops, itemIconFor, rewardItemsOf, DROP_SET_STYLE, DROPS_META, type DropSet } from "@/lib/maple/drops";
import { parseBossKey } from "@/lib/maple/bossKey";
import { crystalPrice, PRICE_TABLE } from "@/lib/maple/prices";
import { tierOf } from "@/lib/maple/tiers";

const keys = Object.keys((rawDrops as { drops: Record<string, unknown> }).drops);

describe("boss_drops.json 무결성", () => {
  it("모든 키가 파싱 가능한 '보스 난이도' 이고 가격·티어표에 실재한다", () => {
    const bad: string[] = [];
    for (const k of keys) {
      const r = parseBossKey(k);
      if (!r) { bad.push(`${k}: 표기 오류`); continue; }
      // 가격이 null 인 것(미확인)은 정상 — 키 자체가 있는지만 본다
      if (!(r.diff in (PRICE_TABLE.prices[r.boss] ?? {}))) bad.push(`${k}: 가격표에 없음`);
      // 티어가 없으면 티어표 UI 에 아예 안 나오므로 드롭을 적어도 보이지 않는다
      if (!tierOf(r.boss, r.diff)) bad.push(`${k}: 티어표에 없음`);
    }
    expect(bad).toEqual([]);
  });

  it("드롭 항목은 이름·부위·세트를 모두 갖고, 세트는 색이 정의돼 있다", () => {
    for (const k of keys) {
      const r = parseBossKey(k)!;
      for (const d of dropsOf(r.boss, r.diff)) {
        expect(d.name, k).toBeTruthy();
        expect(d.slot, k).toBeTruthy();
        expect(DROP_SET_STYLE[d.set as DropSet], `${k} / ${d.set}`).toBeTruthy();
      }
    }
  });

  it("같은 보스·난이도 안에서 아이템 이름이 중복되지 않는다", () => {
    for (const k of keys) {
      const r = parseBossKey(k)!;
      const names = dropsOf(r.boss, r.diff).map((d) => d.name);
      expect(new Set(names).size, k).toBe(names.length);
    }
  });

  it("상위 난이도가 하위 난이도 드롭을 잃지 않는다 (여명 계열 검증)", () => {
    // 하드는 노말 드롭을 포함하고 칠흑이 추가된다
    expect(dropsOf("진 힐라", "normal").map((d) => d.name)).toContain("데이브레이크 펜던트");
    expect(dropsOf("진 힐라", "hard").map((d) => d.name)).toEqual(expect.arrayContaining(["데이브레이크 펜던트", "고통의 근원"]));
    expect(dropsOf("더스크", "chaos").map((d) => d.name)).toEqual(expect.arrayContaining(["에스텔라 이어링", "거대한 공포"]));
    expect(dropsOf("스우", "extreme").map((d) => d.name)).toContain("루즈 컨트롤 머신 마크");
  });

  it("드롭이 없는 보스는 빈 배열을 돌려주고 UI 에서 빠진다", () => {
    expect(dropsOf("자쿰", "chaos")).toEqual([]);
    expect(hasDrops("자쿰", "chaos")).toBe(false);
    expect(hasDrops("선택받은 세렌", "hard")).toBe(true);
  });

  it("출처와 기준일이 기록돼 있다", () => {
    expect(DROPS_META.updated).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(DROPS_META.sources.length).toBeGreaterThan(0);
  });

  it("주간 결정 보스 중 금별 등급은 모두 드롭 정보가 있다", () => {
    // (아래 본문)
    const missing: string[] = [];
    for (const [boss, diffs] of Object.entries(PRICE_TABLE.prices)) {
      for (const diff of Object.keys(diffs)) {
        const t = tierOf(boss, diff);
        if (t?.grade !== "금") continue;
        if (crystalPrice(boss, diff, "2026-09-17") == null) continue;
        if (!hasDrops(boss, diff)) missing.push(`${boss} ${diff}`);
      }
    }
    // 검은 마법사(월간)는 칠흑 뱃지로 채워져 있고, 나머지 금별은 에테르넬
    expect(missing).toEqual([]);
  });
});

describe("나무위키 주요 보상 아이템 아이콘", () => {
  const nonWeekly = new Set([...(PRICE_TABLE._meta.daily ?? []), ...(PRICE_TABLE._meta.monthly ?? [])]);
  const isWeeklyBoss = (boss: string) => Object.keys(PRICE_TABLE.prices[boss] ?? {}).some((d) => !nonWeekly.has(`${boss} ${d}`));
  const bosses = Object.keys((rawItems as { items: Record<string, unknown> }).items);

  it("수집 대상은 가격표에 있는 주간 결정 보스뿐이다", () => {
    for (const b of bosses) {
      expect(PRICE_TABLE.prices[b], b).toBeTruthy();
      expect(isWeeklyBoss(b), `${b} 는 주간 보스가 아님`).toBe(true);
    }
  });

  it("모든 주간 보스가 주요 보상을 갖는다", () => {
    const missing = Object.keys(PRICE_TABLE.prices).filter((b) => isWeeklyBoss(b) && rewardItemsOf(b).length === 0);
    expect(missing).toEqual([]);
  });

  it("아이콘 파일이 public/items 에 실제로 있고 이름은 URL 인코딩된다", () => {
    const root = path.join(__dirname, "..", "..", "public");
    const missing: string[] = [];
    for (const b of bosses) {
      for (const it of rewardItemsOf(b)) {
        expect(it.file.startsWith("/items/"), `${b}/${it.name}`).toBe(true);
        expect(it.file, `${b}/${it.name}`).not.toMatch(/[가-힣]/); // 인코딩 완료
        if (!existsSync(path.join(root, decodeURIComponent(it.file)))) missing.push(`${b}/${it.name}`);
      }
    }
    expect(missing).toEqual([]);
  });

  it("세트 드롭 이름으로도 아이콘을 찾는다 (표기 차이 허용)", () => {
    // boss_drops.json 과 나무위키 표기가 다른 케이스
    expect(itemIconFor("컴플리트 언더 컨트롤")).toBeTruthy(); // 나무위키: 컴플리트 언더컨트롤
    expect(itemIconFor("미트라의 분노")).toBeTruthy(); // 나무위키: 미트라의 분노 선택 상자
    expect(itemIconFor("저주받은 마도서")).toBeTruthy(); // 나무위키: 저주받은 마도서 선택 상자
    expect(itemIconFor("고통의 근원")).toBeTruthy();
    expect(itemIconFor("존재하지 않는 아이템 이름")).toBeNull();
  });

  it("일간·월간 행에는 주요 보상을 붙이지 않는다", () => {
    // 자쿰은 카오스만 주간. easy/normal 은 일간이라 폴백 금지.
    expect(hasAnyDrops("자쿰", "chaos", true)).toBe(true);
    expect(hasAnyDrops("자쿰", "easy", false)).toBe(false);
    // 검은 마법사는 월간이지만 난이도별 세트 드롭(태초의 뱃지)이 있어 그건 표시된다
    expect(hasAnyDrops("검은 마법사", "hard", false)).toBe(true);
  });
});
