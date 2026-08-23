import { Link } from "react-router-dom";
import { useAppData } from "../store/store";
import { programMonth } from "../store/selectors";

const LINKS = [
  { to: "/program", label: "Program", hint: "Schedule, sessions, hockey nights" },
  { to: "/milestones", label: "Milestones", hint: "The 3-month plan" },
  { to: "/settings", label: "Settings", hint: "Units, targets, habits, backup" },
];

export default function More() {
  const data = useAppData();
  const month = programMonth(data);
  const doneThisMonth = data.milestones.filter((m) => m.month === month && m.done).length;
  const totalThisMonth = data.milestones.filter((m) => m.month === month).length;

  return (
    <div className="page">
      <header className="page-head">
        <h1>More</h1>
      </header>

      <div className="card">
        {LINKS.map((link) => (
          <Link key={link.to} className="row-button" to={link.to}>
            <span>
              {link.label}
              <span className="muted row-hint">{link.hint}</span>
            </span>
            <span className="muted">›</span>
          </Link>
        ))}
      </div>

      <div className="card">
        <div className="card-head">
          <h2>Month {month} of 3</h2>
          <span className="muted">
            {doneThisMonth}/{totalThisMonth} milestones
          </span>
        </div>
        <div className="meter-track">
          <div
            className="meter-fill"
            style={{ width: `${totalThisMonth ? (doneThisMonth / totalThisMonth) * 100 : 0}%` }}
          />
        </div>
        <Link className="btn-link" to="/milestones">
          Review milestones ›
        </Link>
      </div>

      <p className="muted footnote">StrongLife · your data never leaves this device.</p>
    </div>
  );
}
