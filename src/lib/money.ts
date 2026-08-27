import type { AccountKind, AssetClass, Currency } from "../types";

export const CURRENCIES: Currency[] = ["USD", "CAD", "EUR", "GBP", "AUD"];

export const ASSET_CLASS_LABEL: Record<AssetClass, string> = {
  stock: "Stocks",
  etf: "Funds & ETFs",
  bond: "Bonds",
  crypto: "Crypto",
  cash: "Cash",
  other: "Other",
};

export const ACCOUNT_KIND_LABEL: Record<AccountKind, string> = {
  taxable: "Taxable",
  tfsa: "TFSA",
  rrsp: "RRSP",
  "401k": "401(k)",
  ira: "IRA",
  pension: "Pension",
  crypto: "Crypto wallet",
  savings: "Savings",
  other: "Other",
};

/**
 * Money, in the portfolio currency.
 *
 * Cents are noise on a six-figure balance and essential on a single share, so
 * they follow the magnitude rather than a fixed setting.
 */
export function formatMoney(value: number, currency: Currency, decimals?: number): string {
  const safe = Number.isFinite(value) ? value : 0;
  const digits = decimals ?? (Math.abs(safe) >= 1000 ? 0 : 2);
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency,
      minimumFractionDigits: digits,
      maximumFractionDigits: digits,
    }).format(safe);
  } catch {
    // An unknown currency code should cost the symbol, not the number.
    return `${safe.toFixed(digits)} ${currency}`;
  }
}

/** Shortened for stat tiles, where "$1.2M" beats a number that wraps. */
export function formatCompactMoney(value: number, currency: Currency): string {
  const safe = Number.isFinite(value) ? value : 0;
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency,
      notation: "compact",
      maximumFractionDigits: 1,
    }).format(safe);
  } catch {
    return formatMoney(safe, currency);
  }
}

/** Always carries a sign, because a change of zero still reads differently. */
export function formatSignedMoney(value: number, currency: Currency): string {
  const safe = Number.isFinite(value) ? value : 0;
  const sign = safe > 0 ? "+" : safe < 0 ? "−" : "";
  return `${sign}${formatMoney(Math.abs(safe), currency)}`;
}

export function formatPercent(value: number, decimals = 2): string {
  if (!Number.isFinite(value)) return "—";
  const sign = value > 0 ? "+" : value < 0 ? "−" : "";
  return `${sign}${Math.abs(value).toFixed(decimals)}%`;
}

/** Plain number with grouping, for share counts. */
export function formatQuantity(value: number): string {
  if (!Number.isFinite(value)) return "0";
  const rounded = Math.round(value * 1e6) / 1e6;
  return new Intl.NumberFormat(undefined, { maximumFractionDigits: 6 }).format(rounded);
}

/**
 * Read a typed amount, tolerating what people actually type: currency symbols,
 * thousands separators and a leading plus. Returns null for anything unusable
 * so callers can leave the previous value alone rather than storing NaN.
 */
export function parseAmount(text: string): number | null {
  const cleaned = text.replace(/[^0-9.,-]/g, "").trim();
  if (!cleaned) return null;
  // A trailing comma group of one or two digits is a decimal mark (1.234,56 or
  // 12,5); anything else — including 1,500 — is thousands grouping.
  const normalized = /,\d{1,2}$/.test(cleaned)
    ? cleaned.replace(/\./g, "").replace(",", ".")
    : cleaned.replace(/,/g, "");
  const value = Number(normalized);
  return Number.isFinite(value) ? value : null;
}

/** "up 2 minutes ago" — coarse on purpose; exact seconds don't help here. */
export function formatAgo(timestamp: number, now = Date.now()): string {
  const seconds = Math.max(0, Math.round((now - timestamp) / 1000));
  if (seconds < 60) return "just now";
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} hr ago`;
  const days = Math.round(hours / 24);
  return days === 1 ? "yesterday" : `${days} days ago`;
}
