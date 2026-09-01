import { describe, expect, it, beforeEach } from "vitest";
import { getData, replaceAll } from "./store";
import { completeOnboarding, ensureSportTemplate } from "./actions";
import { migrate } from "./migrate";

/** A program carried over from the barbell-only versions: no sport session. */
function liftingOnlyProgram() {
  return migrate({
    version: 2,
    settings: { unit: "lb" },
    templates: [
      {
        id: "t1",
        name: "Workout A",
        exercises: [
          { id: "e1", name: "Squat", sets: 5, targetReps: 5, weight: 185, increment: 5 },
        ],
      },
    ],
    schedule: { mode: "fixed", days: { 1: "t1" } },
    sessions: [{ id: "s1", templateId: "t1", templateName: "Workout A", finishedAt: Date.now() }],
    bodyWeights: [],
  });
}

describe("upgrading from a program with no sport", () => {
  beforeEach(() => {
    localStorage.clear();
    replaceAll(liftingOnlyProgram());
  });

  it("keeps the user's own workouts and adds no sport session by itself", () => {
    const d = getData();
    expect(d.templates.map((t) => t.name)).toEqual(["Workout A"]);
    expect(d.templates.some((t) => t.kind === "sport")).toBe(false);
  });

  it("creates one on demand, once", () => {
    const first = ensureSportTemplate("Hockey", 90);
    const second = ensureSportTemplate("Hockey", 90);

    expect(first).toBe(second);
    const sports = getData().templates.filter((t) => t.kind === "sport");
    expect(sports).toHaveLength(1);
    expect(sports[0].name).toBe("Hockey");
    expect(sports[0].slot).toBe("pm");
    expect(sports[0].exercises[0].targetMinutes).toBe(90);
  });

  it("honours a different sport name", () => {
    ensureSportTemplate("Soccer", 60);
    expect(getData().templates.find((t) => t.kind === "sport")?.name).toBe("Soccer");
  });

  it("makes onboarding's chosen nights actually stick", () => {
    completeOnboarding({
      unit: "lb",
      bodyWeight: 180,
      sportDays: [2, 4],
      sportMinutes: 75,
      recoveryAction: "recovery",
      lateHour: 19,
    });

    const d = getData();
    const sport = d.templates.find((t) => t.kind === "sport");
    expect(sport, "a sport session should have been created").toBeTruthy();
    expect(d.schedule.eveningDays[2]).toBe(sport!.id);
    expect(d.schedule.eveningDays[4]).toBe(sport!.id);
    expect(d.schedule.eveningDays[1]).toBeNull();
    expect(sport!.exercises[0].targetMinutes).toBe(75);
  });

  it("does not invent a sport session when no nights are picked", () => {
    completeOnboarding({
      unit: "lb",
      bodyWeight: null,
      sportDays: [],
      sportMinutes: 90,
      recoveryAction: "off",
      lateHour: 19,
    });

    expect(getData().templates.some((t) => t.kind === "sport")).toBe(false);
  });

  it("leaves an existing sport session alone", () => {
    ensureSportTemplate("Hockey", 90);
    const before = getData().templates.find((t) => t.kind === "sport")!.id;

    completeOnboarding({
      unit: "lb",
      bodyWeight: null,
      sportDays: [2],
      sportMinutes: 60,
      recoveryAction: "recovery",
      lateHour: 19,
    });

    const sports = getData().templates.filter((t) => t.kind === "sport");
    expect(sports).toHaveLength(1);
    expect(sports[0].id).toBe(before);
  });
});
