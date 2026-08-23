import type { AppData, Exercise, WorkoutTemplate } from "../types";

function ex(
  name: string,
  weight: number,
  opts: Partial<Pick<Exercise, "sets" | "targetReps" | "increment">> = {}
): Exercise {
  return {
    id: crypto.randomUUID(),
    name,
    sets: opts.sets ?? 5,
    targetReps: opts.targetReps ?? 5,
    weight,
    increment: opts.increment ?? 5,
    unit: "lb",
    consecutiveFails: 0,
  };
}

export function buildDefaultTemplates(): WorkoutTemplate[] {
  const a: WorkoutTemplate = {
    id: crypto.randomUUID(),
    name: "Workout A",
    exercises: [ex("Squat", 45), ex("Bench Press", 45), ex("Barbell Row", 45)],
  };
  const b: WorkoutTemplate = {
    id: crypto.randomUUID(),
    name: "Workout B",
    exercises: [
      ex("Squat", 45),
      ex("Overhead Press", 45),
      ex("Deadlift", 95, { sets: 1, targetReps: 5, increment: 10 }),
    ],
  };
  return [a, b];
}

export function buildDefaultData(): AppData {
  const [a, b] = buildDefaultTemplates();
  return {
    templates: [a, b],
    // Default Mon/Wed/Fri split, editable on the Schedule screen.
    schedule: { 0: null, 1: a.id, 2: null, 3: b.id, 4: null, 5: a.id, 6: null },
    sessions: [],
    activeSessionId: null,
  };
}
