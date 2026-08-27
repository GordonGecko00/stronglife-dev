import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAppData } from "../store/store";
import {
  allocationByAccount,
  allocationByClass,
  holdingsByAccount,
  netWorthSeries,
  orphanHoldings,
  portfolio,
  quoteFor,
  quoteFreshness,
} from "../store/finance";
import { patchMoneySettings, recordNetWorth } from "../store/financeActions";
import { useQuotes } from "../components/useQuotes";
import LineChart from "../components/LineChart";
import AllocationBar from "../components/AllocationBar";
import Sparkline from "../components/Sparkline";
import {
  ACCOUNT_KIND_LABEL,
  formatAgo,
  formatCompactMoney,
  formatMoney,
  formatPercent,
  formatQuantity,
  formatSignedMoney,
} from "../lib/money";
import type { PricedHolding } from "../lib/portfolio";
import type { Currency } from "../types";

/** Green for up, red for down, neutral for flat — matched to the hit/miss tokens. */
function changeClass(value: number): string {
  return value > 0 ? "delta-up" : value < 0 ? "delta-down" : "delta-flat";
}

export default function Money() {
  const data = useAppData();
  const { currency, privacy } = data.settings.money;
  const { loading, errors, refresh } = useQuotes();
  const [breakdown, setBreakdown] = useState<"class" | "account">("class");

  const totals = portfolio(data);
  const groups = holdingsByAccount(data);
  const orphans = orphanHoldings(data);
  const slices = breakdown === "class" ? allocationByClass(data) : allocationByAccount(data);
  const series = netWorthSeries(data);
  const { newest } = quoteFreshness(data);

  const hasAnything = data.accounts.length > 0 || data.holdings.length > 0;

  // Snapshot today's value whenever the page is opened, so the net worth curve
  // builds itself out of ordinary use rather than a chore.
  useEffect(() => {
    recordNetWorth();
  }, [totals.netWorth]);

  return (
    <div className={`page money-page${privacy ? " money-private" : ""}`}>
      <header className="page-head money-head">
        <div>
          <h1>Money</h1>
          <p className="muted">What you own, and what it's worth today.</p>
        </div>
        <button
          className="icon-btn"
          onClick={() => patchMoneySettings({ privacy: !privacy })}
          aria-pressed={privacy}
          title={privacy ? "Show balances" : "Hide balances"}
        >
          {privacy ? "🙈" : "👁"}
        </button>
      </header>

      {!hasAnything ? (
        <div className="card">
          <div className="card-head">
            <h2>Nothing tracked yet</h2>
          </div>
          <p className="muted">
            Add an account and the things you hold in it, and this page will show what
            you're worth, how it's split, and what moved today.
          </p>
          <Link className="btn btn-primary" to="/money/setup">
            Set up your accounts
          </Link>
        </div>
      ) : (
        <>
          <div className="stat-row">
            <div className="stat-tile">
              <span className="stat-value money-value">
                {formatCompactMoney(totals.netWorth, currency)}
              </span>
              <span className="stat-label">net worth</span>
            </div>
            <div className="stat-tile">
              <span className={`stat-value money-value ${changeClass(totals.dayChange)}`}>
                {formatSignedMoney(totals.dayChange, currency)}
              </span>
              <span className="stat-label">
                today {totals.dayChangePct !== null && `· ${formatPercent(totals.dayChangePct)}`}
              </span>
            </div>
            <div className="stat-tile">
              <span className={`stat-value money-value ${changeClass(totals.gain)}`}>
                {formatCompactMoney(totals.gain, currency)}
              </span>
              <span className="stat-label">
                total {totals.gainPct !== null && `· ${formatPercent(totals.gainPct)}`}
              </span>
            </div>
          </div>

          <p className="status-line money-status">
            {loading
              ? "Updating prices…"
              : newest
                ? `Prices updated ${formatAgo(newest)}`
                : "No prices yet"}
            {data.settings.money.source !== "manual" && (
              <>
                {" · "}
                <button className="btn-link" onClick={refresh} disabled={loading}>
                  Refresh
                </button>
              </>
            )}
          </p>

          {errors.length > 0 && (
            <div className="banner banner-warn">
              <span className="banner-icon" aria-hidden="true">
                !
              </span>
              <div>
                <strong>Couldn't price {errors.length === 1 ? "one symbol" : `${errors.length} symbols`}</strong>
                <p>
                  {errors
                    .slice(0, 3)
                    .map((e) => `${e.symbol}: ${e.error}`)
                    .join(" · ")}
                  . Showing the last known prices — you can also enter a price by hand.
                </p>
              </div>
            </div>
          )}

          {totals.unpriced > 0 && (
            <div className="banner">
              <span className="banner-icon" aria-hidden="true">
                i
              </span>
              <div>
                <strong>
                  {totals.unpriced} holding{totals.unpriced === 1 ? "" : "s"} valued at cost
                </strong>
                <p>No price has been fetched or entered, so cost basis is standing in.</p>
              </div>
            </div>
          )}

          <div className="card">
            <div className="card-head">
              <h2>Net worth</h2>
              <span className="muted">{series.length} day{series.length === 1 ? "" : "s"}</span>
            </div>
            <LineChart
              unit=""
              caption="Net worth over time"
              emptyLabel="Open this page over a few days and the curve fills in."
              series={[{ name: "Net worth", color: "var(--series-1)", points: series }]}
              formatValue={(value) => formatMoney(value, currency)}
              formatAxis={(value) => formatCompactMoney(value, currency)}
            />
          </div>

          <div className="card">
            <div className="card-head">
              <h2>Where you're invested</h2>
            </div>
            <div className="segmented">
              <button
                className={`segment ${breakdown === "class" ? "segment-on" : ""}`}
                onClick={() => setBreakdown("class")}
              >
                By asset
              </button>
              <button
                className={`segment ${breakdown === "account" ? "segment-on" : ""}`}
                onClick={() => setBreakdown("account")}
              >
                By account
              </button>
            </div>
            <AllocationBar
              slices={slices}
              formatValue={(value) => formatMoney(value, currency)}
            />
          </div>

          {groups.map((group) => (
            <div className="card" key={group.account.id}>
              <div className="card-head">
                <h2>{group.account.name}</h2>
                <span className="muted">{ACCOUNT_KIND_LABEL[group.account.kind]}</span>
              </div>
              <div className="account-total">
                <span className="money-value">{formatMoney(group.value, currency)}</span>
                <span className={`money-value ${changeClass(group.dayChange)}`}>
                  {formatSignedMoney(group.dayChange, currency)} today
                </span>
              </div>

              {group.items.length === 0 ? (
                <p className="muted">Cash only.</p>
              ) : (
                <ul className="holding-list">
                  {group.items.map((item) => (
                    <HoldingRow
                      key={item.holding.id}
                      item={item}
                      currency={currency}
                      history={quoteFor(data, item.holding.symbol)?.history ?? []}
                    />
                  ))}
                </ul>
              )}

              {group.account.cash !== 0 && (
                <div className="holding-cash">
                  <span>Cash</span>
                  <span className="money-value">{formatMoney(group.account.cash, currency)}</span>
                </div>
              )}
            </div>
          ))}

          {orphans.length > 0 && (
            <div className="banner banner-warn">
              <span className="banner-icon" aria-hidden="true">
                !
              </span>
              <div>
                <strong>{orphans.length} holding{orphans.length === 1 ? "" : "s"} with no account</strong>
                <p>
                  They still count toward your totals.{" "}
                  <Link className="btn-link" to="/money/setup">
                    Assign them
                  </Link>
                </p>
              </div>
            </div>
          )}

          {data.liabilities.length > 0 && (
            <div className="card">
              <div className="card-head">
                <h2>What you owe</h2>
                <span className="muted money-value">
                  {formatMoney(totals.liabilities, currency)}
                </span>
              </div>
              <ul className="holding-list">
                {data.liabilities.map((item) => (
                  <li key={item.id} className="holding-row">
                    <div className="holding-name">
                      <strong>{item.name}</strong>
                    </div>
                    <div className="holding-values">
                      <span className="money-value">{formatMoney(item.balance, currency)}</span>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}

      <div className="card">
        <Link className="row-button" to="/money/setup">
          <span>
            Accounts &amp; holdings
            <span className="muted row-hint">Add, edit, currency and price source</span>
          </span>
          <span className="muted">›</span>
        </Link>
        <Link className="row-button" to="/market">
          <span>
            Market
            <span className="muted row-hint">Indexes, your watchlist, today's movers</span>
          </span>
          <span className="muted">›</span>
        </Link>
      </div>

      <p className="muted footnote">
        Prices are indicative and can lag. Nothing here is financial advice, and your
        numbers never leave this device.
      </p>
    </div>
  );
}

function HoldingRow({
  item,
  currency,
  history,
}: {
  item: PricedHolding;
  currency: Currency;
  history: number[];
}) {
  const { holding } = item;
  // Only a real quote has a trend worth drawing; a manual price is one number.
  const trend = item.source === "quote" ? history.slice(-30) : [];
  return (
    <li className="holding-row">
      <div className="holding-name">
        <strong>{holding.symbol || holding.name || "—"}</strong>
        <span className="muted row-hint">
          {formatQuantity(holding.quantity)} @ {formatMoney(item.price, currency)}
          {item.source === "manual" && " · manual"}
          {item.source === "cost" && " · at cost"}
        </span>
      </div>
      <Sparkline
        values={trend}
        color={item.dayChange >= 0 ? "var(--hit)" : "var(--miss)"}
      />
      <div className="holding-values">
        <span className="money-value">{formatMoney(item.value, currency)}</span>
        <span className={`muted ${changeClass(item.dayChange)}`}>
          {item.dayChangePct !== null ? formatPercent(item.dayChangePct) : "—"}
        </span>
      </div>
    </li>
  );
}
