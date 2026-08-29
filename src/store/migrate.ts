import type {
  AppData,
  DailyLog,
  Exercise,
  Habit,
  Milestone,
  SessionKind,
  Settings,
  Theme,
  TrackingMode,
  Unit,
} from "../types";
import {
  buildDefaultData,
  buildHabits,
  buildMilestones,
  DATA_VERSION,
  defaultSettings,
} from "./defaults";
import { DEFAULT_BAR, DEFAULT_PLATES } from "../lib/units";

type Loose = Record<string, unknown>;

function isObject(value: unknown): value is Loose {
  return typeof value === "object" && value !== null;
}

function asArray(value: unknown): Loose[] {
  return Array.isArray(value) ? value.filter(isObject) : [];
}

function num(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function str(value: unknown, fallback: string): string {
  return typeof value === "string" ? value : fallback;
}

function bool(value: unknown, fallback: boolean): boolean {
  return typeof value === "boolean" ? value : fallback;
}

/**
 * Bring any previously stored shape up to the current one.
 *
 * Anything unrecognised falls back to a sane default rather than throwing —
 * a malformed field should cost one setting, not someone's whole training log.
 */
export function migrate(raw: unknown): AppData {
  if (!isObject(raw)) return buildDefaultData();
  const version = num(raw.version, 1);
  return version >= 2 ? normalizeCurrent(raw) : fromV1(raw);
}

function normalizeSettings(raw: unknown): Settings {
  const base = defaultSettings();
  if (!isObject(raw)) return base;
  const unit: Unit = raw.unit === "kg" ? "kg" : "lb";
  const plates = Array.isArray(raw.plates)
    ? raw.plates.filter((p): p is number => typeof p === "number" && p > 0)
    : [];
  return {
    unit,
    barWeight: num(raw.barWeight, DEFAULT_BAR[unit]),
    plates: plates.length ? [...plates].sort((a, b) => b - a) : [...DEFAULT_PLATES[unit]],
    restSec: num(raw.restSec, base.restSec),
    restAfterFailSec: num(raw.restAfterFailSec, base.restAfterFailSec),
    warmupEnabled: bool(raw.warmupEnabled, base.warmupEnabled),
    deloadAfterFails: num(raw.deloadAfterFails, base.deloadAfterFails),
    deloadPercent: num(raw.deloadPercent, base.deloadPercent),
    theme: raw.theme === "light" || raw.theme === "dark" ? (raw.theme as Theme) : "system",
    vibrate: bool(raw.vibrate, base.vibrate),
    proteinPerUnit: num(raw.proteinPerUnit, base.proteinPerUnit),
    waterTarget: num(raw.waterTarget, base.waterTarget),
    recovery: normalizeRecovery(raw.recovery, base),
  };
}

function normalizeRecovery(raw: unknown, base: Settings): Settings["recovery"] {
  if (!isObject(raw)) return { ...base.recovery };
  return {
    enabled: bool(raw.enabled, base.recovery.enabled),
    lateHour: Math.min(23, Math.max(0, num(raw.lateHour, base.recovery.lateHour))),
    action: raw.action === "skip" ? "skip" : "recovery",
    recoveryTemplateId:
      typeof raw.recoveryTemplateId === "string" ? raw.recoveryTemplateId : null,
  };
}

function trackingOf(raw: unknown, fallback: TrackingMode = "reps"): TrackingMode {
  return raw === "duration" || raw === "done" || raw === "reps" ? raw : fallback;
}

function kindOf(raw: unknown, fallback: SessionKind = "strength"): SessionKind {
  return raw === "conditioning" || raw === "recovery" || raw === "sport" || raw === "strength"
    ? raw
    : fallback;
}

function normalizeExercise(raw: Loose): Exercise {
  const targetReps = Math.max(1, num(raw.targetReps, 5));
  return {
    id: str(raw.id, crypto.randomUUID()),
    name: str(raw.name, "Exercise"),
    tracking: trackingOf(raw.tracking),
    sets: Math.max(1, num(raw.sets, 5)),
    targetReps,
    // Pre-v3 exercises had a single target; a range of one is plain linear progression.
    targetRepsMax: Math.max(targetReps, num(raw.targetRepsMax, targetReps)),
    weight: num(raw.weight, 45),
    increment: num(raw.increment, 5),
    consecutiveFails: num(raw.consecutiveFails, 0),
    usesBar: bool(raw.usesBar, true),
    useWarmup: bool(raw.useWarmup, true),
    targetMinutes: num(raw.targetMinutes, 0),
    hint: str(raw.hint, ""),
  };
}

function normalizeTemplates(raw: unknown) {
  return asArray(raw).map((t) => ({
    id: str(t.id, crypto.randomUUID()),
    name: str(t.name, "Workout"),
    kind: kindOf(t.kind),
    slot: t.slot === "pm" ? ("pm" as const) : ("am" as const),
    exercises: asArray(t.exercises).map(normalizeExercise),
  }));
}

function normalizeSessions(raw: unknown, fallbackUnit: Unit) {
  return asArray(raw).map((s) => ({
    id: str(s.id, crypto.randomUUID()),
    templateId: str(s.templateId, ""),
    templateName: str(s.templateName, "Workout"),
    kind: kindOf(s.kind),
    dateISO: str(s.dateISO, new Date().toISOString()),
    startedAt: num(s.startedAt, Date.parse(str(s.dateISO, "")) || Date.now()),
    finishedAt: typeof s.finishedAt === "number" ? s.finishedAt : null,
    unit: s.unit === "kg" || s.unit === "lb" ? s.unit : fallbackUnit,
    note: str(s.note, ""),
    effort: typeof s.effort === "number" ? s.effort : null,
    exercises: asArray(s.exercises).map((e) => {
      const targetReps = num(e.targetReps, 5);
      return {
        exerciseId: str(e.exerciseId, ""),
        name: str(e.name, "Exercise"),
        tracking: trackingOf(e.tracking),
        targetReps,
        targetRepsMax: Math.max(targetReps, num(e.targetRepsMax, targetReps)),
        weight: num(e.weight, 0),
        increment: num(e.increment, 5),
        usesBar: bool(e.usesBar, true),
        minutes: typeof e.minutes === "number" ? e.minutes : null,
        targetMinutes: num(e.targetMinutes, 0),
        completed: bool(e.completed, false),
        hint: str(e.hint, ""),
        note: str(e.note, ""),
        sets: asArray(e.sets).map((set) => ({
          kind: set.kind === "warmup" ? ("warmup" as const) : ("work" as const),
          targetReps: num(set.targetReps, targetReps),
          weight: num(set.weight, num(e.weight, 0)),
          reps: typeof set.reps === "number" ? set.reps : null,
          done: bool(set.done, false),
        })),
      };
    }),
  }));
}

function normalizeSchedule(raw: unknown, templateIds: string[]) {
  const fallback = buildDefaultData().schedule;
  if (!isObject(raw)) return fallback;

  const days: Record<number, string | null> = {};
  const eveningDays: Record<number, string | null> = {};
  const trainingDays: Record<number, boolean> = {};
  const rawDays = isObject(raw.days) ? raw.days : {};
  const rawEvening = isObject(raw.eveningDays) ? raw.eveningDays : {};
  const rawTraining = isObject(raw.trainingDays) ? raw.trainingDays : {};

  for (let day = 0; day < 7; day++) {
    const assigned = rawDays[day];
    days[day] = typeof assigned === "string" && templateIds.includes(assigned) ? assigned : null;
    const evening = rawEvening[day];
    eveningDays[day] =
      typeof evening === "string" && templateIds.includes(evening) ? evening : null;
    trainingDays[day] = bool(rawTraining[day], days[day] !== null);
  }

  const rotation = Array.isArray(raw.rotation)
    ? raw.rotation.filter((id): id is string => typeof id === "string" && templateIds.includes(id))
    : [];

  return {
    mode: raw.mode === "fixed" ? ("fixed" as const) : ("rotating" as const),
    days,
    eveningDays,
    trainingDays,
    rotation: rotation.length ? rotation : templateIds,
    rotationIndex: num(raw.rotationIndex, 0),
  };
}

function normalizeHabits(raw: unknown): Habit[] {
  const habits = asArray(raw).map((h) => ({
    id: str(h.id, crypto.randomUUID()),
    name: str(h.name, "Habit"),
    group:
      h.group === "nutrition" || h.group === "mind" || h.group === "other"
        ? (h.group as Habit["group"])
        : ("other" as const),
    cadence: h.cadence === "weekly" ? ("weekly" as const) : ("daily" as const),
    weeklyTarget: num(h.weeklyTarget, 7),
    archived: bool(h.archived, false),
  }));
  return habits.length ? habits : buildHabits();
}

function normalizeDailyLogs(raw: unknown): Record<string, DailyLog> {
  if (!isObject(raw)) return {};
  const logs: Record<string, DailyLog> = {};
  for (const [key, value] of Object.entries(raw)) {
    if (!isObject(value)) continue;
    const habits: Record<string, boolean> = {};
    if (isObject(value.habits)) {
      for (const [habitId, done] of Object.entries(value.habits)) habits[habitId] = Boolean(done);
    }
    logs[key] = {
      dayKey: str(value.dayKey, key),
      proteinGrams: num(value.proteinGrams, 0),
      waterGlasses: num(value.waterGlasses, 0),
      habits,
      journal: str(value.journal, ""),
    };
  }
  return logs;
}

function normalizeMilestones(raw: unknown): Milestone[] {
  const milestones = asArray(raw).map((m) => ({
    id: str(m.id, crypto.randomUUID()),
    month: Math.max(1, num(m.month, 1)),
    title: str(m.title, "Milestone"),
    done: bool(m.done, false),
  }));
  return milestones.length ? milestones : buildMilestones();
}

function normalizeCurrent(raw: Loose): AppData {
  const settings = normalizeSettings(raw.settings);
  const templates = normalizeTemplates(raw.templates);
  const ids = templates.map((t) => t.id);
  const sessions = normalizeSessions(raw.sessions, settings.unit);
  const activeId = typeof raw.activeSessionId === "string" ? raw.activeSessionId : null;

  // A recovery template that no longer exists would silently disable the rule.
  if (settings.recovery.recoveryTemplateId && !ids.includes(settings.recovery.recoveryTemplateId)) {
    settings.recovery.recoveryTemplateId =
      templates.find((t) => t.kind === "recovery")?.id ?? null;
  }

  return {
    version: DATA_VERSION,
    settings,
    templates: templates.length ? templates : buildDefaultData().templates,
    schedule: normalizeSchedule(raw.schedule, ids),
    sessions,
    activeSessionId: sessions.some((s) => s.id === activeId) ? activeId : null,
    restEndsAt: typeof raw.restEndsAt === "number" ? raw.restEndsAt : null,
    bodyWeights: asArray(raw.bodyWeights).map((b) => ({
      id: str(b.id, crypto.randomUUID()),
      dateISO: str(b.dateISO, new Date().toISOString()),
      weight: num(b.weight, 0),
      unit: b.unit === "kg" ? ("kg" as const) : ("lb" as const),
    })),
    habits: normalizeHabits(raw.habits),
    dailyLogs: normalizeDailyLogs(raw.dailyLogs),
    milestones: normalizeMilestones(raw.milestones),
    programStartISO: str(raw.programStartISO, new Date().toISOString()),
    // Anyone with data from before the welcome flow existed has already set the
    // app up by hand; don't send them back through it.
    onboardedAt:
      typeof raw.onboardedAt === "string"
        ? raw.onboardedAt
        : asArray(raw.sessions).length > 0
          ? str(raw.programStartISO, new Date().toISOString())
          : null,
    tipsSeen: isObject(raw.tipsSeen)
      ? Object.fromEntries(Object.entries(raw.tipsSeen).map(([k, v]) => [k, Boolean(v)]))
      : {},
  };
}

/**
 * v1 stored a unit per exercise, a bare day->template map, and no settings.
 * Lift the most common exercise unit up into settings and keep every session.
 */
function fromV1(raw: Loose): AppData {
  const templates = normalizeTemplates(raw.templates);
  const firstUnit = asArray(raw.templates)
    .flatMap((t) => asArray(t.exercises))
    .map((e) => e.unit)
    .find((u) => u === "kg" || u === "lb");
  const unit: Unit = firstUnit === "kg" ? "kg" : "lb";

  const settings = { ...defaultSettings(), unit };
  settings.barWeight = DEFAULT_BAR[unit];
  settings.plates = [...DEFAULT_PLATES[unit]];

  const ids = templates.map((t) => t.id);
  const days: Record<number, string | null> = {};
  const trainingDays: Record<number, boolean> = {};
  const rawSchedule = isObject(raw.schedule) ? raw.schedule : {};
  for (let day = 0; day < 7; day++) {
    const assigned = rawSchedule[day];
    days[day] = typeof assigned === "string" && ids.includes(assigned) ? assigned : null;
    trainingDays[day] = days[day] !== null;
  }

  const sessions = normalizeSessions(raw.sessions, unit);
  const activeId = typeof raw.activeSessionId === "string" ? raw.activeSessionId : null;

  return {
    version: DATA_VERSION,
    settings,
    templates: templates.length ? templates : buildDefaultData().templates,
    // v1 only had fixed day assignments, so stay in that mode after upgrading.
    schedule: {
      mode: "fixed",
      days,
      eveningDays: { 0: null, 1: null, 2: null, 3: null, 4: null, 5: null, 6: null },
      trainingDays,
      rotation: ids,
      rotationIndex: 0,
    },
    sessions,
    activeSessionId: sessions.some((s) => s.id === activeId) ? activeId : null,
    restEndsAt: null,
    bodyWeights: [],
    habits: buildHabits(),
    dailyLogs: {},
    milestones: buildMilestones(),
    programStartISO: new Date().toISOString(),
    onboardedAt: new Date().toISOString(),
    tipsSeen: {},
  };
}
