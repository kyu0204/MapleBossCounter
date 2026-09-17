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
 * 값으로 환산되지 못한 보상의 차이.
 *
 * 합계 메소만 내면 "값을 안 매긴 보상" 이 통째로 사라진다. 그런데 비교에서 정작
 * 갈리는 게 그쪽인 경우가 많다 — 칠흑 장신구 상자처럼 값을 매기기 어려운 것,
 * 또는 양쪽이 똑같이 주는 것.
 *
 * 그래서 메소 차액과 별개로 두 갈래를 따로 낸다.
 *   gaps  한쪽이 더 주는 것. 이건 메소 차액에 얹어서 판단해야 한다.
 *   wash  양쪽이 똑같이 주는 것. 상쇄되므로 비교에서 빼고 봐도 된다.
 */
export interface UnpricedDiff {
  name: string;
  /** 확정이면 수량 비교가 뜻이 있다. 랜덤은 "나오느냐" 만 본다 (확률을 모른다). */
  kind: "fixed" | "random";
  /** 왼쪽 수량. 랜덤이면 나오면 1 */
  a: number;
  /** 오른쪽 수량 */
  b: number;
  /** a - b */
  delta: number;
  icon?: string;
  w?: number;
  h?: number;
  short?: string;
}

export interface CompareSummary {
  /** 값을 매긴 것까지 반영한 메소 차이 (왼쪽 - 오른쪽) */
  mesoGap: number;
  /** 값을 못 매긴 보상 중 한쪽이 더 주는 것 */
  gaps: UnpricedDiff[];
  /** 값을 못 매긴 보상 중 양쪽이 똑같이 주는 것 */
  wash: UnpricedDiff[];
}

/**
 * 랜덤은 수량 대신 "나오느냐" 로 본다.
 * 확률을 모르는데 개수를 견주면 5개 주는 쪽이 무조건 나은 것처럼 읽힌다.
 */
const presence = (lines: RewardLine[], name: string, kind: "fixed" | "random") => {
  const hit = lines.find((l) => l.name === name);
  if (!hit) return 0;
  return kind === "fixed" ? hit.amount : 1;
};

export function summarize(a: CompareRow, b: CompareRow): CompareSummary {
  const gaps: UnpricedDiff[] = [];
  const wash: UnpricedDiff[] = [];

  // 값을 못 매긴 줄만 모은다. 이름이 같으면 한 항목이다.
  const seen = new Map<string, { kind: "fixed" | "random"; ref: RewardLine }>();
  for (const row of [a, b]) {
    for (const [lines, kind] of [
      [row.fixed, "fixed"],
      [row.random, "random"],
    ] as const) {
      for (const l of lines) {
        if (!l.unpriced) continue;
        const prev = seen.get(l.name);
        // 한쪽에선 확정, 다른 쪽에선 랜덤으로 나오면 약한 쪽(랜덤)으로 본다
        if (!prev) seen.set(l.name, { kind, ref: l });
        else if (prev.kind === "fixed" && kind === "random") prev.kind = "random";
      }
    }
  }

  for (const [name, { kind, ref }] of seen) {
    const av = presence(kind === "fixed" ? a.fixed : a.random, name, kind);
    const bv = presence(kind === "fixed" ? b.fixed : b.random, name, kind);
    const entry: UnpricedDiff = { name, kind, a: av, b: bv, delta: av - bv, icon: ref.icon, w: ref.w, h: ref.h, short: ref.short };
    (entry.delta === 0 ? wash : gaps).push(entry);
  }

  const order = (x: UnpricedDiff, y: UnpricedDiff) => Math.abs(y.delta) - Math.abs(x.delta) || x.name.localeCompare(y.name, "ko");
  return { mesoGap: a.total - b.total, gaps: gaps.sort(order), wash: wash.sort((x, y) => x.name.localeCompare(y.name, "ko")) };
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
