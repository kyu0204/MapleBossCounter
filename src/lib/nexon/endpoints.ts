import "server-only";
import { nx } from "./client";
import type { NexonCredential } from "./credentials";
import { NexonApiError } from "./errors";
import type { EquipmentResponse } from "@/lib/maple/power";
import type { RawScheduler } from "@/lib/maple/scheduler";
import { sumForces, type Forces, type SymbolRow } from "@/lib/maple/force";

export const TTL = {
  id: 24 * 3600e3,
  basic: 3600e3,
  stat: 3600e3,
  equip: 3600e3,
  symbol: 3600e3,
  list: 10 * 60e3,
  schedulerRealtime: 5 * 60e3,
  schedulerMissing: 24 * 3600e3,
} as const;

export interface BasicResponse {
  date: string | null;
  character_name: string;
  world_name: string;
  character_gender: string;
  character_class: string;
  character_class_level: string;
  character_level: number;
  character_exp: number;
  character_exp_rate: string;
  character_guild_name: string | null;
  character_image: string;
  character_date_create: string;
  access_flag: string;
  liberation_quest_clear_flag?: string;
  liberation_quest_clear?: string;
}

export interface StatResponse {
  date: string | null;
  character_class: string;
  final_stat: { stat_name: string; stat_value: string }[];
  remain_ap: number;
}

export interface CharacterListResponse {
  account_list: {
    account_id: string;
    character_list: { ocid: string; character_name: string; world_name: string; character_class: string; character_level: number }[];
  }[];
}

export async function getOcid(cred: NexonCredential, name: string, force = false): Promise<string> {
  const r = await nx<{ ocid: string }>(cred, "/maplestory/v1/id", { character_name: name }, { ttlMs: TTL.id, cacheScope: "public", force });
  return r.ocid;
}

export const getBasic = (cred: NexonCredential, ocid: string, force = false) =>
  nx<BasicResponse>(cred, "/maplestory/v1/character/basic", { ocid }, { ttlMs: TTL.basic, cacheScope: "public", force });

export const getStat = (cred: NexonCredential, ocid: string, force = false) =>
  nx<StatResponse>(cred, "/maplestory/v1/character/stat", { ocid }, { ttlMs: TTL.stat, cacheScope: "public", force });

export const getEquipment = (cred: NexonCredential, ocid: string, force = false) =>
  nx<EquipmentResponse>(cred, "/maplestory/v1/character/item-equipment", { ocid }, { ttlMs: TTL.equip, cacheScope: "public", force });

export interface SymbolResponse {
  date: string | null;
  character_class: string;
  symbol: SymbolRow[] | null;
}

export const getSymbols = (cred: NexonCredential, ocid: string, force = false) =>
  nx<SymbolResponse>(cred, "/maplestory/v1/character/symbol-equipment", { ocid }, { ttlMs: TTL.symbol, cacheScope: "public", force });

/**
 * 아케인포스·어센틱포스 합. 심볼을 하나도 안 낀 캐릭터는 0/0 이다.
 *
 * 포스는 파티 짤 때 보는 값이라 이것 때문에 새로고침 전체가 실패하면 곤란하다.
 * 심볼 조회만 실패하면 null 을 주고 부르는 쪽이 이전 값을 지키게 한다.
 */
export async function getForces(cred: NexonCredential, ocid: string, force = false): Promise<Forces | null> {
  try {
    const r = await getSymbols(cred, ocid, force);
    return sumForces(r.symbol);
  } catch {
    return null;
  }
}

export async function getCombatPower(cred: NexonCredential, ocid: string, force = false): Promise<number | null> {
  const stat = await getStat(cred, ocid, force);
  const row = (stat.final_stat ?? []).find((s) => s.stat_name === "전투력");
  return row ? Number(row.stat_value) : null;
}

/** 계정 한정: 키 소유 계정의 캐릭터 목록 */
export const getMyCharacterList = (cred: NexonCredential, force = false) =>
  nx<CharacterListResponse>(cred, "/maplestory/v1/character/list", {}, { ttlMs: TTL.list, force });

/**
 * 계정 한정: 스케줄러. date 없으면 실시간(5분 캐시).
 * date 지정 시 기록이 없으면 400 OPENAPI00004 → null 반환 (24h negative cache).
 */
export async function getScheduler(cred: NexonCredential, ocid: string, date?: string, force = false): Promise<RawScheduler | null> {
  if (!date) return nx<RawScheduler>(cred, "/maplestory/v1/scheduler/character-state", { ocid }, { ttlMs: TTL.schedulerRealtime, force });
  try {
    return await nx<RawScheduler>(cred, "/maplestory/v1/scheduler/character-state", { ocid, date }, { ttlMs: 0 });
  } catch (e) {
    if (e instanceof NexonApiError && e.isInvalidParam) return null;
    throw e;
  }
}
