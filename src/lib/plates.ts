/** Plate math: what to actually hang on each side of the bar. */

export interface PlateLoad {
  /** Plates for ONE side of the bar, largest first. */
  perSide: number[];
  /** Total weight these plates plus the bar actually come to. */
  achieved: number;
  /** How far short of the requested weight that leaves us (0 when exact). */
  short: number;
}

const EPSILON = 1e-6;

/**
 * Greedy largest-first fill of one side of the bar. Greedy is exact for the
 * standard plate sets (each denomination divides into the next), and any
 * leftover is surfaced as `short` rather than silently rounded away.
 */
export function computePlates(target: number, bar: number, available: number[]): PlateLoad {
  const perSideTarget = (target - bar) / 2;
  if (perSideTarget <= EPSILON) {
    return { perSide: [], achieved: bar, short: Math.max(0, target - bar) };
  }

  const denominations = [...available].sort((a, b) => b - a);
  const perSide: number[] = [];
  let remaining = perSideTarget;

  for (const plate of denominations) {
    while (remaining + EPSILON >= plate) {
      perSide.push(plate);
      remaining -= plate;
    }
  }

  const loaded = perSide.reduce((sum, p) => sum + p, 0);
  const achieved = bar + loaded * 2;
  return { perSide, achieved, short: Math.max(0, target - achieved) };
}

/** The closest weight that can actually be loaded at or below `target`. */
export function nearestLoadable(target: number, bar: number, available: number[]): number {
  if (target <= bar) return bar;
  return computePlates(target, bar, available).achieved;
}

/** Collapse [45,45,25] into [{plate:45,count:2},{plate:25,count:1}] for display. */
export function groupPlates(perSide: number[]): { plate: number; count: number }[] {
  const groups: { plate: number; count: number }[] = [];
  for (const plate of perSide) {
    const last = groups[groups.length - 1];
    if (last && last.plate === plate) last.count += 1;
    else groups.push({ plate, count: 1 });
  }
  return groups;
}
