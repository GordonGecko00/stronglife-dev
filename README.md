# StrongLife

A StrongLifts 5×5-style strength training tracker that installs on your iPhone
home screen. No App Store, no subscription, no account — everything is stored
on the device.

**Live:** https://gordongecko00.github.io/stronglife-dev/

## Features

### Planning
- **Weekly schedule** in two modes: *alternating* (pick your training days and
  cycle A / B / A, B / A / B automatically — the classic StrongLifts pattern),
  or *fixed* (pin a specific workout to each weekday).
- **Custom workouts** — any number of workouts, each with its own exercises,
  sets, reps, starting weight, and per-session increment. Reorder, duplicate,
  and delete.
- Mark an exercise as a barbell lift (drives plate math and warmups) or not,
  for things like dips and chin-ups.

### During a workout
- **One tap per set.** Tapping cycles the rep count down from your target
  (5 → 4 → 3 … → 0 → cleared), so a clean set is a single tap. Long-press for a
  keypad when you need something else, including going over target.
- **Plate calculator** shows exactly what to hang on each side of the bar, and
  tells you when a weight isn't loadable with the plates you have.
- **Automatic warmup sets** — two bar sets then a ramp to your work weight,
  each rounded to a weight you can actually load.
- **Adjust weight mid-workout** with +/− buttons; unlogged sets follow along.
- **Rest timer** starts automatically after each set (longer after a missed
  set), survives navigation, reloads, and the phone locking, and vibrates when
  it's up.
- Per-exercise and per-workout notes.

### Progress
- **Progressive overload** — hit every rep and the weight goes up next session.
  Miss, and it repeats; miss enough times in a row and it deloads. Both
  thresholds are configurable.
- **Strength charts** per exercise: working weight and estimated 1RM over time,
  with a values table for when you want the numbers.
- **Personal records** with estimated one-rep max, ranked.
- **Consistency calendar** for the last 16 weeks, plus workout / streak /
  total-volume stats.
- **Body weight** logging and chart.

### Your data
- **Works offline.** Installed as a PWA with a service worker — no signal
  needed in the gym.
- **Export** a full JSON backup, or a CSV with one row per logged set. Restore
  from a file or pasted JSON.
- lb / kg switching converts every planned weight; past workouts keep the units
  they were logged in.
- Light / dark / system theme.

## Installing on iPhone

1. Open the URL above in **Safari** (it must be Safari — other iOS browsers
   can't install PWAs).
2. Share → **Add to Home Screen**.
3. Launch it from the icon. It runs full screen, works offline, and
   long-pressing the icon gives you a "Start Today's Workout" quick action.

> Your log lives in this browser's storage only. Clearing Safari's website data
> or losing the phone loses it — export a backup from **More → Backup**
> occasionally.

## Development

```bash
npm install
npm run dev      # dev server
npm test         # unit tests for the plate/warmup/progression math
npm run lint
npm run build    # production build into dist/
npm run preview  # serve the production build
```

App icons are generated, not checked in by hand: `node scripts/gen-icons.mjs`.

## Architecture

```
src/
  lib/        pure logic — plate math, warmup ramps, progression, 1RM, units, backup
  store/      persisted app state: defaults, versioned migrations, actions, selectors
  components/ shared UI — set cells, plate chips, rest bar, charts, calendar
  pages/      Today, Session, Plan, Progress, History, Settings
```

State is a single object in `localStorage` behind a `useSyncExternalStore`
store. Every update runs against a clone so each change publishes a new
top-level reference — mutating in place would leave subscribers rendering stale
values. Stored data carries a version and is run through `store/migrate.ts` on
load, which also normalizes anything malformed rather than throwing, so a bad
field costs one setting instead of your training history.

## Deployment

`.github/workflows/deploy.yml` builds and deploys to GitHub Pages on every push
to `main`.
