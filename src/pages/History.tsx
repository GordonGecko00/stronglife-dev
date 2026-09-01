import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAppData } from "../store/store";
import { addPastSession, deleteSession } from "../store/actions";
import { completedSessions } from "../store/selectors";
import { sessionVolume } from "../lib/strength";
import { formatDuration, formatWeight } from "../lib/units";
import Icon from "../components/Icon";
import { dayKey } from "../lib/misc";
import type { WorkoutSession } from "../types";

export default function History() {
  const data = useAppData();
  const sessions = completedSessions(data);
  const [expanded, setExpanded] = useState<string | null>(sessions[0]?.id ?? null);

  return (
    <div className="page">
      <Link className="btn-link" to="/progress">
        ‹ Progress
      </Link>
      <header className="page-head">
        <h1>History</h1>
        <p className="muted">
          {sessions.length} completed workout{sessions.length === 1 ? "" : "s"}
        </p>
      </header>

      <AddPastSession />

      {sessions.length === 0 && (
        <div className="card">
          <p className="muted">No finished workouts yet.</p>
        </div>
      )}

      {sessions.map((session) => (
        <SessionCard
          key={session.id}
          session={session}
          open={expanded === session.id}
          onToggle={() => setExpanded(expanded === session.id ? null : session.id)}
        />
      ))}
    </div>
  );
}

function SessionCard({
  session,
  open,
  onToggle,
}: {
  session: WorkoutSession;
  open: boolean;
  onToggle: () => void;
}) {
  const volume = sessionVolume(session.exercises);
  const duration =
    session.finishedAt !== null ? Math.floor((session.finishedAt - session.startedAt) / 1000) : 0;

  return (
    <div className="card">
      <button className="card-toggle" onClick={onToggle} aria-expanded={open}>
        <div>
          <h2>{session.templateName}</h2>
          <span className="muted">
            {new Date(session.dateISO).toLocaleDateString()} · {formatDuration(duration)} ·{" "}
            {formatWeight(Math.round(volume))} {session.unit} moved
          </span>
        </div>
        <span className={`chevron ${open ? "chevron-open" : ""}`}>
          <Icon name="chevron" size={16} />
        </span>
      </button>

      {open && (
        <>
          <ul className="lineup">
            {session.exercises.map((log) => {
              const work = log.sets.filter((s) => s.kind === "work");
              return (
                <li key={log.exerciseId}>
                  <span className="lineup-name">{log.name}</span>
                  <span className="lineup-detail">
                    {work.map((s) => (s.done ? s.reps : "–")).join("/")}
                    <strong>
                      {" "}
                      {formatWeight(log.weight)} {session.unit}
                    </strong>
                  </span>
                </li>
              );
            })}
          </ul>
          {session.exercises.some((e) => e.note) && (
            <div className="note-list">
              {session.exercises
                .filter((e) => e.note)
                .map((e) => (
                  <p key={e.exerciseId} className="muted">
                    <strong>{e.name}:</strong> {e.note}
                  </p>
                ))}
            </div>
          )}
          {session.note && <p className="muted">{session.note}</p>}
          <div className="row-actions">
            <Link className="btn btn-small btn-ghost" to={`/session/${session.id}`}>
              Edit
            </Link>
            <Link
              className="btn btn-small btn-ghost"
              to={`/day/${dayKey(session.finishedAt ?? session.dateISO)}`}
            >
              Open day
            </Link>
            <button
              className="btn-link danger"
              onClick={() => {
                if (confirm("Delete this workout from your history?")) deleteSession(session.id);
              }}
            >
              Delete
            </button>
          </div>
        </>
      )}
    </div>
  );
}

/** Add a workout you did but never logged, then fill it in on the edit screen. */
function AddPastSession() {
  const data = useAppData();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [templateId, setTemplateId] = useState(data.templates[0]?.id ?? "");
  const [day, setDay] = useState(dayKey(new Date()));
  const [time, setTime] = useState("07:00");

  if (!open) {
    return (
      <button className="quiet-link" onClick={() => setOpen(true)}>
        + Add a workout you didn't log
      </button>
    );
  }

  const startedAt = new Date(`${day}T${time}`);
  const template = data.templates.find((t) => t.id === templateId);
  const valid = Boolean(template) && !Number.isNaN(startedAt.getTime());

  return (
    <div className="card">
      <div className="card-head">
        <h2>Add a past workout</h2>
        <button className="btn-link" onClick={() => setOpen(false)}>
          Cancel
        </button>
      </div>
      <label className="field">
        <span>Session</span>
        <select value={templateId} onChange={(event) => setTemplateId(event.target.value)}>
          {data.templates.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
      </label>
      <div className="field-grid">
        <label>
          Day
          <input type="date" value={day} onChange={(event) => setDay(event.target.value)} />
        </label>
        <label>
          Start time
          <input type="time" value={time} onChange={(event) => setTime(event.target.value)} />
        </label>
      </div>
      <button
        className="btn btn-primary"
        disabled={!valid}
        onClick={() => {
          if (!template) return;
          navigate(`/session/${addPastSession(template, startedAt)}`);
        }}
      >
        Add and fill it in
      </button>
    </div>
  );
}
