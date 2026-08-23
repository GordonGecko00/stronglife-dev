import { useEffect, useRef, useState } from "react";
import { useAppData } from "../store/store";
import { clearRest, extendRest, notifyRestFinished } from "../store/actions";
import { formatDuration } from "../lib/units";

/**
 * Rest countdown driven by a persisted end timestamp, so it stays correct
 * across navigation, reloads, and the phone locking mid-set.
 */
export default function RestBar() {
  const data = useAppData();
  const restEndsAt = data.restEndsAt;
  const [now, setNow] = useState(() => Date.now());
  const notified = useRef<number | null>(null);

  useEffect(() => {
    if (restEndsAt === null) return;
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, [restEndsAt]);

  useEffect(() => {
    if (restEndsAt === null) {
      notified.current = null;
      return;
    }
    if (now >= restEndsAt && notified.current !== restEndsAt) {
      notified.current = restEndsAt;
      notifyRestFinished(data.settings.vibrate);
    }
  }, [now, restEndsAt, data.settings.vibrate]);

  if (restEndsAt === null) return null;

  const remaining = Math.ceil((restEndsAt - now) / 1000);
  const done = remaining <= 0;

  return (
    <div className={`rest-bar ${done ? "rest-bar-done" : ""}`} role="status">
      <span className="rest-time">{done ? "Rest over" : formatDuration(remaining)}</span>
      <button className="rest-action" onClick={() => extendRest(30)}>
        +30s
      </button>
      <button className="rest-action" onClick={clearRest}>
        {done ? "Dismiss" : "Skip"}
      </button>
    </div>
  );
}
