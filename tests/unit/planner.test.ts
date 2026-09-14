import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { parseSnapshot, estimateRevenue, highestClearedTier, type RawScheduler } from "@/lib/maple/scheduler";
import { allocatePlan, buildProfile, initCharConfigFromRegistration, type PlanConfig, type PlanProfile } from "@/lib/maple/planner";
import { weeklyCandidates } from "@/lib/maple/prices";

const fx = (name: string) => JSON.parse(readFileSync(path.join(__dirname, "..", "fixtures", name), "utf8"));
const raw다이아 = fx("sched_다이아태훈_raw2.json") as RawScheduler;
const raw알전임LW = fx("sched_알전임_lastweek_2026-09-09.json") as RawScheduler;
const raw호감LW = fx("sched_호감토끼_lastweek_2026-09-09.json") as RawScheduler;
const planConfig = fx("plan_config.json") as PlanConfig;
const PRICE_DATE = "2026-09-17";

describe("parseSnapshot", () => {
  it("행 파싱 + 플래그 독립", () => {
    const s = parseSnapshot(raw다이아);
    expect(s.name).toBe("다이아태훈");
    expect(s.weeklyClearCount).toBe(5);
    expect(s.weeklyLimit).toBe(12);
    expect(s.bosses.length).toBe(80);
    const dunkelHard = s.bosses.find((b) => b.boss === "듄켈" && b.diff === "hard")!;
    const dunkelNormal = s.bosses.find((b) => b.boss === "듄켈" && b.diff === "normal")!;
    expect(dunkelHard).toMatchObject({ registered: false, completed: true, cycle: "bossWeekly" });
    expect(dunkelNormal).toMatchObject({ registered: true, completed: false });
    expect(s.bosses.filter((b) => b.cycle === "bossDaily").length).toBe(24);
  });
  it("상한 = 클리어 중 티어 최고 (다이아태훈 → 노말 흉성 금★2, 하드 세렌 은★9보다 위)", () => {
    const top = highestClearedTier(parseSnapshot(raw다이아).bosses)!;
    expect(top.boss).toBe("찬란한 흉성");
    expect(top.diff).toBe("normal");
    expect(top.tier?.rank).toBe(25);
  });
  it("수익 추정: 솔로 vs 파티 인원", () => {
    const s = parseSnapshot(raw다이아);
    const solo = estimateRevenue(s.bosses, "2026-09-14");
    expect(solo.byCycle.bossWeekly.count).toBe(5);
    // 카더스크 6980만 + 하진힐 1억600만 + 하듄켈 9440만 + 하세렌 3억5600만 + 노말흉성 6억2500만 = 12억5120만
    expect(solo.totalGross).toBe(1_251_200_000);
    expect(solo.totalValue).toBe(1_251_200_000);
    const party = estimateRevenue(s.bosses, "2026-09-14", (b) => (b === "찬란한 흉성" ? 3 : 1));
    expect(party.totalValue).toBe(1_251_200_000 - 625_000_000 + Math.floor(625_000_000 / 3));
  });
});

describe("allocatePlan — 프로토타입 회귀", () => {
  const snapshots: Record<string, RawScheduler[]> = {
    다이아태훈: [raw다이아],
    알전임: [raw알전임LW],
    호감토끼: [raw호감LW],
  };

  function buildAll(cfg: PlanConfig, extra: Record<string, { level?: number; cls?: string }> = {}) {
    const defaultParty = cfg.default_party ?? 1;
    const profiles: PlanProfile[] = [];
    const warnings: string[] = [];
    for (const [name, c] of Object.entries(cfg.characters)) {
      if (c.skip) continue;
      const snaps = (snapshots[name] ?? []).map((r) => parseSnapshot(r).bosses);
      const r = buildProfile({ charId: name, name, cfg: c, defaultParty, priceDate: PRICE_DATE, snapshotBosses: snaps, ...extra[name] });
      profiles.push(r.profile);
      warnings.push(...r.warnings);
    }
    return { profiles, warnings };
  }

  it("plan_config.json 입력 → 프로토타입 결과(90개, 실수령 88억 7062만)와 일치", () => {
    const { profiles, warnings } = buildAll(planConfig);
    const out = allocatePlan({ priceDate: PRICE_DATE, worldLimit: 90, candidates: weeklyCandidates(PRICE_DATE), profiles });
    expect(out.count).toBe(90);
    // 프로토타입 출력은 만 단위 절삭 표시("88억 7062만", "109억 1383만")
    expect(Math.floor(out.worldValue / 10_000)).toBe(887_062);
    expect(Math.floor(out.worldGross / 10_000)).toBe(1_091_383);
    expect(warnings).toContain("알전임: 고정 픽 13개 > 주간 한도 12개 — 실수령 상위 12개만 사용");
    const byId = Object.fromEntries(out.rows.map((r) => [r.charId, r]));
    expect(byId["알전임"].picks.length).toBe(12);
    expect(byId["알전임"].value).toBe(2_998_400_000);
    expect(byId["봉풀르르"].picks.length).toBe(9);
    expect(byId["봉풀르르"].value).toBe(361_200_000);
    expect(byId["윤비공부해"].value).toBe(302_070_000);
    // 티어 모델: 상한 노말 흉성(금★2)인 캐릭에 노말 카링(금★3)은 안 붙음
    expect(byId["다이아태훈"].picks.some((p) => p.boss === "카링" && p.diff === "normal")).toBe(false);
  });

  it("고정 픽은 상한 무관, 자동은 상한 티어 이하만", () => {
    const { profiles } = buildAll({ default_party: 1, characters: { 알전아님: { ceiling: "루시드 hard", bosses: { "선택받은 세렌 hard": 1 }, auto: true } } });
    const out = allocatePlan({ priceDate: PRICE_DATE, worldLimit: 90, candidates: weeklyCandidates(PRICE_DATE), profiles });
    const picks = out.rows[0].picks;
    expect(picks.find((p) => p.boss === "선택받은 세렌")?.fixed).toBe(true);
    for (const p of picks.filter((p) => !p.fixed)) expect(p.tier!.rank).toBeLessThanOrEqual(17); // 은★3 = 14+3
  });

  it("월드 한도와 캐릭터 한도", () => {
    const { profiles } = buildAll({ default_party: 1, characters: { 알전임: { ceiling: "최초의 대적자 normal" }, 호감토끼: { ceiling: "진 힐라 hard" } } });
    const out = allocatePlan({ priceDate: PRICE_DATE, worldLimit: 15, candidates: weeklyCandidates(PRICE_DATE), profiles });
    expect(out.count).toBe(15);
    for (const r of out.rows) expect(r.picks.length).toBeLessThanOrEqual(12);
    const bosses = out.rows.map((r) => r.picks.map((p) => p.boss));
    for (const list of bosses) expect(new Set(list).size).toBe(list.length); // 보스당 1난이도
  });

  it("파티 유래 고정 픽 병합: 설정이 우선, 나머지는 party", () => {
    const r = buildProfile({
      charId: "x", name: "x", cfg: { bosses: { "듄켈 hard": 1 } }, defaultParty: 1, priceDate: PRICE_DATE, snapshotBosses: [],
      partyPicks: { "듄켈 normal": 2, "진 힐라 hard": 2 },
    });
    expect(r.profile.fixed.map((f) => `${f.boss} ${f.diff} ${f.party} ${f.source}`)).toEqual(["듄켈 hard 1 config", "진 힐라 hard 2 party"]);
    expect(r.profile.auto).toBe(false);
  });

  it("파티 유래 고정 픽만 있으면 auto 는 기본 true (나머지 자동 채움)", () => {
    const r = buildProfile({
      charId: "x", name: "x", cfg: { ceiling: "진 힐라 hard" }, defaultParty: 1, priceDate: PRICE_DATE, snapshotBosses: [],
      partyPicks: { "선택받은 세렌 hard": 3 },
    });
    expect(r.profile.auto).toBe(true);
    const out = allocatePlan({ priceDate: PRICE_DATE, worldLimit: 90, candidates: weeklyCandidates(PRICE_DATE), profiles: [r.profile] });
    const picks = out.rows[0].picks;
    expect(picks.length).toBe(12);
    expect(picks.find((p) => p.boss === "선택받은 세렌")).toMatchObject({ fixed: true, party: 3, diff: "hard" });
    expect(picks.filter((p) => !p.fixed).every((p) => p.tier!.rank <= 20)).toBe(true); // 은★6 = 20
  });

  it("월간(검은 마법사)·일간 보스는 자동 배분에 안 들어감", () => {
    const { profiles } = buildAll({ default_party: 1, characters: { 알전임: { ceiling: "카링 extreme", bosses: { "검은 마법사 hard": 1 } } } });
    const out = allocatePlan({ priceDate: PRICE_DATE, worldLimit: 90, candidates: weeklyCandidates(PRICE_DATE), profiles });
    const picks = out.rows[0]?.picks ?? [];
    expect(picks.some((p) => p.boss === "검은 마법사")).toBe(false);
    expect(picks.some((p) => p.boss === "매그너스" && p.diff === "normal")).toBe(false);
  });

  it("상한 미파악 → idle", () => {
    const { profiles } = buildAll({ default_party: 1, characters: { 없는캐릭: {} } });
    const out = allocatePlan({ priceDate: PRICE_DATE, worldLimit: 90, candidates: weeklyCandidates(PRICE_DATE), profiles });
    expect(out.idle).toEqual(["없는캐릭"]);
  });
});

describe("initCharConfigFromRegistration", () => {
  it("등록 14개(보스 기준) → 상위 12개, 이전 party 유지", () => {
    const s = parseSnapshot(raw다이아);
    const r = initCharConfigFromRegistration({ name: "다이아태훈", keep: { party: 2 }, defaultParty: 1, priceDate: PRICE_DATE, bosses: s.bosses, cap: s.weeklyLimit });
    const bosses = r.cfg.bosses as Record<string, number>;
    expect(Object.keys(bosses).length).toBe(12);
    expect(Object.values(bosses).every((v) => v === 2)).toBe(true);
    expect(r.cfg.auto).toBe(false);
    expect(r.cfg._note).toMatch(/등록 14개 > 한도 12개/); // 16행 등록이지만 보스당 1난이도로 14개
    // 등록 기준이라 클리어된 하드 듄켈(미등록)은 안 들어가고, 상위 12개엔 고가 보스가 남음
    expect(bosses["듄켈 hard"]).toBeUndefined();
    expect(bosses["찬란한 흉성 normal"]).toBe(2);
    expect(bosses["선택받은 세렌 hard"]).toBe(2);
  });
  it("skip 유지 / 조회 실패", () => {
    expect(initCharConfigFromRegistration({ name: "a", keep: { skip: true }, defaultParty: 1, priceDate: PRICE_DATE, bosses: null }).cfg).toEqual({ skip: true });
    expect(initCharConfigFromRegistration({ name: "a", keep: { ceiling: "듄켈 hard" }, defaultParty: 1, priceDate: PRICE_DATE, bosses: null }).cfg.ceiling).toBe("듄켈 hard");
  });
});
