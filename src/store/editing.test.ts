import { describe, expect, it, beforeEach } from "vitest";
import { getData, replaceAll } from "./store";
import { buildDefaultData } from "./defaults";
import {
  addPastSession,
  finishSession,
  logSession,
  setReps,
  setSessionStart,
  startSession,
  deleteSession,
} from "./actions";
import { dayKey } from "../lib/misc";

function template(name: string) {
  return getData().templates.find((t) => t.name === name)!;
}

describe("editing a past session", () => {
  beforeEach(() => {
    localStorage.clear();
    replaceAll(buildDefaultData());
  });

  /** Run a full session and finish it, so there is history to edit. */
  function completeOne(): string {
    const id = startSession(template("Full Body"));
    const session = getData().sessions.find((s) => s.id === id)!;
    session.exercises.forEach((ex, exIndex) => {
      ex.sets.forEach((set, setIndex) => {
        if (set.kind === "work") setReps(id, exIndex, setIndex, ex.targetRepsMax);
      });
    });
    finishSession(id);
    return id;
  }

  it("keeps the session editable after it is finished", () => {
    const id = completeOne();
    const before = getData().sessions.find((s) => s.id === id)!;
    expect(before.finishedAt).not.toBeNull();

    setReps(id, 0, before.exercises[0].sets.findIndex((s) => s.kind === "work"), 6);

    const after = getData().sessions.find((s) => s.id === id)!;
    const firstWork = after.exercises[0].sets.find((s) => s.kind === "work")!;
    expect(firstWork.reps).toBe(6);
    expect(firstWork.done).toBe(true);
  });

  it("does not start a rest timer while correcting history", () => {
    const id = completeOne();
    expect(getData().restEndsAt).toBeNull();

    setReps(id, 0, 0, 5);

    expect(getData().restEndsAt, "editing an old session must not start a rest timer").toBeNull();
  });

  it("still starts the rest timer during a live workout", () => {
    const id = startSession(template("Full Body"));
    const workIndex = getData()
      .sessions.find((s) => s.id === id)!
      .exercises[0].sets.findIndex((s) => s.kind === "work");

    setReps(id, 0, workIndex, 8);

    expect(getData().restEndsAt).not.toBeNull();
  });

  it("leaves the current working weight alone when history changes", () => {
    completeOne();
    const weightAfterProgression = template("Full Body").exercises[0].weight;

    // Correct the record to a miss; the plan should not silently roll back.
    const id = getData().sessions[0].id;
    setReps(id, 0, getData().sessions[0].exercises[0].sets.findIndex((s) => s.kind === "work"), 2);

    expect(template("Full Body").exercises[0].weight).toBe(weightAfterProgression);
  });

  it("moves a session to another day, keeping its duration", () => {
    const hockey = template("Hockey");
    const start = new Date();
    start.setHours(21, 0, 0, 0);
    logSession(hockey, { minutes: 90, startedAt: start });

    const id = getData().sessions[0].id;
    const duration = getData().sessions[0].finishedAt! - getData().sessions[0].startedAt;

    const moved = new Date(start);
    moved.setDate(moved.getDate() - 2);
    moved.setHours(19, 30, 0, 0);
    setSessionStart(id, moved);

    const after = getData().sessions.find((s) => s.id === id)!;
    expect(dayKey(after.startedAt)).toBe(dayKey(moved));
    expect(new Date(after.startedAt).getHours()).toBe(19);
    expect(after.finishedAt! - after.startedAt).toBe(duration);
    expect(after.dateISO).toBe(moved.toISOString());
  });

  it("adds a missed workout as finished but unfilled", () => {
    const when = new Date();
    when.setDate(when.getDate() - 3);
    when.setHours(7, 0, 0, 0);

    const id = addPastSession(template("Full Body"), when);
    const session = getData().sessions.find((s) => s.id === id)!;

    expect(session.finishedAt).not.toBeNull();
    expect(dayKey(session.startedAt)).toBe(dayKey(when));
    expect(session.exercises.length).toBeGreaterThan(0);
    expect(session.exercises.every((ex) => ex.sets.every((s) => !s.done))).toBe(true);
    // It is history, not the workout in progress.
    expect(getData().activeSessionId).toBeNull();
  });

  it("does not disturb the workout in progress", () => {
    const liveId = startSession(template("Upper Body"));
    const when = new Date();
    when.setDate(when.getDate() - 1);

    addPastSession(template("Full Body"), when);

    expect(getData().activeSessionId).toBe(liveId);
  });

  it("deletes a session without touching the others", () => {
    const first = completeOne();
    const second = completeOne();

    deleteSession(first);

    const ids = getData().sessions.map((s) => s.id);
    expect(ids).toContain(second);
    expect(ids).not.toContain(first);
  });
});
