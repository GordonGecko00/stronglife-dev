import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAppData } from "../store/store";
import {
  getActiveSession,
  setReps,
  adjustSessionWeight,
  setExerciseNote,
  setExerciseMinutes,
  toggleExerciseComplete,
  setSessionEffort,
  setSessionNote,
  finishSession,
  cancelSession,
  dismissTip,
} from "../store/actions";
import SetCell from "../components/SetCell";
import PlateChips from "../components/PlateChips";
import { formatDuration, formatWeight } from "../lib/units";
import { hitAllTargets } from "../lib/strength";
import type { ExerciseLog } from "../types";
import Icon from "../components/Icon";

const SET_TIP = "set-logging";

export default function Session() {
  const data = useAppData();
  const navigate = useNavigate();
  const session = getActiveSession(data);
  const [elapsed, setElapsed] = useState(0);
  // Which exercise card is expanded, tracked alongside the session it belongs
  // to. It opens on the first unfinished exercise and then stays under the
  // user's control: auto-advancing the moment the last set is tapped would
  // collapse the card out from under their finger.
  const [openCard, setOpenCard] = useState<{ sessionId: string | null; index: number }>({
    sessionId: null,
    index: 0,
  });

  useEffect(() => {
    if (!session) return;
    const tick = () => setElapsed(Math.floor((Date.now() - session.startedAt) / 1000));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [session]);

  // Finishing clears the active session, which would otherwise trip the guard
  // below and bounce us to Today instead of the history we just wrote.
  const leaving = useRef(false);

  useEffect(() => {
    if (!session && !leaving.current) navigate("/", { replace: true });
  }, [session, navigate]);

  if (!session) return null;

  // Adjust state during render when the session changes, rather than in an
  // effect, so there is no second render pass.
  let openIndex = openCard.index;
  if (openCard.sessionId !== session.id) {
    const first = session.exercises.findIndex((ex) => !logDone(ex));
    openIndex = first === -1 ? Math.max(0, session.exercises.length - 1) : first;
    setOpenCard({ sessionId: session.id, index: openIndex });
  }

  // Count every trackable item, so a cardio or yoga session can reach 100% too.
  const items = session.exercises.flatMap((ex) =>
    ex.tracking === "reps" ? ex.sets.filter((s) => s.kind === "work").map((s) => s.done) : [logDone(ex)]
  );
  const loggedCount = items.filter(Boolean).length;
  const allLogged = loggedCount === items.length && items.length > 0;


  return (
    <div className="page session-page">
      <header className="session-head">
        <div>
          <p className="eyebrow">{formatDuration(elapsed)} elapsed</p>
          <h1>{session.templateName}</h1>
        </div>
        <button
          className="btn btn-small btn-ghost danger"
          onClick={() => {
            if (confirm("Discard this workout? Nothing will be saved.")) {
              cancelSession(session.id);
              navigate("/");
            }
          }}
        >
          Discard
        </button>
      </header>

      <div className="progress-track" aria-hidden="true">
        <div
          className="progress-fill"
          style={{ width: `${items.length ? (loggedCount / items.length) * 100 : 0}%` }}
        />
      </div>
      <p className="muted">
        {loggedCount} of {items.length} logged
      </p>

      {!data.tipsSeen[SET_TIP] && session.exercises.some((e) => e.tracking === "reps") && (
        <div className="tip">
          <div>
            <strong>Logging sets</strong>
            <p className="muted">
              Tap a set once when you hit every rep. Tap again to count down (10 → 9 → 8…).
              Long-press for a keypad.
            </p>
          </div>
          <button className="btn btn-small btn-ghost" onClick={() => dismissTip(SET_TIP)}>
            Got it
          </button>
        </div>
      )}

      {session.exercises.map((log, index) => (
        <ExerciseCard
          key={log.exerciseId}
          sessionId={session.id}
          log={log}
          index={index}
          open={index === openIndex}
          isLast={index === session.exercises.length - 1}
          onOpen={() =>
            setOpenCard({ sessionId: session.id, index: index === openIndex ? -1 : index })
          }
          onNext={() => setOpenCard({ sessionId: session.id, index: index + 1 })}
        />
      ))}

      <div className="field">
        <span>How did it feel?</span>
        <div className="effort-row">
          {[1, 2, 3, 4, 5].map((level) => (
            <button
              key={level}
              className={`effort ${session.effort === level ? "effort-on" : ""}`}
              aria-pressed={session.effort === level}
              onClick={() => setSessionEffort(session.id, session.effort === level ? null : level)}
            >
              {level}
            </button>
          ))}
          <span className="muted effort-hint">1 easy · 5 all-out</span>
        </div>
      </div>

      <label className="field">
        <span>Workout notes</span>
        <textarea
          rows={2}
          value={session.note}
          placeholder="How did it feel?"
          onChange={(event) => setSessionNote(session.id, event.target.value)}
        />
      </label>

      <button
        className="btn btn-primary"
        disabled={loggedCount === 0}
        onClick={() => {
          if (!allLogged && !confirm("Some sets aren't logged. Finish anyway?")) return;
          leaving.current = true;
          finishSession(session.id);
          navigate("/history", { replace: true });
        }}
      >
        Finish workout
      </button>
    </div>
  );
}

/** A timed or tick-box exercise counts as logged once it has a value. */
function logDone(log: ExerciseLog): boolean {
  if (log.tracking === "duration") return log.minutes !== null;
  if (log.tracking === "done") return log.completed;
  return log.sets.filter((s) => s.kind === "work").every((s) => s.done);
}

/** One line describing what has been logged, shown when the card is collapsed. */
function summaryOf(log: ExerciseLog, unit: string): string {
  if (log.tracking === "duration") {
    return log.minutes === null ? `${log.targetMinutes} min target` : `${log.minutes} min`;
  }
  if (log.tracking === "done") return log.completed ? "Done" : log.hint || "Not done yet";
  const work = log.sets.filter((s) => s.kind === "work");
  const logged = work.filter((s) => s.done);
  if (logged.length === 0) {
    return `${work.length}×${log.targetReps}${
      log.targetRepsMax > log.targetReps ? `–${log.targetRepsMax}` : ""
    } · ${formatWeight(log.weight)} ${unit}`;
  }
  return `${work.map((s) => (s.done ? s.reps : "–")).join("/")} · ${formatWeight(log.weight)} ${unit}`;
}

function ExerciseCard({
  sessionId,
  log,
  index,
  open,
  isLast,
  onOpen,
  onNext,
}: {
  sessionId: string;
  log: ExerciseLog;
  index: number;
  open: boolean;
  isLast: boolean;
  onOpen: () => void;
  onNext: () => void;
}) {
  const data = useAppData();
  const [showNote, setShowNote] = useState(log.note.length > 0);
  const { unit, barWeight, plates } = data.settings;
  const complete = hitAllTargets(log);
  const logged = logDone(log);

  return (
    <div className={`card exercise-card ${complete ? "exercise-done" : ""} ${open ? "" : "exercise-collapsed"}`}>
      <button className="card-toggle" onClick={onOpen} aria-expanded={open}>
        <div className="exercise-head">
          <span className="exercise-title">
            <span className={`exercise-status ${logged ? "exercise-status-on" : ""}`} aria-hidden="true">
              {logged ? "✓" : index + 1}
            </span>
            <h2>{log.name}</h2>
          </span>
          {!open && <span className="muted">{summaryOf(log, unit)}</span>}
        </div>
        <span className={`chevron ${open ? "chevron-open" : ""}`}>
          <Icon name="chevron" size={16} />
        </span>
      </button>

      {open && (
        <>
          {log.hint && <p className="muted">{log.hint}</p>}

          {log.tracking === "reps" && (
            <RepsBody sessionId={sessionId} log={log} index={index} unit={unit} bar={barWeight} plates={plates} />
          )}
          {log.tracking === "duration" && <DurationBody sessionId={sessionId} log={log} index={index} />}
          {log.tracking === "done" && <DoneBody sessionId={sessionId} log={log} index={index} />}

          {showNote ? (
            <label className="field">
              <span>Note</span>
              <input
                value={log.note}
                placeholder="Form cue, pain, how it felt…"
                onChange={(event) => setExerciseNote(sessionId, index, event.target.value)}
              />
            </label>
          ) : (
            <button className="btn-link" onClick={() => setShowNote(true)}>
              + Add note
            </button>
          )}

          {logged && !isLast && (
            <button className="btn btn-ghost" onClick={onNext}>
              Next exercise ›
            </button>
          )}
        </>
      )}
    </div>
  );
}

function RepsBody({
  sessionId,
  log,
  index,
  unit,
  bar,
  plates,
}: {
  sessionId: string;
  log: ExerciseLog;
  index: number;
  unit: "lb" | "kg";
  bar: number;
  plates: number[];
}) {
  const step = unit === "kg" ? 2.5 : 5;
  const warmups = log.sets
    .map((set, setIndex) => ({ set, setIndex }))
    .filter(({ set }) => set.kind === "warmup");
  const work = log.sets
    .map((set, setIndex) => ({ set, setIndex }))
    .filter(({ set }) => set.kind === "work");
  const range = log.targetRepsMax > log.targetReps ? `${log.targetReps}–${log.targetRepsMax}` : `${log.targetReps}`;

  return (
    <>
      <div className="weight-row">
        <button
          className="step-btn"
          aria-label={`Decrease ${log.name} weight`}
          onClick={() => adjustSessionWeight(sessionId, index, log.weight - step)}
        >
          −
        </button>
        <span className="weight-value">
          {formatWeight(log.weight)}
          <span className="weight-unit">{unit}</span>
        </span>
        <button
          className="step-btn"
          aria-label={`Increase ${log.name} weight`}
          onClick={() => adjustSessionWeight(sessionId, index, log.weight + step)}
        >
          +
        </button>
      </div>

      {log.usesBar && <PlateChips weight={log.weight} bar={bar} plates={plates} unit={unit} />}

      {warmups.length > 0 && (
        <div className="set-group">
          <span className="set-group-label">Warmup</span>
          <div className="set-grid">
            {warmups.map(({ set, setIndex }) => (
              <div className="warmup-cell" key={setIndex}>
                <SetCell
                  set={set}
                  index={setIndex}
                  onChange={(reps) => setReps(sessionId, index, setIndex, reps)}
                />
                <span className="warmup-weight">{formatWeight(set.weight)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="set-group">
        <span className="set-group-label">
          Work · {work.length}×{range}
        </span>
        <div className="set-grid">
          {work.map(({ set, setIndex }) => (
            <SetCell
              key={setIndex}
              set={set}
              index={setIndex}
              topOfRange={log.targetRepsMax}
              onChange={(reps) => setReps(sessionId, index, setIndex, reps)}
            />
          ))}
        </div>
      </div>
    </>
  );
}

function DurationBody({
  sessionId,
  log,
  index,
}: {
  sessionId: string;
  log: ExerciseLog;
  index: number;
}) {
  const value = log.minutes ?? log.targetMinutes;

  return (
    <div className="duration-body">
      <div className="weight-row">
        <button
          className="step-btn"
          aria-label={`Less time on ${log.name}`}
          onClick={() => setExerciseMinutes(sessionId, index, Math.max(0, value - 5))}
        >
          −
        </button>
        <span className="weight-value">
          {value}
          <span className="weight-unit">min</span>
        </span>
        <button
          className="step-btn"
          aria-label={`More time on ${log.name}`}
          onClick={() => setExerciseMinutes(sessionId, index, value + 5)}
        >
          +
        </button>
      </div>
      <p className="muted">Target {log.targetMinutes} min</p>
      <button
        className={`btn ${log.minutes === null ? "btn-ghost" : "btn-primary"}`}
        onClick={() =>
          setExerciseMinutes(sessionId, index, log.minutes === null ? value : null)
        }
      >
        {log.minutes === null ? `Log ${value} min` : `Logged ${log.minutes} min — tap to clear`}
      </button>
    </div>
  );
}

function DoneBody({
  sessionId,
  log,
  index,
}: {
  sessionId: string;
  log: ExerciseLog;
  index: number;
}) {
  return (
    <button
      className={`btn ${log.completed ? "btn-primary" : "btn-ghost"}`}
      aria-pressed={log.completed}
      onClick={() => toggleExerciseComplete(sessionId, index)}
    >
      {log.completed ? "✓ Done" : "Mark done"}
    </button>
  );
}
