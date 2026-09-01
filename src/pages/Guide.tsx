import { Link } from "react-router-dom";
import { restartOnboarding } from "../store/actions";
import { useNavigate } from "react-router-dom";

export default function Guide() {
  const navigate = useNavigate();

  return (
    <div className="page">
      <header className="page-head">
        <h1>How it works</h1>
        <p className="muted">The whole app in one screen.</p>
      </header>

      <div className="card">
        <div className="card-head">
          <h2>Every day</h2>
        </div>
        <ol className="how-list">
          <li>
            <span className="how-num">1</span>
            <div>
              <strong>Open Today</strong>
              <p className="muted">
                The top card is the one thing to do right now — start the session, log tonight's
                game, or finish your check-in. Under it, the three-item list shows the whole day.
              </p>
            </div>
          </li>
          <li>
            <span className="how-num">2</span>
            <div>
              <strong>During a session</strong>
              <p className="muted">
                One exercise is open at a time. Tap a set when you hit every rep; tap again to
                count down; long-press for a keypad. Weight steppers and the plate calculator sit
                above the sets. Finish at the bottom.
              </p>
            </div>
          </li>
          <li>
            <span className="how-num">3</span>
            <div>
              <strong>Check in</strong>
              <p className="muted">
                Protein, water and habits live in the Daily check-in card on Today. Body weight goes
                in there too — it sets your protein target.
              </p>
            </div>
          </li>
        </ol>
      </div>

      <div className="card">
        <div className="card-head">
          <h2>Where things live</h2>
        </div>
        <ul className="lineup">
          <li>
            <span className="lineup-name">Today</span>
            <span className="lineup-detail">Do and log — sessions, check-in, body weight</span>
          </li>
          <li>
            <span className="lineup-name">Week</span>
            <span className="lineup-detail">The plan, and what moved after a late game</span>
          </li>
          <li>
            <span className="lineup-name">Progress</span>
            <span className="lineup-detail">Charts, records, consistency</span>
          </li>
          <li>
            <span className="lineup-name">History</span>
            <span className="lineup-detail">Every finished session</span>
          </li>
          <li>
            <span className="lineup-name">More → Program</span>
            <span className="lineup-detail">Change the schedule, sessions and exercises</span>
          </li>
        </ul>
      </div>

      <div className="card">
        <div className="card-head">
          <h2>Hockey</h2>
        </div>
        <p className="muted">
          <strong>Regular nights</strong> go on More → Program → Weekly schedule, in the
          <em> Evening</em> column. Those are what the week plans around.
        </p>
        <p className="muted">
          <strong>To record a game</strong> — including a pickup game on a night you don't
          normally play, or one you forgot to log — tap the evening row on Today, or the
          <em> Log</em> button on any past day in Week. Set the time you played: it decides whether
          the next morning gets eased off.
        </p>
      </div>

      <div className="card">
        <div className="card-head">
          <h2>The late-night rule</h2>
        </div>
        <p className="muted">
          Play in the evening and the next morning's hard session is automatically eased off —
          swapped for recovery, or skipped. Easy mornings are left alone. It uses what you actually
          logged first, and your scheduled game nights as a fallback so the week can show it in
          advance. Change it under More → Program → After a late night.
        </p>
      </div>

      <button
        className="btn btn-ghost"
        onClick={() => {
          restartOnboarding();
          navigate("/welcome");
        }}
      >
        Run setup again
      </button>
      <Link className="btn-link" to="/more">
        ‹ More
      </Link>
    </div>
  );
}
