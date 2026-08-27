import type { Holding, Quote } from "../types";

/** Where a holding's price came from, so the UI can be honest about it. */
export type PriceSource = "quote" | "manual" | "cost";

export interface PricedHolding {
  holding: Holding;
  price: number;
  previousClose: number;
  source: PriceSource;
  /** Epoch ms of the quote behind this price, or null when it isn't a quote. */
  asOf: number | null;
  value: number;
  cost: number;
  gain: number;
  /** Percent, or null when there's no cost basis to compare against. */
  gainPct: number | null;
  dayChange: number;
  dayChangePct: number | null;
}

function pct(part: number, whole: number): number | null {
  return whole > 0 ? (part / whole) * 100 : null;
}

/**
 * Value one holding.
 *
 * A hand-entered price wins over a fetched one: it's an explicit override for
 * things the market can't quote (a private position, a fund with no ticker),
 * and silently replacing it with a stale quote would misstate the portfolio.
 * With neither, cost basis is used so the position still shows up — flagged,
 * so it never reads as a real market value.
 */
export function priceHolding(holding: Holding, quote?: Quote): PricedHolding {
  const manual = holding.manualPrice;
  let price: number;
  let previousClose: number;
  let source: PriceSource;
  let asOf: number | null = null;

  if (manual !== null && Number.isFinite(manual) && manual >= 0) {
    price = manual;
    previousClose = manual;
    source = "manual";
  } else if (quote && Number.isFinite(quote.price) && quote.price > 0) {
    price = quote.price;
    previousClose = Number.isFinite(quote.previousClose) && quote.previousClose > 0
      ? quote.previousClose
      : quote.price;
    source = "quote";
    asOf = quote.asOf;
  } else {
    price = holding.costPerUnit;
    previousClose = holding.costPerUnit;
    source = "cost";
  }

  const quantity = Number.isFinite(holding.quantity) ? holding.quantity : 0;
  const value = price * quantity;
  const cost = holding.costPerUnit * quantity;
  const dayChange = (price - previousClose) * quantity;
  const yesterday = previousClose * quantity;

  return {
    holding,
    price,
    previousClose,
    source,
    asOf,
    value,
    cost,
    gain: value - cost,
    gainPct: pct(value - cost, Math.abs(cost)),
    dayChange,
    dayChangePct: pct(dayChange, Math.abs(yesterday)),
  };
}

export interface PortfolioTotals {
  /** Market value of the holdings alone. */
  invested: number;
  cash: number;
  liabilities: number;
  /** invested + cash − liabilities. */
  netWorth: number;
  cost: number;
  gain: number;
  gainPct: number | null;
  dayChange: number;
  dayChangePct: number | null;
  /** Holdings priced from cost because nothing better was available. */
  unpriced: number;
}

export function totals(
  priced: PricedHolding[],
  cash: number,
  liabilities: number
): PortfolioTotals {
  let invested = 0;
  let cost = 0;
  let dayChange = 0;
  let yesterday = 0;
  let unpriced = 0;

  for (const item of priced) {
    invested += item.value;
    cost += item.cost;
    dayChange += item.dayChange;
    yesterday += item.previousClose * item.holding.quantity;
    if (item.source === "cost") unpriced += 1;
  }

  // Cash doesn't move with the market, but it is part of what the day change
  // is measured against — otherwise a big cash balance inflates the percentage.
  const base = yesterday + cash;

  return {
    invested,
    cash,
    liabilities,
    netWorth: invested + cash - liabilities,
    cost,
    gain: invested - cost,
    gainPct: pct(invested - cost, Math.abs(cost)),
    dayChange,
    dayChangePct: pct(dayChange, Math.abs(base)),
    unpriced,
  };
}

export interface Slice {
  key: string;
  label: string;
  value: number;
  percent: number;
}

/**
 * Group holdings into allocation slices, largest first.
 *
 * Percentages are of the total passed in, so a caller can include cash as its
 * own slice and have everything still add up to 100.
 */
export function allocate(
  priced: PricedHolding[],
  groupBy: (item: PricedHolding) => { key: string; label: string },
  extra: { key: string; label: string; value: number }[] = []
): Slice[] {
  const buckets = new Map<string, { label: string; value: number }>();

  for (const item of priced) {
    const { key, label } = groupBy(item);
    const bucket = buckets.get(key);
    if (bucket) bucket.value += item.value;
    else buckets.set(key, { label, value: item.value });
  }
  for (const item of extra) {
    if (item.value === 0) continue;
    const bucket = buckets.get(item.key);
    if (bucket) bucket.value += item.value;
    else buckets.set(item.key, { label: item.label, value: item.value });
  }

  const total = [...buckets.values()].reduce((sum, b) => sum + b.value, 0);

  return [...buckets.entries()]
    .filter(([, bucket]) => bucket.value !== 0)
    .map(([key, bucket]) => ({
      key,
      label: bucket.label,
      value: bucket.value,
      percent: total > 0 ? (bucket.value / total) * 100 : 0,
    }))
    .sort((a, b) => b.value - a.value);
}
