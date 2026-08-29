import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAppData } from "../store/store";
import { completeOnboarding, type OnboardingChoices } from "../store/actions";
import { DAY_NAMES_SHORT } from "../lib/misc";
import type { Unit } from "../types";

const STEPS = ["Welcome", "You", "Hockey", "Mornings", "Ready"] as const;

export default function Onboarding() {
  const data = useAppData();
  const navigate = useNavigate();
  const [step, setStep] = useState(0);

  const [unit, setUnit] = useState<Unit>(data.settings.unit);
  const [bodyWeight, setBodyWeight] = useState("");
  const [sportDays, setSportDays] = useState<number[]>([2, 4]);
  const [sportMinutes, setSportMinutes] = useState("90");
  const [recoveryAction, setRecoveryAction] =
    useState<OnboardingChoices["recoveryAction"]>("recovery");
  const [lateHour, setLateHour] = useState(19);

  const sportName = data.templates.find((t) => t.kind === "sport")?.name ?? "Hockey";

  function finish() {
    completeOnboarding({
      unit,
      bodyWeight: Number(bodyWeight) || null,
      sportDays,
      sportMinutes: Number(sportMinutes) || 90,
      recoveryAction,
      lateHour,
    });
    navigate("/", { replace: true });
  }

  const next = () => setStep((s) => Math.min(STEPS.length - 1, s + 1));
  const back = () => setStep((s) => Math.max(0, s - 1));

  return (
    <div className="page onboarding">
      <div className="progress-dots" aria-label={`Step ${step + 1} of ${STEPS.length}`}>
        {STEPS.map((label, index) => (
          <span key={label} className={`dot ${index <= step ? "dot-on" : ""}`} />
        ))}
      </div>

      {step === 0 && (
        <>
          <header className="page-head">
            <h1>StrongLife</h1>
            <p className="muted">Three things, every day. That's the whole app.</p>
          </header>
          <div className="card">
            <ol className="how-list">
              <li>
                <span className="how-num">1</span>
                <div>
                  <strong>Train</strong>
                  <p className="muted">
                    Open <em>Today</em>, hit the one big button, tap your sets as you go.
                  </p>
                </div>
              </li>
              <li>
                <span className="how-num">2</span>
                <div>
                  <strong>Check in</strong>
                  <p className="muted">Protein, water, and your habits — a few taps.</p>
                </div>
              </li>
              <li>
                <span className="how-num">3</span>
                <div>
                  <strong>Look at the week</strong>
                  <p className="muted">
                    <em>Week</em> shows what's planned and what got moved after a late skate.
                  </p>
                </div>
              </li>
            </ol>
          </div>
          <button className="btn btn-primary" onClick={next}>
            Set it up — 30 seconds
          </button>
        </>
      )}

      {step === 1 && (
        <>
          <header className="page-head">
            <p className="eyebrow">Step 2 of 5</p>
            <h1>Weights and you</h1>
          </header>
          <div className="card">
            <div className="field">
              <span>Units</span>
              <div className="segmented">
                {(["lb", "kg"] as Unit[]).map((u) => (
                  <button
                    key={u}
                    className={unit === u ? "segment segment-on" : "segment"}
                    onClick={() => setUnit(u)}
                  >
                    {u}
                  </button>
                ))}
              </div>
            </div>
            <label className="field">
              <span>Body weight ({unit}) — optional</span>
              <input
                type="number"
                inputMode="decimal"
                step="0.1"
                placeholder={unit === "lb" ? "180" : "82"}
                value={bodyWeight}
                onChange={(event) => setBodyWeight(event.target.value)}
              />
            </label>
            <p className="muted">
              Only used to work out your daily protein target. You can add it later.
            </p>
          </div>
          <button className="btn btn-primary" onClick={next}>
            Continue
          </button>
          <button className="btn-link" onClick={back}>
            ‹ Back
          </button>
        </>
      )}

      {step === 2 && (
        <>
          <header className="page-head">
            <p className="eyebrow">Step 3 of 5</p>
            <h1>When do you play?</h1>
          </header>
          <div className="card">
            <div className="field">
              <span>{sportName} nights</span>
              <div className="day-toggles">
                {DAY_NAMES_SHORT.map((name, day) => (
                  <button
                    key={day}
                    className={`day-toggle ${sportDays.includes(day) ? "day-toggle-on" : ""}`}
                    aria-pressed={sportDays.includes(day)}
                    onClick={() =>
                      setSportDays((days) =>
                        days.includes(day) ? days.filter((d) => d !== day) : [...days, day]
                      )
                    }
                  >
                    {name}
                  </button>
                ))}
              </div>
            </div>
            <label className="field">
              <span>Usual length (minutes)</span>
              <input
                type="number"
                inputMode="numeric"
                step={15}
                value={sportMinutes}
                onChange={(event) => setSportMinutes(event.target.value)}
              />
            </label>
            <p className="muted">
              These go on your week as evening sessions. You can still log a one-off game any time.
            </p>
          </div>
          <button className="btn btn-primary" onClick={next}>
            Continue
          </button>
          <button className="btn-link" onClick={back}>
            ‹ Back
          </button>
        </>
      )}

      {step === 3 && (
        <>
          <header className="page-head">
            <p className="eyebrow">Step 4 of 5</p>
            <h1>The morning after</h1>
            <p className="muted">
              You play late. What should the app do with the next morning's hard session?
            </p>
          </header>
          <div className="card">
            <div className="choice-list">
              {(
                [
                  {
                    value: "recovery" as const,
                    title: "Swap it for something easy",
                    hint: "A walk and some mobility instead of the lift",
                  },
                  {
                    value: "skip" as const,
                    title: "Skip the morning",
                    hint: "Sleep in — the day shows as recovery",
                  },
                  {
                    value: "off" as const,
                    title: "Leave it alone",
                    hint: "Show the session as planned and let me decide",
                  },
                ]
              ).map((option) => (
                <button
                  key={option.value}
                  className={`choice ${recoveryAction === option.value ? "choice-on" : ""}`}
                  aria-pressed={recoveryAction === option.value}
                  onClick={() => setRecoveryAction(option.value)}
                >
                  <span className="choice-mark" aria-hidden="true" />
                  <span>
                    <strong>{option.title}</strong>
                    <span className="muted">{option.hint}</span>
                  </span>
                </button>
              ))}
            </div>

            {recoveryAction !== "off" && (
              <label className="field">
                <span>Count a session as "late" if it starts after</span>
                <select value={lateHour} onChange={(event) => setLateHour(Number(event.target.value))}>
                  {[17, 18, 19, 20, 21, 22].map((hour) => (
                    <option key={hour} value={hour}>
                      {hour - 12}pm
                    </option>
                  ))}
                </select>
              </label>
            )}
          </div>
          <button className="btn btn-primary" onClick={next}>
            Continue
          </button>
          <button className="btn-link" onClick={back}>
            ‹ Back
          </button>
        </>
      )}

      {step === 4 && (
        <>
          <header className="page-head">
            <p className="eyebrow">Step 5 of 5</p>
            <h1>You're set</h1>
          </header>
          <div className="card">
            <ul className="lineup">
              <li>
                <span className="lineup-name">Units</span>
                <span className="lineup-detail">{unit}</span>
              </li>
              <li>
                <span className="lineup-name">{sportName}</span>
                <span className="lineup-detail">
                  {sportDays.length
                    ? sportDays
                        .slice()
                        .sort()
                        .map((d) => DAY_NAMES_SHORT[d])
                        .join(", ")
                    : "none set"}
                </span>
              </li>
              <li>
                <span className="lineup-name">After a late night</span>
                <span className="lineup-detail">
                  {recoveryAction === "recovery"
                    ? "swap to easy"
                    : recoveryAction === "skip"
                      ? "skip the morning"
                      : "leave it alone"}
                </span>
              </li>
            </ul>
            <p className="muted">
              Your six-day program is already loaded. Change any of it under More → Program.
            </p>
          </div>
          <button className="btn btn-primary" onClick={finish}>
            Start using it
          </button>
          <button className="btn-link" onClick={back}>
            ‹ Back
          </button>
        </>
      )}

      {step === 0 && (
        <button className="btn-link" onClick={finish}>
          Skip setup
        </button>
      )}
    </div>
  );
}
