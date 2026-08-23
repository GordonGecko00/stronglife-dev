import type { AppData, WorkoutSession, WorkoutTemplate } from "../types";
import { addDays, dayKey, startOfDay } from "../lib/misc";

export type PlanStatus = "planned" | "adjusted" | "skipped" | "rest" | "done";

export interface DayPlan {
  date: Date;
  key: string;
  /** What the schedule says should happen in the morning. */
  scheduled: WorkoutTemplate | null;
  /** What should actually happen, after the late-night rule is applied. */
  morning: WorkoutTemplate | null;
  evening: WorkoutTemplate | null;
  status: PlanStatus;
  /** Human-readable explanation when the plan was changed. */
  reason: string | null;
  /** Sessions already logged on this day. */
  logged: WorkoutSession[];
}

function templateById(d: AppData, id: string | null | undefined): WorkoutTemplate | null {
  if (!id) return null;
  return d.templates.find((t) => t.id === id) ?? null;
}

/** What the plain schedule says for a weekday, ignoring any adjustments. */
export function scheduledMorning(d: AppData, day: number): WorkoutTemplate | null {
  if (d.schedule.mode === "fixed") return templateById(d, d.schedule.days[day]);

  if (!d.schedule.trainingDays[day]) return null;
  const rotation = d.schedule.rotation.filter((id) => d.templates.some((t) => t.id === id));
  if (rotation.length === 0) return null;
  return templateById(d, rotation[d.schedule.rotationIndex % rotation.length]);
}

export function scheduledEvening(d: AppData, day: number): WorkoutTemplate | null {
  return templateById(d, d.schedule.eveningDays[day]);
}

function sessionsOn(d: AppData, key: string): WorkoutSession[] {
  return d.sessions.filter(
    (s) => s.finishedAt !== null && dayKey(s.finishedAt ?? s.dateISO) === key
  );
}

/**
 * Did a late-night effort happen the evening before `date`?
 *
 * Prefers what was actually logged; falls back to the schedule so the week view
 * can predict the knock-on effect of hockey nights that haven't happened yet.
 */
export function lateNightBefore(
  d: AppData,
  date: Date
): { source: "logged" | "scheduled"; name: string } | null {
  const rule = d.settings.recovery;
  if (!rule.enabled) return null;

  const yesterday = addDays(startOfDay(date), -1);
  const key = dayKey(yesterday);

  for (const session of sessionsOn(d, key)) {
    const finished = new Date(session.finishedAt ?? session.dateISO);
    const startedLate = new Date(session.startedAt).getHours() >= rule.lateHour;
    if (startedLate || finished.getHours() >= rule.lateHour) {
      return { source: "logged", name: session.templateName };
    }
  }

  // Nothing logged (yet) — fall back to a scheduled evening session.
  if (sessionsOn(d, key).length === 0) {
    const evening = scheduledEvening(d, yesterday.getDay());
    if (evening) return { source: "scheduled", name: evening.name };
  }

  return null;
}

/** The full picture for one day, adjustments included. */
export function planForDate(d: AppData, date: Date): DayPlan {
  const key = dayKey(date);
  const day = date.getDay();
  const scheduled = scheduledMorning(d, day);
  const evening = scheduledEvening(d, day);
  const logged = sessionsOn(d, key);

  let morning = scheduled;
  let status: PlanStatus = scheduled ? "planned" : "rest";
  let reason: string | null = null;

  const late = lateNightBefore(d, date);
  const rule = d.settings.recovery;

  // Only adjust a hard morning; recovery days are already easy.
  const worthAdjusting =
    scheduled !== null && (scheduled.kind === "strength" || scheduled.kind === "conditioning");

  if (late && worthAdjusting) {
    const suffix = late.source === "scheduled" ? " (scheduled)" : "";
    if (rule.action === "skip") {
      morning = null;
      status = "skipped";
      reason = `${late.name} last night${suffix} — rest this morning`;
    } else {
      const swap = templateById(d, rule.recoveryTemplateId);
      morning = swap ?? scheduled;
      status = swap ? "adjusted" : "planned";
      reason = swap
        ? `${late.name} last night${suffix} — swapped to ${swap.name}`
        : `${late.name} last night${suffix} — take it easy`;
    }
  }

  if (logged.length > 0 && logged.some((s) => s.kind !== "sport")) status = "done";

  return { date, key, scheduled, morning, evening, status, reason, logged };
}

/** Seven days starting from Monday of the week containing `from`. */
export function weekPlan(d: AppData, from = new Date()): DayPlan[] {
  const monday = startOfDay(from);
  monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
  return Array.from({ length: 7 }, (_, i) => planForDate(d, addDays(monday, i)));
}

export interface WeekSummary {
  strengthPlanned: number;
  strengthDone: number;
  sportPlanned: number;
  sportDone: number;
  adjustments: number;
  minutes: number;
}

export function summarizeWeek(plans: DayPlan[]): WeekSummary {
  let strengthPlanned = 0;
  let strengthDone = 0;
  let sportPlanned = 0;
  let sportDone = 0;
  let adjustments = 0;
  let minutes = 0;

  for (const plan of plans) {
    if (plan.morning?.kind === "strength") strengthPlanned += 1;
    if (plan.evening?.kind === "sport") sportPlanned += 1;
    if (plan.status === "adjusted" || plan.status === "skipped") adjustments += 1;

    for (const session of plan.logged) {
      if (session.kind === "strength") strengthDone += 1;
      if (session.kind === "sport") sportDone += 1;
      minutes += session.exercises.reduce((sum, ex) => sum + (ex.minutes ?? 0), 0);
    }
  }

  return { strengthPlanned, strengthDone, sportPlanned, sportDone, adjustments, minutes };
}
