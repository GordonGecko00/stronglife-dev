import { useRef, useState } from "react";
import { useAppData, replaceAll, resetAll } from "../store/store";
import { patchSettings, setUnit } from "../store/actions";
import {
  backupFilename,
  bodyWeightCSV,
  copyToClipboard,
  downloadFile,
  parseBackup,
  toCSV,
  toJSON,
} from "../lib/backup";
import { DEFAULT_PLATES, formatWeight } from "../lib/units";
import type { Theme, Unit } from "../types";

export default function Settings() {
  const data = useAppData();
  const { settings } = data;
  const [status, setStatus] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  async function share(contents: string, filename: string, mime: string) {
    downloadFile(filename, contents, mime);
    // Standalone Safari blocks page-initiated downloads, so always offer the
    // clipboard as a fallback the user can paste anywhere.
    const copied = await copyToClipboard(contents);
    setStatus(copied ? `${filename} downloaded and copied to clipboard.` : `${filename} downloaded.`);
  }

  function importText(text: string) {
    const result = parseBackup(text);
    if (!result.ok || !result.data) {
      setStatus(result.error ?? "Could not read that backup.");
      return;
    }
    const count = result.data.sessions?.length ?? 0;
    if (!confirm(`Replace everything on this device with this backup (${count} workouts)?`)) return;
    replaceAll(result.data);
    setStatus("Backup restored.");
  }

  return (
    <div className="page">
      <header className="page-head">
        <h1>Settings</h1>
      </header>

      <div className="card">
        <div className="card-head">
          <h2>Units and equipment</h2>
        </div>
        <div className="segmented">
          {(["lb", "kg"] as Unit[]).map((unit) => (
            <button
              key={unit}
              className={settings.unit === unit ? "segment segment-on" : "segment"}
              onClick={() => setUnit(unit)}
            >
              {unit}
            </button>
          ))}
        </div>
        <p className="muted">
          Switching converts every planned weight. Past workouts keep the units they were logged in.
        </p>
        <label className="field">
          <span>Bar weight ({settings.unit})</span>
          <input
            type="number"
            min={0}
            step="0.5"
            inputMode="decimal"
            value={settings.barWeight}
            onChange={(event) =>
              patchSettings({ barWeight: Math.max(0, Number(event.target.value) || 0) })
            }
          />
        </label>
        <div className="field">
          <span>Plates in your gym ({settings.unit}, per side)</span>
          <div className="plate-toggles">
            {DEFAULT_PLATES[settings.unit].map((plate) => {
              const on = settings.plates.includes(plate);
              return (
                <button
                  key={plate}
                  className={`plate-toggle ${on ? "plate-toggle-on" : ""}`}
                  aria-pressed={on}
                  onClick={() =>
                    patchSettings({
                      plates: on
                        ? settings.plates.filter((p) => p !== plate)
                        : [...settings.plates, plate].sort((a, b) => b - a),
                    })
                  }
                >
                  {formatWeight(plate)}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-head">
          <h2>Workout</h2>
        </div>
        <label className="field">
          <span>Rest between sets (seconds)</span>
          <input
            type="number"
            min={0}
            step={15}
            inputMode="numeric"
            value={settings.restSec}
            onChange={(event) =>
              patchSettings({ restSec: Math.max(0, Number(event.target.value) || 0) })
            }
          />
        </label>
        <label className="field">
          <span>Rest after a missed set (seconds)</span>
          <input
            type="number"
            min={0}
            step={15}
            inputMode="numeric"
            value={settings.restAfterFailSec}
            onChange={(event) =>
              patchSettings({ restAfterFailSec: Math.max(0, Number(event.target.value) || 0) })
            }
          />
        </label>
        <label className="toggle">
          <input
            type="checkbox"
            checked={settings.warmupEnabled}
            onChange={(event) => patchSettings({ warmupEnabled: event.target.checked })}
          />
          Generate warmup sets
        </label>
        <label className="toggle">
          <input
            type="checkbox"
            checked={settings.vibrate}
            onChange={(event) => patchSettings({ vibrate: event.target.checked })}
          />
          Vibrate when rest ends
        </label>
      </div>

      <div className="card">
        <div className="card-head">
          <h2>Progression</h2>
        </div>
        <label className="field">
          <span>Deload after this many failed sessions</span>
          <input
            type="number"
            min={1}
            inputMode="numeric"
            value={settings.deloadAfterFails}
            onChange={(event) =>
              patchSettings({ deloadAfterFails: Math.max(1, Number(event.target.value) || 1) })
            }
          />
        </label>
        <label className="field">
          <span>Deload by (%)</span>
          <input
            type="number"
            min={0}
            max={50}
            inputMode="numeric"
            value={settings.deloadPercent}
            onChange={(event) =>
              patchSettings({
                deloadPercent: Math.min(50, Math.max(0, Number(event.target.value) || 0)),
              })
            }
          />
        </label>
      </div>

      <div className="card">
        <div className="card-head">
          <h2>Appearance</h2>
        </div>
        <div className="segmented">
          {(["system", "light", "dark"] as Theme[]).map((theme) => (
            <button
              key={theme}
              className={settings.theme === theme ? "segment segment-on" : "segment"}
              onClick={() => patchSettings({ theme })}
            >
              {theme}
            </button>
          ))}
        </div>
      </div>

      <div className="card">
        <div className="card-head">
          <h2>Backup</h2>
        </div>
        <p className="muted">
          Everything lives in this browser's storage only. Clearing Safari's data or losing the
          phone loses your log — export now and then.
        </p>
        <button
          className="btn btn-ghost"
          onClick={() => share(toJSON(data), backupFilename("json"), "application/json")}
        >
          Export backup (JSON)
        </button>
        <button
          className="btn btn-ghost"
          onClick={() => share(toCSV(data), backupFilename("csv"), "text/csv")}
        >
          Export sets (CSV)
        </button>
        {data.bodyWeights.length > 0 && (
          <button
            className="btn btn-ghost"
            onClick={() =>
              share(bodyWeightCSV(data), `stronglife-bodyweight.csv`, "text/csv")
            }
          >
            Export body weight (CSV)
          </button>
        )}

        <input
          ref={fileInput}
          type="file"
          accept="application/json,.json"
          hidden
          onChange={async (event) => {
            const file = event.target.files?.[0];
            if (!file) return;
            importText(await file.text());
            event.target.value = "";
          }}
        />
        <button className="btn btn-ghost" onClick={() => fileInput.current?.click()}>
          Restore from file
        </button>
        <button
          className="btn btn-ghost"
          onClick={async () => {
            const text = prompt("Paste a JSON backup:");
            if (text) importText(text);
          }}
        >
          Restore from pasted JSON
        </button>

        {status && <p className="status-line">{status}</p>}
      </div>

      <div className="card">
        <div className="card-head">
          <h2>Danger zone</h2>
        </div>
        <button
          className="btn btn-ghost danger"
          onClick={() => {
            if (!confirm("Erase all workouts, templates and settings on this device?")) return;
            if (!confirm("This cannot be undone. Really erase everything?")) return;
            resetAll();
            setStatus("All data erased.");
          }}
        >
          Erase all data
        </button>
      </div>

      <p className="muted footnote">
        StrongLife · your data never leaves this device.
      </p>
    </div>
  );
}
