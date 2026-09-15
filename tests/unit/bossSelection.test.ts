import { describe, expect, it } from "vitest";
import { validateBossSelection, buildProfile, allocatePlan } from "@/lib/maple/planner";
import { weeklyCandidates } from "@/lib/maple/prices";
import { bossTag, bossShort, DIFF_SHORT, DIFF_LABEL, DIFF_SOLID } from "@/lib/maple/bossMeta";
import { bossIconFile } from "@/components/boss/BossIcon";
import { PRICE_TABLE } from "@/lib/maple/prices";
import { isWeeklyCrystal } from "@/lib/maple/prices";

const DATE = "2026-09-17";

describe("validateBossSelection", () => {
  it("정상 선택은 그대로 통과", () => {
    const r = validateBossSelection({ "선택받은 세렌 hard": 3, "진 힐라 hard": 1 }, DATE);
    expect(r).toEqual({ ok: true, clean: { "선택받은 세렌 hard": 3, "진 힐라 hard": 1 } });
  });
  it("같은 보스 두 난이도는 거부", () => {
    const r = validateBossSelection({ "듄켈 hard": 1, "듄켈 normal": 1 }, DATE);
    expect(r).toMatchObject({ ok: false });
    if (!r.ok) expect(r.error).toContain("난이도 하나만");
  });
  it("일간·월간 결정은 거부", () => {
    expect(validateBossSelection({ "검은 마법사 hard": 1 }, DATE)).toMatchObject({ ok: false });
    expect(validateBossSelection({ "매그너스 normal": 1 }, DATE)).toMatchObject({ ok: false });
    // 같은 보스라도 주간 행은 통과
    expect(validateBossSelection({ "매그너스 hard": 1 }, DATE)).toMatchObject({ ok: true });
  });
  it("가격표에 없는 보스·잘못된 표기·인원 범위", () => {
    expect(validateBossSelection({ "없는보스 hard": 1 }, DATE)).toMatchObject({ ok: false });
    expect(validateBossSelection({ 듄켈: 1 }, DATE)).toMatchObject({ ok: false });
    expect(validateBossSelection({ "듄켈 hard": 0 }, DATE)).toMatchObject({ ok: false });
    expect(validateBossSelection({ "듄켈 hard": 7 }, DATE)).toMatchObject({ ok: false });
    expect(validateBossSelection({}, DATE)).toEqual({ ok: true, clean: {} });
  });
});

describe("캐릭터 상세에서 고른 보스가 플래너 고정 픽으로 이어짐", () => {
  it("선택한 보스는 상한과 무관하게 픽에 포함되고 인원이 반영된다", () => {
    const sel = validateBossSelection({ "선택받은 세렌 hard": 3, "진 힐라 hard": 1 }, DATE);
    expect(sel.ok).toBe(true);
    if (!sel.ok) return;
    const { profile } = buildProfile({
      charId: "c1", name: "테스트", cfg: { bosses: sel.clean, auto: false },
      defaultParty: 1, priceDate: DATE, snapshotBosses: [],
    });
    expect(profile.fixed.map((f) => `${f.boss} ${f.diff}×${f.party}`)).toEqual(["선택받은 세렌 hard×3", "진 힐라 hard×1"]);
    const out = allocatePlan({ priceDate: DATE, worldLimit: 90, candidates: weeklyCandidates(DATE), profiles: [profile] });
    expect(out.rows[0].picks.every((p) => p.fixed)).toBe(true);
    // 하세렌 3억200만 ÷ 3 + 하진힐 1억
    expect(out.rows[0].value).toBe(Math.floor(302_000_000 / 3) + 100_000_000);
  });
});

describe("보스 표기·아이콘", () => {
  it("약칭 + 난이도 한 글자", () => {
    expect(bossTag("선택받은 세렌", "hard")).toBe("하세렌");
    expect(bossTag("더스크", "chaos")).toBe("카더스크");
    expect(bossTag("스우", "extreme")).toBe("익스우");
    expect(bossTag("가디언 엔젤 슬라임", "chaos")).toBe("카가엔슬");
    expect(bossShort("림보")).toBe("림보");
    expect(DIFF_SHORT.easy).toBe("이");
  });
  it("난이도 표기는 배지 한 벌로 통일 (한 글자 / 전체 / 색)", () => {
    for (const d of ["easy", "normal", "hard", "chaos", "extreme"] as const) {
      expect(DIFF_SHORT[d]).toHaveLength(1);
      expect(DIFF_LABEL[d].length).toBeGreaterThan(1);
      expect(DIFF_SOLID[d]).toContain("bg-");
    }
    // 난이도마다 색이 달라야 구분된다
    expect(new Set(Object.values(DIFF_SOLID)).size).toBe(5);
  });
  it("주간 보스는 전부 아이콘 파일이 있고 URL 인코딩된다", () => {
    const missing: string[] = [];
    for (const [boss, diffs] of Object.entries(PRICE_TABLE.prices)) {
      if (!Object.keys(diffs).some((d) => isWeeklyCrystal(boss, d))) continue;
      if (!bossIconFile(boss)) missing.push(boss);
    }
    expect(missing).toEqual([]);
    const f = bossIconFile("선택받은 세렌")!;
    expect(f.startsWith("/bosses/")).toBe(true);
    expect(f).not.toMatch(/[가-힣]/); // 인코딩되어 한글이 남지 않음
  });
});
