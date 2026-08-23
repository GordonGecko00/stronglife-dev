import { useEffect, useState } from "react";

export default function RestTimer({
  restUntil,
  onClear,
}: {
  restUntil: number | null;
  onClear: () => void;
}) {
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    if (restUntil === null) return;
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, [restUntil]);

  if (restUntil === null) return null;

  const remainingMs = restUntil - now;
  if (remainingMs <= 0) {
    onClear();
    return null;
  }

  const seconds = Math.ceil(remainingMs / 1000);
  const mm = Math.floor(seconds / 60);
  const ss = String(seconds % 60).padStart(2, "0");

  return (
    <div className="rest-timer">
      <span>Rest: {mm}:{ss}</span>
      <button className="btn-link" onClick={onClear}>
        Skip
      </button>
    </div>
  );
}
