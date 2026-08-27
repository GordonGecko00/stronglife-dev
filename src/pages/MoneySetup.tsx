import { useState } from "react";
import { Link } from "react-router-dom";
import { useAppData } from "../store/store";
import { orphanHoldings } from "../store/finance";
import {
  addAccount,
  addHolding,
  addLiability,
  patchAccount,
  patchHolding,
  patchLiability,
  patchMoneySettings,
  removeAccount,
  removeHolding,
  removeLiability,
} from "../store/financeActions";
import {
  ACCOUNT_KIND_LABEL,
  ASSET_CLASS_LABEL,
  CURRENCIES,
  parseAmount,
} from "../lib/money";
import type { AccountKind, AssetClass, Currency, Holding, QuoteSource } from "../types";

const ACCOUNT_KINDS = Object.keys(ACCOUNT_KIND_LABEL) as AccountKind[];
const ASSET_CLASSES = Object.keys(ASSET_CLASS_LABEL) as AssetClass[];

/**
 * A number field that keeps what you typed while you type it.
 *
 * Parsing on every keystroke fights the user — clearing the box would snap it
 * back to 0, and "1." isn't a number yet — so the draft is local and only
 * committed on blur.
 */
function AmountInput({
  value,
  onCommit,
  placeholder,
  label,
}: {
  value: number;
  onCommit: (value: number) => void;
  placeholder?: string;
  label: string;
}) {
  const [draft, setDraft] = useState<string | null>(null);

  return (
    <input
      inputMode="decimal"
      aria-label={label}
      placeholder={placeholder}
      value={draft ?? String(value)}
      onChange={(event) => setDraft(event.target.value)}
      onFocus={(event) => event.currentTarget.select()}
      onBlur={() => {
        if (draft !== null) {
          const parsed = parseAmount(draft);
          if (parsed !== null) onCommit(parsed);
        }
        setDraft(null);
      }}
    />
  );
}

export default function MoneySetup() {
  const data = useAppData();
  const { currency, source } = data.settings.money;
  const orphans = orphanHoldings(data);

  return (
    <div className="page">
      <header className="page-head">
        <Link className="btn-link" to="/money">
          ‹ Money
        </Link>
        <h1>Accounts &amp; holdings</h1>
      </header>

      <div className="card">
        <div className="card-head">
          <h2>Preferences</h2>
        </div>
        <label className="field">
          <span>Currency</span>
          <select
            value={currency}
            onChange={(event) =>
              patchMoneySettings({ currency: event.target.value as Currency })
            }
          >
            {CURRENCIES.map((code) => (
              <option key={code} value={code}>
                {code}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>Prices</span>
          <select
            value={source}
            onChange={(event) =>
              patchMoneySettings({ source: event.target.value as QuoteSource })
            }
          >
            <option value="stooq">Fetch automatically</option>
            <option value="manual">Enter by hand only</option>
          </select>
        </label>
        <p className="muted">
          {source === "stooq"
            ? "Daily closing prices are fetched from a free public source when you open the money pages. No account or API key needed, and it can occasionally be unavailable — cached prices are used when it is."
            : "Nothing is fetched. Enter a price on each holding to value it."}
        </p>
      </div>

      {orphans.length > 0 && (
        <div className="card">
          <div className="card-head">
            <h2>Holdings with no account</h2>
          </div>
          <p className="muted">Pick an account for each, or remove it.</p>
          <ul className="holding-list">
            {orphans.map((holding) => (
              <li key={holding.id} className="holding-row">
                <div className="holding-name">
                  <strong>{holding.symbol || "—"}</strong>
                </div>
                <select
                  value=""
                  aria-label={`Account for ${holding.symbol}`}
                  onChange={(event) => patchHolding(holding.id, { accountId: event.target.value })}
                >
                  <option value="" disabled>
                    Choose…
                  </option>
                  {data.accounts.map((account) => (
                    <option key={account.id} value={account.id}>
                      {account.name}
                    </option>
                  ))}
                </select>
                <button className="icon-btn" onClick={() => removeHolding(holding.id)} aria-label="Remove">
                  ✕
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {data.accounts.map((account) => (
        <div className="card" key={account.id}>
          <input
            className="title-input"
            value={account.name}
            aria-label="Account name"
            onChange={(event) => patchAccount(account.id, { name: event.target.value })}
          />
          <div className="field-grid">
            <label>
              <span>Type</span>
              <select
                value={account.kind}
                onChange={(event) =>
                  patchAccount(account.id, { kind: event.target.value as AccountKind })
                }
              >
                {ACCOUNT_KINDS.map((kind) => (
                  <option key={kind} value={kind}>
                    {ACCOUNT_KIND_LABEL[kind]}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>Cash ({currency})</span>
              <AmountInput
                label="Cash balance"
                value={account.cash}
                onCommit={(value) => patchAccount(account.id, { cash: value })}
              />
            </label>
          </div>

          {data.holdings
            .filter((holding) => holding.accountId === account.id)
            .map((holding) => (
              <HoldingEditor key={holding.id} holding={holding} currency={currency} />
            ))}

          <div className="inline-form">
            <button className="btn btn-ghost" onClick={() => addHolding(account.id)}>
              + Holding
            </button>
            <button
              className="btn-link danger"
              onClick={() => {
                const count = data.holdings.filter((h) => h.accountId === account.id).length;
                const message = count
                  ? `Delete "${account.name}" and its ${count} holding${count === 1 ? "" : "s"}?`
                  : `Delete "${account.name}"?`;
                if (confirm(message)) removeAccount(account.id);
              }}
            >
              Delete account
            </button>
          </div>
        </div>
      ))}

      <div className="card">
        <button className="btn btn-primary" onClick={() => addAccount()}>
          + Add account
        </button>
      </div>

      <div className="card">
        <div className="card-head">
          <h2>What you owe</h2>
        </div>
        {data.liabilities.length === 0 && (
          <p className="muted">Mortgage, loans, a card balance — anything that offsets what you own.</p>
        )}
        {data.liabilities.map((item) => (
          <div className="field-grid" key={item.id}>
            <label>
              <span>Name</span>
              <input
                value={item.name}
                aria-label="Debt name"
                onChange={(event) => patchLiability(item.id, { name: event.target.value })}
              />
            </label>
            <label>
              <span>Balance ({currency})</span>
              <AmountInput
                label="Balance"
                value={item.balance}
                onCommit={(value) => patchLiability(item.id, { balance: value })}
              />
            </label>
            <button className="btn-link danger" onClick={() => removeLiability(item.id)}>
              Remove
            </button>
          </div>
        ))}
        <button className="btn btn-ghost" onClick={() => addLiability()}>
          + Add debt
        </button>
      </div>
    </div>
  );
}

function HoldingEditor({ holding, currency }: { holding: Holding; currency: Currency }) {
  const [open, setOpen] = useState(holding.symbol === "");

  return (
    <div className="holding-editor">
      <button className="card-toggle" onClick={() => setOpen((v) => !v)}>
        <h2>{holding.symbol || "New holding"}</h2>
        <span className="chevron">{open ? "▾" : "▸"}</span>
      </button>

      {open && (
        <>
          <div className="field-grid">
            <label>
              <span>Symbol</span>
              <input
                value={holding.symbol}
                aria-label="Symbol"
                placeholder="AAPL"
                autoCapitalize="characters"
                autoCorrect="off"
                spellCheck={false}
                onChange={(event) =>
                  patchHolding(holding.id, { symbol: event.target.value.toUpperCase() })
                }
              />
            </label>
            <label>
              <span>Name</span>
              <input
                value={holding.name}
                aria-label="Holding name"
                placeholder="Apple Inc."
                onChange={(event) => patchHolding(holding.id, { name: event.target.value })}
              />
            </label>
            <label>
              <span>Type</span>
              <select
                value={holding.assetClass}
                onChange={(event) =>
                  patchHolding(holding.id, { assetClass: event.target.value as AssetClass })
                }
              >
                {ASSET_CLASSES.map((cls) => (
                  <option key={cls} value={cls}>
                    {ASSET_CLASS_LABEL[cls]}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>Quantity</span>
              <AmountInput
                label="Quantity"
                value={holding.quantity}
                onCommit={(value) => patchHolding(holding.id, { quantity: value })}
              />
            </label>
            <label>
              <span>Cost per unit ({currency})</span>
              <AmountInput
                label="Cost per unit"
                value={holding.costPerUnit}
                onCommit={(value) => patchHolding(holding.id, { costPerUnit: value })}
              />
            </label>
            <label>
              <span>Price override</span>
              <AmountInput
                label="Manual price"
                placeholder="auto"
                value={holding.manualPrice ?? 0}
                onCommit={(value) => patchHolding(holding.id, { manualPrice: value })}
              />
            </label>
          </div>

          <div className="inline-form">
            {holding.manualPrice !== null && (
              <button
                className="btn-link"
                onClick={() => patchHolding(holding.id, { manualPrice: null })}
              >
                Use fetched price
              </button>
            )}
            <button className="btn-link danger" onClick={() => removeHolding(holding.id)}>
              Remove holding
            </button>
          </div>
        </>
      )}
    </div>
  );
}
