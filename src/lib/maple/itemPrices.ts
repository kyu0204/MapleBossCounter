/**
 * 받아 둔 경매장 시세를 읽는 곳.
 *
 * 값은 코드에 박지 않는다. CI 가 메이플증권 공개 페이지에서 받아
 * src/data/item_prices.json 에 쓴다 (scripts/fetch-item-prices.mjs).
 */
import priceData from "@/data/item_prices.json";

export interface PriceRow {
  meso: number;
  at: string;
  /** main = 메인 페이지(억 단위 환산), item = 개별 아이템 페이지(메소 원값) */
  src?: string;
  /** 개별 페이지에서 읽은 호가 기준일 */
  quotedOn?: string;
}

interface PriceFile {
  _meta: { updated: string | null; source: string; note: string };
  items: Record<string, PriceRow>;
  /** 보스 보상은 아니지만 받아 둔 것. 화면 계산에는 안 쓴다. */
  extra?: Record<string, PriceRow>;
  /** 사이트에 거래 기록이 없던 것. 값은 마지막으로 확인한 날짜다. */
  noMarket?: Record<string, string>;
}

const prices = priceData as unknown as PriceFile;

export const PRICE_META = prices._meta;

/** 시세가 있으면 메소, 없으면 null. 거래 불가 아이템과 신규 아이템은 여기 없다. */
export function marketPriceOf(item: string): number | null {
  return prices.items[item]?.meso ?? null;
}

export function priceRowOf(item: string): PriceRow | null {
  return prices.items[item] ?? null;
}

/** 시세가 잡힌 전부. 시세 탭에서 통째로 보여 준다. */
export function allPrices(): [string, PriceRow][] {
  return Object.entries(prices.items);
}

export function extraPrices(): [string, PriceRow][] {
  return Object.entries(prices.extra ?? {});
}

/** 사이트에 기록이 없어 값을 못 매긴 것 (이름 → 마지막 확인 날짜). */
export function noMarketItems(): [string, string][] {
  return Object.entries(prices.noMarket ?? {});
}
