/**
 * 시세 목록을 묶는 기준.
 *
 * 68종을 값 순으로만 늘어놓으면 칠흑 장신구와 에테르넬 방어구가 뒤섞여 무엇을 보는지
 * 놓친다. 세트는 같은 목적으로 모으는 물건이라 세트끼리 붙여 놓는 편이 읽힌다.
 *
 * 세트가 없는 것도 성격은 있다 — 해머·소울 에테르·연마석은 세트가 아니라 쓰임으로 묶인다.
 * 그래서 세트(setOfItem)를 먼저 보고, 없으면 쓰임으로 떨어뜨린다.
 */
import { setOfItem } from "./drops";

export interface PriceGroup {
  key: string;
  /** 화면에 그대로 쓰는 제목 */
  label: string;
}

/** 내는 순서. 세트가 먼저, 쓰임으로 묶은 것이 뒤. */
export const PRICE_GROUPS: PriceGroup[] = [
  { key: "칠흑", label: "칠흑의 보스 세트" },
  { key: "광휘", label: "광휘의 보스 세트" },
  { key: "여명", label: "여명의 보스 세트" },
  { key: "에테르넬", label: "에테르넬 방어구" },
  { key: "반지", label: "특수 스킬 반지" },
  { key: "해머", label: "익셉셔널 해머" },
  { key: "에테르", label: "소울 에테르" },
  { key: "연마석", label: "연마석" },
  { key: "기타", label: "그 밖" },
];

export function priceGroupOf(name: string): string {
  const set = setOfItem(name);
  if (set && set !== "기타") return set;
  if (/익셉셔널 해머/.test(name)) return "해머";
  if (/소울 에테르/.test(name)) return "에테르";
  if (/연마석/.test(name)) return "연마석";
  if (/(링|반지)/.test(name)) return "반지";
  return "기타";
}

/** [그룹, 그 그룹의 행들] 을 PRICE_GROUPS 순서로. 빈 그룹은 내지 않는다. */
export function groupByPriceGroup<T>(rows: T[], nameOf: (row: T) => string): [PriceGroup, T[]][] {
  const buckets = new Map<string, T[]>();
  for (const row of rows) {
    const k = priceGroupOf(nameOf(row));
    const hit = buckets.get(k);
    if (hit) hit.push(row);
    else buckets.set(k, [row]);
  }
  return PRICE_GROUPS.filter((g) => buckets.get(g.key)?.length).map((g) => [g, buckets.get(g.key)!] as [PriceGroup, T[]]);
}
