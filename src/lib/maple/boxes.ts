/**
 * 상자 보상의 속.
 *
 * 상자는 그 자체로 거래가 안 돼 시세가 없다. 그런데 보스 보상에는 상자가 수두룩하다
 * (에테르넬 방어구 상자, 칠흑 장신구 상자, 보스 반지 상자). 값을 0 으로 두면 그 보스가
 * 실제보다 초라해 보인다.
 *
 * 그래서 안에서 나오는 물건의 시세로 상자를 본다. 두 종류를 다르게 다룬다.
 *
 *   choice  원하는 것을 골라 꺼낸다 (에테르넬 방어구 상자). 고를 수 있으니 가장 비싼
 *           것이 곧 그 상자의 값이다. 합계에도 그 값을 넣는다.
 *   random  무엇이 나올지 못 고른다 (칠흑 장신구 상자, 보스 반지 상자). 하나로 정하면
 *           거짓말이 되므로 구성만 보여 주고 합계에는 넣지 않는다.
 */
import boxData from "@/data/box_contents.json";
import { marketPriceOf } from "./itemPrices";

export type BoxKind = "choice" | "random";

interface BoxDef {
  kind: BoxKind;
  items?: string[];
  parts?: string[];
  note?: string;
}

interface BoxFile {
  _meta: { updated: string; notes: string[]; sources: { label: string; url: string }[] };
  eternelArmor: Record<string, Record<string, string>>;
  boxes: Record<string, BoxDef>;
}

const data = boxData as unknown as BoxFile;

export const BOX_META = data._meta;

/** 에테르넬은 직업군 5개 × 부위라 이름을 다 적지 않고 여기서 펼친다. */
function expand(def: BoxDef): string[] {
  if (def.items) return def.items;
  if (!def.parts) return [];
  const out: string[] = [];
  for (const parts of Object.values(data.eternelArmor)) {
    for (const p of def.parts) {
      const name = parts[p];
      if (name) out.push(name);
    }
  }
  return out;
}

export interface BoxContent {
  name: string;
  meso: number | null;
}

export interface BoxInfo {
  kind: BoxKind;
  note?: string;
  /** 비싼 순. 시세 없는 것은 뒤로 민다. */
  contents: BoxContent[];
  /** 시세가 잡힌 것 중 가장 비싼 값. 하나도 없으면 null */
  max: number | null;
  /** 시세가 잡힌 것 중 가장 싼 값 */
  min: number | null;
  /** 시세를 모르는 구성품 수 */
  unknownCount: number;
}

/** 상자면 구성과 시세, 상자가 아니면 null. */
export function boxInfo(item: string): BoxInfo | null {
  const def = data.boxes[item];
  if (!def) return null;
  const contents = expand(def).map((name) => ({ name, meso: marketPriceOf(name) }));
  const known = contents.filter((c) => c.meso != null).map((c) => c.meso!);
  contents.sort((a, b) => (b.meso ?? -1) - (a.meso ?? -1));
  return {
    kind: def.kind,
    note: def.note,
    contents,
    max: known.length ? Math.max(...known) : null,
    min: known.length ? Math.min(...known) : null,
    unknownCount: contents.length - known.length,
  };
}

/**
 * 상자 자체의 값. 고를 수 있는 상자만 값이 선다.
 *
 * 못 고르는 상자는 null 이다 — 구성이 13억부터 52억까지 벌어지는데 하나를 고르면
 * 그게 곧 추측이다. 화면에서 구성을 보여 주고 판단은 사람에게 맡긴다.
 */
export function boxValueOf(item: string): number | null {
  const info = boxInfo(item);
  if (!info || info.kind !== "choice") return null;
  return info.max;
}

/** 에테르넬 부위 순서. 위 넷과 아래 셋이 각각 다른 상자에서 나온다. */
export const ETERNEL_PARTS = ["모자", "상의", "하의", "어깨장식", "장갑", "신발", "망토"] as const;

/** 에테르넬 방어구면 직업군과 부위, 아니면 null. */
export function eternelPartOf(item: string): { group: string; part: string } | null {
  for (const [group, parts] of Object.entries(data.eternelArmor)) {
    for (const [part, name] of Object.entries(parts)) if (name === item) return { group, part };
  }
  return null;
}

/** 시세를 받아 둬야 할 구성품 이름 전부. 수집 스크립트와 시세 탭이 쓴다. */
export function allBoxContentNames(): string[] {
  const out = new Set<string>();
  for (const def of Object.values(data.boxes)) for (const n of expand(def)) out.add(n);
  return [...out];
}
