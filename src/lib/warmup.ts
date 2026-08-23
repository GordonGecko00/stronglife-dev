import { nearestLoadable } from "./plates";

export interface WarmupSet {
  weight: number;
  reps: number;
}

/** Ramp toward the work weight: two bar sets, then ~55% / 70% / 85%. */
const RAMP: { fraction: number; reps: number }[] = [
  { fraction: 0.55, reps: 5 },
  { fraction: 0.7, reps: 3 },
  { fraction: 0.85, reps: 2 },
];

/**
 * StrongLifts-style warmup: empty bar for two sets, then a short ramp to the
 * work weight. Steps that land on the bar or on the work weight are dropped, so
 * light work weights get a short ramp (or none) instead of redundant sets.
 */
export function warmupSets(
  workWeight: number,
  bar: number,
  plates: number[],
  barReps = 5
): WarmupSet[] {
  if (workWeight <= bar) return [];

  const sets: WarmupSet[] = [
    { weight: bar, reps: barReps },
    { weight: bar, reps: barReps },
  ];

  let previous = bar;
  for (const step of RAMP) {
    const weight = nearestLoadable(workWeight * step.fraction, bar, plates);
    if (weight <= previous || weight >= workWeight) continue;
    sets.push({ weight, reps: step.reps });
    previous = weight;
  }

  return sets;
}
