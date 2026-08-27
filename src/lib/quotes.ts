import type { Quote } from "../types";

/** One day of trading, as parsed from a provider's CSV. */
export interface DailyBar {
  /** Epoch ms at local midnight of the trading day. */
  t: number;
  close: number;
}

/** How much history to keep per symbol — enough for a 3-month sparkline. */
export const HISTORY_DAYS = 90;

const YAHOO_SUFFIX_TO_STOOQ: Record<string, string> = {
  TO: "ca",
  V: "ca",
  L: "uk",
  DE: "de",
  PA: "fr",
  AS: "nl",
  MI: "it",
  MC: "es",
  HK: "hk",
  AX: "au",
};

/** Index tickers people actually type, mapped onto the provider's names. */
const INDEX_ALIASES: Record<string, string> = {
  "^GSPC": "^spx",
  "^SPX": "^spx",
  "^DJI": "^dji",
  "^IXIC": "^ndq",
  "^NDQ": "^ndq",
  "^NDX": "^ndx",
  "^RUT": "^rut",
  "^VIX": "^vix",
  "^FTSE": "^ukx",
  "^GSPTSE": "^tsx",
  "^N225": "^nkx",
};

/**
 * Translate a ticker as typed into the form Stooq expects.
 *
 * Stooq namespaces by market suffix (`aapl.us`) and has its own index names,
 * so this is where Yahoo-style symbols — the ones most people know — get
 * converted rather than failing silently as an unknown symbol.
 */
export function toStooqSymbol(symbol: string): string {
  const raw = symbol.trim().toUpperCase();
  if (!raw) return "";

  if (raw.startsWith("^")) return INDEX_ALIASES[raw] ?? raw.toLowerCase();

  // Crypto is quoted as a pair: BTC-USD and BTC/USD both mean btcusd.
  const pair = raw.match(/^([A-Z]{2,5})[-/]([A-Z]{3})$/);
  if (pair) return `${pair[1]}${pair[2]}`.toLowerCase();

  const dot = raw.lastIndexOf(".");
  if (dot > 0) {
    const base = raw.slice(0, dot).toLowerCase();
    const suffix = raw.slice(dot + 1);
    return `${base}.${(YAHOO_SUFFIX_TO_STOOQ[suffix] ?? suffix).toLowerCase()}`;
  }

  return `${raw.toLowerCase()}.us`;
}

/** Normalized key for the quote cache, so "aapl" and "AAPL" share one entry. */
export function symbolKey(symbol: string): string {
  return symbol.trim().toUpperCase();
}

/**
 * Parse Stooq's daily CSV (`Date,Open,High,Low,Close,Volume`), oldest first.
 *
 * Rows the provider can't price come back as `N/D`; they're dropped rather
 * than parsed as zero, which would put a fake crash in the chart.
 */
export function parseStooqDaily(csv: string): DailyBar[] {
  const lines = csv.trim().split(/\r?\n/);
  if (lines.length < 2) return [];

  const header = lines[0].toLowerCase().split(",");
  const dateAt = header.indexOf("date");
  const closeAt = header.indexOf("close");
  if (dateAt === -1 || closeAt === -1) return [];

  const bars: DailyBar[] = [];
  for (const line of lines.slice(1)) {
    const cells = line.split(",");
    const t = Date.parse(`${cells[dateAt]}T00:00:00`);
    const close = Number(cells[closeAt]);
    if (!Number.isFinite(t) || !Number.isFinite(close) || close <= 0) continue;
    bars.push({ t, close });
  }

  bars.sort((a, b) => a.t - b.t);
  return bars;
}

/** Turn a run of daily bars into the cached quote shape. */
export function quoteFromBars(symbol: string, bars: DailyBar[], now = Date.now()): Quote | null {
  if (bars.length === 0) return null;
  const recent = bars.slice(-HISTORY_DAYS);
  const last = recent[recent.length - 1];
  const previous = recent.length > 1 ? recent[recent.length - 2] : last;
  return {
    symbol: symbolKey(symbol),
    price: last.close,
    previousClose: previous.close,
    asOf: last.t,
    fetchedAt: now,
    history: recent.map((bar) => bar.close),
  };
}

function stooqUrl(symbol: string): string {
  const from = new Date(Date.now() - HISTORY_DAYS * 2 * 86_400_000);
  const stamp = (d: Date) =>
    `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
  const params = new URLSearchParams({
    s: toStooqSymbol(symbol),
    d1: stamp(from),
    d2: stamp(new Date()),
    i: "d",
  });
  return `https://stooq.com/q/d/l/?${params.toString()}`;
}

export interface FetchResult {
  symbol: string;
  quote: Quote | null;
  error: string | null;
}

/**
 * Fetch one symbol.
 *
 * Stooq is used because it needs no API key and serves plain CSV, which keeps
 * this a purely client-side app with nothing to deploy and no secret to leak.
 * The trade-off is that it's a courtesy endpoint: it can rate-limit, and a
 * browser can only read it if it keeps sending permissive CORS headers. Every
 * failure is therefore reported rather than thrown, and callers fall back to
 * the cached price so the portfolio still adds up offline.
 */
export async function fetchQuote(symbol: string, timeoutMs = 12_000): Promise<FetchResult> {
  const key = symbolKey(symbol);
  try {
    const response = await fetch(stooqUrl(symbol), {
      signal: AbortSignal.timeout(timeoutMs),
      // No credentials, so the response stays cacheable and CORS stays simple.
      credentials: "omit",
    });
    if (!response.ok) {
      return { symbol: key, quote: null, error: `HTTP ${response.status}` };
    }
    const text = await response.text();
    if (/exceeded|limit/i.test(text) && !/^date,/i.test(text.trim())) {
      return { symbol: key, quote: null, error: "Rate limited by the price source" };
    }
    const quote = quoteFromBars(key, parseStooqDaily(text));
    return quote
      ? { symbol: key, quote, error: null }
      : { symbol: key, quote: null, error: "No prices returned for that symbol" };
  } catch (error) {
    const message =
      error instanceof DOMException && error.name === "TimeoutError"
        ? "Timed out"
        : "Couldn't reach the price source";
    return { symbol: key, quote: null, error: message };
  }
}

/** Fetch many symbols at once; one bad symbol never sinks the rest. */
export async function fetchQuotes(symbols: string[]): Promise<FetchResult[]> {
  const unique = [...new Set(symbols.map(symbolKey))].filter(Boolean);
  return Promise.all(unique.map((symbol) => fetchQuote(symbol)));
}

/* ------------------------------------------------------- market clock */

export type MarketState = "open" | "pre" | "after" | "closed";

export interface MarketStatus {
  state: MarketState;
  label: string;
}

/** Minutes past midnight in New York for a given instant. */
function newYorkMinutes(now: Date): { minutes: number; day: number } {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    hour: "2-digit",
    minute: "2-digit",
    weekday: "short",
    hour12: false,
  }).formatToParts(now);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  // "24" shows up at midnight in some engines; fold it back to hour zero.
  const hour = Number(get("hour")) % 24;
  return { minutes: hour * 60 + Number(get("minute")), day: days.indexOf(get("weekday")) };
}

/**
 * Whether the US market is trading right now.
 *
 * Regular hours only, and holidays aren't modelled — this labels the header,
 * it doesn't gate anything, so a wrong label on Thanksgiving is harmless.
 */
export function marketStatus(now = new Date()): MarketStatus {
  const { minutes, day } = newYorkMinutes(now);
  if (day === 0 || day === 6) return { state: "closed", label: "Markets closed · weekend" };
  if (minutes < 4 * 60) return { state: "closed", label: "Markets closed" };
  if (minutes < 9 * 60 + 30) return { state: "pre", label: "Pre-market" };
  if (minutes < 16 * 60) return { state: "open", label: "Markets open" };
  if (minutes < 20 * 60) return { state: "after", label: "After hours" };
  return { state: "closed", label: "Markets closed" };
}
