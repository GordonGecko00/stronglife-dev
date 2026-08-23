import { useEffect, useState } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import { useAppData } from "../store/store";
import {
  getActiveSession,
  startSession,
  cancelSession,
  logBodyWeight,
  quickLogSession,
  bumpWater,
  bumpProtein,
  patchDailyLog,
  toggleHabit,
} from "../store/actions";
import { planForDate } from "../store/planning";
import { dayLog, habitProgress, proteinTarget, stats } from "../store/selectors";
import { DAY_NAMES_LONG, dayKey, formatShortDate } from "../lib/misc";
import { formatWeight } from "../lib/units";
import { kindLabel, repRange } from "../lib/labels";
import type { WorkoutTemplate } from "../types";

export default function Today() {
  const data = useAppData();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [picking, setPicking] = useState(false);

  const active = getActiveSession(data);
  const today = new Date();
  const plan = planForDate(data, today);
  const summary = stats(data, data.settings.unit);
  const quickAction = searchParams.get("start");

  useEffect(() => {
    if (quickAction !== "today") return;
    if (active) {
      navigate("/session", { replace: true });
    } else if (plan.morning) {
      startSession(plan.morning);
      navigate("/session", { replace: true });
    }
  }, [quickAction, active, plan.morning, navigate]);

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
        <p className="eyebrow">{DAY_NAMES_LONG[today.getDay()]}</p>
        <h1>{plan.morning ? plan.morning.name : "Rest day"}</h1>
      </header>

      {plan.reason && (
        <div className="banner">
          <span className="banner-icon" aria-hidden="true">
            🌙
          </span>
          <div>
            <strong>{plan.reason}</strong>
            {plan.scheduled && plan.status === "adjusted" && (
              <p className="muted">{plan.scheduled.name} moves to another day.</p>
            )}
          </div>
        </div>
      )}

      {plan.morning ? (
        <>
          <div className="card">
            <ul className="lineup">
              {plan.morning.exercises.map((exercise) => (
                <li key={exercise.id}>
                  <span className="lineup-name">{exercise.name}</span>
                  <span className="lineup-detail">
                    {exercise.tracking === "reps" && (
                      <>
                        {exercise.sets}×{repRange(exercise.targetReps, exercise.targetRepsMax)}
                        {exercise.weight > 0 && (
                          <strong>
                            {" "}
                            {formatWeight(exercise.weight)} {data.settings.unit}
                          </strong>
                        )}
                      </>
                    )}
                    {exercise.tracking === "duration" && <>{exercise.targetMinutes} min</>}
                    {exercise.tracking === "done" && <>{exercise.hint || "to complete"}</>}
                  </span>
                </li>
              ))}
            </ul>
          </div>
          <button className="btn btn-primary" onClick={() => begin(plan.morning!)}>
            Start {plan.morning.name}
          </button>
          {plan.status === "adjusted" && plan.scheduled && (
            <button className="btn btn-ghost" onClick={() => begin(plan.scheduled!)}>
              Do {plan.scheduled.name} anyway
            </button>
          )}
        </>
      ) : (
        <div className="card">
          <p>{plan.status === "skipped" ? "Recovery morning — no session." : "Nothing scheduled today."}</p>
          <Link className="btn-link" to="/week">
            See the week ›
          </Link>
        </div>
      )}

      {plan.evening && <EveningCard template={plan.evening} />}

      {picking ? (
        <div className="card">
          <h2>Pick a session</h2>
          {data.templates.map((template) => (
            <button key={template.id} className="row-button" onClick={() => begin(template)}>
              <span>{template.name}</span>
              <span className="muted">{kindLabel(template.kind)}</span>
            </button>
          ))}
          <button className="btn-link" onClick={() => setPicking(false)}>
            Cancel
          </button>
        </div>
      ) : (
        <button className="btn btn-ghost" onClick={() => setPicking(true)}>
          Start something else
        </button>
      )}

      <CheckInCard />

      <div className="stat-row">
        <div className="stat-tile">
          <span className="stat-value">{summary.workoutsThisWeek}</span>
          <span className="stat-label">this week</span>
        </div>
        <div className="stat-tile">
          <span className="stat-value">{summary.totalWorkouts}</span>
          <span className="stat-label">total</span>
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

/** Evening slot: hockey gets a one-tap log because you won't open the app rink-side. */
function EveningCard({ template }: { template: WorkoutTemplate }) {
  const data = useAppData();
  const navigate = useNavigate();
  const defaultMinutes = template.exercises[0]?.targetMinutes || 60;
  const [minutes, setMinutes] = useState(String(defaultMinutes));

  const loggedToday = data.sessions.some(
    (s) =>
      s.templateId === template.id &&
      s.finishedAt !== null &&
      dayKey(s.finishedAt) === dayKey(new Date())
  );

  return (
    <div className="card">
      <div className="card-head">
        <h2>Tonight · {template.name}</h2>
        {loggedToday && <span className="badge badge-hit">Logged</span>}
      </div>
      {loggedToday ? (
        <p className="muted">Nice. Tomorrow morning is adjusted automatically.</p>
      ) : (
        <>
          <div className="inline-form">
            <input
              type="number"
              inputMode="numeric"
              min={0}
              step={15}
              value={minutes}
              onChange={(event) => setMinutes(event.target.value)}
              aria-label={`${template.name} minutes`}
            />
            <button
              className="btn btn-small btn-ghost"
              onClick={() => quickLogSession(template, Number(minutes) || defaultMinutes)}
            >
              Log it
            </button>
          </div>
          <button className="btn-link" onClick={() => { startSession(template); navigate("/session"); }}>
            Or track it live ›
          </button>
        </>
      )}
    </div>
  );
}

function CheckInCard() {
  const data = useAppData();
  const key = dayKey(new Date());
  const log = dayLog(data, key);
  const target = proteinTarget(data);
  const habits = habitProgress(data);
  const [showJournal, setShowJournal] = useState(log.journal.length > 0);

  return (
    <div className="card">
      <div className="card-head">
        <h2>Today's check-in</h2>
      </div>

      <div className="meter-row">
        <div className="meter">
          <div className="meter-head">
            <span>Protein</span>
            <span className="meter-value">
              {log.proteinGrams}
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
          {!target && <p className="muted">Log a body weight to get a protein target.</p>}
        </div>

        <div className="meter">
          <div className="meter-head">
            <span>Water</span>
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
                onClick={() => patchDailyLog(key, { waterGlasses: i + 1 === log.waterGlasses ? i : i + 1 })}
              />
            ))}
            <button className="mini-btn" onClick={() => bumpWater(key, 1)}>
              +1
            </button>
          </div>
        </div>
      </div>

      <div className="habit-list">
        {habits.map(({ habit, count, target: habitTarget, doneToday }) => (
          <button
            key={habit.id}
            className={`habit ${doneToday ? "habit-on" : ""}`}
            aria-pressed={doneToday}
            onClick={() => toggleHabit(key, habit.id)}
          >
            <span className="habit-check" aria-hidden="true">
              {doneToday ? "✓" : ""}
            </span>
            <span className="habit-name">{habit.name}</span>
            <span className="habit-count">
              {count}/{habitTarget}
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
