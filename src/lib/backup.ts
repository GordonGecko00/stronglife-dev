import type { AppData } from "../types";

export function toJSON(data: AppData): string {
  return JSON.stringify(data, null, 2);
}

function csvCell(value: string | number): string {
  const text = String(value);
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/** One row per logged set — the shape you'd actually want in a warehouse. */
export function toCSV(data: AppData): string {
  const header = [
    "date",
    "workout",
    "exercise",
    "set_number",
    "set_kind",
    "weight",
    "unit",
    "target_reps",
    "reps",
    "completed",
  ];
  const rows: string[] = [header.join(",")];

  for (const session of data.sessions) {
    if (session.finishedAt === null) continue;
    for (const log of session.exercises) {
      log.sets.forEach((set, index) => {
        rows.push(
          [
            new Date(session.finishedAt ?? session.dateISO).toISOString(),
            csvCell(session.templateName),
            csvCell(log.name),
            index + 1,
            set.kind,
            set.weight,
            session.unit,
            set.targetReps,
            set.reps ?? "",
            set.done ? "true" : "false",
          ].join(",")
        );
      });
    }
  }

  return rows.join("\n");
}

export function bodyWeightCSV(data: AppData): string {
  const rows = ["date,weight,unit"];
  for (const entry of [...data.bodyWeights].reverse()) {
    rows.push([entry.dateISO, entry.weight, entry.unit].join(","));
  }
  return rows.join("\n");
}

/** One row per holding, with the numbers a spreadsheet would want. */
export function holdingsCSV(data: AppData, prices: Record<string, number>): string {
  const accounts = new Map(data.accounts.map((a) => [a.id, a.name]));
  const rows = [
    ["account", "symbol", "name", "asset_class", "quantity", "cost_per_unit", "price", "value", "currency"].join(","),
  ];

  for (const holding of data.holdings) {
    const price = prices[holding.symbol] ?? holding.costPerUnit;
    rows.push(
      [
        csvCell(accounts.get(holding.accountId) ?? "Unassigned"),
        csvCell(holding.symbol),
        csvCell(holding.name),
        holding.assetClass,
        holding.quantity,
        holding.costPerUnit,
        price,
        Math.round(price * holding.quantity * 100) / 100,
        data.settings.money.currency,
      ].join(",")
    );
  }

  for (const account of data.accounts) {
    if (account.cash === 0) continue;
    rows.push(
      [csvCell(account.name), "CASH", "Cash", "cash", "", "", "", account.cash, data.settings.money.currency].join(",")
    );
  }

  return rows.join("\n");
}

export interface ParsedBackup {
  ok: boolean;
  data?: AppData;
  error?: string;
}

/** Parse a pasted or uploaded backup, refusing anything that isn't one. */
export function parseBackup(text: string): ParsedBackup {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return { ok: false, error: "That doesn't look like JSON." };
  }
  if (typeof parsed !== "object" || parsed === null) {
    return { ok: false, error: "Backup file is empty or malformed." };
  }
  const candidate = parsed as Partial<AppData>;
  if (!Array.isArray(candidate.templates) || !Array.isArray(candidate.sessions)) {
    return { ok: false, error: "No workouts or templates found in that file." };
  }
  return { ok: true, data: parsed as AppData };
}

/**
 * Offer a file to the user. Safari in standalone (home-screen) mode blocks
 * downloads started by the page, so callers should also offer copy-to-clipboard.
 */
export function downloadFile(filename: string, contents: string, mime: string): void {
  const blob = new Blob([contents], { type: mime });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

export function backupFilename(extension: string): string {
  const date = new Date().toISOString().slice(0, 10);
  return `stronglife-${date}.${extension}`;
}
