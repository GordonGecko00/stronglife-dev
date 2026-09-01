import type {
  AppData,
  BodyWeightEntry,
  DailyLog,
  Exercise,
  ExerciseLog,
  Habit,
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

  if (exercise.tracking === "reps") {
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
  }

  return {
    exerciseId: exercise.id,
    name: exercise.name,
    tracking: exercise.tracking,
    targetReps: exercise.targetReps,
    targetRepsMax: exercise.targetRepsMax,
    weight: exercise.weight,
    increment: exercise.increment,
    usesBar: exercise.usesBar,
    sets,
    minutes: null,
    targetMinutes: exercise.targetMinutes,
    completed: false,
    hint: exercise.hint,
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
      kind: template.kind,
      dateISO: new Date().toISOString(),
      startedAt: Date.now(),
      finishedAt: null,
      unit: d.settings.unit,
      note: "",
      effort: null,
      exercises: template.exercises.map((e) => buildExerciseLog(e, d.settings)),
    };
    d.sessions.unshift(session);
    d.activeSessionId = id;
    d.restEndsAt = null;
  });
  return id;
}

/**
 * Record a finished session in one go, for things like hockey you don't run a
 * timer through.
 *
 * `startedAt` matters beyond bookkeeping: the late-night rule reads the clock
 * time off the session to decide whether the next morning should be eased off,
 * so a game logged after the fact has to carry the hour it was actually played.
 */
export function logSession(
  template: WorkoutTemplate,
  options: { minutes: number; startedAt: Date; note?: string }
): void {
  const { minutes, startedAt, note = "" } = options;
  update((d) => {
    const exercises = template.exercises.map((e) => {
      const log = buildExerciseLog(e, d.settings);
      if (log.tracking === "duration") log.minutes = minutes;
      if (log.tracking === "done") log.completed = true;
      return log;
    });
    d.sessions.unshift({
      id: uid(),
      templateId: template.id,
      templateName: template.name,
      kind: template.kind,
      dateISO: startedAt.toISOString(),
      startedAt: startedAt.getTime(),
      finishedAt: startedAt.getTime() + minutes * 60_000,
      unit: d.settings.unit,
      note,
      effort: null,
      exercises,
    });
  });
}

/** Log a session that just finished. */
export function logSessionJustFinished(template: WorkoutTemplate, minutes: number): void {
  logSession(template, { minutes, startedAt: new Date(Date.now() - minutes * 60_000) });
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

/** `duration` exercises: minutes actually done. */
export function setExerciseMinutes(
  sessionId: string,
  exerciseIndex: number,
  minutes: number | null
): void {
  update((d) => {
    const log = withSession(d, sessionId)?.exercises[exerciseIndex];
    if (!log) return;
    log.minutes = minutes === null ? null : Math.max(0, minutes);
  });
}

/** `done` exercises: a plain tick. */
export function toggleExerciseComplete(sessionId: string, exerciseIndex: number): void {
  update((d) => {
    const log = withSession(d, sessionId)?.exercises[exerciseIndex];
    if (!log) return;
    log.completed = !log.completed;
  });
}

export function setSessionEffort(sessionId: string, effort: number | null): void {
  update((d) => {
    const session = withSession(d, sessionId);
    if (session) session.effort = effort;
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
    d.templates.push({
      id,
      name: `Workout ${d.templates.length + 1}`,
      kind: "strength",
      slot: "am",
      exercises: [],
    });
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
      if (d.schedule.eveningDays[day] === templateId) d.schedule.eveningDays[day] = null;
    }
    if (d.settings.recovery.recoveryTemplateId === templateId) {
      d.settings.recovery.recoveryTemplateId = null;
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
      ...source,
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
      tracking: "reps",
      sets: 3,
      targetReps: 8,
      targetRepsMax: 10,
      weight: d.settings.barWeight,
      increment: d.settings.unit === "kg" ? 2.5 : 5,
      consecutiveFails: 0,
      usesBar: true,
      useWarmup: true,
      targetMinutes: 0,
      hint: "",
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

/* ------------------------------------------------------------ daily check-in */

function ensureDay(d: AppData, key: string): DailyLog {
  if (!d.dailyLogs[key]) {
    d.dailyLogs[key] = { dayKey: key, proteinGrams: 0, waterGlasses: 0, habits: {}, journal: "" };
  }
  return d.dailyLogs[key];
}

export function patchDailyLog(key: string, fields: Partial<Omit<DailyLog, "dayKey">>): void {
  update((d) => {
    Object.assign(ensureDay(d, key), fields);
  });
}

export function toggleHabit(key: string, habitId: string): void {
  update((d) => {
    const log = ensureDay(d, key);
    log.habits[habitId] = !log.habits[habitId];
  });
}

export function bumpWater(key: string, delta: number): void {
  update((d) => {
    const log = ensureDay(d, key);
    log.waterGlasses = Math.max(0, log.waterGlasses + delta);
  });
}

export function bumpProtein(key: string, delta: number): void {
  update((d) => {
    const log = ensureDay(d, key);
    log.proteinGrams = Math.max(0, log.proteinGrams + delta);
  });
}

/* ----------------------------------------------------------------- habits */

export function addHabit(name: string, group: Habit["group"], cadence: Habit["cadence"]): void {
  update((d) => {
    d.habits.push({
      id: uid(),
      name,
      group,
      cadence,
      weeklyTarget: cadence === "daily" ? 7 : 2,
      archived: false,
    });
  });
}

export function patchHabit(habitId: string, fields: Partial<Habit>): void {
  update((d) => {
    const habit = d.habits.find((h) => h.id === habitId);
    if (habit) Object.assign(habit, fields);
  });
}

export function removeHabit(habitId: string): void {
  update((d) => {
    d.habits = d.habits.filter((h) => h.id !== habitId);
  });
}

/* -------------------------------------------------------------- milestones */

export function toggleMilestone(id: string): void {
  update((d) => {
    const milestone = d.milestones.find((m) => m.id === id);
    if (milestone) milestone.done = !milestone.done;
  });
}

export function addMilestone(month: number, title: string): void {
  update((d) => {
    d.milestones.push({ id: uid(), month, title, done: false });
  });
}

export function removeMilestone(id: string): void {
  update((d) => {
    d.milestones = d.milestones.filter((m) => m.id !== id);
  });
}

/* ------------------------------------------------------- evening schedule */

export function setEveningDay(day: number, templateId: string | null): void {
  update((d) => {
    d.schedule.eveningDays[day] = templateId;
  });
}

export function patchRecoveryRule(fields: Partial<AppData["settings"]["recovery"]>): void {
  update((d) => {
    Object.assign(d.settings.recovery, fields);
  });
}

export function patchTemplate(templateId: string, fields: Partial<WorkoutTemplate>): void {
  update((d) => {
    const template = d.templates.find((t) => t.id === templateId);
    if (template) Object.assign(template, fields);
  });
}

/* -------------------------------------------------------------- first run */

export interface OnboardingChoices {
  unit: Unit;
  bodyWeight: number | null;
  /** Days of the week with an evening sport. */
  sportDays: number[];
  sportMinutes: number;
  recoveryAction: "recovery" | "skip" | "off";
  lateHour: number;
}

/**
 * Apply first-run answers in one go, so the app opens already shaped around
 * the user's week rather than a generic default.
 */
export function completeOnboarding(choices: OnboardingChoices): void {
  update((d) => {
    if (choices.unit !== d.settings.unit) {
      const from = d.settings.unit;
      for (const template of d.templates) {
        for (const exercise of template.exercises) {
          exercise.weight = convertRounded(exercise.weight, from, choices.unit);
          exercise.increment = convertRounded(exercise.increment, from, choices.unit);
        }
      }
      d.settings.unit = choices.unit;
      d.settings.barWeight = DEFAULT_BAR[choices.unit];
      d.settings.plates = [...DEFAULT_PLATES[choices.unit]];
    }

    if (choices.bodyWeight && choices.bodyWeight > 0) {
      d.bodyWeights.unshift({
        id: uid(),
        dateISO: new Date().toISOString(),
        weight: choices.bodyWeight,
        unit: choices.unit,
      });
    }

    const sport = d.templates.find((t) => t.kind === "sport");
    for (let day = 0; day < 7; day++) {
      d.schedule.eveningDays[day] = choices.sportDays.includes(day) && sport ? sport.id : null;
    }
    if (sport && choices.sportMinutes > 0) {
      const timed = sport.exercises.find((e) => e.tracking === "duration");
      if (timed) timed.targetMinutes = choices.sportMinutes;
    }

    d.settings.recovery.enabled = choices.recoveryAction !== "off";
    if (choices.recoveryAction !== "off") d.settings.recovery.action = choices.recoveryAction;
    d.settings.recovery.lateHour = choices.lateHour;
    if (!d.settings.recovery.recoveryTemplateId) {
      d.settings.recovery.recoveryTemplateId =
        d.templates.find((t) => t.kind === "recovery")?.id ?? null;
    }

    d.programStartISO = new Date().toISOString();
    d.onboardedAt = new Date().toISOString();
  });
}

export function restartOnboarding(): void {
  update((d) => {
    d.onboardedAt = null;
  });
}

export function dismissTip(id: string): void {
  update((d) => {
    d.tipsSeen[id] = true;
  });
}
