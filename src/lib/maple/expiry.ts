/**
 * 기간제 아이템 만료일 수집 (순수 함수).
 *
 * 넥슨 응답 네 종류에서 date_expire 가 있는 항목만 뽑는다. 응답 모양은 문서 기준이고
 * 칸이 빠져 있어도 죽지 않게 전부 선택적으로 읽는다.
 *   /character/cashitem-equipment  cash_item_equipment_base[] + preset_1~3 + additional_*
 *   /character/pet-equipment       pet_1~3_date_expire, pet_N_equipment, pet_N_auto_skill(스킬 만료는 없음)
 *   /character/android-equipment   android_cash_item_equipment[]
 *   /character/item-equipment      item_equipment[] (+ title.date_expire)
 * 같은 아이템이 착용본과 프리셋에 겹쳐 나오므로 (source, name, expireAt) 로 중복을 없앤다.
 */
import { parseNexonDate } from "./nexonDate";

export type ExpirySource = "cash" | "pet" | "android" | "equip" | "title";

export interface ExpiryRow {
  source: ExpirySource;
  slot: string | null;
  name: string;
  icon: string | null;
  /** UTC ISO */
  expireAt: string;
}

interface CashItem {
  cash_item_equipment_part?: string;
  cash_item_equipment_slot?: string;
  cash_item_name?: string;
  cash_item_icon?: string;
  date_expire?: string | null;
  date_option_expire?: string | null;
  [k: string]: unknown;
}

export interface CashItemResponse {
  cash_item_equipment_base?: CashItem[] | null;
  cash_item_equipment_preset_1?: CashItem[] | null;
  cash_item_equipment_preset_2?: CashItem[] | null;
  cash_item_equipment_preset_3?: CashItem[] | null;
  additional_cash_item_equipment_base?: CashItem[] | null;
  additional_cash_item_equipment_preset_1?: CashItem[] | null;
  additional_cash_item_equipment_preset_2?: CashItem[] | null;
  additional_cash_item_equipment_preset_3?: CashItem[] | null;
  [k: string]: unknown;
}

export interface PetResponse {
  [k: string]: unknown;
}

export interface AndroidResponse {
  android_name?: string | null;
  android_cash_item_equipment?: CashItem[] | null;
  [k: string]: unknown;
}

interface EquipItemLike {
  item_equipment_slot?: string;
  item_name?: string;
  item_icon?: string;
  date_expire?: string | null;
  [k: string]: unknown;
}

export interface EquipResponseLike {
  item_equipment?: EquipItemLike[] | null;
  title?: { title_name?: string; title_icon?: string; date_expire?: string | null; date_option_expire?: string | null } | null;
  [k: string]: unknown;
}

export interface ExpiryPayloads {
  cash?: CashItemResponse | null;
  pet?: PetResponse | null;
  android?: AndroidResponse | null;
  equip?: EquipResponseLike | null;
}

function pushCash(out: ExpiryRow[], list: CashItem[] | null | undefined, source: "cash" | "android") {
  for (const it of list ?? []) {
    const name = it.cash_item_name?.trim();
    if (!name) continue;
    const base = { source, slot: it.cash_item_equipment_slot ?? it.cash_item_equipment_part ?? null, icon: it.cash_item_icon ?? null };
    const exp = parseNexonDate(it.date_expire);
    if (exp) out.push({ ...base, name, expireAt: exp });
    // 옵션(예: 라벨·프리즘) 만료는 본체와 따로 온다. 본체가 영구인데 옵션만 기간제일 수 있다.
    const opt = parseNexonDate(it.date_option_expire);
    if (opt && opt !== exp) out.push({ ...base, name: `${name} (옵션)`, expireAt: opt });
  }
}

export function collectExpiries(p: ExpiryPayloads): ExpiryRow[] {
  const out: ExpiryRow[] = [];

  const cash = p.cash ?? {};
  for (const key of [
    "cash_item_equipment_base",
    "cash_item_equipment_preset_1",
    "cash_item_equipment_preset_2",
    "cash_item_equipment_preset_3",
    "additional_cash_item_equipment_base",
    "additional_cash_item_equipment_preset_1",
    "additional_cash_item_equipment_preset_2",
    "additional_cash_item_equipment_preset_3",
  ] as const) {
    pushCash(out, cash[key], "cash");
  }

  const pet = p.pet ?? {};
  for (const n of [1, 2, 3]) {
    const name = typeof pet[`pet_${n}_name`] === "string" ? String(pet[`pet_${n}_name`]).trim() : "";
    const exp = parseNexonDate(pet[`pet_${n}_date_expire`]);
    if (name && exp) out.push({ source: "pet", slot: `펫 ${n}`, name, icon: typeof pet[`pet_${n}_icon`] === "string" ? String(pet[`pet_${n}_icon`]) : null, expireAt: exp });
    // 펫 장비(펫 아이템)에도 기간이 붙는 경우가 있다
    const eq = pet[`pet_${n}_equipment`] as { item_name?: string; item_icon?: string; date_expire?: string | null } | null | undefined;
    const eqExp = parseNexonDate(eq?.date_expire);
    if (eq?.item_name && eqExp) out.push({ source: "pet", slot: `펫 ${n} 장비`, name: eq.item_name, icon: eq.item_icon ?? null, expireAt: eqExp });
  }

  pushCash(out, p.android?.android_cash_item_equipment, "android");

  for (const it of p.equip?.item_equipment ?? []) {
    const exp = parseNexonDate(it.date_expire);
    if (it.item_name && exp) out.push({ source: "equip", slot: it.item_equipment_slot ?? null, name: it.item_name, icon: it.item_icon ?? null, expireAt: exp });
  }
  const title = p.equip?.title;
  const titleExp = parseNexonDate(title?.date_expire);
  if (title?.title_name && titleExp) out.push({ source: "title", slot: "칭호", name: title.title_name, icon: title.title_icon ?? null, expireAt: titleExp });
  const titleOpt = parseNexonDate(title?.date_option_expire);
  if (title?.title_name && titleOpt && titleOpt !== titleExp) out.push({ source: "title", slot: "칭호", name: `${title.title_name} (옵션)`, icon: title.title_icon ?? null, expireAt: titleOpt });

  // 착용본·프리셋 중복 제거
  const seen = new Set<string>();
  return out
    .filter((r) => {
      const k = `${r.source}|${r.name}|${r.expireAt}`;
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    })
    .sort((a, b) => (a.expireAt < b.expireAt ? -1 : a.expireAt > b.expireAt ? 1 : 0));
}

export const EXPIRY_SOURCE_LABEL: Record<ExpirySource, string> = { cash: "캐시", pet: "펫", android: "안드로이드", equip: "장비", title: "칭호" };
