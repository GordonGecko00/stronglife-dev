import type {
  AppData,
  BodyWeightEntry,
  Exercise,
  ExerciseLog,
  SetLog,
  Settings,
  Unit,
  WorkoutSession,
  WorkoutTemplate,
} from "../types";
import { update } from "./store";
import { uid, vibrate } from "../lib/misc";
import { applyProgression } from "../lib/strength";
import { warmupSets } from "../lib/warmup";
import { convertRounded, DEFAULT_BAR, DEFAULT_PLATES } from "../lib/units";

/* ---------------------------------------------------------------- sessions */

function buildExerciseLog(exercise: Exercise, settings: Settings): ExerciseLog {
  const sets: SetLog[] = [];

  if (settings.warmupEnabled && exercise.useWarmup && exercise.usesBar) {
    for (const w of warmupSets(exercise.weight, settings.barWeight, settings.plates)) {
      sets.push({ kind: "warmup", targetReps: w.reps, weight: w.weight, reps: null, done: false });
    }
  }

  for (let i = 0; i < exercise.sets; i++) {
    sets.push({
      kind: "work",
      targetReps: exercise.targetReps,
      weight: exercise.weight,
      reps: null,
      done: false,
    });
  }

  return {
    exerciseId: exercise.id,
    name: exercise.name,
    targetReps: exercise.targetReps,
    weight: exercise.weight,
    increment: exercise.increment,
    usesBar: exercise.usesBar,
    sets,
    note: "",
  };
}

export function startSession(template: WorkoutTemplate): string {
  const id = uid();
  update((d) => {
    const session: WorkoutSession = {
      id,
      templateId: template.id,
      templateName: template.name,
      dateISO: new Date().toISOString(),
      startedAt: Date.now(),
      finishedAt: null,
      unit: d.settings.unit,
      note: "",
      exercises: template.exercises.map((e) => buildExerciseLog(e, d.settings)),
    };
    d.sessions.unshift(session);
    d.activeSessionId = id;
    d.restEndsAt = null;
  });
  return id;
}

export function getActiveSession(d: AppData): WorkoutSession | null {
  if (!d.activeSessionId) return null;
  return d.sessions.find((s) => s.id === d.activeSessionId) ?? null;
}

function withSession(d: AppData, sessionId: string): WorkoutSession | undefined {
  return d.sessions.find((s) => s.id === sessionId);
}

export function setReps(
  sessionId: string,
  exerciseIndex: number,
  setIndex: number,
  reps: number | null
): void {
  update((d) => {
    const set = withSession(d, sessionId)?.exercises[exerciseIndex]?.sets[setIndex];
    if (!set) return;
    set.reps = reps;
    set.done = reps !== null;

    if (reps === null) {
      d.restEndsAt = null;
      return;
    }
    const missed = reps < set.targetReps;
    const seconds = missed ? d.settings.restAfterFailSec : d.settings.restSec;
    d.restEndsAt = Date.now() + seconds * 1000;
  });
}

/** Change the weight of an exercise mid-session (its unlogged sets follow). */
export function adjustSessionWeight(
  sessionId: string,
  exerciseIndex: number,
  weight: number
): void {
  update((d) => {
    const log = withSession(d, sessionId)?.exercises[exerciseIndex];
    if (!log) return;
    const next = Math.max(0, weight);
    log.weight = next;
    for (const set of log.sets) {
      if (set.kind === "work" && !set.done) set.weight = next;
    }
  });
}

export function setExerciseNote(sessionId: string, exerciseIndex: number, note: string): void {
  update((d) => {
    const log = withSession(d, sessionId)?.exercises[exerciseIndex];
    if (log) log.note = note;
  });
}

export function setSessionNote(sessionId: string, note: string): void {
  update((d) => {
    const session = withSession(d, sessionId);
    if (session) session.note = note;
  });
}

export function finishSession(sessionId: string): void {
  update((d) => {
    const session = withSession(d, sessionId);
    if (!session) return;
    session.finishedAt = Date.now();
    d.activeSessionId = null;
    d.restEndsAt = null;

    const template = d.templates.find((t) => t.id === session.templateId);
    if (!template) return;

    for (const log of session.exercises) {
      const exercise = template.exercises.find((e) => e.id === log.exerciseId);
      if (!exercise) continue;
      const result = applyProgression(
        log.weight,
        exercise.increment,
        exercise.consecutiveFails,
        log,
        d.settings
      );
      exercise.weight = result.weight;
      exercise.consecutiveFails = result.consecutiveFails;
    }

    if (d.schedule.mode === "rotating" && d.schedule.rotation.length > 0) {
      d.schedule.rotationIndex = (d.schedule.rotationIndex + 1) % d.schedule.rotation.length;
    }
  });
}

export function cancelSession(sessionId: string): void {
  update((d) => {
    d.sessions = d.sessions.filter((s) => s.id !== sessionId);
    if (d.activeSessionId === sessionId) d.activeSessionId = null;
    d.restEndsAt = null;
  });
}

export function deleteSession(sessionId: string): void {
  update((d) => {
    d.sessions = d.sessions.filter((s) => s.id !== sessionId);
    if (d.activeSessionId === sessionId) d.activeSessionId = null;
  });
}

/* ------------------------------------------------------------- rest timer */

export function startRest(seconds: number): void {
  update((d) => {
    d.restEndsAt = Date.now() + seconds * 1000;
  });
}

export function extendRest(seconds: number): void {
  update((d) => {
    const base = d.restEndsAt && d.restEndsAt > Date.now() ? d.restEndsAt : Date.now();
    d.restEndsAt = base + seconds * 1000;
  });
}

export function clearRest(): void {
  update((d) => {
    d.restEndsAt = null;
  });
}

export function notifyRestFinished(enabled: boolean): void {
  if (enabled) vibrate([200, 100, 200]);
}

/* --------------------------------------------------------------- templates */

export function addTemplate(): string {
  const id = uid();
  update((d) => {
    d.templates.push({ id, name: `Workout ${d.templates.length + 1}`, exercises: [] });
    if (!d.schedule.rotation.includes(id)) d.schedule.rotation.push(id);
  });
  return id;
}

export function renameTemplate(templateId: string, name: string): void {
  update((d) => {
    const t = d.templates.find((t) => t.id === templateId);
    if (t) t.name = name;
  });
}

export function deleteTemplate(templateId: string): void {
  update((d) => {
    d.templates = d.templates.filter((t) => t.id !== templateId);
    for (let day = 0; day < 7; day++) {
      if (d.schedule.days[day] === templateId) d.schedule.days[day] = null;
    }
    d.schedule.rotation = d.schedule.rotation.filter((id) => id !== templateId);
    if (d.schedule.rotationIndex >= d.schedule.rotation.length) d.schedule.rotationIndex = 0;
  });
}

export function duplicateTemplate(templateId: string): void {
  update((d) => {
    const source = d.templates.find((t) => t.id === templateId);
    if (!source) return;
    d.templates.push({
      id: uid(),
      name: `${source.name} copy`,
      exercises: source.exercises.map((e) => ({ ...e, id: uid() })),
    });
  });
}

export function addExercise(templateId: string): void {
  update((d) => {
    const t = d.templates.find((t) => t.id === templateId);
    if (!t) return;
    t.exercises.push({
      id: uid(),
      name: "New exercise",
      sets: 5,
      targetReps: 5,
      weight: d.settings.barWeight,
      increment: d.settings.unit === "kg" ? 2.5 : 5,
      consecutiveFails: 0,
      usesBar: true,
      useWarmup: true,
    });
  });
}

export function patchExercise(
  templateId: string,
  exerciseId: string,
  fields: Partial<Exercise>
): void {
  update((d) => {
    const exercise = d.templates
      .find((t) => t.id === templateId)
      ?.exercises.find((e) => e.id === exerciseId);
    if (exercise) Object.assign(exercise, fields);
  });
}

export function removeExercise(templateId: string, exerciseId: string): void {
  update((d) => {
    const t = d.templates.find((t) => t.id === templateId);
    if (t) t.exercises = t.exercises.filter((e) => e.id !== exerciseId);
  });
}

export function moveExercise(templateId: string, exerciseId: string, direction: -1 | 1): void {
  update((d) => {
    const t = d.templates.find((t) => t.id === templateId);
    if (!t) return;
    const from = t.exercises.findIndex((e) => e.id === exerciseId);
    const to = from + direction;
    if (from < 0 || to < 0 || to >= t.exercises.length) return;
    const [moved] = t.exercises.splice(from, 1);
    t.exercises.splice(to, 0, moved);
  });
}

/* ---------------------------------------------------------------- schedule */

export function setScheduleMode(mode: "fixed" | "rotating"): void {
  update((d) => {
    d.schedule.mode = mode;
  });
}

export function setScheduleDay(day: number, templateId: string | null): void {
  update((d) => {
    d.schedule.days[day] = templateId;
  });
}

export function toggleTrainingDay(day: number): void {
  update((d) => {
    d.schedule.trainingDays[day] = !d.schedule.trainingDays[day];
  });
}

export function setRotation(rotation: string[]): void {
  update((d) => {
    d.schedule.rotation = rotation;
    if (d.schedule.rotationIndex >= rotation.length) d.schedule.rotationIndex = 0;
  });
}

export function setRotationIndex(index: number): void {
  update((d) => {
    const length = d.schedule.rotation.length;
    if (length > 0) d.schedule.rotationIndex = ((index % length) + length) % length;
  });
}

/* ------------------------------------------------------------ body weight */

export function logBodyWeight(weight: number): void {
  update((d) => {
    const entry: BodyWeightEntry = {
      id: uid(),
      dateISO: new Date().toISOString(),
      weight,
      unit: d.settings.unit,
    };
    d.bodyWeights.unshift(entry);
  });
}

export function deleteBodyWeight(id: string): void {
  update((d) => {
    d.bodyWeights = d.bodyWeights.filter((b) => b.id !== id);
  });
}

/* ---------------------------------------------------------------- settings */

export function patchSettings(fields: Partial<Settings>): void {
  update((d) => {
    Object.assign(d.settings, fields);
  });
}

/**
 * Switch units and convert every stored weight so the numbers keep meaning the
 * same load. Past sessions keep the unit they were recorded in.
 */
export function setUnit(unit: Unit): void {
  update((d) => {
    const from = d.settings.unit;
    if (from === unit) return;

    for (const template of d.templates) {
      for (const exercise of template.exercises) {
        exercise.weight = convertRounded(exercise.weight, from, unit);
        exercise.increment = convertRounded(exercise.increment, from, unit);
      }
    }

    d.settings.unit = unit;
    d.settings.barWeight = DEFAULT_BAR[unit];
    d.settings.plates = [...DEFAULT_PLATES[unit]];
  });
}
