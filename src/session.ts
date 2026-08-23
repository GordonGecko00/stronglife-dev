import type { AppData, WorkoutSession, WorkoutTemplate } from "./types";
import { update } from "./store";

const DELOAD_AFTER_FAILS = 3;
const DELOAD_FACTOR = 0.9;

export function startSession(template: WorkoutTemplate): string {
  const id = crypto.randomUUID();
  update((d) => {
    const session: WorkoutSession = {
      id,
      templateId: template.id,
      templateName: template.name,
      dateISO: new Date().toISOString(),
      startedAt: Date.now(),
      finishedAt: null,
      exercises: template.exercises.map((e) => ({
        exerciseId: e.id,
        name: e.name,
        targetReps: e.targetReps,
        unit: e.unit,
        weight: e.weight,
        increment: e.increment,
        sets: Array.from({ length: e.sets }, () => ({
          reps: 0,
          weight: e.weight,
          done: false,
        })),
      })),
    };
    d.sessions.unshift(session);
    d.activeSessionId = id;
  });
  return id;
}

export function getActiveSession(d: AppData): WorkoutSession | null {
  if (!d.activeSessionId) return null;
  return d.sessions.find((s) => s.id === d.activeSessionId) ?? null;
}

export function logSet(sessionId: string, exerciseIndex: number, setIndex: number, reps: number): void {
  update((d) => {
    const session = d.sessions.find((s) => s.id === sessionId);
    if (!session) return;
    const set = session.exercises[exerciseIndex]?.sets[setIndex];
    if (!set) return;
    set.reps = reps;
    set.done = true;
  });
}

/** Finish the session, apply StrongLifts-style progression to each exercise's template entry. */
export function finishSession(sessionId: string): void {
  update((d) => {
    const session = d.sessions.find((s) => s.id === sessionId);
    if (!session) return;
    session.finishedAt = Date.now();
    d.activeSessionId = null;

    const template = d.templates.find((t) => t.id === session.templateId);
    if (!template) return;

    for (const log of session.exercises) {
      const exercise = template.exercises.find((e) => e.id === log.exerciseId);
      if (!exercise) continue;
      const allSetsHit = log.sets.every((s) => s.reps >= log.targetReps);
      if (allSetsHit) {
        exercise.weight = round2_5(exercise.weight + exercise.increment);
        exercise.consecutiveFails = 0;
      } else {
        exercise.consecutiveFails += 1;
        if (exercise.consecutiveFails >= DELOAD_AFTER_FAILS) {
          exercise.weight = round2_5(exercise.weight * DELOAD_FACTOR);
          exercise.consecutiveFails = 0;
        }
      }
    }
  });
}

export function cancelSession(sessionId: string): void {
  update((d) => {
    d.sessions = d.sessions.filter((s) => s.id !== sessionId);
    if (d.activeSessionId === sessionId) d.activeSessionId = null;
  });
}

function round2_5(n: number): number {
  return Math.max(0, Math.round(n / 2.5) * 2.5);
}
