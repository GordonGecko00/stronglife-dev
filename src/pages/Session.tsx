import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAppData } from "../store";
import { getActiveSession, logSet, finishSession, cancelSession } from "../session";
import RestTimer from "../components/RestTimer";

export default function Session() {
  const data = useAppData();
  const navigate = useNavigate();
  const session = getActiveSession(data);
  const [restUntil, setRestUntil] = useState<number | null>(null);

  useEffect(() => {
    if (!session) navigate("/", { replace: true });
  }, [session, navigate]);

  if (!session) return null;

  const allDone = session.exercises.every((ex) => ex.sets.every((s) => s.done));

  return (
    <div className="page">
      <div className="session-header">
        <h1>{session.templateName}</h1>
        <button
          className="btn btn-ghost btn-small"
          onClick={() => {
            if (confirm("Discard this workout?")) {
              cancelSession(session.id);
              navigate("/");
            }
          }}
        >
          Discard
        </button>
      </div>

      {session.exercises.map((ex, exIdx) => (
        <div className="card" key={ex.exerciseId}>
          <div className="exercise-title-row">
            <h2>{ex.name}</h2>
            <span className="muted">
              {ex.weight}
              {ex.unit} · target {ex.targetReps} reps
            </span>
          </div>
          <div className="set-grid">
            {ex.sets.map((set, setIdx) => (
              <SetButton
                key={setIdx}
                setNumber={setIdx + 1}
                targetReps={ex.targetReps}
                reps={set.reps}
                done={set.done}
                onLog={(reps) => {
                  logSet(session.id, exIdx, setIdx, reps);
                  setRestUntil(Date.now() + 90_000);
                }}
              />
            ))}
          </div>
        </div>
      ))}

      <button
        className="btn btn-primary"
        disabled={!allDone}
        onClick={() => {
          finishSession(session.id);
          navigate("/");
        }}
      >
        {allDone ? "Finish workout" : "Log all sets to finish"}
      </button>

      <RestTimer restUntil={restUntil} onClear={() => setRestUntil(null)} />
    </div>
  );
}

function SetButton({
  setNumber,
  targetReps,
  reps,
  done,
  onLog,
}: {
  setNumber: number;
  targetReps: number;
  reps: number;
  done: boolean;
  onLog: (reps: number) => void;
}) {
  const [expanded, setExpanded] = useState(false);

  if (!expanded) {
    return (
      <button
        className={`set-btn ${done ? (reps >= targetReps ? "set-hit" : "set-miss") : ""}`}
        onClick={() => setExpanded(true)}
      >
        <span className="set-btn-label">Set {setNumber}</span>
        <span className="set-btn-reps">{done ? `${reps} reps` : `${targetReps} reps`}</span>
      </button>
    );
  }

  const chips = Array.from({ length: targetReps + 3 }, (_, i) => i);

  return (
    <div className="set-btn set-btn-expanded">
      <span className="set-btn-label">Set {setNumber} — reps done</span>
      <div className="rep-chips">
        {chips.map((r) => (
          <button
            key={r}
            className={`rep-chip ${r === targetReps ? "rep-chip-target" : ""}`}
            onClick={() => {
              onLog(r);
              setExpanded(false);
            }}
          >
            {r}
          </button>
        ))}
      </div>
    </div>
  );
}
