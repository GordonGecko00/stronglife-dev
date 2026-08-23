import { useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAppData } from "../store";
import { startSession, getActiveSession, cancelSession } from "../session";

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export default function Today() {
  const data = useAppData();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const active = getActiveSession(data);

  const todayIdx = new Date().getDay();
  const templateId = data.schedule[todayIdx] ?? null;
  const template = templateId ? data.templates.find((t) => t.id === templateId) ?? null : null;

  // Home screen quick action ("Start Today's Workout") lands here with ?start=today.
  useEffect(() => {
    if (searchParams.get("start") !== "today") return;
    if (active) {
      navigate("/session", { replace: true });
    } else if (template) {
      startSession(template);
      navigate("/session", { replace: true });
    }
  }, [searchParams, active, template, navigate]);

  if (active) {
    return (
      <div className="page">
        <h1>Workout in progress</h1>
        <p className="muted">{active.templateName} · started {new Date(active.startedAt).toLocaleTimeString()}</p>
        <button className="btn btn-primary" onClick={() => navigate("/session")}>
          Resume workout
        </button>
        <button
          className="btn btn-ghost"
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
      <h1>{DAY_NAMES[todayIdx]}</h1>
      {template ? (
        <>
          <p className="muted">Today's workout</p>
          <div className="card">
            <h2>{template.name}</h2>
            <ul className="exercise-preview">
              {template.exercises.map((e) => (
                <li key={e.id}>
                  <span>{e.name}</span>
                  <span className="muted">
                    {e.sets}×{e.targetReps} @ {e.weight}
                    {e.unit}
                  </span>
                </li>
              ))}
            </ul>
          </div>
          <button
            className="btn btn-primary"
            onClick={() => {
              startSession(template);
              navigate("/session");
            }}
          >
            Start workout
          </button>
        </>
      ) : (
        <div className="card">
          <p>Rest day. No workout scheduled.</p>
          <p className="muted">Edit your weekly schedule in the Plan tab.</p>
        </div>
      )}

      {data.sessions.length > 0 && (
        <div className="quick-history">
          <p className="muted">Last workout</p>
          <p>
            {data.sessions[0].templateName} · {new Date(data.sessions[0].dateISO).toLocaleDateString()}
          </p>
        </div>
      )}
    </div>
  );
}
