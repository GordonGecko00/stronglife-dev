import { useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import { useAppData } from "../store/store";
import {
  getActiveSession,
  startSession,
  cancelSession,
  logSessionJustFinished,
} from "../store/actions";
import { planForDate } from "../store/planning";
import { dayTasks, nextUp, greeting, type DayTask } from "../store/day";
import { DAY_NAMES_LONG } from "../lib/misc";
import { formatWeight } from "../lib/units";
import { repRange } from "../lib/labels";
import Icon from "../components/Icon";
import CheckIn from "../components/CheckIn";
import LogGameSheet from "../components/LogGameSheet";
import type { WorkoutTemplate } from "../types";

export default function Today() {
  const data = useAppData();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const checkInRef = useRef<HTMLDivElement>(null);
  const [openCheckIn, setOpenCheckIn] = useState(false);
  const [loggingGame, setLoggingGame] = useState(false);

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
      logSessionJustFinished(up.template, up.template.exercises[0]?.targetMinutes || 60);
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
    } else if (task.id === "sport") {
      setLoggingGame(true);
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
          <span className="banner-icon">
            <Icon name="moon" />
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
          <p className="hero-done">
            <Icon name="check" size={20} />
            Nothing left today
          </p>
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
              disabled={!task.actionable}
              onClick={() => focusTask(task)}
            >
              <TaskRing task={task} />
              <span className="task-text">
                <span className="task-label">{task.label}</span>
                <span className="muted">{task.detail}</span>
              </span>
              {task.actionable && task.state !== "done" && (
                <span className="task-go">
                  <Icon name="chevron" size={16} />
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      <div ref={checkInRef}>
        {openCheckIn && <CheckIn date={today} onClose={() => setOpenCheckIn(false)} />}
      </div>

      <OtherSessions onPick={begin} />

      {loggingGame && (
        <LogGameSheet
          date={today}
          template={plan.evening}
          onClose={() => setLoggingGame(false)}
        />
      )}
    </div>
  );
}

function TaskRing({ task }: { task: DayTask }) {
  if (task.state === "done") {
    return (
      <span className="task-ring task-ring-done">
        <Icon name="check" size={15} />
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
      {task.progress > 0 && (
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
      )}
    </svg>
  );
}

function OtherSessions({ onPick }: { onPick: (t: WorkoutTemplate) => void }) {
  const data = useAppData();
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <button className="quiet-link" onClick={() => setOpen(true)}>
        Start a different session
      </button>
    );
  }

  return (
    <div className="card">
      <div className="card-head">
        <h2>Start a different session</h2>
        <button className="btn-link" onClick={() => setOpen(false)}>
          Cancel
        </button>
      </div>
      {data.templates.map((template) => (
        <button key={template.id} className="row-button" onClick={() => onPick(template)}>
          <span>{template.name}</span>
          <span className={`kind-tag kind-${template.kind}`}>{template.kind}</span>
        </button>
      ))}
    </div>
  );
}
