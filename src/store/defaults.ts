import type {
  AppData,
  Exercise,
  Habit,
  Milestone,
  Settings,
  TrackingMode,
  WorkoutTemplate,
} from "../types";
import { DEFAULT_BAR, DEFAULT_PLATES } from "../lib/units";
import { uid } from "../lib/misc";

export const DATA_VERSION = 3;

export function defaultSettings(): Settings {
  return {
    unit: "lb",
    barWeight: DEFAULT_BAR.lb,
    plates: [...DEFAULT_PLATES.lb],
    restSec: 75,
    restAfterFailSec: 120,
    warmupEnabled: true,
    deloadAfterFails: 3,
    deloadPercent: 10,
    theme: "system",
    vibrate: true,
    proteinPerUnit: 0.8,
    waterTarget: 9,
    recovery: {
      enabled: true,
      lateHour: 19,
      action: "recovery",
      recoveryTemplateId: null,
    },
  };
}

function baseExercise(name: string, tracking: TrackingMode): Exercise {
  return {
    id: uid(),
    name,
    tracking,
    sets: 3,
    targetReps: 8,
    targetRepsMax: 10,
    weight: 45,
    increment: 5,
    consecutiveFails: 0,
    usesBar: false,
    useWarmup: false,
    targetMinutes: 0,
    hint: "",
  };
}

function lift(name: string, weight: number, options: Partial<Exercise> = {}): Exercise {
  return {
    ...baseExercise(name, "reps"),
    weight,
    usesBar: true,
    useWarmup: true,
    ...options,
  };
}

function timed(name: string, minutes: number, hint = ""): Exercise {
  return { ...baseExercise(name, "duration"), targetMinutes: minutes, hint };
}

function checkbox(name: string, hint = ""): Exercise {
  return { ...baseExercise(name, "done"), hint };
}

/**
 * The user's own six-day plan: strength Mon/Wed/Fri, conditioning Thu,
 * recovery Tue/Sat, plus hockey as an evening session.
 */
export function buildProgram(): WorkoutTemplate[] {
  return [
    {
      id: uid(),
      name: "Full Body",
      kind: "strength",
      slot: "am",
      exercises: [
        lift("Squat", 45),
        lift("Bench Press", 45),
        lift("Bent-over Row", 65),
        checkbox("Plank", "3 × 45–60s hold"),
      ],
    },
    {
      id: uid(),
      name: "Active Recovery",
      kind: "recovery",
      slot: "am",
      exercises: [
        timed("Brisk Walk or Light Cycle", 30),
        timed("Mobility & Stretching", 10, "Hips, ankles, thoracic spine"),
      ],
    },
    {
      id: uid(),
      name: "Upper Body",
      kind: "strength",
      slot: "am",
      exercises: [
        lift("Overhead Press", 45),
        lift("Pull-ups", 0, { usesBar: false, useWarmup: false, increment: 2.5, hint: "Assisted if needed" }),
        lift("Dumbbell Curls", 20, { usesBar: false, useWarmup: false, increment: 2.5 }),
        lift("Tricep Dips", 0, { usesBar: false, useWarmup: false, increment: 2.5, hint: "Bodyweight or assisted" }),
      ],
    },
    {
      id: uid(),
      name: "Cardio & Core",
      kind: "conditioning",
      slot: "am",
      exercises: [
        timed("HIIT", 20, "Treadmill intervals"),
        { ...baseExercise("Russian Twists", "reps"), sets: 3, targetReps: 20, targetRepsMax: 30, weight: 25, increment: 5 },
        { ...baseExercise("Leg Raises", "reps"), sets: 3, targetReps: 10, targetRepsMax: 15, weight: 0, increment: 0 },
        checkbox("Plank", "3 × 45–60s hold"),
      ],
    },
    {
      id: uid(),
      name: "Lower Body",
      kind: "strength",
      slot: "am",
      exercises: [
        lift("Deadlift", 95, { increment: 10 }),
        lift("Lunges", 30, { usesBar: false, useWarmup: false }),
        lift("Leg Press", 180, { usesBar: false, useWarmup: false, increment: 10 }),
        lift("Calf Raises", 90, { usesBar: false, useWarmup: false, targetReps: 12, targetRepsMax: 15 }),
      ],
    },
    {
      id: uid(),
      name: "Yoga / Pilates",
      kind: "recovery",
      slot: "am",
      exercises: [timed("Yoga or Pilates", 35, "Flexibility & balance")],
    },
    {
      id: uid(),
      name: "Hockey",
      kind: "sport",
      slot: "pm",
      exercises: [timed("Ice Time", 90, "9pm skate")],
    },
  ];
}

export function buildHabits(): Habit[] {
  const daily = (name: string, group: Habit["group"]): Habit => ({
    id: uid(),
    name,
    group,
    cadence: "daily",
    weeklyTarget: 7,
    archived: false,
  });
  const weekly = (name: string, group: Habit["group"], target: number): Habit => ({
    id: uid(),
    name,
    group,
    cadence: "weekly",
    weeklyTarget: target,
    archived: false,
  });

  return [
    daily("Ate to plan", "nutrition"),
    daily("Morning meditation", "mind"),
    daily("Evening reflection", "mind"),
    weekly("Journaling", "mind", 3),
    weekly("Nature walk", "mind", 2),
    weekly("Community / spiritual group", "other", 1),
  ];
}

export function buildMilestones(): Milestone[] {
  const make = (month: number, title: string): Milestone => ({
    id: uid(),
    month,
    title,
    done: false,
  });
  return [
    make(1, "Follow the workout and meal plan consistently"),
    make(1, "Integrate daily mindfulness practice"),
    make(2, "Increase workout intensity or duration slightly"),
    make(2, "Explore new healthy recipes"),
    make(2, "Attend a local yoga or meditation class"),
    make(3, "Hold consistency in workouts and nutrition"),
    make(3, "Deepen mindfulness practice"),
    make(3, "Set long-term wellness goals beyond the 3-month plan"),
  ];
}

export function buildDefaultData(): AppData {
  const templates = buildProgram();
  const byName = (name: string) => templates.find((t) => t.name === name)!;

  const fullBody = byName("Full Body");
  const activeRecovery = byName("Active Recovery");
  const upper = byName("Upper Body");
  const cardio = byName("Cardio & Core");
  const lower = byName("Lower Body");
  const yoga = byName("Yoga / Pilates");
  const hockey = byName("Hockey");

  const settings = defaultSettings();
  settings.recovery.recoveryTemplateId = activeRecovery.id;

  return {
    version: DATA_VERSION,
    settings,
    templates,
    schedule: {
      mode: "fixed",
      days: {
        0: null,
        1: fullBody.id,
        2: activeRecovery.id,
        3: upper.id,
        4: cardio.id,
        5: lower.id,
        6: yoga.id,
      },
      // Hockey is at least twice a week; Tue and Thu nights to start.
      eveningDays: { 0: null, 1: null, 2: hockey.id, 3: null, 4: hockey.id, 5: null, 6: null },
      trainingDays: { 0: false, 1: true, 2: true, 3: true, 4: true, 5: true, 6: true },
      rotation: [fullBody.id, upper.id, lower.id],
      rotationIndex: 0,
    },
    sessions: [],
    activeSessionId: null,
    restEndsAt: null,
    bodyWeights: [],
    habits: buildHabits(),
    dailyLogs: {},
    milestones: buildMilestones(),
    programStartISO: new Date().toISOString(),
  };
}
