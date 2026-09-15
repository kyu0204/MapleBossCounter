import { describe, expect, it } from "vitest";
import rawDrops from "@/data/boss_drops.json";
import { dropsOf, hasDrops, DROP_SET_STYLE, DROPS_META, type DropSet } from "@/lib/maple/drops";
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
