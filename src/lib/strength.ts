import type { ExerciseLog, Settings } from "../types";
import { nearestLoadable } from "./plates";
import { roundTo, SMALLEST_STEP } from "./units";

/** Epley estimate — the usual gym-app one-rep-max formula. */
export function estimateOneRepMax(weight: number, reps: number): number {
  if (reps <= 0) return 0;
  if (reps === 1) return weight;
  return weight * (1 + reps / 30);
}

/** Did every work set hit its target? Warmups never count against you. */
export function hitAllTargets(log: ExerciseLog): boolean {
  const workSets = log.sets.filter((s) => s.kind === "work");
  if (workSets.length === 0) return false;
  return workSets.every((s) => s.done && (s.reps ?? 0) >= s.targetReps);
}

export interface ProgressionResult {
  weight: number;
  consecutiveFails: number;
  /** What happened, for the post-workout summary. */
  outcome: "increase" | "deload" | "repeat";
}

/**
 * Linear progression: hit every rep and the weight goes up next time. Miss, and
 * it stays put until `deloadAfterFails` sessions in a row have missed, at which
 * point it drops back to build momentum again.
 */
export function applyProgression(
  currentWeight: number,
  increment: number,
  consecutiveFails: number,
  log: ExerciseLog,
  settings: Settings
): ProgressionResult {
  const step = SMALLEST_STEP[settings.unit];

  if (hitAllTargets(log)) {
    return {
      weight: roundTo(currentWeight + increment, step),
      consecutiveFails: 0,
      outcome: "increase",
    };
  }

  const fails = consecutiveFails + 1;
  if (fails >= settings.deloadAfterFails) {
    const target = currentWeight * (1 - settings.deloadPercent / 100);
    const deloaded = log.usesBar
      ? nearestLoadable(target, settings.barWeight, settings.plates)
      : roundTo(target, step);
    return {
      weight: Math.max(deloaded, log.usesBar ? settings.barWeight : step),
      consecutiveFails: 0,
      outcome: "deload",
    };
  }

  return { weight: currentWeight, consecutiveFails: fails, outcome: "repeat" };
}

/** Total weight moved: sum of weight x reps across completed work sets. */
export function sessionVolume(exercises: ExerciseLog[]): number {
  let total = 0;
  for (const ex of exercises) {
    for (const set of ex.sets) {
      if (set.kind === "work" && set.done) total += set.weight * (set.reps ?? 0);
    }
  }
  return total;
}
