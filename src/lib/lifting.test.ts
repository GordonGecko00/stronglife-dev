import { describe, expect, it } from "vitest";
import { computePlates, groupPlates, nearestLoadable } from "./plates";
import { warmupSets } from "./warmup";
import { applyProgression, estimateOneRepMax, hitAllTargets } from "./strength";
import { convertRounded } from "./units";
import { defaultSettings } from "../store/defaults";
import type { ExerciseLog, SetLog } from "../types";

const LB_PLATES = [45, 35, 25, 10, 5, 2.5];

describe("plate calculator", () => {
  it("loads a standard 135 as one 45 per side", () => {
    const load = computePlates(135, 45, LB_PLATES);
    expect(load.perSide).toEqual([45]);
    expect(load.achieved).toBe(135);
    expect(load.short).toBe(0);
  });

  it("loads 225 as two 45s per side", () => {
    expect(computePlates(225, 45, LB_PLATES).perSide).toEqual([45, 45]);
  });

  it("combines denominations for an awkward weight", () => {
    // 72.5 per side = 45 + 25 + 2.5
    const load = computePlates(190, 45, LB_PLATES);
    expect(load.perSide).toEqual([45, 25, 2.5]);
    expect(load.achieved).toBe(190);
    expect(load.short).toBe(0);
  });

  it("falls short rather than rounding up past the target", () => {
    // 51.25 per side is unreachable without a 1.25 plate.
    const load = computePlates(147.5, 45, LB_PLATES);
    expect(load.achieved).toBe(145);
    expect(load.short).toBe(2.5);
  });

  it("reports the shortfall when a weight cannot be made", () => {
    // 46 lb needs 0.5 per side and the smallest plate is 2.5.
    const load = computePlates(46, 45, LB_PLATES);
    expect(load.perSide).toEqual([]);
    expect(load.achieved).toBe(45);
    expect(load.short).toBe(1);
  });

  it("returns an empty bar for anything at or under bar weight", () => {
    expect(computePlates(45, 45, LB_PLATES).perSide).toEqual([]);
    expect(computePlates(20, 45, LB_PLATES).perSide).toEqual([]);
  });

  it("respects a reduced plate inventory", () => {
    const load = computePlates(135, 45, [25, 10, 5]);
    expect(load.perSide).toEqual([25, 10, 10]);
    expect(load.achieved).toBe(135);
  });

  it("groups repeated plates for display", () => {
    expect(groupPlates([45, 45, 25])).toEqual([
      { plate: 45, count: 2 },
      { plate: 25, count: 1 },
    ]);
  });

  it("never returns more than the requested weight", () => {
    for (const target of [45, 47.5, 95, 132.5, 185, 313]) {
      expect(nearestLoadable(target, 45, LB_PLATES)).toBeLessThanOrEqual(target);
    }
  });
});

describe("warmup ramp", () => {
  it("is empty when the work weight is just the bar", () => {
    expect(warmupSets(45, 45, LB_PLATES)).toEqual([]);
  });

  it("starts with two bar sets and ramps upward", () => {
    const sets = warmupSets(225, 45, LB_PLATES);
    expect(sets[0]).toEqual({ weight: 45, reps: 5 });
    expect(sets[1]).toEqual({ weight: 45, reps: 5 });

    const weights = sets.map((s) => s.weight);
    for (let i = 1; i < weights.length; i++) {
      expect(weights[i]).toBeGreaterThanOrEqual(weights[i - 1]);
    }
    expect(Math.max(...weights)).toBeLessThan(225);
  });

  it("never exceeds the work weight", () => {
    for (const work of [55, 95, 135, 185, 315]) {
      for (const set of warmupSets(work, 45, LB_PLATES)) {
        expect(set.weight).toBeLessThan(work);
      }
    }
  });
});

describe("one-rep max", () => {
  it("is the weight itself for a single", () => {
    expect(estimateOneRepMax(225, 1)).toBe(225);
  });

  it("scales up with reps", () => {
    expect(estimateOneRepMax(200, 5)).toBeCloseTo(233.33, 1);
  });

  it("is zero for an unlogged set", () => {
    expect(estimateOneRepMax(200, 0)).toBe(0);
  });
});

function makeLog(reps: (number | null)[], targetReps = 5, targetRepsMax = targetReps): ExerciseLog {
  const sets: SetLog[] = reps.map((r) => ({
    kind: "work",
    targetReps,
    weight: 100,
    reps: r,
    done: r !== null,
  }));
  return {
    exerciseId: "x",
    name: "Squat",
    tracking: "reps",
    targetReps,
    targetRepsMax,
    weight: 100,
    increment: 5,
    usesBar: true,
    sets,
    minutes: null,
    targetMinutes: 0,
    completed: false,
    hint: "",
    note: "",
  };
}

describe("progression", () => {
  const settings = { ...defaultSettings(), deloadAfterFails: 3, deloadPercent: 10 };

  it("counts a clean session as a hit", () => {
    expect(hitAllTargets(makeLog([5, 5, 5, 5, 5]))).toBe(true);
    expect(hitAllTargets(makeLog([5, 5, 5, 5, 4]))).toBe(false);
  });

  it("ignores warmups when judging the session", () => {
    const log = makeLog([5, 5, 5, 5, 5]);
    log.sets.unshift({ kind: "warmup", targetReps: 5, weight: 45, reps: 2, done: true });
    expect(hitAllTargets(log)).toBe(true);
  });

  it("adds the increment after a clean session", () => {
    const result = applyProgression(100, 5, 0, makeLog([5, 5, 5, 5, 5]), settings);
    expect(result).toMatchObject({ weight: 105, consecutiveFails: 0, outcome: "increase" });
  });

  it("repeats the weight on the first miss", () => {
    const result = applyProgression(100, 5, 0, makeLog([5, 5, 5, 5, 3]), settings);
    expect(result).toMatchObject({ weight: 100, consecutiveFails: 1, outcome: "repeat" });
  });

  it("deloads on the third consecutive miss and resets the counter", () => {
    const result = applyProgression(100, 5, 2, makeLog([5, 5, 5, 5, 3]), settings);
    expect(result.outcome).toBe("deload");
    expect(result.consecutiveFails).toBe(0);
    expect(result.weight).toBeLessThan(100);
    expect(result.weight).toBeGreaterThanOrEqual(settings.barWeight);
  });

  it("never deloads a barbell lift below the empty bar", () => {
    const result = applyProgression(45, 5, 2, makeLog([1]), settings);
    expect(result.weight).toBeGreaterThanOrEqual(settings.barWeight);
  });
});

describe("unit conversion", () => {
  it("round-trips a common weight within one rounding step", () => {
    const kg = convertRounded(225, "lb", "kg");
    expect(kg).toBeCloseTo(102, 0);
    expect(convertRounded(kg, "kg", "lb")).toBeCloseTo(225, 0);
  });

  it("is a no-op for the same unit", () => {
    expect(convertRounded(137.5, "lb", "lb")).toBe(137.5);
  });
});

describe("double progression (8-10 rep ranges)", () => {
  const settings = { ...defaultSettings(), deloadAfterFails: 3, deloadPercent: 10 };

  it("holds the weight while you are inside the range", () => {
    // All sets at 8 — the bottom of 8-10. Chase reps, not weight.
    const result = applyProgression(100, 5, 0, makeLog([8, 8, 8], 8, 10), settings);
    expect(result).toMatchObject({ weight: 100, outcome: "hold", consecutiveFails: 0 });
  });

  it("still holds when only some sets reach the top", () => {
    const result = applyProgression(100, 5, 0, makeLog([10, 9, 8], 8, 10), settings);
    expect(result.outcome).toBe("hold");
    expect(result.weight).toBe(100);
  });

  it("adds weight once every set reaches the top of the range", () => {
    const result = applyProgression(100, 5, 0, makeLog([10, 10, 10], 8, 10), settings);
    expect(result).toMatchObject({ weight: 105, outcome: "increase" });
  });

  it("counts dropping below the bottom of the range as a miss", () => {
    const result = applyProgression(100, 5, 0, makeLog([8, 8, 7], 8, 10), settings);
    expect(result).toMatchObject({ weight: 100, outcome: "repeat", consecutiveFails: 1 });
  });

  it("behaves exactly like linear progression when the range is a single number", () => {
    expect(applyProgression(100, 5, 0, makeLog([5, 5, 5], 5, 5), settings).outcome).toBe("increase");
  });
});

describe("non-lifting exercises", () => {
  const settings = defaultSettings();

  function durationLog(minutes: number | null, target: number): ExerciseLog {
    return {
      ...makeLog([]),
      name: "HIIT",
      tracking: "duration",
      minutes,
      targetMinutes: target,
      sets: [],
    };
  }

  it("counts a duration exercise as hit once the target minutes are in", () => {
    expect(hitAllTargets(durationLog(20, 20))).toBe(true);
    expect(hitAllTargets(durationLog(25, 20))).toBe(true);
    expect(hitAllTargets(durationLog(12, 20))).toBe(false);
    expect(hitAllTargets(durationLog(null, 20))).toBe(false);
  });

  it("never changes the weight of a duration exercise", () => {
    const result = applyProgression(0, 5, 0, durationLog(30, 30), settings);
    expect(result).toMatchObject({ weight: 0, outcome: "hold", consecutiveFails: 0 });
  });

  it("never accumulates fails against a checkbox exercise", () => {
    const plank: ExerciseLog = { ...makeLog([]), tracking: "done", sets: [], completed: false };
    const result = applyProgression(0, 5, 2, plank, settings);
    expect(result).toMatchObject({ weight: 0, outcome: "hold", consecutiveFails: 0 });
  });

  it("treats a checkbox exercise as hit only when ticked", () => {
    const plank: ExerciseLog = { ...makeLog([]), tracking: "done", sets: [], completed: true };
    expect(hitAllTargets(plank)).toBe(true);
    expect(hitAllTargets({ ...plank, completed: false })).toBe(false);
  });
});
