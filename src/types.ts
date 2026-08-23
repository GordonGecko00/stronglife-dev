export type Unit = "lb" | "kg";

export interface Exercise {
  id: string;
  name: string;
  sets: number;
  targetReps: number;
  weight: number;
  increment: number;
  unit: Unit;
  /** Consecutive sessions where this exercise failed to hit all target reps. */
  consecutiveFails: number;
}

export interface WorkoutTemplate {
  id: string;
  name: string;
  exercises: Exercise[];
}

/** Maps day-of-week (0 = Sunday .. 6 = Saturday) to a template id, or null for rest day. */
export type WeeklySchedule = Record<number, string | null>;

export interface SetLog {
  reps: number;
  weight: number;
  done: boolean;
}

export interface ExerciseLog {
  exerciseId: string;
  name: string;
  targetReps: number;
  unit: Unit;
  sets: SetLog[];
  /** Weight used going into this exercise; may be bumped for next time on completion. */
  weight: number;
  increment: number;
}

export interface WorkoutSession {
  id: string;
  templateId: string;
  templateName: string;
  dateISO: string;
  startedAt: number;
  finishedAt: number | null;
  exercises: ExerciseLog[];
}

export interface AppData {
  templates: WorkoutTemplate[];
  schedule: WeeklySchedule;
  sessions: WorkoutSession[];
  activeSessionId: string | null;
}
