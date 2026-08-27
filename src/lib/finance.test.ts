import { describe, expect, it } from "vitest";
import {
  marketStatus,
  parseStooqDaily,
  quoteFromBars,
  symbolKey,
  toStooqSymbol,
} from "./quotes";
import { allocate, priceHolding, totals } from "./portfolio";
import { formatPercent, parseAmount } from "./money";
import { migrate } from "../store/migrate";
import { buildDefaultData } from "../store/defaults";
import type { Holding, Quote } from "../types";

function holding(fields: Partial<Holding> = {}): Holding {
  return {
    id: "h1",
    accountId: "a1",
    symbol: "AAPL",
    name: "Apple",
    assetClass: "stock",
    quantity: 10,
    costPerUnit: 100,
    manualPrice: null,
    ...fields,
  };
}

function quote(fields: Partial<Quote> = {}): Quote {
  return {
    symbol: "AAPL",
    price: 120,
    previousClose: 110,
    asOf: 1_700_000_000_000,
    fetchedAt: 1_700_000_000_000,
    history: [100, 110, 120],
    ...fields,
  };
}

describe("symbol translation", () => {
  it("suffixes plain US tickers", () => {
    expect(toStooqSymbol("AAPL")).toBe("aapl.us");
    expect(toStooqSymbol(" voo ")).toBe("voo.us");
  });

  it("maps the index names people actually type", () => {
    expect(toStooqSymbol("^GSPC")).toBe("^spx");
    expect(toStooqSymbol("^DJI")).toBe("^dji");
    expect(toStooqSymbol("^IXIC")).toBe("^ndq");
  });

  it("passes unknown indexes through rather than guessing", () => {
    expect(toStooqSymbol("^ABC")).toBe("^abc");
  });

  it("collapses crypto pairs", () => {
    expect(toStooqSymbol("BTC-USD")).toBe("btcusd");
    expect(toStooqSymbol("ETH/USD")).toBe("ethusd");
  });

  it("translates Yahoo market suffixes", () => {
    expect(toStooqSymbol("SHOP.TO")).toBe("shop.ca");
    expect(toStooqSymbol("BP.L")).toBe("bp.uk");
  });

  it("leaves an already-correct suffix alone", () => {
    expect(toStooqSymbol("aapl.us")).toBe("aapl.us");
  });

  it("keys the cache case-insensitively", () => {
    expect(symbolKey(" aapl ")).toBe("AAPL");
  });
});

describe("daily CSV parsing", () => {
  const csv = [
    "Date,Open,High,Low,Close,Volume",
    "2026-08-24,100,101,99,100.5,1000",
    "2026-08-25,100.5,103,100,102.25,1200",
    "2026-08-26,102,104,101,103,900",
  ].join("\n");

  it("reads closes oldest first", () => {
    const bars = parseStooqDaily(csv);
    expect(bars).toHaveLength(3);
    expect(bars.map((b) => b.close)).toEqual([100.5, 102.25, 103]);
  });

  it("sorts rows that arrive newest first", () => {
    const reversed = [csv.split("\n")[0], ...csv.split("\n").slice(1).reverse()].join("\n");
    expect(parseStooqDaily(reversed).map((b) => b.close)).toEqual([100.5, 102.25, 103]);
  });

  it("drops unpriced rows rather than reading them as zero", () => {
    const withGap = `${csv}\n2026-08-27,N/D,N/D,N/D,N/D,N/D`;
    expect(parseStooqDaily(withGap)).toHaveLength(3);
  });

  it("returns nothing for an error body or a bare header", () => {
    expect(parseStooqDaily("Exceeded the daily hits limit")).toEqual([]);
    expect(parseStooqDaily("Date,Open,High,Low,Close,Volume")).toEqual([]);
    expect(parseStooqDaily("")).toEqual([]);
  });

  it("builds a quote whose previous close is the day before", () => {
    const result = quoteFromBars("aapl", parseStooqDaily(csv), 5);
    expect(result).not.toBeNull();
    expect(result!.symbol).toBe("AAPL");
    expect(result!.price).toBe(103);
    expect(result!.previousClose).toBe(102.25);
    expect(result!.fetchedAt).toBe(5);
    expect(result!.history).toEqual([100.5, 102.25, 103]);
  });

  it("treats a lone bar as its own previous close, so the day change is zero", () => {
    const result = quoteFromBars("aapl", [{ t: 1, close: 50 }]);
    expect(result!.price).toBe(50);
    expect(result!.previousClose).toBe(50);
  });

  it("has no quote to build without bars", () => {
    expect(quoteFromBars("aapl", [])).toBeNull();
  });
});

describe("pricing a holding", () => {
  it("uses the fetched quote when there's no override", () => {
    const priced = priceHolding(holding(), quote());
    expect(priced.source).toBe("quote");
    expect(priced.value).toBe(1200);
    expect(priced.cost).toBe(1000);
    expect(priced.gain).toBe(200);
    expect(priced.gainPct).toBeCloseTo(20);
    expect(priced.dayChange).toBeCloseTo(100);
    expect(priced.dayChangePct).toBeCloseTo(9.0909, 3);
  });

  it("lets a hand-entered price win over a stale quote", () => {
    const priced = priceHolding(holding({ manualPrice: 200 }), quote());
    expect(priced.source).toBe("manual");
    expect(priced.value).toBe(2000);
    // A manual price has no yesterday, so it never invents a day change.
    expect(priced.dayChange).toBe(0);
  });

  it("treats a manual price of zero as a real price, not a missing one", () => {
    const priced = priceHolding(holding({ manualPrice: 0 }));
    expect(priced.source).toBe("manual");
    expect(priced.value).toBe(0);
  });

  it("falls back to cost basis and flags it", () => {
    const priced = priceHolding(holding());
    expect(priced.source).toBe("cost");
    expect(priced.value).toBe(1000);
    expect(priced.gain).toBe(0);
  });

  it("ignores a quote with no usable price", () => {
    expect(priceHolding(holding(), quote({ price: 0 })).source).toBe("cost");
  });

  it("has no percentage to report without a cost basis", () => {
    expect(priceHolding(holding({ costPerUnit: 0 }), quote()).gainPct).toBeNull();
  });
});

describe("portfolio totals", () => {
  const priced = [
    priceHolding(holding({ id: "a" }), quote()),
    priceHolding(
      holding({ id: "b", symbol: "VOO", quantity: 5, costPerUnit: 300 }),
      quote({ symbol: "VOO", price: 400, previousClose: 400 })
    ),
  ];

  it("adds cash and subtracts what you owe", () => {
    const result = totals(priced, 500, 2000);
    expect(result.invested).toBe(3200);
    expect(result.netWorth).toBe(1700);
    expect(result.cost).toBe(2500);
    expect(result.gain).toBe(700);
  });

  it("measures the day change against yesterday including cash", () => {
    const result = totals(priced, 500, 0);
    expect(result.dayChange).toBeCloseTo(100);
    // Yesterday: 110*10 + 400*5 + 500 cash = 3600.
    expect(result.dayChangePct).toBeCloseTo((100 / 3600) * 100, 6);
  });

  it("counts holdings that fell back to cost", () => {
    expect(totals([priceHolding(holding())], 0, 0).unpriced).toBe(1);
  });

  it("is all zeroes and no percentages when empty", () => {
    const result = totals([], 0, 0);
    expect(result.netWorth).toBe(0);
    expect(result.gainPct).toBeNull();
    expect(result.dayChangePct).toBeNull();
  });
});

describe("allocation", () => {
  const priced = [
    priceHolding(holding({ id: "a", assetClass: "stock" }), quote()),
    priceHolding(
      holding({ id: "b", assetClass: "etf", quantity: 10, costPerUnit: 10 }),
      quote({ symbol: "VOO", price: 60, previousClose: 60 })
    ),
  ];

  it("groups, totals and sorts biggest first", () => {
    const slices = allocate(priced, (item) => ({
      key: item.holding.assetClass,
      label: item.holding.assetClass,
    }));
    expect(slices.map((s) => s.key)).toEqual(["stock", "etf"]);
    expect(slices[0].value).toBe(1200);
    expect(slices[0].percent).toBeCloseTo((1200 / 1800) * 100);
  });

  it("includes extra slices such as cash in the percentages", () => {
    const slices = allocate(
      priced,
      () => ({ key: "invested", label: "Invested" }),
      [{ key: "cash", label: "Cash", value: 200 }]
    );
    const total = slices.reduce((sum, s) => sum + s.percent, 0);
    expect(total).toBeCloseTo(100);
    expect(slices.find((s) => s.key === "cash")!.percent).toBeCloseTo((200 / 2000) * 100);
  });

  it("merges an extra slice into a matching group", () => {
    const slices = allocate(
      priced,
      () => ({ key: "one", label: "One" }),
      [{ key: "one", label: "One", value: 200 }]
    );
    expect(slices).toHaveLength(1);
    expect(slices[0].value).toBe(2000);
  });

  it("drops empty slices", () => {
    const slices = allocate([], () => ({ key: "x", label: "X" }), [
      { key: "cash", label: "Cash", value: 0 },
    ]);
    expect(slices).toEqual([]);
  });
});

describe("typed amounts", () => {
  it("accepts what people actually type", () => {
    expect(parseAmount("$1,234.56")).toBeCloseTo(1234.56);
    expect(parseAmount("1234.56")).toBeCloseTo(1234.56);
    expect(parseAmount("-40")).toBe(-40);
  });

  it("reads a comma decimal mark", () => {
    expect(parseAmount("1.234,56")).toBeCloseTo(1234.56);
    expect(parseAmount("12,5")).toBeCloseTo(12.5);
  });

  it("refuses anything unusable rather than storing NaN", () => {
    expect(parseAmount("")).toBeNull();
    expect(parseAmount("abc")).toBeNull();
  });

  it("signs percentages so a fall reads as a fall", () => {
    expect(formatPercent(1.5)).toBe("+1.50%");
    expect(formatPercent(-1.5)).toBe("−1.50%");
    expect(formatPercent(0)).toBe("0.00%");
    expect(formatPercent(Number.NaN)).toBe("—");
  });
});

describe("market clock", () => {
  // Late August, so New York is on daylight time (UTC-4).
  it("is open during the session", () => {
    expect(marketStatus(new Date("2026-08-27T14:00:00Z")).state).toBe("open");
  });

  it("marks the hours either side of the session", () => {
    expect(marketStatus(new Date("2026-08-27T12:00:00Z")).state).toBe("pre");
    expect(marketStatus(new Date("2026-08-27T21:00:00Z")).state).toBe("after");
  });

  it("is closed overnight and at the weekend", () => {
    expect(marketStatus(new Date("2026-08-27T05:00:00Z")).state).toBe("closed");
    expect(marketStatus(new Date("2026-08-29T14:00:00Z")).state).toBe("closed");
  });
});

describe("migrating older saves", () => {
  it("gives a v3 save the money defaults without touching training data", () => {
    const v3 = { ...buildDefaultData(), version: 3 } as Record<string, unknown>;
    delete v3.accounts;
    delete v3.holdings;
    delete v3.watchlist;
    delete v3.quotes;
    delete v3.netWorth;
    delete v3.liabilities;
    (v3.settings as Record<string, unknown>).money = undefined;

    const migrated = migrate(v3);
    expect(migrated.version).toBe(4);
    expect(migrated.templates.length).toBeGreaterThan(0);
    expect(migrated.settings.money.currency).toBe("USD");
    expect(migrated.settings.money.source).toBe("stooq");
    expect(migrated.accounts).toEqual([]);
    expect(migrated.holdings).toEqual([]);
    expect(migrated.quotes).toEqual({});
    // An empty watchlist is indistinguishable from "never set up", so it seeds.
    expect(migrated.watchlist.map((w) => w.symbol)).toEqual(["^SPX", "^DJI", "^NDQ"]);
  });

  it("keeps money data it recognises and repairs what it doesn't", () => {
    const saved = {
      ...buildDefaultData(),
      version: 4,
      accounts: [{ id: "a1", name: "TFSA", kind: "tfsa", cash: 250 }],
      holdings: [
        { id: "h1", accountId: "a1", symbol: " voo ", assetClass: "etf", quantity: 3, costPerUnit: 400 },
        { id: "h2", accountId: "a1", symbol: "XYZ", assetClass: "nonsense", quantity: "lots" },
      ],
      liabilities: [{ id: "l1", name: "Mortgage", balance: 100 }],
      netWorth: [
        { dayKey: "2026-08-01", invested: 1, cash: 2, liabilities: 3 },
        { dayKey: "not-a-day", invested: 9, cash: 9, liabilities: 9 },
      ],
      quotes: {
        voo: { symbol: "voo", price: 500, previousClose: 490, asOf: 1, fetchedAt: 2, history: [1, 2] },
        bad: { symbol: "bad", price: 0 },
      },
    };

    const migrated = migrate(saved);
    expect(migrated.accounts[0].kind).toBe("tfsa");
    expect(migrated.holdings[0].symbol).toBe("VOO");
    expect(migrated.holdings[0].manualPrice).toBeNull();
    // Unrecognised values fall back rather than throwing the holding away.
    expect(migrated.holdings[1].assetClass).toBe("other");
    expect(migrated.holdings[1].quantity).toBe(0);
    expect(migrated.liabilities).toHaveLength(1);
    expect(migrated.netWorth.map((p) => p.dayKey)).toEqual(["2026-08-01"]);
    expect(Object.keys(migrated.quotes)).toEqual(["VOO"]);
    expect(migrated.quotes.VOO.previousClose).toBe(490);
  });

  it("gives a v1 save the money fields too", () => {
    const migrated = migrate({ version: 1, templates: [], sessions: [] });
    expect(migrated.version).toBe(4);
    expect(migrated.accounts).toEqual([]);
    expect(migrated.settings.money.currency).toBe("USD");
  });
});
