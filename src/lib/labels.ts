import type { SessionKind } from "../types";

/** "8–10" for a range, "5" for a fixed target. */
export function repRange(min: number, max: number): string {
  return max > min ? `${min}–${max}` : String(min);
}

const KIND_LABELS: Record<SessionKind, string> = {
  strength: "Strength",
  conditioning: "Cardio",
  recovery: "Recovery",
  sport: "Sport",
};

export function kindLabel(kind: SessionKind): string {
  return KIND_LABELS[kind] ?? kind;
}
