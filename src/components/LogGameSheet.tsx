import { useState } from "react";
import { useAppData } from "../store/store";
import { logSession } from "../store/actions";
import { dayKey } from "../lib/misc";
import type { WorkoutTemplate } from "../types";

function timeValue(date: Date): string {
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

/**
 * Record a game that already happened, on any day and at any time.
 *
 * The time is asked for rather than assumed because the late-night rule keys
 * off it: a 9pm skate logged the next morning still has to ease off that
 * morning's session.
 */
export default function LogGameSheet({
  date,
  template,
  onClose,
}: {
  /** Day being logged. */
  date: Date;
  /** Pre-selected session; falls back to the first sport template. */
  template?: WorkoutTemplate | null;
  onClose: () => void;
}) {
  const data = useAppData();

  const candidates = data.templates.filter((t) => t.kind === "sport");
  const options = candidates.length > 0 ? candidates : data.templates;
  const initial = template ?? options[0] ?? null;

  const [templateId, setTemplateId] = useState(initial?.id ?? "");
  const [day, setDay] = useState(dayKey(date));
  // Default to an hour that trips the late-night rule, since that's the case
  // this exists for.
  const [time, setTime] = useState(() => {
    const start = new Date(date);
    start.setHours(Math.min(22, data.settings.recovery.lateHour + 2), 0, 0, 0);
    return timeValue(start);
  });
  const chosen = data.templates.find((t) => t.id === templateId) ?? initial;
  const [minutes, setMinutes] = useState(
    String(chosen?.exercises.find((e) => e.tracking === "duration")?.targetMinutes || 60)
  );

  const parsedMinutes = Math.max(1, Number(minutes) || 60);
  const startedAt = new Date(`${day}T${time}`);
  const valid = chosen !== null && !Number.isNaN(startedAt.getTime());
  const late = valid && startedAt.getHours() >= data.settings.recovery.lateHour;

  function save() {
    if (!chosen || !valid) return;
    logSession(chosen, { minutes: parsedMinutes, startedAt });
    onClose();
  }

  return (
    <div className="sheet-backdrop" role="presentation" onClick={onClose}>
      <div
        className="sheet"
        role="dialog"
        aria-modal="true"
        aria-label="Log a game"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="sheet-grip" aria-hidden="true" />
        <div className="card-head">
          <h2>Log a game</h2>
          <button className="btn-link" onClick={onClose}>
            Cancel
          </button>
        </div>

        {options.length > 1 && (
          <label className="field">
            <span>Session</span>
            <select value={templateId} onChange={(event) => setTemplateId(event.target.value)}>
              {options.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.name}
                </option>
              ))}
            </select>
          </label>
        )}

        <div className="field-grid">
          <label>
            Day
            <input type="date" value={day} onChange={(event) => setDay(event.target.value)} />
          </label>
          <label>
            Start time
            <input type="time" value={time} onChange={(event) => setTime(event.target.value)} />
          </label>
        </div>

        <label className="field">
          <span>How long (minutes)</span>
          <input
            type="number"
            inputMode="numeric"
            min={1}
            step={15}
            value={minutes}
            onChange={(event) => setMinutes(event.target.value)}
          />
        </label>

        <p className="muted">
          {late
            ? "Counts as a late night — the next morning's hard session gets eased off."
            : `Before your ${data.settings.recovery.lateHour - 12}pm cutoff, so the next morning is left as planned.`}
        </p>

        <button className="btn btn-primary" disabled={!valid} onClick={save}>
          Save
        </button>
      </div>
    </div>
  );
}
