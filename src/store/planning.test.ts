import { describe, expect, it } from "vitest";
import { buildDefaultData } from "./defaults";
import { lateNightBefore, planForDate, summarizeWeek, weekPlan } from "./planning";
import type { AppData, WorkoutSession, WorkoutTemplate } from "../types";

function setup(): { data: AppData; byName: (n: string) => WorkoutTemplate } {
  const data = buildDefaultData();
  const byName = (n: string) => data.templates.find((t) => t.name === n)!;
  return { data, byName };
}

/** A finished session on `date` at `hour` local time. */
function logSession(
  data: AppData,
  template: WorkoutTemplate,
  date: Date,
  hour: number,
  durationMin = 90
): void {
  const start = new Date(date);
  start.setHours(hour, 0, 0, 0);
  const end = new Date(start.getTime() + durationMin * 60_000);
  const session: WorkoutSession = {
    id: `s-${start.getTime()}`,
    templateId: template.id,
    templateName: template.name,
    kind: template.kind,
    dateISO: start.toISOString(),
    startedAt: start.getTime(),
    finishedAt: end.getTime(),
    unit: "lb",
    note: "",
    effort: null,
    exercises: [],
  };
  data.sessions.unshift(session);
}

/** A weekday in the future/past, anchored so tests don't depend on "today". */
function dateForWeekday(weekday: number, weeksAgo = 0): Date {
  const d = new Date();
  d.setHours(9, 0, 0, 0);
  const shift = (d.getDay() - weekday + 7) % 7;
  d.setDate(d.getDate() - shift - weeksAgo * 7);
  return d;
}

describe("late-night detection", () => {
  it("finds a hockey session logged at 9pm the night before", () => {
    const { data, byName } = setup();
    const today = dateForWeekday(new Date().getDay());
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    logSession(data, byName("Hockey"), yesterday, 21);

    const late = lateNightBefore(data, today);
    expect(late).toMatchObject({ source: "logged", name: "Hockey" });
  });

  it("ignores a session that finished well before the cutoff", () => {
    const { data, byName } = setup();
    const today = dateForWeekday(new Date().getDay());
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    logSession(data, byName("Full Body"), yesterday, 7, 60);

    expect(lateNightBefore(data, today)).toBeNull();
  });

  it("falls back to a scheduled hockey night when nothing is logged yet", () => {
    const { data } = setup();
    // Hockey is scheduled Tuesday night by default, so Wednesday morning is affected.
    const wednesday = dateForWeekday(3);
    const late = lateNightBefore(data, wednesday);
    expect(late).toMatchObject({ source: "scheduled", name: "Hockey" });
  });

  it("respects the rule being switched off", () => {
    const { data, byName } = setup();
    data.settings.recovery.enabled = false;
    const today = dateForWeekday(new Date().getDay());
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    logSession(data, byName("Hockey"), yesterday, 21);

    expect(lateNightBefore(data, today)).toBeNull();
  });

  it("honours a custom late-night cutoff", () => {
    const { data, byName } = setup();
    const today = dateForWeekday(new Date().getDay());
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    logSession(data, byName("Hockey"), yesterday, 17, 60); // 5-6pm

    expect(lateNightBefore(data, today)).toBeNull();
    data.settings.recovery.lateHour = 16;
    expect(lateNightBefore(data, today)).not.toBeNull();
  });
});

describe("morning adjustment after hockey", () => {
  it("swaps a strength morning for active recovery", () => {
    const { data } = setup();
    // Default schedule: hockey Tue night, Upper Body Wed morning.
    const wednesday = dateForWeekday(3);
    const plan = planForDate(data, wednesday);

    expect(plan.scheduled?.name).toBe("Upper Body");
    expect(plan.morning?.name).toBe("Active Recovery");
    expect(plan.status).toBe("adjusted");
    expect(plan.reason).toContain("Hockey");
  });

  it("can be set to skip the morning entirely", () => {
    const { data } = setup();
    data.settings.recovery.action = "skip";
    const plan = planForDate(data, dateForWeekday(3));

    expect(plan.morning).toBeNull();
    expect(plan.status).toBe("skipped");
  });

  it("leaves an already-easy morning alone", () => {
    const { data, byName } = setup();
    // Make Saturday morning yoga follow a Friday hockey night.
    data.schedule.eveningDays[5] = byName("Hockey").id;
    const saturday = dateForWeekday(6);
    const plan = planForDate(data, saturday);

    expect(plan.morning?.name).toBe("Yoga / Pilates");
    expect(plan.status).toBe("planned");
  });

  it("leaves mornings alone when no hockey preceded them", () => {
    const { data } = setup();
    // Monday morning follows Sunday, which has no evening session.
    const monday = dateForWeekday(1);
    const plan = planForDate(data, monday);

    expect(plan.morning?.name).toBe("Full Body");
    expect(plan.status).toBe("planned");
    expect(plan.reason).toBeNull();
  });

  it("prefers what actually happened over what was scheduled", () => {
    const { data, byName } = setup();
    const wednesday = dateForWeekday(3);
    const tuesday = new Date(wednesday);
    tuesday.setDate(tuesday.getDate() - 1);

    // Hockey was scheduled Tuesday but the user did a morning walk instead.
    logSession(data, byName("Active Recovery"), tuesday, 7, 30);

    const plan = planForDate(data, wednesday);
    expect(plan.morning?.name).toBe("Upper Body");
    expect(plan.status).toBe("planned");
  });
});

describe("week plan", () => {
  it("covers Monday through Sunday", () => {
    const { data } = setup();
    const plans = weekPlan(data);
    expect(plans).toHaveLength(7);
    expect(plans[0].date.getDay()).toBe(1);
    expect(plans[6].date.getDay()).toBe(0);
  });

  it("counts planned strength sessions and hockey nights", () => {
    const { data } = setup();
    const summary = summarizeWeek(weekPlan(data));

    // The stated plan lifts Mon/Wed/Fri and skates Tue/Thu nights, so BOTH the
    // Wednesday and Friday lifts land the morning after hockey and get swapped.
    // Only Monday survives as a strength day — the collision this view exists
    // to make visible.
    expect(summary.strengthPlanned).toBe(1);
    expect(summary.sportPlanned).toBe(2);
    expect(summary.adjustments).toBe(2);
  });

  it("shows every adjustment when hockey runs four nights", () => {
    const { data, byName } = setup();
    const hockey = byName("Hockey").id;
    data.schedule.eveningDays = { 0: hockey, 1: null, 2: hockey, 3: null, 4: hockey, 5: null, 6: hockey };

    const summary = summarizeWeek(weekPlan(data));
    expect(summary.sportPlanned).toBe(4);
    // Mon (after Sun hockey) and Wed (after Tue) both get swapped; Fri follows Thu hockey too.
    expect(summary.adjustments).toBe(3);
  });
});
