import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAppData } from "../store/store";
import {
  getActiveSession,
  setReps,
  adjustSessionWeight,
  setExerciseNote,
  setSessionNote,
  finishSession,
  cancelSession,
} from "../store/actions";
import SetCell from "../components/SetCell";
import PlateChips from "../components/PlateChips";
import { formatDuration, formatWeight } from "../lib/units";
import { hitAllTargets } from "../lib/strength";
import type { ExerciseLog } from "../types";

export default function Session() {
  const data = useAppData();
  const navigate = useNavigate();
  const session = getActiveSession(data);
  const [elapsed, setElapsed] = useState(0);

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

  const workSets = session.exercises.flatMap((e) => e.sets.filter((s) => s.kind === "work"));
  const loggedCount = workSets.filter((s) => s.done).length;
  const allLogged = loggedCount === workSets.length && workSets.length > 0;

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
          style={{ width: `${workSets.length ? (loggedCount / workSets.length) * 100 : 0}%` }}
        />
      </div>
      <p className="muted">
        {loggedCount} of {workSets.length} work sets logged · tap a set to log, long-press for other
        rep counts
      </p>

      {session.exercises.map((log, index) => (
        <ExerciseCard key={log.exerciseId} sessionId={session.id} log={log} index={index} />
      ))}

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

function ExerciseCard({
  sessionId,
  log,
  index,
}: {
  sessionId: string;
  log: ExerciseLog;
  index: number;
}) {
  const data = useAppData();
  const [showNote, setShowNote] = useState(log.note.length > 0);
  const { unit, barWeight, plates } = data.settings;

  const step = unit === "kg" ? 2.5 : 5;
  const warmups = log.sets
    .map((set, setIndex) => ({ set, setIndex }))
    .filter(({ set }) => set.kind === "warmup");
  const work = log.sets
    .map((set, setIndex) => ({ set, setIndex }))
    .filter(({ set }) => set.kind === "work");
  const complete = hitAllTargets(log);

  return (
    <div className={`card exercise-card ${complete ? "exercise-done" : ""}`}>
      <div className="card-head">
        <h2>{log.name}</h2>
        {complete && <span className="badge badge-hit">All reps</span>}
      </div>

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

      {log.usesBar && (
        <PlateChips weight={log.weight} bar={barWeight} plates={plates} unit={unit} />
      )}

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
          Work · {log.sets.filter((s) => s.kind === "work").length}×{log.targetReps}
        </span>
        <div className="set-grid">
          {work.map(({ set, setIndex }) => (
            <SetCell
              key={setIndex}
              set={set}
              index={setIndex}
              onChange={(reps) => setReps(sessionId, index, setIndex, reps)}
            />
          ))}
        </div>
      </div>

      {showNote ? (
        <label className="field">
          <span>Note</span>
          <input
            value={log.note}
            placeholder="Form cue, pain, bar speed…"
            onChange={(event) => setExerciseNote(sessionId, index, event.target.value)}
          />
        </label>
      ) : (
        <button className="btn-link" onClick={() => setShowNote(true)}>
          + Add note
        </button>
      )}
    </div>
  );
}
