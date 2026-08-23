import { addDays, dayKey, DAY_NAMES_SHORT, startOfDay } from "../lib/misc";

const WEEKS = 16;

/**
 * Sixteen weeks of training days — one hue, filled or empty, so the pattern of
 * consistency reads at a glance without a legend.
 */
export default function CalendarStrip({ days }: { days: Set<string> }) {
  const today = startOfDay(new Date());
  // Start on the Monday of the earliest week shown.
  const start = addDays(today, -((WEEKS - 1) * 7 + ((today.getDay() + 6) % 7)));

  const columns = Array.from({ length: WEEKS }, (_, week) =>
    Array.from({ length: 7 }, (_, day) => addDays(start, week * 7 + day))
  );

  return (
    <div className="calendar">
      <div className="calendar-labels">
        {[1, 3, 5].map((index) => (
          <span key={index} style={{ gridRow: index + 1 }}>
            {DAY_NAMES_SHORT[(index + 1) % 7]}
          </span>
        ))}
      </div>
      <div className="calendar-grid">
        {columns.map((week, weekIndex) => (
          <div className="calendar-week" key={weekIndex}>
            {week.map((date) => {
              const key = dayKey(date);
              const trained = days.has(key);
              const future = date > today;
              return (
                <span
                  key={key}
                  className={`calendar-day ${trained ? "calendar-day-on" : ""} ${
                    future ? "calendar-day-future" : ""
                  }`}
                  title={`${date.toLocaleDateString()}${trained ? " — trained" : ""}`}
                />
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
