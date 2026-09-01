import { useState } from "react";
import { Link, Navigate, useNavigate, useParams } from "react-router-dom";
import { useAppData } from "../store/store";
import { addPastSession, deleteSession, startSession } from "../store/actions";
import { planForDate } from "../store/planning";
import { addDays, dayKey, DAY_NAMES_LONG } from "../lib/misc";
import Icon from "../components/Icon";
import CheckIn from "../components/CheckIn";
import LogGameSheet from "../components/LogGameSheet";
import type { WorkoutSession } from "../types";

/** Parse a YYYY-MM-DD route param. Noon local, so a DST shift can't move the day. */
function parseDayKey(key: string | undefined): Date | null {
  if (!key || !/^\d{4}-\d{2}-\d{2}$/.test(key)) return null;
  const date = new Date(`${key}T12:00:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}

/**
 * One day, end to end, with everything on it editable: what you trained, what
 * you played in the evening, and the check-in behind it.
 *
 * The rest of the app is arranged around what to do next, which leaves no room
 * for going back and correcting a day you got wrong at the time. This is that
 * room.
 */
export default function Day() {
  const data = useAppData();
  const navigate = useNavigate();
  const { key } = useParams();
  const [logging, setLogging] = useState(false);
  const [adding, setAdding] = useState(false);

  const date = parseDayKey(key);
  if (!date) return <Navigate to={`/day/${dayKey(new Date())}`} replace />;

  const plan = planForDate(data, date);
  const isToday = plan.key === dayKey(new Date());
  const isFuture = date > new Date() && !isToday;
  const trainingLogged = plan.logged.some((s) => s.kind !== "sport");

  return (
    <div className="page">
      <Link className="btn-link" to="/week">
        ‹ Week
      </Link>

      <header className="page-head">
        <div className="day-nav">
          <button
            className="icon-btn"
            aria-label="Previous day"
            onClick={() => navigate(`/day/${dayKey(addDays(date, -1))}`)}
          >
            <Icon name="chevron" size={16} className="flip" />
          </button>
          <div>
            <p className="eyebrow">
              {isToday ? "Today" : DAY_NAMES_LONG[date.getDay()]}
            </p>
            <h1>{date.toLocaleDateString(undefined, { month: "long", day: "numeric" })}</h1>
          </div>
          <button
            className="icon-btn"
            aria-label="Next day"
            onClick={() => navigate(`/day/${dayKey(addDays(date, 1))}`)}
          >
            <Icon name="chevron" size={16} />
          </button>
        </div>
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

      <div className="card">
        <div className="card-head">
          <div>
            <h2>What happened</h2>
            <span className="muted">
              Planned: {plan.morning ? plan.morning.name : "rest"}
              {plan.evening ? ` · ${plan.evening.name} in the evening` : ""}
            </span>
          </div>
        </div>

        {plan.logged.length === 0 && (
          <p className="muted">Nothing logged{isFuture ? " yet" : " on this day"}.</p>
        )}

        {plan.logged.map((session) => (
          <LoggedRow key={session.id} session={session} />
        ))}

        {!isFuture && (
          <div className="row-actions">
            <button className="btn btn-small btn-ghost" onClick={() => setLogging(true)}>
              Log a game
            </button>
            {isToday && plan.morning && !trainingLogged ? (
              <button
                className="btn btn-small btn-ghost"
                onClick={() => {
                  startSession(plan.morning!);
                  navigate("/session");
                }}
              >
                Start {plan.morning.name}
              </button>
            ) : (
              <button className="btn btn-small btn-ghost" onClick={() => setAdding(true)}>
                Add a workout
              </button>
            )}
          </div>
        )}
      </div>

      {adding && (
        <AddSession date={date} onClose={() => setAdding(false)} />
      )}

      <CheckIn date={date} />

      {logging && (
        <LogGameSheet date={date} template={plan.evening} onClose={() => setLogging(false)} />
      )}
    </div>
  );
}

function LoggedRow({ session }: { session: WorkoutSession }) {
  const navigate = useNavigate();
  const minutes =
    session.finishedAt !== null
      ? Math.round((session.finishedAt - session.startedAt) / 60_000)
      : 0;
  const started = new Date(session.startedAt);

  // Time and length only. The dot already says what kind of session this is,
  // and volume is a Progress question — this row has to fit on a phone next to
  // two controls.
  const detail = [
    started.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" }),
    minutes > 0 ? `${minutes} min` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className="logged-item">
      <span className={`slot-dot slot-${session.kind}`} aria-hidden="true" />
      <div className="slot-text">
        <span className="slot-name">{session.templateName}</span>
        <span className="muted">{detail}</span>
      </div>
      <button
        className="btn btn-small btn-ghost"
        onClick={() => navigate(`/session/${session.id}`)}
      >
        Edit
      </button>
      <button
        className="btn-link danger"
        onClick={() => {
          if (confirm(`Remove ${session.templateName} from this day?`)) deleteSession(session.id);
        }}
      >
        Remove
      </button>
    </div>
  );
}

/** Add a workout that happened on this day but was never logged. */
function AddSession({ date, onClose }: { date: Date; onClose: () => void }) {
  const data = useAppData();
  const navigate = useNavigate();
  const [templateId, setTemplateId] = useState(data.templates[0]?.id ?? "");
  const [time, setTime] = useState("07:00");

  const template = data.templates.find((t) => t.id === templateId);
  const startedAt = new Date(`${dayKey(date)}T${time}`);
  const valid = Boolean(template) && !Number.isNaN(startedAt.getTime());

  return (
    <div className="card">
      <div className="card-head">
        <h2>Add a workout</h2>
        <button className="btn-link" onClick={onClose}>
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
      <label className="field">
        <span>Start time</span>
        <input type="time" value={time} onChange={(event) => setTime(event.target.value)} />
      </label>
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
