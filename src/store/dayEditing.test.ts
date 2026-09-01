import { describe, expect, it, beforeEach } from "vitest";
import { getData, replaceAll } from "./store";
import { buildDefaultData } from "./defaults";
import { bumpProtein, logBodyWeight, patchDailyLog, toggleHabit } from "./actions";
import { bodyWeightOn, dayLog, habitProgress, proteinTarget } from "./selectors";
import { checkInProgress } from "./day";
import { addDays, dayKey } from "../lib/misc";

/** A date `n` days back at midday, so a DST shift can't move which day it is. */
function daysAgo(n: number): Date {
  const d = addDays(new Date(), -n);
  d.setHours(12, 0, 0, 0);
  return d;
}

describe("editing a past day's check-in", () => {
  beforeEach(() => {
    localStorage.clear();
    replaceAll(buildDefaultData());
  });

  it("writes protein and water to the day being edited, not today", () => {
    const past = daysAgo(3);
    patchDailyLog(dayKey(past), { proteinGrams: 145, waterGlasses: 6 });

    expect(dayLog(getData(), dayKey(past)).proteinGrams).toBe(145);
    expect(dayLog(getData(), dayKey(past)).waterGlasses).toBe(6);
    expect(dayLog(getData(), dayKey(new Date())).proteinGrams).toBe(0);
  });

  it("keeps a journal entry against its own day", () => {
    const past = daysAgo(5);
    patchDailyLog(dayKey(past), { journal: "Slept badly, easy session." });

    expect(dayLog(getData(), dayKey(past)).journal).toBe("Slept badly, easy session.");
    expect(dayLog(getData(), dayKey(new Date())).journal).toBe("");
  });

  it("bumping protein on a past day accumulates on that day", () => {
    const past = daysAgo(2);
    bumpProtein(dayKey(past), 40);
    bumpProtein(dayKey(past), 30);

    expect(dayLog(getData(), dayKey(past)).proteinGrams).toBe(70);
  });

  it("ticks a habit on the day it happened, and counts it in that week", () => {
    // Yesterday is always in the same Monday-to-Sunday week as today except on
    // Monday, so anchor the assertion on yesterday's own week.
    const yesterday = daysAgo(1);
    const habit = getData().habits[0];

    toggleHabit(dayKey(yesterday), habit.id);

    const onYesterday = habitProgress(getData(), yesterday).find((h) => h.habit.id === habit.id)!;
    expect(onYesterday.doneOnDay).toBe(true);
    expect(onYesterday.count).toBe(1);

    const onToday = habitProgress(getData(), new Date()).find((h) => h.habit.id === habit.id)!;
    expect(onToday.doneOnDay).toBe(false);
  });

  it("untoggles a habit that was ticked by mistake", () => {
    const past = daysAgo(4);
    const habit = getData().habits[0];

    toggleHabit(dayKey(past), habit.id);
    toggleHabit(dayKey(past), habit.id);

    expect(habitProgress(getData(), past).find((h) => h.habit.id === habit.id)!.doneOnDay).toBe(
      false
    );
  });

  it("reports check-in progress for the day being viewed", () => {
    const past = daysAgo(6);
    logBodyWeight(180, daysAgo(10));
    const target = proteinTarget(getData(), past)!;

    expect(checkInProgress(getData(), past).completed).toBe(0);

    patchDailyLog(dayKey(past), {
      proteinGrams: target,
      waterGlasses: getData().settings.waterTarget,
    });

    const after = checkInProgress(getData(), past);
    expect(after.proteinDone).toBe(true);
    expect(after.waterDone).toBe(true);
    // Today is untouched by all of that.
    expect(checkInProgress(getData(), new Date()).completed).toBe(0);
  });
});

describe("body weight on a past day", () => {
  beforeEach(() => {
    localStorage.clear();
    replaceAll(buildDefaultData());
  });

  it("does not become the current weight when backdated", () => {
    logBodyWeight(180, daysAgo(1));
    logBodyWeight(200, daysAgo(30));

    // Everything that reads a "current" weight takes the front of this list.
    expect(getData().bodyWeights[0].weight).toBe(180);
    expect(proteinTarget(getData())).toBe(Math.round(180 * getData().settings.proteinPerUnit));
  });

  it("replaces the entry for a day rather than stacking another one", () => {
    const day = daysAgo(2);
    logBodyWeight(181, day);
    logBodyWeight(179.5, day);

    expect(getData().bodyWeights).toHaveLength(1);
    expect(bodyWeightOn(getData(), dayKey(day))!.weight).toBe(179.5);
  });

  it("targets protein against the weight you were at then", () => {
    logBodyWeight(200, daysAgo(60));
    logBodyWeight(180, daysAgo(1));
    const perUnit = getData().settings.proteinPerUnit;

    expect(proteinTarget(getData(), daysAgo(30))).toBe(Math.round(200 * perUnit));
    expect(proteinTarget(getData(), daysAgo(0))).toBe(Math.round(180 * perUnit));
  });

  it("falls back to the first weigh-in for days before it", () => {
    logBodyWeight(180, daysAgo(10));

    expect(proteinTarget(getData(), daysAgo(40))).toBe(
      Math.round(180 * getData().settings.proteinPerUnit)
    );
  });

  it("has no target at all until something is weighed", () => {
    expect(proteinTarget(getData(), daysAgo(3))).toBeNull();
    expect(bodyWeightOn(getData(), dayKey(daysAgo(3)))).toBeNull();
  });
});
