import { useRef, useState } from "react";
import type { SetLog } from "../types";

const LONG_PRESS_MS = 500;

/**
 * A single set button.
 *
 * Tap cycles the rep count down from the target the way StrongLifts does
 * (5 → 4 → 3 … → 0 → cleared), which is one tap for the common case of hitting
 * every rep. Long-press opens a pad for anything else, including going over
 * target on an AMRAP set.
 */
export default function SetCell({
  set,
  index,
  onChange,
}: {
  set: SetLog;
  index: number;
  onChange: (reps: number | null) => void;
}) {
  const [padOpen, setPadOpen] = useState(false);
  const longPressed = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function cycle() {
    if (!set.done || set.reps === null) return onChange(set.targetReps);
    if (set.reps <= 0) return onChange(null);
    return onChange(set.reps - 1);
  }

  function startPress() {
    longPressed.current = false;
    timer.current = setTimeout(() => {
      longPressed.current = true;
      setPadOpen(true);
    }, LONG_PRESS_MS);
  }

  function endPress() {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
  }

  const hit = set.done && (set.reps ?? 0) >= set.targetReps;
  const miss = set.done && (set.reps ?? 0) < set.targetReps;
  const state = hit ? "set-hit" : miss ? "set-miss" : "";

  return (
    <div className="set-cell-wrap">
      <button
        type="button"
        className={`set-cell ${state} ${set.kind === "warmup" ? "set-warmup" : ""}`}
        onPointerDown={startPress}
        onPointerUp={endPress}
        onPointerLeave={endPress}
        onPointerCancel={endPress}
        onContextMenu={(e) => {
          e.preventDefault();
          setPadOpen(true);
        }}
        onClick={() => {
          if (longPressed.current) {
            longPressed.current = false;
            return;
          }
          cycle();
        }}
        aria-label={`Set ${index + 1}, target ${set.targetReps} reps${
          set.done ? `, logged ${set.reps} reps` : ", not logged"
        }`}
      >
        <span className="set-cell-value">{set.done ? set.reps : set.targetReps}</span>
      </button>

      {padOpen && (
        <div className="rep-pad" role="dialog" aria-label={`Reps for set ${index + 1}`}>
          <div className="rep-pad-grid">
            {Array.from({ length: set.targetReps + 6 }, (_, reps) => (
              <button
                key={reps}
                type="button"
                className={`rep-pad-key ${reps === set.targetReps ? "rep-pad-target" : ""}`}
                onClick={() => {
                  onChange(reps);
                  setPadOpen(false);
                }}
              >
                {reps}
              </button>
            ))}
          </div>
          <div className="rep-pad-actions">
            <button
              type="button"
              className="btn-link"
              onClick={() => {
                onChange(null);
                setPadOpen(false);
              }}
            >
              Clear
            </button>
            <button type="button" className="btn-link" onClick={() => setPadOpen(false)}>
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
