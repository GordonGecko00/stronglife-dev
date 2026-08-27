import { useState } from "react";
import { Link } from "react-router-dom";
import { useAppData } from "../store/store";
import { moversToday, quoteFreshness, watchRows } from "../store/finance";
import { addWatch, moveWatch, removeWatch } from "../store/financeActions";
import { useQuotes } from "../components/useQuotes";
import Sparkline from "../components/Sparkline";
import { formatAgo, formatMoney, formatPercent, formatSignedMoney } from "../lib/money";
import { marketStatus } from "../lib/quotes";

function changeClass(value: number): string {
  return value > 0 ? "delta-up" : value < 0 ? "delta-down" : "delta-flat";
}

export default function Market() {
  const data = useAppData();
  const { currency, source, privacy } = data.settings.money;
  const { loading, errors, refresh } = useQuotes();
  const [symbol, setSymbol] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const [managing, setManaging] = useState(false);

  const rows = watchRows(data);
  const movers = moversToday(data);
  const { newest } = quoteFreshness(data);
  const status = marketStatus();

  function submit(event: React.FormEvent) {
    event.preventDefault();
    const trimmed = symbol.trim();
    if (!trimmed) return;
    setNotice(addWatch(trimmed) ? null : `${trimmed.toUpperCase()} is already on your list.`);
    setSymbol("");
  }

  return (
    <div className={`page${privacy ? " money-private" : ""}`}>
      <header className="page-head money-head">
        <div>
          <h1>Market</h1>
          <p className="muted">How things are moving right now.</p>
        </div>
        <span className={`market-pill market-${status.state}`}>{status.label}</span>
      </header>

      <p className="status-line money-status">
        {loading ? "Updating prices…" : newest ? `Updated ${formatAgo(newest)}` : "No prices yet"}
        {source !== "manual" && (
          <>
            {" · "}
            <button className="btn-link" onClick={refresh} disabled={loading}>
              Refresh
            </button>
          </>
        )}
      </p>

      {source === "manual" && (
        <div className="banner">
          <span className="banner-icon" aria-hidden="true">
            i
          </span>
          <div>
            <strong>Manual prices</strong>
            <p>
              Live quotes are switched off, so the watchlist stays empty.{" "}
              <Link className="btn-link" to="/money/setup">
                Turn them on
              </Link>
            </p>
          </div>
        </div>
      )}

      {errors.length > 0 && (
        <div className="banner banner-warn">
          <span className="banner-icon" aria-hidden="true">
            !
          </span>
          <div>
            <strong>Some prices didn't load</strong>
            <p>
              {errors
                .slice(0, 3)
                .map((e) => `${e.symbol}: ${e.error}`)
                .join(" · ")}
              . Anything already fetched is still shown below.
            </p>
          </div>
        </div>
      )}

      <div className="card">
        <div className="card-head">
          <h2>Watchlist</h2>
          <button className="btn-link" onClick={() => setManaging((v) => !v)}>
            {managing ? "Done" : "Edit"}
          </button>
        </div>

        {rows.length === 0 ? (
          <p className="muted">Add a symbol below to start watching it.</p>
        ) : (
          <ul className="quote-list">
            {rows.map((row) => (
              <li className="quote-row" key={row.item.id}>
                <div className="quote-name">
                  <strong>{row.item.name}</strong>
                  <span className="muted row-hint">
                    {row.item.symbol}
                    {row.owned && " · you hold this"}
                  </span>
                </div>

                {row.quote ? (
                  <>
                    <Sparkline
                      values={row.quote.history.slice(-30)}
                      color={row.change >= 0 ? "var(--hit)" : "var(--miss)"}
                    />
                    <div className="quote-values">
                      <span>{formatMoney(row.quote.price, currency, 2)}</span>
                      <span className={changeClass(row.change)}>
                        {row.changePct !== null ? formatPercent(row.changePct) : "—"}
                      </span>
                    </div>
                  </>
                ) : (
                  <div className="quote-values">
                    <span className="muted">{loading ? "…" : "no data"}</span>
                  </div>
                )}

                {managing && (
                  <div className="quote-actions">
                    <button
                      className="icon-btn"
                      onClick={() => moveWatch(row.item.id, -1)}
                      aria-label={`Move ${row.item.name} up`}
                    >
                      ↑
                    </button>
                    <button
                      className="icon-btn"
                      onClick={() => moveWatch(row.item.id, 1)}
                      aria-label={`Move ${row.item.name} down`}
                    >
                      ↓
                    </button>
                    <button
                      className="icon-btn"
                      onClick={() => removeWatch(row.item.id)}
                      aria-label={`Remove ${row.item.name}`}
                    >
                      ✕
                    </button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}

        <form className="inline-form watch-form" onSubmit={submit}>
          <input
            value={symbol}
            onChange={(event) => setSymbol(event.target.value)}
            placeholder="Add a symbol — AAPL, BTC-USD"
            aria-label="Symbol to watch"
            autoCapitalize="characters"
            autoCorrect="off"
            spellCheck={false}
          />
          <button className="btn btn-primary" type="submit" disabled={!symbol.trim()}>
            Add
          </button>
        </form>
        {notice && <p className="muted">{notice}</p>}
      </div>

      <div className="card">
        <div className="card-head">
          <h2>Your movers today</h2>
        </div>
        {movers.length === 0 ? (
          <p className="muted">
            Nothing you hold has a live price yet.{" "}
            <Link className="btn-link" to="/money/setup">
              Add a holding
            </Link>
          </p>
        ) : (
          <ul className="quote-list">
            {movers.slice(0, 8).map((item) => (
              <li className="quote-row" key={item.holding.id}>
                <div className="quote-name">
                  <strong>{item.holding.symbol}</strong>
                  <span className="muted row-hint">{item.holding.name || "—"}</span>
                </div>
                <div className="quote-values">
                  <span className={`money-value ${changeClass(item.dayChange)}`}>
                    {formatSignedMoney(item.dayChange, currency)}
                  </span>
                  <span className={changeClass(item.dayChange)}>
                    {item.dayChangePct !== null ? formatPercent(item.dayChangePct) : "—"}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="card">
        <Link className="row-button" to="/money">
          <span>
            Your portfolio
            <span className="muted row-hint">Net worth, allocation, holdings</span>
          </span>
          <span className="muted">›</span>
        </Link>
      </div>

      <p className="muted footnote">
        Daily closing prices from a free public source — they can lag the live market and
        occasionally fail to load. Not financial advice.
      </p>
    </div>
  );
}
