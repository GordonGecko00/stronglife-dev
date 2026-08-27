import { useCallback, useEffect, useRef, useState } from "react";
import { getData, useAppData } from "../store/store";
import { cachedSymbols, trackedSymbols } from "../store/finance";
import { pruneQuotes, saveQuotes } from "../store/financeActions";
import { fetchQuotes } from "../lib/quotes";

/** How stale a cached price can get before opening a money page refetches it. */
const STALE_AFTER_MS = 15 * 60 * 1000;

export interface QuoteState {
  loading: boolean;
  /** One line per symbol that couldn't be priced, for an honest status row. */
  errors: { symbol: string; error: string }[];
  /** Epoch ms of the last completed refresh attempt, successful or not. */
  lastTried: number | null;
  refresh: () => void;
}

/**
 * Keep cached prices reasonably fresh while a money page is open.
 *
 * Fetching is best-effort by design: the price source needs no key but can
 * rate-limit or be unreachable, and this is a static app with no server to
 * proxy through. Failures are surfaced and the cached prices stay put, so the
 * portfolio always renders — offline, rate-limited, or on a plane.
 */
export function useQuotes(): QuoteState {
  const data = useAppData();
  const symbols = trackedSymbols(data);
  const manual = data.settings.money.source === "manual";

  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<{ symbol: string; error: string }[]>([]);
  const [lastTried, setLastTried] = useState<number | null>(null);
  // A fetch in flight must not be started twice — effects run twice in dev.
  const inFlight = useRef(false);

  const run = useCallback(async (wanted: string[]) => {
    if (inFlight.current || wanted.length === 0) return;
    inFlight.current = true;
    setLoading(true);
    try {
      const results = await fetchQuotes(wanted);
      const quotes = results.flatMap((result) => (result.quote ? [result.quote] : []));
      saveQuotes(quotes);
      // Drop prices for symbols that have since been deleted, so the cache
      // doesn't grow forever as the portfolio is edited over the years.
      pruneQuotes(cachedSymbols(getData()));
      setErrors(
        results
          .filter((result) => result.error !== null)
          .map((result) => ({ symbol: result.symbol, error: result.error as string }))
      );
    } finally {
      setLastTried(Date.now());
      setLoading(false);
      inFlight.current = false;
    }
  }, []);

  // Both of these read the store directly rather than the render snapshot, so
  // they stay stable across the quote writes they themselves cause.
  const refresh = useCallback(() => {
    if (manual) return;
    void run(trackedSymbols(getData()));
  }, [manual, run]);

  // Refresh on open, but only for what's actually missing or stale — reopening
  // the page a few times shouldn't hammer a free endpoint.
  const key = symbols.join(",");
  useEffect(() => {
    if (manual) return;
    const current = getData();
    const now = Date.now();
    const stale = trackedSymbols(current).filter((symbol) => {
      const quote = current.quotes[symbol];
      return !quote || now - quote.fetchedAt > STALE_AFTER_MS;
    });
    if (stale.length > 0) void run(stale);
  }, [key, manual, run]);

  return { loading, errors, lastTried, refresh };
}
