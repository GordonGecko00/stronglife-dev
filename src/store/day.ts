import type { AppData, WorkoutSession, WorkoutTemplate } from "../types";
import { planForDate } from "./planning";
import { dayLog, habitProgress, proteinTarget } from "./selectors";
import { dayKey } from "../lib/misc";

export type TaskId = "session" | "sport" | "checkin";
export type TaskState = "todo" | "partial" | "done" | "na";

export interface DayTask {
  id: TaskId;
  label: string;
  detail: string;
  state: TaskState;
  /** 0–1, for the ring. */
  progress: number;
}

export interface CheckInProgress {
  proteinDone: boolean;
  waterDone: boolean;
  habitsDone: number;
  habitsTotal: number;
  completed: number;
  total: number;
}

/** How far through the daily check-in you are: protein, water, and each daily habit. */
export function checkInProgress(d: AppData, date = new Date()): CheckInProgress {
  const key = dayKey(date);
  const log = dayLog(d, key);
  const target = proteinTarget(d);
  const daily = habitProgress(d, date).filter((h) => h.habit.cadence === "daily");

  const proteinDone = target !== null && log.proteinGrams >= target;
  const waterDone = log.waterGlasses >= d.settings.waterTarget;
  const habitsDone = daily.filter((h) => h.doneToday).length;

  return {
    proteinDone,
    waterDone,
    habitsDone,
    habitsTotal: daily.length,
    completed: (proteinDone ? 1 : 0) + (waterDone ? 1 : 0) + habitsDone,
    total: 2 + daily.length,
  };
}

function sessionsToday(d: AppData, date: Date): WorkoutSession[] {
  const key = dayKey(date);
  return d.sessions.filter(
    (s) => s.finishedAt !== null && dayKey(s.finishedAt ?? s.dateISO) === key
  );
}

/** The three things a day can contain, with how far along each one is. */
export function dayTasks(d: AppData, date = new Date()): DayTask[] {
  const plan = planForDate(d, date);
  const logged = sessionsToday(d, date);
  const check = checkInProgress(d, date);

  const trainingDone = logged.some((s) => s.kind !== "sport");
  const sportDone = logged.some((s) => s.kind === "sport");

  const tasks: DayTask[] = [];

  tasks.push({
    id: "session",
    label: "Morning session",
    detail: plan.morning ? plan.morning.name : "Rest day",
    state: plan.morning ? (trainingDone ? "done" : "todo") : trainingDone ? "done" : "na",
    progress: trainingDone ? 1 : 0,
  });

  tasks.push({
    id: "sport",
    label: plan.evening ? plan.evening.name : "Evening",
    detail: plan.evening ? "Log it after you play" : "Nothing on",
    state: plan.evening ? (sportDone ? "done" : "todo") : sportDone ? "done" : "na",
    progress: sportDone ? 1 : 0,
  });

  tasks.push({
    id: "checkin",
    label: "Daily check-in",
    detail: `${check.completed} of ${check.total}`,
    state:
      check.completed === 0 ? "todo" : check.completed >= check.total ? "done" : "partial",
    progress: check.total ? check.completed / check.total : 0,
  });

  return tasks;
}

export type NextUpKind = "resume" | "session" | "sport" | "checkin" | "rest";

export interface NextUp {
  kind: NextUpKind;
  template: WorkoutTemplate | null;
  title: string;
  subtitle: string;
  /** The label for the single primary button. */
  action: string;
}

/**
 * The one thing worth doing right now.
 *
 * Ordered by what's actually in front of you: an unfinished session first, then
 * the morning work, then the evening sport once it's late enough to matter, and
 * the check-in as the fallback that's always available.
 */
export function nextUp(d: AppData, date = new Date()): NextUp {
  const plan = planForDate(d, date);
  const logged = sessionsToday(d, date);
  const check = checkInProgress(d, date);
  const hour = date.getHours();

  const active = d.activeSessionId
    ? d.sessions.find((s) => s.id === d.activeSessionId) ?? null
    : null;
  if (active) {
    return {
      kind: "resume",
      template: null,
      title: active.templateName,
      subtitle: "You left this running",
      action: "Resume session",
    };
  }

  const trainingDone = logged.some((s) => s.kind !== "sport");
  const sportDone = logged.some((s) => s.kind === "sport");

  // Once the evening slot is close, it takes priority over an unfinished morning.
  const eveningIsNow = plan.evening && !sportDone && hour >= d.settings.recovery.lateHour - 2;
  if (eveningIsNow && plan.evening) {
    return {
      kind: "sport",
      template: plan.evening,
      title: plan.evening.name,
      subtitle: "Tonight — log it when you're done",
      action: `Log ${plan.evening.name}`,
    };
  }

  if (plan.morning && !trainingDone) {
    return {
      kind: "session",
      template: plan.morning,
      title: plan.morning.name,
      subtitle: summarize(plan.morning),
      action: `Start ${plan.morning.name}`,
    };
  }

  if (plan.evening && !sportDone) {
    return {
      kind: "sport",
      template: plan.evening,
      title: plan.evening.name,
      subtitle: "Later tonight",
      action: `Log ${plan.evening.name}`,
    };
  }

  if (check.completed < check.total) {
    return {
      kind: "checkin",
      template: null,
      title: "Daily check-in",
      subtitle: `${check.total - check.completed} left — protein, water, habits`,
      action: "Open check-in",
    };
  }

  return {
    kind: "rest",
    template: null,
    title: "All done for today",
    subtitle: trainingDone ? "Session logged and check-in complete" : "Nothing scheduled — rest up",
    action: "",
  };
}

/** Shape of the session, not its contents — the lineup is listed right below. */
function summarize(template: WorkoutTemplate): string {
  const count = template.exercises.length;
  const workSets = template.exercises
    .filter((e) => e.tracking === "reps")
    .reduce((total, e) => total + e.sets, 0);
  const minutes = template.exercises.reduce((total, e) => total + e.targetMinutes, 0);

  const parts = [`${count} exercise${count === 1 ? "" : "s"}`];
  if (workSets > 0) parts.push(`${workSets} work sets`);
  if (minutes > 0) parts.push(`${minutes} min`);
  return parts.join(" · ");
}

export function greeting(date = new Date()): string {
  const hour = date.getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}
