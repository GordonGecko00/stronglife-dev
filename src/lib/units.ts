import type { Unit } from "../types";

const LB_PER_KG = 2.2046226218;

export const DEFAULT_BAR: Record<Unit, number> = { lb: 45, kg: 20 };
export const DEFAULT_PLATES: Record<Unit, number[]> = {
  lb: [45, 35, 25, 10, 5, 2.5],
  kg: [25, 20, 15, 10, 5, 2.5, 1.25],
};
/** Smallest jump worth showing, used when rounding converted weights. */
export const SMALLEST_STEP: Record<Unit, number> = { lb: 0.5, kg: 0.25 };

export function convert(value: number, from: Unit, to: Unit): number {
  if (from === to) return value;
  return to === "kg" ? value / LB_PER_KG : value * LB_PER_KG;
}

export function roundTo(value: number, step: number): number {
  if (step <= 0) return value;
  return Math.round(value / step) * step;
}

/** Convert and snap to a sensible increment for the target unit. */
export function convertRounded(value: number, from: Unit, to: Unit): number {
  return roundTo(convert(value, from, to), SMALLEST_STEP[to]);
}

/** Drop trailing zeros: 52.5 -> "52.5", 45.0 -> "45". */
export function formatWeight(value: number): string {
  const rounded = Math.round(value * 100) / 100;
  return String(rounded);
}

export function formatWeightWithUnit(value: number, unit: Unit): string {
  return `${formatWeight(value)} ${unit}`;
}

export function formatDuration(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const mm = Math.floor(s / 60);
  const ss = String(s % 60).padStart(2, "0");
  return `${mm}:${ss}`;
}
