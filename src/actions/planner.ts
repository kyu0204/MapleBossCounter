"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUserId } from "@/auth";
import { ownedCharacterByOcid } from "@/services/characterSync";
import { patchCharConfig, savePlanConfigRow } from "@/services/planInput";
import { kstDateStr } from "@/lib/maple/kst";
import { normalizeBossList } from "@/lib/maple/bossKey";
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
  await savePlanConfigRow(userId, world, p.data as PlanConfig);
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
  const c = await ownedCharacterByOcid(userId, ocid);
  if (!c) return { ok: false, message: "내 캐릭터가 아닙니다" };
  if (!c.world) return { ok: false, message: "캐릭터 월드 정보가 없습니다. 캐릭터 목록을 동기화해주세요" };

  const p = BossesSchema.safeParse(bosses);
  if (!p.success) return { ok: false, message: p.error.issues[0]?.message ?? "형식 오류" };

  const v = validateBossSelection(p.data, kstDateStr());
  if (!v.ok) return { ok: false, message: v.error };
  const clean = v.clean;

  const prev = await patchCharConfig(userId, c.world, ocid, {});
  const hadConfig = prev.bosses != null;
  await patchCharConfig(userId, c.world, ocid, {
    bosses: clean,
    // 처음 지정 시에만 auto 를 끈다. 이후에는 사용자가 플래너에서 고른 값을 유지.
    auto: hadConfig ? prev.auto : Object.keys(clean).length === 0,
  });

  revalidatePath(`/me/characters/${ocid}`);
  revalidatePath("/planner");
  revalidatePath("/me");
  return { ok: true, message: `${Object.keys(clean).length}개 저장됨`, data: { count: Object.keys(clean).length } };
}

const KeySchema = z.string().max(40);
const PartySchema = z.number().int().min(1).max(6);

/**
 * 보스 한 줄의 파티 인원만 바꾼다.
 *
 * 목록에서 여러 줄을 잇따라 고칠 수 있으므로, 클라이언트가 들고 있는 목록을 통째로
 * 다시 보내면 안 된다 — 재검증이 끝나기 전에 다음 줄을 고치면 앞의 변경이 덮인다.
 * 여기서 서버에 저장된 값을 읽어 그 키 하나만 얹는다.
 *
 * 파티 등록에서 자동으로 들어온 보스도 여기서 인원을 정하면 직접 고른 픽으로 굳는다.
 * 목록의 모든 줄에서 인원을 정할 수 있어야 하고, 사용자가 정한 값이 파티 인원 변동에
 * 흔들리지 않아야 하기 때문이다.
 */
export async function setCharacterBossParty(ocid: string, key: string, party: number): Promise<ActionResult<{ party: number }>> {
  const userId = await requireUserId();
  const c = await ownedCharacterByOcid(userId, ocid);
  if (!c) return { ok: false, message: "내 캐릭터가 아닙니다" };
  if (!c.world) return { ok: false, message: "캐릭터 월드 정보가 없습니다. 캐릭터 목록을 동기화해주세요" };

  const k = KeySchema.safeParse(key);
  const n = PartySchema.safeParse(party);
  if (!k.success || !n.success) return { ok: false, message: "인원은 1~6 사이여야 합니다" };

  const prev = await patchCharConfig(userId, c.world, ocid, {});
  const cur = Object.fromEntries(normalizeBossList(prev.bosses).map((b) => [b.key, b.party ?? 1]));
  const next = { ...cur, [k.data]: n.data };

  const v = validateBossSelection(next, kstDateStr());
  if (!v.ok) return { ok: false, message: v.error };

  await patchCharConfig(userId, c.world, ocid, { bosses: v.clean, auto: prev.auto ?? false });

  revalidatePath(`/me/characters/${ocid}`);
  revalidatePath("/planner");
  revalidatePath("/me");
  return { ok: true, message: `${n.data}인격으로 저장됨`, data: { party: n.data } };
}
