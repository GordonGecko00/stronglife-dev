import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAppData } from "../store/store";
import { getActiveSession, startSession, cancelSession, logBodyWeight } from "../store/actions";
import { templateForDay, stats, nextTrainingDay } from "../store/selectors";
import { DAY_NAMES_LONG, formatShortDate } from "../lib/misc";
import { formatWeight } from "../lib/units";
import type { WorkoutTemplate } from "../types";

export default function Today() {
  const data = useAppData();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [picking, setPicking] = useState(false);

  const active = getActiveSession(data);
  const todayIndex = new Date().getDay();
  const scheduled = templateForDay(data, todayIndex);
  const summary = stats(data, data.settings.unit);
  const upcoming = nextTrainingDay(data);

  const quickAction = searchParams.get("start");

  // Home-screen quick actions land here: jump straight into the workout.
  useEffect(() => {
    if (quickAction !== "today") return;
    if (active) {
      navigate("/session", { replace: true });
    } else if (scheduled) {
      startSession(scheduled);
      navigate("/session", { replace: true });
    }
  }, [quickAction, active, scheduled, navigate]);

  function begin(template: WorkoutTemplate) {
    startSession(template);
    navigate("/session");
  }

  if (active) {
    return (
      <div className="page">
        <header className="page-head">
          <p className="eyebrow">In progress</p>
          <h1>{active.templateName}</h1>
          <p className="muted">Started {new Date(active.startedAt).toLocaleTimeString()}</p>
        </header>
        <button className="btn btn-primary" onClick={() => navigate("/session")}>
          Resume workout
        </button>
        <button
          className="btn btn-ghost danger"
          onClick={() => {
            if (confirm("Discard this in-progress workout?")) cancelSession(active.id);
          }}
        >
          Discard
        </button>
      </div>
    );
  }

  return (
    <div className="page">
      <header className="page-head">
        <p className="eyebrow">{DAY_NAMES_LONG[todayIndex]}</p>
        <h1>{scheduled ? scheduled.name : "Rest day"}</h1>
      </header>

      {scheduled ? (
        <>
          <div className="card">
            <ul className="lineup">
              {scheduled.exercises.map((exercise) => (
                <li key={exercise.id}>
                  <span className="lineup-name">{exercise.name}</span>
                  <span className="lineup-detail">
                    {exercise.sets}×{exercise.targetReps}
                    <strong>
                      {" "}
                      {formatWeight(exercise.weight)} {data.settings.unit}
                    </strong>
                  </span>
                </li>
              ))}
            </ul>
          </div>
          <button className="btn btn-primary" onClick={() => begin(scheduled)}>
            Start {scheduled.name}
          </button>
        </>
      ) : (
        <div className="card">
          <p>Nothing scheduled today.</p>
          {upcoming && (
            <p className="muted">
              Next up: {upcoming.template.name} on {formatShortDate(upcoming.date.getTime())}
            </p>
          )}
        </div>
      )}

      {picking ? (
        <div className="card">
          <h2>Pick a workout</h2>
          {data.templates.map((template) => (
            <button key={template.id} className="row-button" onClick={() => begin(template)}>
              <span>{template.name}</span>
              <span className="muted">{template.exercises.length} exercises</span>
            </button>
          ))}
          <button className="btn-link" onClick={() => setPicking(false)}>
            Cancel
          </button>
        </div>
      ) : (
        <button className="btn btn-ghost" onClick={() => setPicking(true)}>
          Start a different workout
        </button>
      )}

      <div className="stat-row">
        <div className="stat-tile">
          <span className="stat-value">{summary.totalWorkouts}</span>
          <span className="stat-label">workouts</span>
        </div>
        <div className="stat-tile">
          <span className="stat-value">{summary.workoutsThisWeek}</span>
          <span className="stat-label">this week</span>
        </div>
        <div className="stat-tile">
          <span className="stat-value">{summary.currentStreakWeeks}</span>
          <span className="stat-label">week streak</span>
        </div>
      </div>

      <BodyWeightCard />
    </div>
  );
}

function BodyWeightCard() {
  const data = useAppData();
  const [value, setValue] = useState("");
  const latest = data.bodyWeights[0];

  return (
    <div className="card">
      <div className="card-head">
        <h2>Body weight</h2>
        {latest && (
          <span className="muted">
            {formatWeight(latest.weight)} {latest.unit} · {formatShortDate(latest.dateISO)}
          </span>
        )}
      </div>
      <form
        className="inline-form"
        onSubmit={(event) => {
          event.preventDefault();
          const parsed = Number(value);
          if (!Number.isFinite(parsed) || parsed <= 0) return;
          logBodyWeight(parsed);
          setValue("");
        }}
      >
        <input
          type="number"
          inputMode="decimal"
          step="0.1"
          placeholder={`Weight in ${data.settings.unit}`}
          value={value}
          onChange={(event) => setValue(event.target.value)}
          aria-label="Body weight"
        />
        <button className="btn btn-small btn-ghost" type="submit">
          Log
        </button>
      </form>
    </div>
  );
}
