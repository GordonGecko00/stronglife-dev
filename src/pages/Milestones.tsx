import { useState } from "react";
import { useAppData } from "../store/store";
import { addMilestone, removeMilestone, toggleMilestone } from "../store/actions";
import { programMonth } from "../store/selectors";

const MONTH_TITLES: Record<number, string> = {
  1: "Establishing the foundation",
  2: "Building momentum",
  3: "Sustaining progress",
};

export default function Milestones() {
  const data = useAppData();
  const current = programMonth(data);
  const [draft, setDraft] = useState("");
  const [draftMonth, setDraftMonth] = useState(current);

  const months = [...new Set([1, 2, 3, ...data.milestones.map((m) => m.month)])].sort(
    (a, b) => a - b
  );

  const started = new Date(data.programStartISO);

  return (
    <div className="page">
      <header className="page-head">
        <h1>Milestones</h1>
        <p className="muted">
          Month {current} of 3 · started {started.toLocaleDateString()}
        </p>
      </header>

      {months.map((month) => {
        const items = data.milestones.filter((m) => m.month === month);
        const done = items.filter((m) => m.done).length;
        return (
          <div className={`card ${month === current ? "card-current" : ""}`} key={month}>
            <div className="card-head">
              <h2>
                Month {month}
                {MONTH_TITLES[month] && <span className="muted"> · {MONTH_TITLES[month]}</span>}
              </h2>
              <span className="muted">
                {done}/{items.length}
              </span>
            </div>
            {items.length === 0 && <p className="muted">Nothing set for this month.</p>}
            <div className="habit-list">
              {items.map((milestone) => (
                <div className="milestone-row" key={milestone.id}>
                  <button
                    className={`habit ${milestone.done ? "habit-on" : ""}`}
                    aria-pressed={milestone.done}
                    onClick={() => toggleMilestone(milestone.id)}
                  >
                    <span className="habit-check" aria-hidden="true">
                      {milestone.done ? "✓" : ""}
                    </span>
                    <span className="habit-name">{milestone.title}</span>
                  </button>
                  <button
                    className="icon-btn"
                    aria-label={`Remove ${milestone.title}`}
                    onClick={() => removeMilestone(milestone.id)}
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          </div>
        );
      })}

      <div className="card">
        <div className="card-head">
          <h2>Add a milestone</h2>
        </div>
        <form
          className="inline-form"
          onSubmit={(event) => {
            event.preventDefault();
            if (!draft.trim()) return;
            addMilestone(draftMonth, draft.trim());
            setDraft("");
          }}
        >
          <select
            aria-label="Month"
            value={draftMonth}
            onChange={(event) => setDraftMonth(Number(event.target.value))}
            className="month-select"
          >
            {[1, 2, 3].map((m) => (
              <option key={m} value={m}>
                M{m}
              </option>
            ))}
          </select>
          <input
            value={draft}
            placeholder="What does progress look like?"
            onChange={(event) => setDraft(event.target.value)}
            aria-label="Milestone"
          />
          <button className="btn btn-small btn-ghost" type="submit">
            Add
          </button>
        </form>
      </div>
    </div>
  );
}
