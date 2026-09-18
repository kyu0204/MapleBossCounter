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
import dropData from "@/data/drop_rates.json";

/** 아이템 하나에 매긴 값. 화면에서 입력받아 localStorage 에 둔다. */
export interface ItemValue {
  /** 개당 메소. 0 이거나 없으면 값을 안 매긴 것으로 본다. */
  meso?: number;
  /** 확률 드롭의 회당 획득 확률(%). 확정 보상에는 쓰지 않는다. */
  chance?: number;
}

export type ItemValues = Record<string, ItemValue>;

// ---------- 드롭 확률 ----------

interface DropRateRow {
  boss: string;
  diff: string;
  item: string;
  kills: number;
  drops: number;
  rate: number;
}

interface DropFile {
  _meta: { updated: string; notes: string[]; sources: { label: string; url: string; note?: string }[] };
  applyDropRate: Record<string, boolean | string>;
  rates: DropRateRow[];
}

const drops = dropData as unknown as DropFile;
export const DROP_META = drops._meta;

const rateIndex = new Map(drops.rates.map((r) => [`${r.boss}|${r.diff}|${r.item}`, r]));

/**
 * 관측된 드롭률. 없으면 null.
 *
 * 넥슨은 보스 드롭률을 공개하지 않는다 (확률형 아이템 공개 의무는 유료 아이템 대상이다).
 * 그래서 전부 커뮤니티 대표본 추정치이고, 표본 수를 함께 들고 다닌다 — 103회짜리와
 * 3,600회짜리를 같은 신뢰도로 보여 주면 안 된다.
 */
export function dropRateOf(boss: string, diff: Difficulty | string, item: string): DropRateRow | null {
  return rateIndex.get(`${boss}|${String(diff)}|${item}`) ?? null;
}

/**
 * 아이템 드롭률 증가(아획)가 먹히는 아이템인지.
 *
 * 보스 보상 대부분은 아획을 안 탄다. 장신구류·반지 상자·연마석만 탄다.
 * 모르는 아이템은 보정하지 않는다 — 안 먹는 것을 올려 잡으면 기대값이 부풀려진다.
 */
export function takesDropRate(item: string): boolean {
  return drops.applyDropRate[item] === true;
}

/**
 * 내 아획을 반영한 실효 확률(%).
 *
 * 표본 자체가 어느 정도 아획에서 나왔는지 글에 안 적혀 있다. 관측값이 칠흑 기본
 * 추정치(0.4%)와 비슷해 낮은 아획으로 보고, 관측값을 기준선으로 삼아 내 아획만큼 곱한다.
 * 정확한 모델이 아니라 어림이다 — 화면에서 그렇게 밝힌다.
 */
export function effectiveChance(row: DropRateRow, dropRatePercent: number): number {
  if (!takesDropRate(row.item)) return row.rate;
  return row.rate * (1 + Math.max(0, dropRatePercent) / 100);
}

/**
 * 조각으로 쪼개져 나오는 보상.
 *
 * 같은 보스라도 난이도가 낮으면 본품 대신 조각으로 준다 (카링 노말은 "뒤엉킨 흉수의
 * 고리 조각", 하드는 "뒤엉킨 흉수의 고리"). 이름이 달라 그대로 두면 개수를 못 견준다.
 * 조각 수를 본품 수로 환산해 같은 저울에 올린다.
 *
 * per = 본품 하나를 만드는 데 드는 조각 수.
 */
const FRAGMENTS: Record<string, { base: string; per: number }> = {
  "남겨진 칼로스의 의지 조각": { base: "남겨진 칼로스의 의지", per: 2 },
  "이어진 고대의 결의 조각": { base: "이어진 고대의 결의", per: 2 },
  "뒤엉킨 흉수의 고리 조각": { base: "뒤엉킨 흉수의 고리", per: 2 },
  "황홀한 환상의 단편 조각": { base: "황홀한 환상의 단편", per: 2 },
};

/** 조각이면 본품 이름과 환산 개수, 아니면 자기 자신 그대로. */
export function toBaseItem(name: string, amount: number): { baseName: string; baseAmount: number } {
  const f = FRAGMENTS[name];
  return f ? { baseName: f.base, baseAmount: amount / f.per } : { baseName: name, baseAmount: amount };
}

export interface RewardLine {
  name: string;
  /** 인원 분배까지 반영한 수량 (확정). 랜덤은 1 로 둔다. */
  amount: number;
  /** 조각이면 본품 이름. 아니면 name 과 같다. 확정 보상 비교의 기준이다. */
  baseName?: string;
  /** 본품으로 환산한 개수. 조각 5개면 2.5 처럼 소수가 나온다. */
  baseAmount?: number;
  /** 화면 표기용 수량 문자열 */
  amountText: string;
  /** 이 줄이 합계에 보탠 메소 */
  value: number;
  /** 값을 안 매겨서 0 으로 친 줄인지 */
  unpriced: boolean;
  /** 입력한 개당 단가. 확률 보정을 껐을 때 이 값을 보여 준다. */
  unitPrice?: number;
  /** 기대값 계산에 쓴 확률(%). 랜덤에만 붙는다. */
  chance?: number;
  /** 그 확률의 출처. manual = 손으로 넣음, stats = 커뮤니티 통계 */
  chanceFrom?: "manual" | "stats";
  /** 통계에서 왔을 때의 표본 수 (신뢰도 표시용) */
  kills?: number;
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
  /** 확정 보상. 값이 아니라 개수로 견준다. */
  fixed: RewardLine[];
  random: RewardLine[];
  randomValue: number;
  /** 결정 + 랜덤 기대값. 확정 보상은 값을 안 매기므로 빠진다. */
  total: number;
  /** 값을 안 매긴 랜덤 보상이 하나라도 있는지 (합계가 실제보다 낮다는 뜻) */
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
export function compareRow(
  boss: string,
  diff: Difficulty | string,
  party: number,
  priceDate: string,
  values: ItemValues,
  /** 내 아이템 획득 증가(%). 알려진 드롭률을 이 값으로 보정한다. */
  dropRatePercent = 0,
  /**
   * 확률 보정을 쓸지.
   *
   * 끄면 랜덤 보상을 기대값으로 환산하지 않는다. 확률 자체가 추정이라 그 불확실성을
   * 합계에 섞고 싶지 않을 때가 있다. 그때는 "무엇이 얼마짜리로 나오는가" 만 보고
   * 판단이 사람 몫으로 남는다. 합계에는 결정과 확정 보상만 들어간다.
   */
  useChance = true,
): CompareRow {
  const n = Math.max(1, party);
  const price = crystalPrice(boss, diff, priceDate);
  const crystal = price == null ? null : Math.floor(price / n);
  const { fixed: fixedRaw, random: randomRaw } = rewardRowsFor(boss, diff, priceDate);

  // 확정 보상은 값을 매기지 않는다. 주문의 흔적·큐브·조각은 거래가 안 돼 시세가 없고,
  // 있어도 사람마다 값이 달라 합계에 섞으면 비교가 흐려진다. 개수로만 견준다.
  const fixed: RewardLine[] = [];
  for (const r of fixedRaw) {
    const amt = rewardAmount(r, n);
    const { baseName, baseAmount } = toBaseItem(r.name, amt.value);
    const l = line(r, amt.value, amt.text, 0, false);
    l.baseName = baseName;
    l.baseAmount = baseAmount;
    fixed.push(l);
  }

  const random: RewardLine[] = [];
  for (const r of randomRaw) {
    const v = values[r.name] ?? {};
    const meso = v.meso ?? 0;
    // 손으로 넣은 확률이 있으면 그것이 이긴다. 없으면 알려진 통계를 쓴다.
    const known = dropRateOf(boss, diff, r.name);
    const chance = useChance ? v.chance ?? (known ? effectiveChance(known, dropRatePercent) : 0) : 0;
    const expected = useChance && meso > 0 && chance > 0 ? Math.floor((meso * chance) / 100) : 0;
    // 보정을 끄면 확률은 판단에 안 들어가므로, 값이 없는 것은 단가 미입력뿐이다.
    const unpriced = useChance ? meso <= 0 || chance <= 0 : meso <= 0;
    const l = line(r, 1, r.range ?? String(r.count ?? 1), expected, unpriced);
    l.unitPrice = meso > 0 ? meso : undefined;
    if (useChance) {
      l.chance = chance > 0 ? chance : undefined;
      l.chanceFrom = v.chance != null ? "manual" : known ? "stats" : undefined;
      l.kills = v.chance == null && known ? known.kills : undefined;
    }
    random.push(l);
  }

  const randomValue = random.reduce((s, l) => s + l.value, 0);
  return {
    boss,
    diff,
    party: n,
    crystal,
    fixed,
    random,
    randomValue,
    // 확정 보상은 메소로 환산하지 않으므로 합계에 안 들어간다. 개수는 따로 견준다.
    total: (crystal ?? 0) + randomValue,
    hasUnpriced: random.some((l) => l.unpriced),
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

  /** 확정: 본품 환산 개수로 모은다. 조각과 본품이 한 항목으로 합쳐진다. */
  const fixedOf = (row: CompareRow) => {
    const m = new Map<string, { amount: number; ref: RewardLine }>();
    for (const l of row.fixed) {
      const key = l.baseName ?? l.name;
      const hit = m.get(key);
      if (hit) hit.amount += l.baseAmount ?? l.amount;
      else m.set(key, { amount: l.baseAmount ?? l.amount, ref: l });
    }
    return m;
  };
  const fa = fixedOf(a);
  const fb = fixedOf(b);
  for (const name of new Set([...fa.keys(), ...fb.keys()])) {
    const av = fa.get(name)?.amount ?? 0;
    const bv = fb.get(name)?.amount ?? 0;
    const ref = (fa.get(name) ?? fb.get(name))!.ref;
    const entry: UnpricedDiff = { name, kind: "fixed", a: av, b: bv, delta: av - bv, icon: ref.icon, w: ref.w, h: ref.h, short: ref.short };
    (entry.delta === 0 ? wash : gaps).push(entry);
  }

  // 랜덤: 값을 못 매긴 것만. 값을 매긴 것은 이미 메소 차액에 들어갔다.
  const seen = new Map<string, RewardLine>();
  for (const row of [a, b]) for (const l of row.random) if (l.unpriced && !seen.has(l.name)) seen.set(l.name, l);
  for (const [name, ref] of seen) {
    const av = presence(a.random, name, "random");
    const bv = presence(b.random, name, "random");
    const entry: UnpricedDiff = { name, kind: "random", a: av, b: bv, delta: av - bv, icon: ref.icon, w: ref.w, h: ref.h, short: ref.short };
    (entry.delta === 0 ? wash : gaps).push(entry);
  }

  const order = (x: UnpricedDiff, y: UnpricedDiff) =>
    // 확정이 먼저 (확실히 들어오는 몫이라 판단에 더 크게 걸린다)
    Number(x.kind === "random") - Number(y.kind === "random") || Math.abs(y.delta) - Math.abs(x.delta) || x.name.localeCompare(y.name, "ko");
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
    // 확정 보상은 값을 안 매기므로 입력 칸도 만들지 않는다. 랜덤만 받는다.
    for (const r of rewardRowsFor(p.boss, p.diff, priceDate).random) {
      if (acc.has(r.name)) continue;
      acc.set(r.name, { name: r.name, asFixed: false, asRandom: true, icon: r.icon, w: r.w, h: r.h, short: r.short });
    }
  }
  return [...acc.values()].sort((a, b) => a.name.localeCompare(b.name, "ko"));
}
