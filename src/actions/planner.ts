"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUserId } from "@/auth";
import { savePlanConfigRow } from "@/services/planInput";
import type { PlanConfig } from "@/lib/maple/planner";
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
