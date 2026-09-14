/**
 * 전투력 대표값 로직.
 * - 최대 전투력 기록 시 당시 착용 장비 구성(해시)을 함께 저장
 * - 갱신 시 현재 장비 프리셋 1/2/3 + 착용 구성과 대조:
 *     · 저장된 구성이 어디든 존재 → 세팅 유지 중 → 최대치 유지 (드메템 착용과 무관)
 *     · 어디에도 없음           → 세팅 변경됨 → 최대치 무효화, 현재 값으로 재설정
 * 외형/캐시 요소는 해시에서 제외해 코디 변경으로 오발동하지 않게 한다.
 */
import { createHash } from "node:crypto";

export interface EquipItem {
  item_equipment_slot?: string;
  item_name?: string;
  starforce?: string;
  item_total_option?: unknown;
  potential_option_grade?: string | null;
  potential_option_1?: string | null;
  potential_option_2?: string | null;
  potential_option_3?: string | null;
  additional_potential_option_grade?: string | null;
  additional_potential_option_1?: string | null;
  additional_potential_option_2?: string | null;
  additional_potential_option_3?: string | null;
  soul_name?: string | null;
  [k: string]: unknown;
}

export interface EquipmentResponse {
  item_equipment?: EquipItem[];
  item_equipment_preset_1?: EquipItem[];
  item_equipment_preset_2?: EquipItem[];
  item_equipment_preset_3?: EquipItem[];
  [k: string]: unknown;
}

export interface SetupHashes {
  equipped: string;
  p1: string;
  p2: string;
  p3: string;
}

export interface BestRecord {
  power: number;
  ts: string;
  setupHash: string;
}

export interface PowerRecord {
  name?: string;
  entries: { ts: string; power: number }[];
  best: BestRecord | null;
}

function normalizeItem(it: EquipItem) {
  return {
    slot: it.item_equipment_slot,
    name: it.item_name,
    star: it.starforce ?? "0",
    total: it.item_total_option ?? null,
    pot: [it.potential_option_grade, it.potential_option_1, it.potential_option_2, it.potential_option_3],
    add: [
      it.additional_potential_option_grade,
      it.additional_potential_option_1,
      it.additional_potential_option_2,
      it.additional_potential_option_3,
    ],
    soul: it.soul_name ?? null,
  };
}

export function hashItemList(list: EquipItem[] | undefined | null): string {
  const norm = (list ?? []).map(normalizeItem).sort((a, b) => ((a.slot ?? "") > (b.slot ?? "") ? 1 : -1));
  return createHash("sha1").update(JSON.stringify(norm)).digest("hex").slice(0, 16);
}

/** 착용 + 프리셋 1/2/3 각각의 구성 해시 */
export function setupHashes(equip: EquipmentResponse): SetupHashes {
  return {
    equipped: hashItemList(equip.item_equipment),
    p1: hashItemList(equip.item_equipment_preset_1),
    p2: hashItemList(equip.item_equipment_preset_2),
    p3: hashItemList(equip.item_equipment_preset_3),
  };
}

export type BestUpdateNote = "invalidated" | "new_best" | null;

export interface BestUpdateResult {
  best: BestRecord;
  note: BestUpdateNote;
  /** 무효화된 경우 이전 최대치 */
  previousBest?: BestRecord;
}

/**
 * 대표 전투력 갱신. rec 를 변경하지 않고 결과를 반환한다.
 * power 가 null 이면 기록만 남기지 않고 기존 best 유지.
 */
export function updateBest(
  prevBest: BestRecord | null,
  power: number,
  hashes: SetupHashes,
  now: string = new Date().toISOString(),
): BestUpdateResult {
  let best = prevBest;
  let note: BestUpdateNote = null;
  let previousBest: BestRecord | undefined;

  // 1) 기존 최대치의 세팅이 아직 존재하는지 검사
  if (best) {
    const alive = Object.values(hashes).includes(best.setupHash);
    if (!alive) {
      previousBest = best;
      best = null;
      note = "invalidated";
    }
  }

  // 2) 최대치 갱신 (무효화됐다면 현재 관측값이 새 기준이 됨)
  if (!best || power > best.power) {
    best = { power, ts: now, setupHash: hashes.equipped };
    if (!note) note = "new_best";
  }

  return { best, note, previousBest };
}
