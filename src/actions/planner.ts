"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUserId } from "@/auth";
import { ownedCharacterByOcid } from "@/services/characterSync";
import { patchCharConfig, savePlanConfigRow } from "@/services/planInput";
import { kstDateStr } from "@/lib/maple/kst";
import { validateBossSelection, type PlanConfig } from "@/lib/maple/planner";
import type { ActionResult } from "./nexon-key";

const CharSchema = z.object({
  skip: z.boolean().optional(),
  auto: z.boolean().optional(),
  party: z.number().int().min(1).max(6).optional(),
  ceiling: z.string().max(40).optional(),
  bosses: z.record(z.string().max(40), z.number().int().min(1).max(6)).optional(),
  _note: z.string().max(200).optional(),
});
const ConfigSchema = z.object({
  default_party: z.number().int().min(1).max(6).optional(),
  world_limit: z.number().int().min(1).max(500).optional(),
  characters: z.record(z.string().max(64), CharSchema),
});

export async function savePlanConfig(world: string, config: PlanConfig): Promise<ActionResult> {
  const userId = await requireUserId();
  const p = ConfigSchema.safeParse(config);
  if (!p.success) return { ok: false, message: p.error.issues[0]?.message ?? "설정 형식 오류" };
  if (!world || world.length > 20) return { ok: false, message: "월드 오류" };
  savePlanConfigRow(userId, world, p.data as PlanConfig);
  revalidatePath("/planner");
  return { ok: true, message: "저장됨" };
}

const BossesSchema = z.record(z.string().max(40), z.number().int().min(1).max(6));

/**
 * 캐릭터 상세에서 "이번 주 갈 보스"를 저장한다.
 * 플래너와 같은 저장소(plan_configs)의 characters[ocid].bosses 를 쓰므로 양쪽이 항상 일치한다.
 * auto 는 건드리지 않되, 처음 지정하는 경우에만 false 로 내려 사용자가 고른 것만 들어가게 한다.
 */
export async function setCharacterBosses(ocid: string, bosses: Record<string, number>): Promise<ActionResult<{ count: number }>> {
  const userId = await requireUserId();
  const c = ownedCharacterByOcid(userId, ocid);
  if (!c) return { ok: false, message: "내 캐릭터가 아닙니다" };
  if (!c.world) return { ok: false, message: "캐릭터 월드 정보가 없습니다. 캐릭터 목록을 동기화해주세요" };

  const p = BossesSchema.safeParse(bosses);
  if (!p.success) return { ok: false, message: p.error.issues[0]?.message ?? "형식 오류" };

  const v = validateBossSelection(p.data, kstDateStr());
  if (!v.ok) return { ok: false, message: v.error };
  const clean = v.clean;

  const prev = patchCharConfig(userId, c.world, ocid, {});
  const hadConfig = prev.bosses != null;
  patchCharConfig(userId, c.world, ocid, {
    bosses: clean,
    // 처음 지정 시에만 auto 를 끈다. 이후에는 사용자가 플래너에서 고른 값을 유지.
    auto: hadConfig ? prev.auto : Object.keys(clean).length === 0,
  });

  revalidatePath(`/me/characters/${ocid}`);
  revalidatePath("/planner");
  revalidatePath("/me");
  return { ok: true, message: `${Object.keys(clean).length}개 저장됨`, data: { count: Object.keys(clean).length } };
}
