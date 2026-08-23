import { computePlates, groupPlates } from "../lib/plates";
import { formatWeight } from "../lib/units";
import type { Unit } from "../types";

/** What to hang on each side of the bar for a given target weight. */
export default function PlateChips({
  weight,
  bar,
  plates,
  unit,
}: {
  weight: number;
  bar: number;
  plates: number[];
  unit: Unit;
}) {
  const load = computePlates(weight, bar, plates);

  if (load.perSide.length === 0) {
    return (
      <div className="plate-chips">
        <span className="plate-hint">
          {weight <= bar ? "Empty bar" : `Bar + ${formatWeight(weight - bar)} ${unit}`}
        </span>
      </div>
    );
  }

  return (
    <div className="plate-chips">
      <span className="plate-hint">Per side</span>
      {groupPlates(load.perSide).map(({ plate, count }) => (
        <span className="plate-chip" key={plate}>
          {count > 1 && <span className="plate-count">{count}×</span>}
          {formatWeight(plate)}
        </span>
      ))}
      {load.short > 0 && (
        <span className="plate-hint plate-short">
          {formatWeight(load.short)} {unit} short — closest is {formatWeight(load.achieved)}
        </span>
      )}
    </div>
  );
}
