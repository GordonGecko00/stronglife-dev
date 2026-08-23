export type Unit = "lb" | "kg";
export type Theme = "system" | "light" | "dark";
export type SetKind = "warmup" | "work";
export type ScheduleMode = "fixed" | "rotating";

export interface Settings {
  unit: Unit;
  /** Weight of the empty bar, in `unit`. */
  barWeight: number;
  /** Plate denominations available in the gym, in `unit`, largest first. */
  plates: number[];
  restSec: number;
  /** Longer rest offered after a set that missed its target reps. */
  restAfterFailSec: number;
  warmupEnabled: boolean;
  deloadAfterFails: number;
  deloadPercent: number;
  theme: Theme;
  vibrate: boolean;
}

export interface Exercise {
  id: string;
  name: string;
  sets: number;
  targetReps: number;
  weight: number;
  increment: number;
  /** Consecutive sessions that failed to hit target reps on every set. */
  consecutiveFails: number;
  /** Barbell movement — drives the plate calculator and the warmup ramp. */
  usesBar: boolean;
  useWarmup: boolean;
}

export interface WorkoutTemplate {
  id: string;
  name: string;
  exercises: Exercise[];
}

export interface Schedule {
  mode: ScheduleMode;
  /** `fixed`: day-of-week (0 = Sunday) -> template id, or null for a rest day. */
  days: Record<number, string | null>;
  /** `rotating`: which days of the week are training days. */
  trainingDays: Record<number, boolean>;
  /** `rotating`: template ids cycled through, one per training day. */
  rotation: string[];
  rotationIndex: number;
}

export interface SetLog {
  kind: SetKind;
  targetReps: number;
  weight: number;
  reps: number | null;
  done: boolean;
}

export interface ExerciseLog {
  exerciseId: string;
  name: string;
  targetReps: number;
  weight: number;
  increment: number;
  usesBar: boolean;
  sets: SetLog[];
  note: string;
}

export interface WorkoutSession {
  id: string;
  templateId: string;
  templateName: string;
  dateISO: string;
  startedAt: number;
  finishedAt: number | null;
  /** Unit the weights were recorded in, so history stays truthful after a unit switch. */
  unit: Unit;
  exercises: ExerciseLog[];
  note: string;
}

export interface BodyWeightEntry {
  id: string;
  dateISO: string;
  weight: number;
  unit: Unit;
}

export interface AppData {
  version: number;
  settings: Settings;
  templates: WorkoutTemplate[];
  schedule: Schedule;
  sessions: WorkoutSession[];
  activeSessionId: string | null;
  /** Epoch ms the current rest period ends, persisted so it survives navigation and reloads. */
  restEndsAt: number | null;
  bodyWeights: BodyWeightEntry[];
}
