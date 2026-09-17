/**
 * 보스끼리 "한 번 잡으면 얼마가 남는가" 를 견주는 계산.
 *
 * 결정 메소만 보면 반쪽이다. 어떤 보스는 결정이 싼 대신 큐브·주문의 흔적을 많이 주고,
 * 어떤 보스는 물욕템(칠흑 장신구 상자 같은 확률 드롭) 하나가 결정 몇 배다.
 * 그래서 셋을 나눠 더한다.
 *
 *   결정   가격표 ÷ 인원
 *   확정   잡으면 무조건 주는 것. 조각·큐브는 인원수로 나뉜다(rewardAmount).
 *   랜덤   확률 드롭. 단가 × 확률 = 기대값.
 *
 * 아이템 값어치는 사람마다·시세마다 달라서 코드에 박지 않는다. 화면에서 입력받아
 * 여기로 넘긴다. 값을 안 넣은 아이템은 0 으로 쳐서 합계에 영향을 주지 않는다 —
 * 모르는 것을 짐작해 넣으면 비교가 거짓말이 된다.
 *
 * 랜덤 보상의 확률은 넥슨이 공개하지 않는다. 그래서 확률도 입력값이다.
 * 확률을 안 넣으면 그 아이템은 기대값 0 이고, 목록에는 "값 미입력" 으로 남는다.
 */
import type { Difficulty } from "./bossKey";
import { crystalPrice } from "./prices";
import { rewardAmount, rewardRowsFor, type DisplayReward } from "./rewards";

/** 아이템 하나에 매긴 값. 화면에서 입력받아 localStorage 에 둔다. */
export interface ItemValue {
  /** 개당 메소. 0 이거나 없으면 값을 안 매긴 것으로 본다. */
  meso?: number;
  /** 확률 드롭의 회당 획득 확률(%). 확정 보상에는 쓰지 않는다. */
  chance?: number;
}

export type ItemValues = Record<string, ItemValue>;

export interface RewardLine {
  name: string;
  /** 인원 분배까지 반영한 수량 (확정). 랜덤은 1 로 둔다. */
  amount: number;
  /** 화면 표기용 수량 문자열 */
  amountText: string;
  /** 이 줄이 합계에 보탠 메소 */
  value: number;
  /** 값을 안 매겨서 0 으로 친 줄인지 */
  unpriced: boolean;
  icon?: string;
  w?: number;
  h?: number;
  short?: string;
}

export interface CompareRow {
  boss: string;
  diff: Difficulty | string;
  party: number;
  /** 결정 1인 실수령. 가격표에 없으면 null */
  crystal: number | null;
  fixed: RewardLine[];
  random: RewardLine[];
  fixedValue: number;
  randomValue: number;
  /** 결정 + 확정 + 랜덤 기대값 */
  total: number;
  /** 값을 안 매긴 보상이 하나라도 있는지 (합계가 실제보다 낮다는 뜻) */
  hasUnpriced: boolean;
}

const line = (r: DisplayReward, amount: number, amountText: string, value: number, unpriced: boolean): RewardLine => ({
  name: r.name,
  amount,
  amountText,
  value,
  unpriced,
  icon: r.icon,
  w: r.w,
  h: r.h,
  short: r.short,
});

/**
 * 한 보스·난이도의 값어치.
 *
 * 확정 보상은 수량 × 단가다. 조각·큐브는 파티 한 몫이 떨어지므로 rewardAmount 가
 * 인원수로 나눈 뒤의 수량을 준다 (소수점 버림 — 나눠 떨어지지 않으면 못 받는다).
 *
 * 랜덤은 수량을 곱하지 않는다. 확률 드롭의 "몇 개" 는 떴을 때의 개수라 회당 기대값과
 * 섞으면 이중으로 곱해진다. 단가 × 확률만 본다.
 */
export function compareRow(boss: string, diff: Difficulty | string, party: number, priceDate: string, values: ItemValues): CompareRow {
  const n = Math.max(1, party);
  const price = crystalPrice(boss, diff, priceDate);
  const crystal = price == null ? null : Math.floor(price / n);
  const { fixed: fixedRaw, random: randomRaw } = rewardRowsFor(boss, diff, priceDate);

  const fixed: RewardLine[] = [];
  for (const r of fixedRaw) {
    const amt = rewardAmount(r, n);
    const meso = values[r.name]?.meso ?? 0;
    fixed.push(line(r, amt.value, amt.text, amt.value * meso, meso <= 0));
  }

  const random: RewardLine[] = [];
  for (const r of randomRaw) {
    const v = values[r.name] ?? {};
    const meso = v.meso ?? 0;
    const chance = v.chance ?? 0;
    const expected = meso > 0 && chance > 0 ? Math.floor((meso * chance) / 100) : 0;
    random.push(line(r, 1, r.range ?? String(r.count ?? 1), expected, meso <= 0 || chance <= 0));
  }

  const fixedValue = fixed.reduce((s, l) => s + l.value, 0);
  const randomValue = random.reduce((s, l) => s + l.value, 0);
  return {
    boss,
    diff,
    party: n,
    crystal,
    fixed,
    random,
    fixedValue,
    randomValue,
    total: (crystal ?? 0) + fixedValue + randomValue,
    hasUnpriced: [...fixed, ...random].some((l) => l.unpriced),
  };
}

/**
 * 비교에 등장하는 아이템 목록. 값 입력 칸을 만들 때 쓴다.
 * 확정·랜덤 양쪽에 나오는 아이템이 있을 수 있어 종류를 합집합으로 들고 있는다.
 */
export interface ItemRef {
  name: string;
  /** 확정으로 나오는 곳이 있으면 true */
  asFixed: boolean;
  /** 확률 드롭으로 나오는 곳이 있으면 true (확률 입력이 필요하다) */
  asRandom: boolean;
  icon?: string;
  w?: number;
  h?: number;
  short?: string;
}

export function itemsIn(picks: { boss: string; diff: Difficulty | string }[], priceDate: string): ItemRef[] {
  const acc = new Map<string, ItemRef>();
  for (const p of picks) {
    const { fixed, random } = rewardRowsFor(p.boss, p.diff, priceDate);
    for (const [list, key] of [
      [fixed, "asFixed"],
      [random, "asRandom"],
    ] as const) {
      for (const r of list) {
        const hit = acc.get(r.name);
        if (hit) hit[key] = true;
        else acc.set(r.name, { name: r.name, asFixed: key === "asFixed", asRandom: key === "asRandom", icon: r.icon, w: r.w, h: r.h, short: r.short });
      }
    }
  }
  return [...acc.values()].sort((a, b) => a.name.localeCompare(b.name, "ko"));
}
