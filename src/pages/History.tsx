import { useState } from "react";
import { useAppData } from "../store/store";
import { deleteSession } from "../store/actions";
import { completedSessions } from "../store/selectors";
import { sessionVolume } from "../lib/strength";
import { formatDuration, formatWeight } from "../lib/units";
import type { WorkoutSession } from "../types";

export default function History() {
  const data = useAppData();
  const sessions = completedSessions(data);
  const [expanded, setExpanded] = useState<string | null>(sessions[0]?.id ?? null);

  return (
    <div className="page">
      <header className="page-head">
        <h1>History</h1>
        <p className="muted">
          {sessions.length} completed workout{sessions.length === 1 ? "" : "s"}
        </p>
      </header>

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
        <span className="chevron">{open ? "▾" : "▸"}</span>
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
          <button
            className="btn-link danger"
            onClick={() => {
              if (confirm("Delete this workout from your history?")) deleteSession(session.id);
            }}
          >
            Delete workout
          </button>
        </>
      )}
    </div>
  );
}
