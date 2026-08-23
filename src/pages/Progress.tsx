import { useState } from "react";
import { useAppData } from "../store/store";
import {
  bodyWeightSeries,
  exerciseProgress,
  knownExercises,
  personalRecords,
  stats,
} from "../store/selectors";
import LineChart from "../components/LineChart";
import CalendarStrip from "../components/CalendarStrip";
import { workoutDayKeys } from "../store/selectors";
import { formatShortDate } from "../lib/misc";
import { formatWeight } from "../lib/units";

/** Validated against both app surfaces: blue = working weight, orange = est. 1RM. */
const SERIES_WORK = "var(--series-1)";
const SERIES_ESTIMATE = "var(--series-2)";

export default function Progress() {
  const data = useAppData();
  const unit = data.settings.unit;
  const exercises = knownExercises(data);
  const [selected, setSelected] = useState(exercises[0] ?? "");

  const name = exercises.includes(selected) ? selected : exercises[0] ?? "";
  const progress = name ? exerciseProgress(data, name, unit) : { topSet: [], oneRepMax: [] };
  const records = personalRecords(data, unit);
  const summary = stats(data, unit);
  const bodyWeight = bodyWeightSeries(data, unit);

  return (
    <div className="page">
      <header className="page-head">
        <h1>Progress</h1>
      </header>

      <div className="stat-row">
        <div className="stat-tile">
          <span className="stat-value">{summary.totalWorkouts}</span>
          <span className="stat-label">workouts</span>
        </div>
        <div className="stat-tile">
          <span className="stat-value">{summary.currentStreakWeeks}</span>
          <span className="stat-label">week streak</span>
        </div>
        <div className="stat-tile">
          <span className="stat-value">
            {summary.totalVolume >= 1000
              ? `${Math.round(summary.totalVolume / 1000)}k`
              : Math.round(summary.totalVolume)}
          </span>
          <span className="stat-label">{unit} lifted</span>
        </div>
      </div>

      <div className="card">
        <div className="card-head">
          <h2>Consistency</h2>
          <span className="muted">last 16 weeks</span>
        </div>
        <CalendarStrip days={workoutDayKeys(data)} />
      </div>

      {exercises.length > 0 && (
        <div className="card">
          <div className="card-head">
            <h2>Strength over time</h2>
          </div>
          <label className="field">
            <span>Exercise</span>
            <select value={name} onChange={(event) => setSelected(event.target.value)}>
              {exercises.map((exercise) => (
                <option key={exercise} value={exercise}>
                  {exercise}
                </option>
              ))}
            </select>
          </label>
          <LineChart
            unit={unit}
            caption={`${name} working weight and estimated one-rep max over time`}
            series={[
              { name: "Working weight", color: SERIES_WORK, points: progress.topSet },
              { name: "Est. 1RM", color: SERIES_ESTIMATE, points: progress.oneRepMax },
            ]}
          />
        </div>
      )}

      <div className="card">
        <div className="card-head">
          <h2>Personal records</h2>
        </div>
        {records.length === 0 ? (
          <p className="muted">Finish a workout to set your first record.</p>
        ) : (
          <ul className="record-list">
            {records.map((record) => (
              <li key={record.name}>
                <div>
                  <span className="record-name">{record.name}</span>
                  <span className="muted"> {formatShortDate(record.dateISO)}</span>
                </div>
                <div className="record-values">
                  <strong>
                    {formatWeight(Math.round(record.weight * 10) / 10)} {unit} × {record.reps}
                  </strong>
                  <span className="muted">
                    est. 1RM {formatWeight(Math.round(record.oneRepMax))} {unit}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {bodyWeight.length > 0 && (
        <div className="card">
          <div className="card-head">
            <h2>Body weight</h2>
          </div>
          <LineChart
            unit={unit}
            caption="Body weight over time"
            series={[{ name: "Body weight", color: SERIES_WORK, points: bodyWeight }]}
          />
        </div>
      )}
    </div>
  );
}
