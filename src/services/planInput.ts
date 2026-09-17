import "server-only";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { planConfigs } from "@/lib/db/schema";
import { listOwnedCharacters } from "./characterSync";
import { ceilingSnapshots, latestSnapshot, parsed } from "./snapshotService";
import { partyPicksByCharacter } from "./partyLink";
import type { BossClearRow } from "@/lib/maple/scheduler";
import type { CharPlanConfig, PlanConfig } from "@/lib/maple/planner";

/** 클라이언트 PlannerBoard 에 넘기는 캐릭터 단위 입력. 상한 산정용 클리어 행은 주간·완료만 추린다. */
export interface PlannerCharacter {
  ocid: string;
  name: string;
  cls: string | null;
  level: number | null;
  world: string | null;
  hidden: boolean;
  cap: number;
  clearedWeekly: BossClearRow[][];
  /** 실시간 스냅샷의 등록(registration_flag) 주간 보스 — 'init' 용 */
  registeredWeekly: BossClearRow[];
  partyPicks: Record<string, number>;
  snapshotDates: string[];
}

export interface PlannerWorldInput {
  world: string;
  characters: PlannerCharacter[];
  config: PlanConfig;
}

const DEFAULT_LIMIT = Number(process.env.WEEKLY_WORLD_SALE_LIMIT ?? 90);

export async function loadPlanConfig(userId: string, world: string): Promise<PlanConfig> {
  const [row] = await db.select().from(planConfigs).where(and(eq(planConfigs.userId, userId), eq(planConfigs.world, world))).limit(1);
  const cfg = (row?.config as PlanConfig | undefined) ?? { characters: {} };
  return { default_party: cfg.default_party ?? 1, world_limit: cfg.world_limit ?? DEFAULT_LIMIT, characters: cfg.characters ?? {} };
}

export async function savePlanConfigRow(userId: string, world: string, config: PlanConfig) {
  const updatedAt = new Date().toISOString();
  await db
    .insert(planConfigs)
    .values({ userId, world, config, updatedAt })
    .onConflictDoUpdate({ target: [planConfigs.userId, planConfigs.world], set: { config, updatedAt } });
}

/** 캐릭터 한 명의 설정만 읽는다 (캐릭터 상세 페이지용). */
export async function loadCharConfig(userId: string, world: string, ocid: string): Promise<CharPlanConfig> {
  return (await loadPlanConfig(userId, world)).characters[ocid] ?? {};
}

/**
 * 캐릭터 한 명의 설정만 갱신한다. 나머지 캐릭터·월드 설정은 그대로 둔다.
 * patch 의 값이 undefined 인 키는 삭제로 취급.
 */
export async function patchCharConfig(userId: string, world: string, ocid: string, patch: Partial<CharPlanConfig>): Promise<CharPlanConfig> {
  const cfg = await loadPlanConfig(userId, world);
  const next: CharPlanConfig = { ...(cfg.characters[ocid] ?? {}) };
  for (const [k, v] of Object.entries(patch)) {
    if (v === undefined) delete next[k as keyof CharPlanConfig];
    else (next as Record<string, unknown>)[k] = v;
  }
  cfg.characters = { ...cfg.characters, [ocid]: next };
  await savePlanConfigRow(userId, world, cfg);
  return next;
}

/** 플래너 기본 표시 레벨. 이보다 낮아도 파티 등록·설정에 있으면 포함. */
export const PLANNER_MIN_LEVEL = Number(process.env.PLANNER_MIN_LEVEL ?? 200);

export async function buildPlannerInputs(userId: string): Promise<PlannerWorldInput[]> {
  const partyPicks = await partyPicksByCharacter(userId);
  const configuredIds = new Set<string>();
  for (const row of await db.select({ config: planConfigs.config }).from(planConfigs).where(eq(planConfigs.userId, userId))) {
    for (const k of Object.keys((row.config as PlanConfig)?.characters ?? {})) configuredIds.add(k);
  }
  const chars = (await listOwnedCharacters(userId, true)).filter((c) => (c.level ?? 0) >= PLANNER_MIN_LEVEL || partyPicks.has(c.id) || configuredIds.has(c.ocid));
  const byWorld = new Map<string, PlannerCharacter[]>();
  for (const c of chars) {
    const snaps = await ceilingSnapshots(c.id);
    const latest = parsed(await latestSnapshot(c.id));
    const item: PlannerCharacter = {
      ocid: c.ocid,
      name: c.name,
      cls: c.cls,
      level: c.level,
      world: c.world,
      hidden: c.hidden,
      cap: snaps[0]?.weeklyLimit ?? 12,
      clearedWeekly: snaps.map((s) => s.bosses.filter((b) => b.cycle === "bossWeekly" && b.completed)),
      registeredWeekly: latest?.bosses.filter((b) => b.cycle === "bossWeekly" && b.registered) ?? [],
      partyPicks: partyPicks.get(c.id) ?? {},
      snapshotDates: snaps.map((s) => s.date?.slice(0, 10) ?? "?"),
    };
    const w = c.world ?? "?";
    if (!byWorld.has(w)) byWorld.set(w, []);
    byWorld.get(w)!.push(item);
  }
  return Promise.all(
    [...byWorld.entries()]
      .sort((a, b) => b[1].length - a[1].length)
      .map(async ([world, characters]) => ({ world, characters: characters.sort((a, b) => (b.level ?? 0) - (a.level ?? 0)), config: await loadPlanConfig(userId, world) })),
  );
}
