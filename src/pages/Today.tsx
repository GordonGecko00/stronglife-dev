import { useEffect, useRef, useState } from "react";
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
import { dayTasks, nextUp, checkInProgress, greeting, type DayTask } from "../store/day";
import { dayLog, habitProgress, proteinTarget } from "../store/selectors";
import { DAY_NAMES_LONG, dayKey } from "../lib/misc";
import { formatWeight } from "../lib/units";
import { repRange } from "../lib/labels";
import type { WorkoutTemplate } from "../types";

export default function Today() {
  const data = useAppData();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const checkInRef = useRef<HTMLDivElement>(null);
  const [openCheckIn, setOpenCheckIn] = useState(false);

  const today = new Date();
  const active = getActiveSession(data);
  const plan = planForDate(data, today);
  const tasks = dayTasks(data, today);
  const up = nextUp(data, today);
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

  function runPrimary() {
    if (up.kind === "resume") return navigate("/session");
    if (up.kind === "session" && up.template) return begin(up.template);
    if (up.kind === "sport" && up.template) {
      const minutes = up.template.exercises[0]?.targetMinutes || 60;
      quickLogSession(up.template, minutes);
      return;
    }
    if (up.kind === "checkin") {
      setOpenCheckIn(true);
      checkInRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }

  function focusTask(task: DayTask) {
    if (task.id === "checkin") {
      setOpenCheckIn(true);
      checkInRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    } else if (task.id === "session" && plan.morning) {
      begin(plan.morning);
    } else if (task.id === "sport" && plan.evening) {
      quickLogSession(plan.evening, plan.evening.exercises[0]?.targetMinutes || 60);
    }
  }

  return (
    <div className="page">
      <header className="page-head">
        <p className="eyebrow">
          {greeting(today)} · {DAY_NAMES_LONG[today.getDay()]}
        </p>
        <h1>{up.title}</h1>
      </header>

      {plan.reason && (
        <div className="banner">
          <span className="banner-icon" aria-hidden="true">
            🌙
          </span>
          <div>
            <strong>{plan.reason}</strong>
          </div>
        </div>
      )}

      {/* One card, one action — what to do right now. */}
      <div className="hero">
        <p className="hero-sub">{up.subtitle}</p>

        {up.kind === "session" && up.template && (
          <ul className="hero-lineup">
            {up.template.exercises.map((exercise) => (
              <li key={exercise.id}>
                <span>{exercise.name}</span>
                <span className="muted">
                  {exercise.tracking === "reps" &&
                    `${exercise.sets}×${repRange(exercise.targetReps, exercise.targetRepsMax)}${
                      exercise.weight > 0
                        ? ` · ${formatWeight(exercise.weight)} ${data.settings.unit}`
                        : ""
                    }`}
                  {exercise.tracking === "duration" && `${exercise.targetMinutes} min`}
                  {exercise.tracking === "done" && (exercise.hint || "hold")}
                </span>
              </li>
            ))}
          </ul>
        )}

        {up.action ? (
          <button className="btn btn-primary" onClick={runPrimary}>
            {up.action}
          </button>
        ) : (
          <p className="hero-done">✓ Nothing left today</p>
        )}

        {up.kind === "session" && plan.status === "adjusted" && plan.scheduled && (
          <button className="btn-link" onClick={() => begin(plan.scheduled!)}>
            Do {plan.scheduled.name} instead
          </button>
        )}
        {up.kind === "resume" && active && (
          <button
            className="btn-link danger"
            onClick={() => {
              if (confirm("Discard this in-progress session?")) cancelSession(active.id);
            }}
          >
            Discard it
          </button>
        )}
      </div>

      {/* The whole day at a glance, so nothing is hidden. */}
      <div className="card">
        <div className="card-head">
          <h2>Today</h2>
          <Link className="muted" to="/week">
            Week ›
          </Link>
        </div>
        <div className="task-list">
          {tasks.map((task) => (
            <button
              key={task.id}
              className={`task task-${task.state}`}
              disabled={task.state === "na"}
              onClick={() => focusTask(task)}
            >
              <TaskRing task={task} />
              <span className="task-text">
                <span className="task-label">{task.label}</span>
                <span className="muted">{task.detail}</span>
              </span>
              {task.state !== "na" && task.state !== "done" && (
                <span className="task-go" aria-hidden="true">
                  ›
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      <div ref={checkInRef}>
        {openCheckIn && <CheckInDetail onClose={() => setOpenCheckIn(false)} />}
      </div>

      <OtherSessions onPick={begin} />
    </div>
  );
}

function TaskRing({ task }: { task: DayTask }) {
  if (task.state === "done") {
    return (
      <span className="task-ring task-ring-done" aria-hidden="true">
        ✓
      </span>
    );
  }
  if (task.state === "na") {
    return <span className="task-ring task-ring-off" aria-hidden="true" />;
  }
  const size = 26;
  const r = 11;
  const c = 2 * Math.PI * r;
  return (
    <svg className="task-ring" width={size} height={size} aria-hidden="true">
      <circle cx={size / 2} cy={size / 2} r={r} className="ring-track" fill="none" strokeWidth={3} />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        className="ring-fill"
        fill="none"
        strokeWidth={3}
        strokeDasharray={`${c * task.progress} ${c}`}
        strokeLinecap="round"
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
      />
    </svg>
  );
}

function CheckInDetail({ onClose }: { onClose: () => void }) {
  const data = useAppData();
  const key = dayKey(new Date());
  const log = dayLog(data, key);
  const target = proteinTarget(data);
  const habits = habitProgress(data);
  const progress = checkInProgress(data);
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
        <button className="btn-link" onClick={onClose}>
          Hide
        </button>
      </div>

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
            {!target && <BodyWeightPrompt />}
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

      <BodyWeightRow />
    </div>
  );
}

/** Shown inline where the missing protein target is felt, not in a far-away card. */
function BodyWeightPrompt() {
  const data = useAppData();
  const [value, setValue] = useState("");

  return (
    <form
      className="inline-prompt"
      onSubmit={(event) => {
        event.preventDefault();
        const parsed = Number(value);
        if (!Number.isFinite(parsed) || parsed <= 0) return;
        logBodyWeight(parsed);
        setValue("");
      }}
    >
      <span className="muted">Add your body weight to get a protein target:</span>
      <div className="inline-form">
        <input
          type="number"
          inputMode="decimal"
          step="0.1"
          placeholder={data.settings.unit === "lb" ? "180" : "82"}
          value={value}
          onChange={(event) => setValue(event.target.value)}
          aria-label="Body weight"
        />
        <button className="btn btn-small btn-ghost" type="submit">
          Set
        </button>
      </div>
    </form>
  );
}

function BodyWeightRow() {
  const data = useAppData();
  const [value, setValue] = useState("");
  const latest = data.bodyWeights[0];
  const loggedToday = latest && dayKey(latest.dateISO) === dayKey(new Date());

  if (!latest) return null;

  return (
    <form
      className="field"
      onSubmit={(event) => {
        event.preventDefault();
        const parsed = Number(value);
        if (!Number.isFinite(parsed) || parsed <= 0) return;
        logBodyWeight(parsed);
        setValue("");
      }}
    >
      <span>
        Body weight{" "}
        {loggedToday ? (
          <>· {formatWeight(latest.weight)} {latest.unit} today</>
        ) : (
          <>· last {formatWeight(latest.weight)} {latest.unit}</>
        )}
      </span>
      <div className="inline-form">
        <input
          type="number"
          inputMode="decimal"
          step="0.1"
          placeholder="Today's weight"
          value={value}
          onChange={(event) => setValue(event.target.value)}
          aria-label="Body weight"
        />
        <button className="btn btn-small btn-ghost" type="submit">
          Log
        </button>
      </div>
    </form>
  );
}

function OtherSessions({ onPick }: { onPick: (t: WorkoutTemplate) => void }) {
  const data = useAppData();
  const [open, setOpen] = useState(false);

  return (
    <div className="card">
      <button className="card-toggle" onClick={() => setOpen((v) => !v)} aria-expanded={open}>
        <div>
          <h2>Do something else</h2>
          <span className="muted">Start any session off-schedule</span>
        </div>
        <span className="chevron">{open ? "▾" : "▸"}</span>
      </button>
      {open &&
        data.templates.map((template) => (
          <button key={template.id} className="row-button" onClick={() => onPick(template)}>
            <span>{template.name}</span>
            <span className={`kind-tag kind-${template.kind}`}>{template.kind}</span>
          </button>
        ))}
    </div>
  );
}
