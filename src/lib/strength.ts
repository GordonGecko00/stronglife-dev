import type { ExerciseLog, Settings } from "../types";
import { nearestLoadable } from "./plates";
import { roundTo, SMALLEST_STEP } from "./units";

/** Epley estimate — the usual gym-app one-rep-max formula. */
export function estimateOneRepMax(weight: number, reps: number): number {
  if (reps <= 0) return 0;
  if (reps === 1) return weight;
  return weight * (1 + reps / 30);
}

function workSets(log: ExerciseLog) {
  return log.sets.filter((s) => s.kind === "work");
}

/** Every work set reached the bottom of the rep range. */
export function hitAllTargets(log: ExerciseLog): boolean {
  if (log.tracking === "done") return log.completed;
  if (log.tracking === "duration") return (log.minutes ?? 0) >= log.targetMinutes;
  const sets = workSets(log);
  if (sets.length === 0) return false;
  return sets.every((s) => s.done && (s.reps ?? 0) >= s.targetReps);
}

/** Every work set reached the TOP of the range — the cue to add weight. */
export function hitTopOfRange(log: ExerciseLog): boolean {
  if (log.tracking !== "reps") return hitAllTargets(log);
  const sets = workSets(log);
  if (sets.length === 0) return false;
  const top = Math.max(log.targetRepsMax, log.targetReps);
  return sets.every((s) => s.done && (s.reps ?? 0) >= top);
}

export interface ProgressionResult {
  weight: number;
  consecutiveFails: number;
  outcome: "increase" | "hold" | "deload" | "repeat";
}

/**
 * Double progression.
 *
 * Work up through the rep range at a fixed weight; once every set hits the top
 * of the range, add weight and start again from the bottom. A range of 5–5 (a
 * classic 5x5) collapses to plain linear progression.
 */
export function applyProgression(
  currentWeight: number,
  increment: number,
  consecutiveFails: number,
  log: ExerciseLog,
  settings: Settings
): ProgressionResult {
  // Timed and tick-box work carries no load, so there is nothing to progress.
  if (log.tracking !== "reps") {
    return { weight: currentWeight, consecutiveFails: 0, outcome: "hold" };
  }

  const step = SMALLEST_STEP[settings.unit];

  if (hitTopOfRange(log)) {
    return {
      weight: roundTo(currentWeight + increment, step),
      consecutiveFails: 0,
      outcome: "increase",
    };
  }

  // Inside the range: same weight next time, chase more reps.
  if (hitAllTargets(log)) {
    return { weight: currentWeight, consecutiveFails: 0, outcome: "hold" };
  }

  const fails = consecutiveFails + 1;
  if (fails >= settings.deloadAfterFails) {
    const target = currentWeight * (1 - settings.deloadPercent / 100);
    const deloaded = log.usesBar
      ? nearestLoadable(target, settings.barWeight, settings.plates)
      : roundTo(target, step);
    const floor = log.usesBar ? settings.barWeight : 0;
    return {
      weight: Math.max(deloaded, floor),
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
    if (ex.tracking !== "reps") continue;
    for (const set of ex.sets) {
      if (set.kind === "work" && set.done) total += set.weight * (set.reps ?? 0);
    }
  }
  return total;
}

/** Minutes of conditioning / recovery / sport work in a session. */
export function sessionMinutes(exercises: ExerciseLog[]): number {
  return exercises.reduce((total, ex) => total + (ex.minutes ?? 0), 0);
}
