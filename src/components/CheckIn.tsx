import { useState } from "react";
import { useAppData } from "../store/store";
import {
  bumpProtein,
  bumpWater,
  logBodyWeight,
  patchDailyLog,
  toggleHabit,
} from "../store/actions";
import { checkInProgress } from "../store/day";
import { bodyWeightOn, dayLog, habitProgress, proteinTarget } from "../store/selectors";
import { dayKey } from "../lib/misc";
import { formatWeight } from "../lib/units";
import Icon from "./Icon";

/**
 * Protein, water, habits and journal for one day.
 *
 * The day is a parameter rather than "now" throughout: this is the same card
 * whether you are ticking off tonight's habits or filling in the Thursday you
 * forgot about, and nothing here should quietly write to today instead.
 */
export default function CheckIn({
  date,
  onClose,
}: {
  date: Date;
  /** Omit for a check-in that is always open, as on the day page. */
  onClose?: () => void;
}) {
  const data = useAppData();
  const key = dayKey(date);
  const log = dayLog(data, key);
  const target = proteinTarget(data, date);
  const habits = habitProgress(data, date);
  const progress = checkInProgress(data, date);
  const [showJournal, setShowJournal] = useState(log.journal.length > 0);

  return (
    <div className="card">
      <div className="card-head">
        <div>
          <h2>Daily check-in</h2>
          <span className="muted">
            {progress.completed} of {progress.total} done
          </span>
        </div>
        {onClose && (
          <button className="btn-link" onClick={onClose}>
            Hide
          </button>
        )}
      </div>

      <div className="meter">
        <div className="meter-head">
          <span className="label-icon">
            <Icon name="flame" size={16} />
            Protein
          </span>
          <span className="meter-value">
            <input
              className="value-input"
              type="number"
              inputMode="numeric"
              min={0}
              step={5}
              value={log.proteinGrams}
              aria-label="Protein in grams"
              onChange={(event) =>
                patchDailyLog(key, { proteinGrams: Math.max(0, Number(event.target.value) || 0) })
              }
            />
            {target ? ` / ${target} g` : " g"}
          </span>
        </div>
        <div className="meter-track">
          <div
            className="meter-fill"
            style={{ width: `${target ? Math.min(100, (log.proteinGrams / target) * 100) : 0}%` }}
          />
        </div>
        <div className="chip-row">
          {[20, 30, 40].map((grams) => (
            <button key={grams} className="mini-btn" onClick={() => bumpProtein(key, grams)}>
              +{grams}
            </button>
          ))}
          <button className="mini-btn" onClick={() => bumpProtein(key, -20)}>
            −20
          </button>
        </div>
      </div>

      <div className="meter">
        <div className="meter-head">
          <span className="label-icon">
            <Icon name="drop" size={16} />
            Water
          </span>
          <span className="meter-value">
            {log.waterGlasses} / {data.settings.waterTarget}
          </span>
        </div>
        <div className="glass-row">
          {Array.from({ length: data.settings.waterTarget }, (_, i) => (
            <button
              key={i}
              className={`glass ${i < log.waterGlasses ? "glass-on" : ""}`}
              aria-label={`${i + 1} glasses`}
              onClick={() =>
                patchDailyLog(key, { waterGlasses: i + 1 === log.waterGlasses ? i : i + 1 })
              }
            />
          ))}
          <button className="mini-btn" onClick={() => bumpWater(key, 1)}>
            +1
          </button>
        </div>
      </div>

      <div className="habit-list">
        {habits.map(({ habit, count, target: habitTarget, doneOnDay }) => (
          <button
            key={habit.id}
            className={`habit ${doneOnDay ? "habit-on" : ""}`}
            aria-pressed={doneOnDay}
            onClick={() => toggleHabit(key, habit.id)}
          >
            <span className="habit-check">
              <Icon name="check" size={12} />
            </span>
            <span className="habit-name">{habit.name}</span>
            <span className="habit-count">
              {habit.cadence === "weekly" ? `${count}/${habitTarget} wk` : ""}
            </span>
          </button>
        ))}
      </div>

      {showJournal ? (
        <label className="field">
          <span>Journal</span>
          <textarea
            rows={3}
            value={log.journal}
            placeholder="Gratitude, reflections, intentions for tomorrow…"
            onChange={(event) => patchDailyLog(key, { journal: event.target.value })}
          />
        </label>
      ) : (
        <button className="btn-link" onClick={() => setShowJournal(true)}>
          + Journal entry
        </button>
      )}

      <BodyWeightRow date={date} />
    </div>
  );
}

/**
 * Body weight for this day. Sits next to the protein target because that is the
 * number it feeds; without it the target reads as a blank.
 */
function BodyWeightRow({ date }: { date: Date }) {
  const data = useAppData();
  const key = dayKey(date);
  const onDay = bodyWeightOn(data, key);
  const latest = data.bodyWeights[0];
  const [value, setValue] = useState("");

  const known = onDay ?? latest ?? null;

  return (
    <form
      className="field"
      onSubmit={(event) => {
        event.preventDefault();
        const parsed = Number(value);
        if (!Number.isFinite(parsed) || parsed <= 0) return;
        logBodyWeight(parsed, date);
        setValue("");
      }}
    >
      <span>
        Body weight
        {onDay ? (
          <>
            {" "}
            · {formatWeight(onDay.weight)} {onDay.unit} this day
          </>
        ) : known ? (
          <>
            {" "}
            · last {formatWeight(known.weight)} {known.unit}
          </>
        ) : null}
      </span>
      <div className="inline-form">
        <input
          type="number"
          inputMode="decimal"
          step="0.1"
          placeholder={
            onDay ? "Replace it" : data.settings.unit === "lb" ? "180" : "82"
          }
          value={value}
          onChange={(event) => setValue(event.target.value)}
          aria-label="Body weight"
        />
        <button className="btn btn-small btn-ghost" type="submit">
          {onDay ? "Update" : "Log"}
        </button>
      </div>
      {!known && (
        <span className="muted">Needed for a protein target.</span>
      )}
    </form>
  );
}
