import type { Account, AppData, Holding, Quote, WatchItem } from "../types";
import type { PricedHolding, PortfolioTotals, Slice } from "../lib/portfolio";
import { allocate, priceHolding, totals } from "../lib/portfolio";
import { symbolKey } from "../lib/quotes";
import { ASSET_CLASS_LABEL } from "../lib/money";
import type { SeriesPoint } from "./selectors";

export function quoteFor(d: AppData, symbol: string): Quote | undefined {
  return d.quotes[symbolKey(symbol)];
}

export function pricedHoldings(d: AppData): PricedHolding[] {
  return d.holdings.map((holding) => priceHolding(holding, quoteFor(d, holding.symbol)));
}

export function totalCash(d: AppData): number {
  return d.accounts.reduce((sum, account) => sum + (account.cash || 0), 0);
}

export function totalLiabilities(d: AppData): number {
  return d.liabilities.reduce((sum, item) => sum + (item.balance || 0), 0);
}

export function portfolio(d: AppData): PortfolioTotals {
  return totals(pricedHoldings(d), totalCash(d), totalLiabilities(d));
}

/** Where you're invested, by what the money is in. */
export function allocationByClass(d: AppData): Slice[] {
  const cash = totalCash(d);
  return allocate(
    pricedHoldings(d),
    (item) => ({
      key: item.holding.assetClass,
      label: ASSET_CLASS_LABEL[item.holding.assetClass],
    }),
    [{ key: "cash", label: ASSET_CLASS_LABEL.cash, value: cash }]
  );
}

/** Where you're invested, by which account holds it. */
export function allocationByAccount(d: AppData): Slice[] {
  const names = new Map(d.accounts.map((a) => [a.id, a.name]));
  return allocate(
    pricedHoldings(d),
    (item) => ({
      key: item.holding.accountId,
      label: names.get(item.holding.accountId) ?? "Unassigned",
    }),
    d.accounts
      .filter((a) => a.cash !== 0)
      .map((a) => ({ key: a.id, label: a.name, value: a.cash }))
  );
}

export interface AccountGroup {
  account: Account;
  items: PricedHolding[];
  /** Holdings plus the account's cash. */
  value: number;
  dayChange: number;
  gain: number;
}

/** Holdings grouped under their account, biggest account first. */
export function holdingsByAccount(d: AppData): AccountGroup[] {
  const priced = pricedHoldings(d);
  return d.accounts
    .map((account) => {
      const items = priced
        .filter((item) => item.holding.accountId === account.id)
        .sort((a, b) => b.value - a.value);
      return {
        account,
        items,
        value: items.reduce((sum, i) => sum + i.value, 0) + account.cash,
        dayChange: items.reduce((sum, i) => sum + i.dayChange, 0),
        gain: items.reduce((sum, i) => sum + i.gain, 0),
      };
    })
    .sort((a, b) => b.value - a.value);
}

/** Holdings whose account was deleted — surfaced so they aren't lost silently. */
export function orphanHoldings(d: AppData): Holding[] {
  const ids = new Set(d.accounts.map((a) => a.id));
  return d.holdings.filter((h) => !ids.has(h.accountId));
}

/**
 * Every symbol worth keeping a cached price for.
 *
 * Wider than `trackedSymbols`: it includes holdings with a manual price, so
 * clearing that override doesn't leave the holding unpriced until the next fetch.
 */
export function cachedSymbols(d: AppData): string[] {
  const symbols = [...d.watchlist.map((w) => w.symbol), ...d.holdings.map((h) => h.symbol)];
  return [...new Set(symbols.map(symbolKey))].filter(Boolean);
}

/** Every symbol worth fetching: the watchlist plus everything you own. */
export function trackedSymbols(d: AppData): string[] {
  const symbols = [
    ...d.watchlist.map((w) => w.symbol),
    ...d.holdings.filter((h) => h.manualPrice === null).map((h) => h.symbol),
  ];
  return [...new Set(symbols.map(symbolKey))].filter(Boolean);
}

export interface WatchRow {
  item: WatchItem;
  quote: Quote | undefined;
  change: number;
  changePct: number | null;
  /** True when you also hold this symbol, so the market view links to yours. */
  owned: boolean;
}

export function watchRows(d: AppData): WatchRow[] {
  const owned = new Set(d.holdings.map((h) => symbolKey(h.symbol)));
  return d.watchlist.map((item) => {
    const quote = quoteFor(d, item.symbol);
    const change = quote ? quote.price - quote.previousClose : 0;
    return {
      item,
      quote,
      change,
      changePct:
        quote && quote.previousClose > 0 ? (change / quote.previousClose) * 100 : null,
      owned: owned.has(symbolKey(item.symbol)),
    };
  });
}

/** Your holdings as market rows, biggest mover first — "what moved today". */
export function moversToday(d: AppData): PricedHolding[] {
  return pricedHoldings(d)
    .filter((item) => item.source === "quote" && item.dayChange !== 0)
    .sort((a, b) => Math.abs(b.dayChange) - Math.abs(a.dayChange));
}

/**
 * Saved net worth over time, with today's live value appended so the line
 * always ends at what the portfolio is worth right now.
 */
export function netWorthSeries(d: AppData): SeriesPoint[] {
  const points = d.netWorth
    .map((point) => ({
      x: Date.parse(`${point.dayKey}T12:00:00`),
      y: point.invested + point.cash - point.liabilities,
    }))
    .filter((point) => Number.isFinite(point.x))
    .sort((a, b) => a.x - b.x);

  const live = portfolio(d).netWorth;
  const today = Date.parse(`${new Date().toISOString().slice(0, 10)}T12:00:00`);
  const last = points[points.length - 1];
  if (last && last.x === today) last.y = live;
  else if (points.length > 0) points.push({ x: today, y: live });

  return points;
}

/** Freshest and stalest fetch times across tracked quotes. */
export function quoteFreshness(d: AppData): { newest: number | null; oldest: number | null } {
  const times = trackedSymbols(d)
    .map((symbol) => d.quotes[symbol]?.fetchedAt)
    .filter((t): t is number => typeof t === "number" && Number.isFinite(t));
  if (times.length === 0) return { newest: null, oldest: null };
  return { newest: Math.max(...times), oldest: Math.min(...times) };
}
