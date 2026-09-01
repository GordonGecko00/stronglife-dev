import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAppData } from "../store/store";
import { startSession } from "../store/actions";
import { weekPlan, summarizeWeek, type DayPlan } from "../store/planning";
import { habitProgress } from "../store/selectors";
import { addDays, DAY_NAMES_SHORT, dayKey } from "../lib/misc";
import { kindLabel } from "../lib/labels";
import Icon from "../components/Icon";
import LogGameSheet from "../components/LogGameSheet";

export default function Week() {
  const data = useAppData();
  const navigate = useNavigate();
  const [offsetWeeks, setOffsetWeeks] = useState(0);
  const [logging, setLogging] = useState<DayPlan | null>(null);

  const anchor = addDays(new Date(), offsetWeeks * 7);
  const plans = weekPlan(data, anchor);
  const summary = summarizeWeek(plans);
  const habits = habitProgress(data, anchor);
  const todayKey = dayKey(new Date());

  const collisions = plans.filter((p) => p.status === "adjusted" || p.status === "skipped").length;

  return (
    <div className="page">
      <header className="page-head">
        <h1>The week</h1>
        <div className="week-nav">
          <button className="icon-btn" onClick={() => setOffsetWeeks((v) => v - 1)} aria-label="Previous week">
            <Icon name="chevron" size={16} className="flip" />
          </button>
          <span className="muted">
            {offsetWeeks === 0
              ? "This week"
              : `${plans[0].date.toLocaleDateString(undefined, { month: "short", day: "numeric" })} – ${plans[6].date.toLocaleDateString(undefined, { month: "short", day: "numeric" })}`}
          </span>
          <button className="icon-btn" onClick={() => setOffsetWeeks((v) => v + 1)} aria-label="Next week">
            <Icon name="chevron" size={16} />
          </button>
        </div>
      </header>

      <div className="stat-row">
        <div className="stat-tile">
          <span className="stat-value">
            {summary.strengthDone}/{summary.strengthPlanned}
          </span>
          <span className="stat-label">strength</span>
        </div>
        <div className="stat-tile">
          <span className="stat-value">
            {summary.sportDone}/{summary.sportPlanned}
          </span>
          <span className="stat-label">hockey</span>
        </div>
        <div className="stat-tile">
          <span className="stat-value">{summary.adjustments}</span>
          <span className="stat-label">adjusted</span>
        </div>
      </div>

      {collisions > 0 && (
        <div className="banner banner-warn">
          <span className="banner-icon">
            <Icon name="alert" />
          </span>
          <div>
            <strong>
              {collisions} morning{collisions > 1 ? "s" : ""} land after a late skate
            </strong>
            <p className="muted">
              Those sessions get eased off automatically. If you want the hard days back, move
              hockey or the lift to a different day in <Link to="/program">Program</Link>.
            </p>
          </div>
        </div>
      )}

      <p className="muted list-hint">Tap a date to open that day and edit anything on it.</p>

      <div className="day-list">
        {plans.map((plan) => (
          <DayCard
            key={plan.key}
            plan={plan}
            isToday={plan.key === todayKey}
            onStart={(templateId) => {
              const template = data.templates.find((t) => t.id === templateId);
              if (!template) return;
              startSession(template);
              navigate("/session");
            }}
            onLogGame={() => setLogging(plan)}
            onEdit={(id) => navigate(`/session/${id}`)}
            onOpenDay={() => navigate(`/day/${plan.key}`)}
          />
        ))}
      </div>

      <div className="card">
        <div className="card-head">
          <h2>Habits this week</h2>
        </div>
        <div className="habit-list">
          {habits.map(({ habit, count, target }) => (
            <div key={habit.id} className="habit habit-static">
              <span className="habit-name">{habit.name}</span>
              <span className="habit-dots" aria-label={`${count} of ${target}`}>
                {Array.from({ length: target }, (_, i) => (
                  <span key={i} className={`habit-dot ${i < count ? "habit-dot-on" : ""}`} />
                ))}
              </span>
              <span className="habit-count">
                {count}/{target}
              </span>
            </div>
          ))}
        </div>
      </div>

      {logging && (
        <LogGameSheet
          date={logging.date}
          template={logging.evening}
          onClose={() => setLogging(null)}
        />
      )}
    </div>
  );
}

function DayCard({
  plan,
  isToday,
  onStart,
  onLogGame,
  onEdit,
  onOpenDay,
}: {
  plan: DayPlan;
  isToday: boolean;
  onStart: (templateId: string) => void;
  onLogGame: () => void;
  onEdit: (sessionId: string) => void;
  onOpenDay: () => void;
}) {
  const done = plan.logged.length > 0;
  const past = plan.date < new Date() && !isToday;
  const future = !isToday && plan.date > new Date();
  const sportLogged = plan.logged.some((s) => s.kind === "sport");

  return (
    <div className={`day-card ${isToday ? "day-card-today" : ""} ${past && !done ? "day-card-past" : ""}`}>
      <button
        className="day-card-date"
        onClick={onOpenDay}
        aria-label={`Open ${plan.date.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}`}
      >
        <span className="day-card-name">{DAY_NAMES_SHORT[plan.date.getDay()]}</span>
        <span className="day-card-num">
          {plan.date.getDate()}
          <span className="day-card-open" aria-hidden="true">
            <Icon name="chevron" size={13} />
          </span>
        </span>
      </button>

      <div className="day-card-body">
        {plan.morning ? (
          <div className="slot">
            <span className={`slot-dot slot-${plan.morning.kind}`} aria-hidden="true" />
            <div className="slot-text">
              <span className="slot-name">
                {plan.morning.name}
                {plan.status === "adjusted" && <span className="slot-tag">swapped</span>}
              </span>
              <span className="muted">{kindLabel(plan.morning.kind)} · morning</span>
            </div>
            {isToday && !done && (
              <button className="btn btn-small btn-ghost" onClick={() => onStart(plan.morning!.id)}>
                Start
              </button>
            )}
          </div>
        ) : (
          <div className="slot">
            <span className="slot-dot slot-rest" aria-hidden="true" />
            <div className="slot-text">
              <span className="slot-name">{plan.status === "skipped" ? "Recovery morning" : "Rest"}</span>
              {plan.reason && <span className="muted">{plan.reason}</span>}
            </div>
          </div>
        )}

        {plan.evening && (
          <div className="slot">
            <span className="slot-dot slot-sport" aria-hidden="true" />
            <div className="slot-text">
              <span className="slot-name">{plan.evening.name}</span>
              <span className="muted">Evening</span>
            </div>
            {!future && !sportLogged && (
              <button className="btn btn-small btn-ghost" onClick={onLogGame}>
                Log
              </button>
            )}
          </div>
        )}

        {!plan.evening && !future && !sportLogged && (
          <button className="quiet-link day-card-add" onClick={onLogGame}>
            + Log a game
          </button>
        )}

        {plan.logged.length > 0 && (
          <div className="logged-row">
            {plan.logged.map((session) => (
              <button
                key={session.id}
                className="badge badge-hit badge-button"
                onClick={() => onEdit(session.id)}
                aria-label={`Edit ${session.templateName}`}
              >
                ✓ {session.templateName}
              </button>
            ))}
          </div>
        )}

        {plan.reason && plan.status === "adjusted" && (
          <p className="muted slot-reason">{plan.reason}</p>
        )}
      </div>
    </div>
  );
}
