import type {
  Account,
  AccountKind,
  Holding,
  Liability,
  MoneySettings,
  Quote,
  WatchItem,
} from "../types";
import { update } from "./store";
import { uid, dayKey } from "../lib/misc";
import { symbolKey } from "../lib/quotes";
import { portfolio, totalCash, totalLiabilities } from "./finance";

/* -------------------------------------------------------------- accounts */

export function addAccount(name = "New account", kind: AccountKind = "taxable"): string {
  const id = uid();
  update((d) => {
    d.accounts.push({ id, name, kind, cash: 0 });
  });
  return id;
}

export function patchAccount(accountId: string, fields: Partial<Omit<Account, "id">>): void {
  update((d) => {
    const account = d.accounts.find((a) => a.id === accountId);
    if (account) Object.assign(account, fields);
  });
}

/** Removing an account removes what it held — the positions no longer exist. */
export function removeAccount(accountId: string): void {
  update((d) => {
    d.accounts = d.accounts.filter((a) => a.id !== accountId);
    d.holdings = d.holdings.filter((h) => h.accountId !== accountId);
  });
}

/* -------------------------------------------------------------- holdings */

export function addHolding(accountId: string, fields: Partial<Holding> = {}): string {
  const id = uid();
  update((d) => {
    d.holdings.push({
      id,
      accountId,
      symbol: "",
      name: "",
      assetClass: "stock",
      quantity: 0,
      costPerUnit: 0,
      manualPrice: null,
      ...fields,
    });
  });
  return id;
}

export function patchHolding(holdingId: string, fields: Partial<Omit<Holding, "id">>): void {
  update((d) => {
    const holding = d.holdings.find((h) => h.id === holdingId);
    if (holding) Object.assign(holding, fields);
  });
}

export function removeHolding(holdingId: string): void {
  update((d) => {
    d.holdings = d.holdings.filter((h) => h.id !== holdingId);
  });
}

/** Move a stray holding back under a real account. */
export function reassignHolding(holdingId: string, accountId: string): void {
  patchHolding(holdingId, { accountId });
}

/* ----------------------------------------------------------- liabilities */

export function addLiability(name = "New debt", balance = 0): string {
  const id = uid();
  update((d) => {
    d.liabilities.push({ id, name, balance });
  });
  return id;
}

export function patchLiability(id: string, fields: Partial<Omit<Liability, "id">>): void {
  update((d) => {
    const item = d.liabilities.find((l) => l.id === id);
    if (item) Object.assign(item, fields);
  });
}

export function removeLiability(id: string): void {
  update((d) => {
    d.liabilities = d.liabilities.filter((l) => l.id !== id);
  });
}

/* ------------------------------------------------------------- watchlist */

/** Returns false when the symbol is blank or already on the list. */
export function addWatch(symbol: string, name = ""): boolean {
  const key = symbolKey(symbol);
  if (!key) return false;
  let added = false;
  update((d) => {
    if (d.watchlist.some((w) => symbolKey(w.symbol) === key)) return;
    const item: WatchItem = { id: uid(), symbol: key, name: name.trim() || key };
    d.watchlist.push(item);
    added = true;
  });
  return added;
}

export function removeWatch(id: string): void {
  update((d) => {
    d.watchlist = d.watchlist.filter((w) => w.id !== id);
  });
}

export function moveWatch(id: string, direction: -1 | 1): void {
  update((d) => {
    const index = d.watchlist.findIndex((w) => w.id === id);
    const next = index + direction;
    if (index === -1 || next < 0 || next >= d.watchlist.length) return;
    const [item] = d.watchlist.splice(index, 1);
    d.watchlist.splice(next, 0, item);
  });
}

/* ---------------------------------------------------------------- quotes */

/** Merge freshly fetched quotes into the cache, leaving unfetched ones alone. */
export function saveQuotes(quotes: Quote[]): void {
  if (quotes.length === 0) return;
  update((d) => {
    for (const quote of quotes) d.quotes[symbolKey(quote.symbol)] = quote;
  });
}

/** Drop cached prices for symbols nothing refers to any more. */
export function pruneQuotes(keep: string[]): void {
  const wanted = new Set(keep.map(symbolKey));
  update((d) => {
    for (const key of Object.keys(d.quotes)) {
      if (!wanted.has(key)) delete d.quotes[key];
    }
  });
}

export function patchMoneySettings(fields: Partial<MoneySettings>): void {
  update((d) => {
    d.settings.money = { ...d.settings.money, ...fields };
  });
}

/* ------------------------------------------------------------ net worth */

/**
 * Record today's net worth, replacing any earlier snapshot for the same day.
 *
 * Called when the money page opens, so the curve fills in from ordinary use
 * rather than needing the user to remember to save a number.
 */
export function recordNetWorth(when = new Date()): void {
  update((d) => {
    const key = dayKey(when);
    const point = {
      dayKey: key,
      invested: portfolio(d).invested,
      cash: totalCash(d),
      liabilities: totalLiabilities(d),
    };
    // Nothing to plot until there's something to plot.
    if (point.invested === 0 && point.cash === 0 && point.liabilities === 0) return;
    const existing = d.netWorth.findIndex((p) => p.dayKey === key);
    if (existing !== -1) {
      const previous = d.netWorth[existing];
      // Opening the page repeatedly shouldn't rewrite an unchanged snapshot.
      if (
        previous.invested === point.invested &&
        previous.cash === point.cash &&
        previous.liabilities === point.liabilities
      ) {
        return;
      }
      d.netWorth[existing] = point;
    } else {
      d.netWorth.push(point);
    }
    d.netWorth.sort((a, b) => a.dayKey.localeCompare(b.dayKey));
  });
}
