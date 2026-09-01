import type {
  AppData,
  BodyWeightEntry,
  DailyLog,
  Habit,
  Unit,
  WorkoutSession,
  WorkoutTemplate,
} from "../types";
import { estimateOneRepMax, sessionVolume } from "../lib/strength";
import { convert } from "../lib/units";
import { addDays, dayKey, endOfDay, exerciseKey, startOfDay } from "../lib/misc";

export function completedSessions(d: AppData): WorkoutSession[] {
  return d.sessions.filter((s) => s.finishedAt !== null);
}

/** The workout scheduled for a given weekday, honouring the schedule mode. */
export function templateForDay(d: AppData, day: number): WorkoutTemplate | null {
  if (d.schedule.mode === "fixed") {
    const id = d.schedule.days[day];
    return id ? d.templates.find((t) => t.id === id) ?? null : null;
  }
  if (!d.schedule.trainingDays[day]) return null;
  const rotation = d.schedule.rotation.filter((id) => d.templates.some((t) => t.id === id));
  if (rotation.length === 0) return null;
  const id = rotation[d.schedule.rotationIndex % rotation.length];
  return d.templates.find((t) => t.id === id) ?? null;
}

export function nextTrainingDay(d: AppData, from = new Date()): { date: Date; template: WorkoutTemplate } | null {
  for (let offset = 1; offset <= 7; offset++) {
    const date = new Date(from);
    date.setDate(date.getDate() + offset);
    const template = templateForDay(d, date.getDay());
    if (template) return { date, template };
  }
  return null;
}

export interface SeriesPoint {
  x: number;
  y: number;
  label?: string;
}

/** Heaviest completed work set per session for one exercise, oldest first. */
export function exerciseProgress(
  d: AppData,
  name: string,
  unit: Unit
): { topSet: SeriesPoint[]; oneRepMax: SeriesPoint[] } {
  const key = exerciseKey(name);
  const topSet: SeriesPoint[] = [];
  const oneRepMax: SeriesPoint[] = [];

  for (const session of completedSessions(d)) {
    for (const log of session.exercises) {
      if (exerciseKey(log.name) !== key) continue;
      const done = log.sets.filter((s) => s.kind === "work" && s.done && (s.reps ?? 0) > 0);
      if (done.length === 0) continue;

      const heaviest = done.reduce((best, s) => (s.weight > best.weight ? s : best), done[0]);
      const best1rm = done.reduce(
        (best, s) => Math.max(best, estimateOneRepMax(s.weight, s.reps ?? 0)),
        0
      );
      const x = session.finishedAt ?? Date.parse(session.dateISO);
      topSet.push({ x, y: convert(heaviest.weight, session.unit, unit) });
      oneRepMax.push({ x, y: convert(best1rm, session.unit, unit) });
    }
  }

  topSet.sort((a, b) => a.x - b.x);
  oneRepMax.sort((a, b) => a.x - b.x);
  return { topSet, oneRepMax };
}

export interface PersonalRecord {
  name: string;
  weight: number;
  reps: number;
  oneRepMax: number;
  dateISO: string;
}

/** Best estimated 1RM per exercise, with the set that produced it. */
export function personalRecords(d: AppData, unit: Unit): PersonalRecord[] {
  const best = new Map<string, PersonalRecord>();

  for (const session of completedSessions(d)) {
    for (const log of session.exercises) {
      for (const set of log.sets) {
        if (set.kind !== "work" || !set.done || !set.reps) continue;
        const weight = convert(set.weight, session.unit, unit);
        const oneRepMax = estimateOneRepMax(weight, set.reps);
        const key = exerciseKey(log.name);
        const current = best.get(key);
        if (!current || oneRepMax > current.oneRepMax) {
          best.set(key, {
            name: log.name,
            weight,
            reps: set.reps,
            oneRepMax,
            dateISO: session.dateISO,
          });
        }
      }
    }
  }

  return [...best.values()].sort((a, b) => b.oneRepMax - a.oneRepMax);
}

/** Every exercise name that appears in a template or in history. */
export function knownExercises(d: AppData): string[] {
  const names = new Map<string, string>();
  for (const template of d.templates) {
    for (const exercise of template.exercises) names.set(exerciseKey(exercise.name), exercise.name);
  }
  for (const session of completedSessions(d)) {
    for (const log of session.exercises) {
      if (!names.has(exerciseKey(log.name))) names.set(exerciseKey(log.name), log.name);
    }
  }
  return [...names.values()].sort((a, b) => a.localeCompare(b));
}

export interface Stats {
  totalWorkouts: number;
  workoutsThisWeek: number;
  currentStreakWeeks: number;
  volumeSeries: SeriesPoint[];
  totalVolume: number;
}

/** Consecutive weeks (ending this week or last) with at least one workout. */
function streakWeeks(dates: Date[]): number {
  if (dates.length === 0) return 0;
  const weekKeys = new Set(
    dates.map((d) => {
      const monday = startOfDay(d);
      const shift = (monday.getDay() + 6) % 7;
      monday.setDate(monday.getDate() - shift);
      return dayKey(monday);
    })
  );

  const cursor = startOfDay(new Date());
  cursor.setDate(cursor.getDate() - ((cursor.getDay() + 6) % 7));

  // Allow the streak to start last week — mid-week you may not have lifted yet.
  if (!weekKeys.has(dayKey(cursor))) cursor.setDate(cursor.getDate() - 7);

  let streak = 0;
  while (weekKeys.has(dayKey(cursor))) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 7);
  }
  return streak;
}

export function stats(d: AppData, unit: Unit): Stats {
  const finished = completedSessions(d);
  const volumeSeries: SeriesPoint[] = [];
  let totalVolume = 0;

  for (const session of finished) {
    const volume = convert(sessionVolume(session.exercises), session.unit, unit);
    totalVolume += volume;
    volumeSeries.push({ x: session.finishedAt ?? Date.parse(session.dateISO), y: volume });
  }
  volumeSeries.sort((a, b) => a.x - b.x);

  const weekStart = startOfDay(new Date());
  weekStart.setDate(weekStart.getDate() - ((weekStart.getDay() + 6) % 7));

  return {
    totalWorkouts: finished.length,
    workoutsThisWeek: finished.filter(
      (s) => (s.finishedAt ?? Date.parse(s.dateISO)) >= weekStart.getTime()
    ).length,
    currentStreakWeeks: streakWeeks(finished.map((s) => new Date(s.finishedAt ?? s.dateISO))),
    volumeSeries,
    totalVolume,
  };
}

export function bodyWeightSeries(d: AppData, unit: Unit): SeriesPoint[] {
  return d.bodyWeights
    .map((entry) => ({
      x: Date.parse(entry.dateISO),
      y: convert(entry.weight, entry.unit, unit),
    }))
    .sort((a, b) => a.x - b.x);
}

/** Day keys that have a completed workout, for the calendar. */
export function workoutDayKeys(d: AppData): Set<string> {
  return new Set(completedSessions(d).map((s) => dayKey(s.finishedAt ?? s.dateISO)));
}

/* ------------------------------------------------------ daily check-in */

export function dayLog(d: AppData, key: string): DailyLog {
  return d.dailyLogs[key] ?? { dayKey: key, proteinGrams: 0, waterGlasses: 0, habits: {}, journal: "" };
}

/** The body weight entry logged on a given day, if there is one. */
export function bodyWeightOn(d: AppData, key: string): BodyWeightEntry | null {
  return d.bodyWeights.find((entry) => dayKey(entry.dateISO) === key) ?? null;
}

/**
 * Daily protein goal from body weight, converted into the current unit.
 * Returns null until a body weight has been logged.
 *
 * `on` picks the weight you were at then rather than the weight you are now, so
 * reviewing a day from six weeks ago shows the target you were actually eating
 * against. Days before your first weigh-in fall back to that first entry, since
 * a target that reads "—" is less useful than an approximate one.
 */
export function proteinTarget(d: AppData, on?: Date): number | null {
  if (d.bodyWeights.length === 0) return null;
  const cutoff = on ? endOfDay(on).getTime() : Infinity;
  const entry =
    d.bodyWeights.find((e) => Date.parse(e.dateISO) <= cutoff) ??
    d.bodyWeights[d.bodyWeights.length - 1];
  const weight = convert(entry.weight, entry.unit, d.settings.unit);
  return Math.round(weight * d.settings.proteinPerUnit);
}

export interface HabitProgress {
  habit: Habit;
  /** Days completed within the week containing the reference day. */
  count: number;
  target: number;
  /** Ticked on the reference day itself, which need not be today. */
  doneOnDay: boolean;
}

/** Habit completion for the Monday-to-Sunday week containing `from`. */
export function habitProgress(d: AppData, from = new Date()): HabitProgress[] {
  const monday = startOfDay(from);
  monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
  const weekKeys = Array.from({ length: 7 }, (_, i) => dayKey(addDays(monday, i)));
  const key = dayKey(from);

  return d.habits
    .filter((h) => !h.archived)
    .map((habit) => ({
      habit,
      count: weekKeys.filter((key) => d.dailyLogs[key]?.habits[habit.id]).length,
      target: habit.cadence === "daily" ? 7 : habit.weeklyTarget,
      doneOnDay: Boolean(d.dailyLogs[key]?.habits[habit.id]),
    }));
}

/** Which month of the 3-month plan we're in (1-based, clamped at 3). */
export function programMonth(d: AppData): number {
  const start = Date.parse(d.programStartISO);
  if (!Number.isFinite(start)) return 1;
  const days = Math.floor((Date.now() - start) / 86_400_000);
  return Math.min(3, Math.max(1, Math.floor(days / 30) + 1));
}

/** Average protein and water over the last `days`, ignoring untouched days. */
export function nutritionAverages(d: AppData, days = 7): { protein: number; water: number } {
  const keys = Array.from({ length: days }, (_, i) => dayKey(addDays(new Date(), -i)));
  const logged = keys.map((k) => d.dailyLogs[k]).filter((l): l is DailyLog => Boolean(l));
  if (logged.length === 0) return { protein: 0, water: 0 };
  return {
    protein: Math.round(logged.reduce((s, l) => s + l.proteinGrams, 0) / logged.length),
    water: Math.round(logged.reduce((s, l) => s + l.waterGlasses, 0) / logged.length),
  };
}
