export type Unit = "lb" | "kg";
export type Theme = "system" | "light" | "dark";
export type SetKind = "warmup" | "work";
export type ScheduleMode = "fixed" | "rotating";

/** How an exercise is measured: loaded sets, a stretch of time, or just done. */
export type TrackingMode = "reps" | "duration" | "done";

/** What kind of effort a session is, which drives how it is planned and displayed. */
export type SessionKind = "strength" | "conditioning" | "recovery" | "sport";

/** Morning slot (the 6:30am lift) or evening slot (the 9pm skate). */
export type Slot = "am" | "pm";

export interface RecoveryRule {
  enabled: boolean;
  /** A session finishing at or after this hour counts as a late night. */
  lateHour: number;
  /** What the next morning becomes: a lighter session, or nothing at all. */
  action: "recovery" | "skip";
  /** Template to swap in when `action` is "recovery". */
  recoveryTemplateId: string | null;
}

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
  /** Grams of protein per unit of body weight, for the daily target. */
  proteinPerUnit: number;
  waterTarget: number;
  recovery: RecoveryRule;
}

export interface Exercise {
  id: string;
  name: string;
  tracking: TrackingMode;

  /** `reps` mode: loaded sets. */
  sets: number;
  /** Bottom of the rep range — the number every set must reach. */
  targetReps: number;
  /** Top of the rep range. Reaching it on every set earns the weight increase. */
  targetRepsMax: number;
  weight: number;
  increment: number;
  /** Consecutive sessions that failed to reach the bottom of the range. */
  consecutiveFails: number;
  /** Barbell movement — drives the plate calculator and the warmup ramp. */
  usesBar: boolean;
  useWarmup: boolean;

  /** `duration` mode: minutes of work. */
  targetMinutes: number;

  /** Free-text cue shown while logging, e.g. "treadmill intervals". */
  hint: string;
}

export interface WorkoutTemplate {
  id: string;
  name: string;
  kind: SessionKind;
  slot: Slot;
  exercises: Exercise[];
}

export interface Schedule {
  mode: ScheduleMode;
  /** `fixed`: day-of-week (0 = Sunday) -> template id, or null for a rest day. */
  days: Record<number, string | null>;
  /** Evening slot, for recurring sport nights. */
  eveningDays: Record<number, string | null>;
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
  tracking: TrackingMode;
  targetReps: number;
  targetRepsMax: number;
  weight: number;
  increment: number;
  usesBar: boolean;
  sets: SetLog[];
  /** `duration` mode: minutes actually done. */
  minutes: number | null;
  targetMinutes: number;
  /** `done` mode: simply completed or not. */
  completed: boolean;
  /** Cue copied from the template, e.g. "treadmill intervals". */
  hint: string;
  note: string;
}

export interface WorkoutSession {
  id: string;
  templateId: string;
  templateName: string;
  kind: SessionKind;
  dateISO: string;
  startedAt: number;
  finishedAt: number | null;
  /** Unit the weights were recorded in, so history stays truthful after a unit switch. */
  unit: Unit;
  exercises: ExerciseLog[];
  note: string;
  /** 1–5, how hard it felt. */
  effort: number | null;
}

export interface BodyWeightEntry {
  id: string;
  dateISO: string;
  weight: number;
  unit: Unit;
}

export type HabitGroup = "nutrition" | "mind" | "other";

export interface Habit {
  id: string;
  name: string;
  group: HabitGroup;
  /** Daily habits show every day; weekly ones count toward a per-week target. */
  cadence: "daily" | "weekly";
  weeklyTarget: number;
  archived: boolean;
}

export interface DailyLog {
  /** Local YYYY-MM-DD. */
  dayKey: string;
  proteinGrams: number;
  waterGlasses: number;
  /** Habit id -> completed. */
  habits: Record<string, boolean>;
  journal: string;
}

export interface Milestone {
  id: string;
  /** 1, 2 or 3 — which month of the plan this belongs to. */
  month: number;
  title: string;
  done: boolean;
}

export interface AppData {
  version: number;
  settings: Settings;
  templates: WorkoutTemplate[];
  schedule: Schedule;
  sessions: WorkoutSession[];
  activeSessionId: string | null;
  /** Epoch ms the current rest period ends, persisted so it survives navigation. */
  restEndsAt: number | null;
  bodyWeights: BodyWeightEntry[];
  habits: Habit[];
  /** Keyed by local YYYY-MM-DD. */
  dailyLogs: Record<string, DailyLog>;
  milestones: Milestone[];
  /** When the plan started, for working out which month you're in. */
  programStartISO: string;
}
