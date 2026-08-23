import type { AppData, Exercise, Settings, WorkoutTemplate } from "../types";
import { DEFAULT_BAR, DEFAULT_PLATES } from "../lib/units";
import { uid } from "../lib/misc";

export const DATA_VERSION = 2;

export function defaultSettings(): Settings {
  return {
    unit: "lb",
    barWeight: DEFAULT_BAR.lb,
    plates: [...DEFAULT_PLATES.lb],
    restSec: 90,
    restAfterFailSec: 180,
    warmupEnabled: true,
    deloadAfterFails: 3,
    deloadPercent: 10,
    theme: "system",
    vibrate: true,
  };
}

function ex(name: string, weight: number, overrides: Partial<Exercise> = {}): Exercise {
  return {
    id: uid(),
    name,
    sets: 5,
    targetReps: 5,
    weight,
    increment: 5,
    consecutiveFails: 0,
    usesBar: true,
    useWarmup: true,
    ...overrides,
  };
}

export function buildDefaultTemplates(): WorkoutTemplate[] {
  return [
    {
      id: uid(),
      name: "Workout A",
      exercises: [ex("Squat", 45), ex("Bench Press", 45), ex("Barbell Row", 65)],
    },
    {
      id: uid(),
      name: "Workout B",
      exercises: [
        ex("Squat", 45),
        ex("Overhead Press", 45),
        ex("Deadlift", 95, { sets: 1, increment: 10 }),
      ],
    },
  ];
}

export function buildDefaultData(): AppData {
  const templates = buildDefaultTemplates();
  const [a, b] = templates;
  return {
    version: DATA_VERSION,
    settings: defaultSettings(),
    templates,
    schedule: {
      mode: "rotating",
      days: { 0: null, 1: a.id, 2: null, 3: b.id, 4: null, 5: a.id, 6: null },
      trainingDays: { 0: false, 1: true, 2: false, 3: true, 4: false, 5: true, 6: false },
      rotation: [a.id, b.id],
      rotationIndex: 0,
    },
    sessions: [],
    activeSessionId: null,
    restEndsAt: null,
    bodyWeights: [],
  };
}
