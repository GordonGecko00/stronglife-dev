export type Unit = "lb" | "kg";
export type Theme = "system" | "light" | "dark";
export type SetKind = "warmup" | "work";
export type ScheduleMode = "fixed" | "rotating";

/** How an exercise is measured: loaded sets, a stretch of time, or just done. */
export type TrackingMode = "reps" | "duration" | "done";

/** What kind of effort a session is, which drives how it is planned and displayed. */
export type SessionKind = "strength" | "conditioning" | "recovery" | "sport";

/** Morning slot (the 6:30am lift) or evening slot (the 9pm skate). */
export type Slot = "am" | "pm";

export interface RecoveryRule {
  enabled: boolean;
  /** A session finishing at or after this hour counts as a late night. */
  lateHour: number;
  /** What the next morning becomes: a lighter session, or nothing at all. */
  action: "recovery" | "skip";
  /** Template to swap in when `action` is "recovery". */
  recoveryTemplateId: string | null;
}

export interface Settings {
  unit: Unit;
  /** Weight of the empty bar, in `unit`. */
  barWeight: number;
  /** Plate denominations available in the gym, in `unit`, largest first. */
  plates: number[];
  restSec: number;
  /** Longer rest offered after a set that missed its target reps. */
  restAfterFailSec: number;
  warmupEnabled: boolean;
  deloadAfterFails: number;
  deloadPercent: number;
  theme: Theme;
  vibrate: boolean;
  /** Grams of protein per unit of body weight, for the daily target. */
  proteinPerUnit: number;
  waterTarget: number;
  recovery: RecoveryRule;
  money: MoneySettings;
}

export interface Exercise {
  id: string;
  name: string;
  tracking: TrackingMode;

  /** `reps` mode: loaded sets. */
  sets: number;
  /** Bottom of the rep range — the number every set must reach. */
  targetReps: number;
  /** Top of the rep range. Reaching it on every set earns the weight increase. */
  targetRepsMax: number;
  weight: number;
  increment: number;
  /** Consecutive sessions that failed to reach the bottom of the range. */
  consecutiveFails: number;
  /** Barbell movement — drives the plate calculator and the warmup ramp. */
  usesBar: boolean;
  useWarmup: boolean;

  /** `duration` mode: minutes of work. */
  targetMinutes: number;

  /** Free-text cue shown while logging, e.g. "treadmill intervals". */
  hint: string;
}

export interface WorkoutTemplate {
  id: string;
  name: string;
  kind: SessionKind;
  slot: Slot;
  exercises: Exercise[];
}

export interface Schedule {
  mode: ScheduleMode;
  /** `fixed`: day-of-week (0 = Sunday) -> template id, or null for a rest day. */
  days: Record<number, string | null>;
  /** Evening slot, for recurring sport nights. */
  eveningDays: Record<number, string | null>;
  /** `rotating`: which days of the week are training days. */
  trainingDays: Record<number, boolean>;
  /** `rotating`: template ids cycled through, one per training day. */
  rotation: string[];
  rotationIndex: number;
}

export interface SetLog {
  kind: SetKind;
  targetReps: number;
  weight: number;
  reps: number | null;
  done: boolean;
}

export interface ExerciseLog {
  exerciseId: string;
  name: string;
  tracking: TrackingMode;
  targetReps: number;
  targetRepsMax: number;
  weight: number;
  increment: number;
  usesBar: boolean;
  sets: SetLog[];
  /** `duration` mode: minutes actually done. */
  minutes: number | null;
  targetMinutes: number;
  /** `done` mode: simply completed or not. */
  completed: boolean;
  /** Cue copied from the template, e.g. "treadmill intervals". */
  hint: string;
  note: string;
}

export interface WorkoutSession {
  id: string;
  templateId: string;
  templateName: string;
  kind: SessionKind;
  dateISO: string;
  startedAt: number;
  finishedAt: number | null;
  /** Unit the weights were recorded in, so history stays truthful after a unit switch. */
  unit: Unit;
  exercises: ExerciseLog[];
  note: string;
  /** 1–5, how hard it felt. */
  effort: number | null;
}

export interface BodyWeightEntry {
  id: string;
  dateISO: string;
  weight: number;
  unit: Unit;
}

export type HabitGroup = "nutrition" | "mind" | "other";

export interface Habit {
  id: string;
  name: string;
  group: HabitGroup;
  /** Daily habits show every day; weekly ones count toward a per-week target. */
  cadence: "daily" | "weekly";
  weeklyTarget: number;
  archived: boolean;
}

export interface DailyLog {
  /** Local YYYY-MM-DD. */
  dayKey: string;
  proteinGrams: number;
  waterGlasses: number;
  /** Habit id -> completed. */
  habits: Record<string, boolean>;
  journal: string;
}

export interface Milestone {
  id: string;
  /** 1, 2 or 3 — which month of the plan this belongs to. */
  month: number;
  title: string;
  done: boolean;
}

export interface AppData {
  version: number;
  settings: Settings;
  templates: WorkoutTemplate[];
  schedule: Schedule;
  sessions: WorkoutSession[];
  activeSessionId: string | null;
  /** Epoch ms the current rest period ends, persisted so it survives navigation. */
  restEndsAt: number | null;
  bodyWeights: BodyWeightEntry[];
  habits: Habit[];
  /** Keyed by local YYYY-MM-DD. */
  dailyLogs: Record<string, DailyLog>;
  milestones: Milestone[];
  /** When the plan started, for working out which month you're in. */
  programStartISO: string;

  accounts: Account[];
  holdings: Holding[];
  liabilities: Liability[];
  watchlist: WatchItem[];
  /** Net worth snapshots, oldest first, at most one per day. */
  netWorth: NetWorthPoint[];
  /** Cached prices keyed by upper-case symbol, so the portfolio renders offline. */
  quotes: Record<string, Quote>;
}

/* --------------------------------------------------------------- money */

export type Currency = "USD" | "CAD" | "EUR" | "GBP" | "AUD";

/** What a holding is, which drives the allocation breakdown. */
export type AssetClass = "stock" | "etf" | "bond" | "crypto" | "cash" | "other";

/** Tax wrapper or account type, so registered money is easy to spot. */
export type AccountKind =
  | "taxable"
  | "tfsa"
  | "rrsp"
  | "401k"
  | "ira"
  | "pension"
  | "crypto"
  | "savings"
  | "other";

/** Where prices come from. `manual` never touches the network. */
export type QuoteSource = "stooq" | "manual";

export interface Account {
  id: string;
  name: string;
  kind: AccountKind;
  /** Uninvested cash in the account, in the portfolio currency. */
  cash: number;
}

export interface Holding {
  id: string;
  accountId: string;
  /** Ticker as you'd type it: AAPL, VOO, BTC-USD, ^GSPC. */
  symbol: string;
  name: string;
  assetClass: AssetClass;
  quantity: number;
  /** What you paid per unit, for gain/loss. */
  costPerUnit: number;
  /** Price entered by hand — used when no quote is available, or in manual mode. */
  manualPrice: number | null;
}

/** A debt, subtracted from net worth. */
export interface Liability {
  id: string;
  name: string;
  balance: number;
}

export interface WatchItem {
  id: string;
  symbol: string;
  name: string;
}

/** One saved point on the net-worth curve. Keyed by local day; latest wins. */
export interface NetWorthPoint {
  dayKey: string;
  invested: number;
  cash: number;
  liabilities: number;
}

/** A cached price. `previousClose` is what the day change is measured against. */
export interface Quote {
  symbol: string;
  price: number;
  previousClose: number;
  /** Epoch ms of the last bar, i.e. how fresh the market data itself is. */
  asOf: number;
  /** Epoch ms we fetched it, for the "updated X ago" line. */
  fetchedAt: number;
  /** Recent closes, oldest first, for the sparkline. */
  history: number[];
}

export interface MoneySettings {
  currency: Currency;
  source: QuoteSource;
  /** Blur balances until tapped, for reading somewhere public. */
  privacy: boolean;
}
