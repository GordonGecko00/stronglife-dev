# StrongLife

A training and wellness tracker that installs on your iPhone home screen. No
App Store, no subscription, no account — everything is stored on the device.

Built around a six-day split with an evening sport in the mix: it knows that a
9pm skate wrecks a 6:30am squat session, and plans around it.

**Live:** https://gordongecko00.github.io/stronglife-dev/

## Features

### Planning around a late sport
- **Two slots a day**: a morning session and an evening one, so hockey nights
  sit on the schedule alongside the lifts.
- **The late-night rule**: a session logged (or scheduled) after your cutoff
  automatically eases off the next morning — swapped for active recovery, or
  skipped entirely. Easy mornings are left alone; only the hard ones move.
  It prefers what you actually logged and falls back to the schedule so the
  week view can predict knock-on effects before they happen.
- **The week view** shows all seven days, both slots, what got adjusted and
  why, and flags when your lifting days collide with your sport nights.
- **Weekly schedule** in two modes: *fixed* (pin a session to each weekday) or
  *alternating* (pick training days and cycle sessions A / B / A automatically).

### Sessions of any kind
- **Three ways to track an exercise**: sets and reps, a stretch of time
  (walks, HIIT, yoga), or a plain tick box (planks, mobility).
- **Custom sessions** typed as strength, cardio, recovery or sport — any number
  of them, each with its own exercises. Reorder, duplicate, delete.
- Mark an exercise as a barbell lift (drives plate math and warmups) or not,
  for things like dips and chin-ups.

### During a workout
- **One tap per set.** Tapping cycles the rep count down from the top of your
  rep range (10 → 9 → 8 … → 0 → cleared), so nailing every rep is a single tap.
  Long-press for a keypad when you need something else, including AMRAP sets.
- **Plate calculator** shows exactly what to hang on each side of the bar, and
  tells you when a weight isn't loadable with the plates you have.
- **Automatic warmup sets** — two bar sets then a ramp to your work weight,
  each rounded to a weight you can actually load.
- **Adjust weight mid-workout** with +/− buttons; unlogged sets follow along.
- **Rest timer** starts automatically after each set (longer after a missed
  set), survives navigation, reloads, and the phone locking, and vibrates when
  it's up.
- **Timed and tick-box blocks** log with one control, so a HIIT or yoga session
  is as quick to record as a lift.
- Per-exercise and per-workout notes, plus a 1–5 effort rating.

### Progress
- **Double progression** — set a rep range (say 3×8–10). Work up through the
  range at one weight; once every set hits the top, the weight goes up and you
  start again at the bottom. A range of 5–5 is plain linear progression, so a
  classic 5×5 still behaves exactly as before. Miss the bottom of the range
  enough times in a row and it deloads.
- **Strength charts** per exercise: working weight and estimated 1RM over time,
  with a values table for when you want the numbers.
- **Personal records** with estimated one-rep max, ranked.
- **Consistency calendar** for the last 16 weeks, plus workout / streak /
  total-volume stats.
- **Body weight** logging and chart.

### Nutrition and mind
- **Daily check-in**: protein against a target worked out from your latest body
  weight, water glasses, and a tick-box list of habits.
- **Habits** are yours to edit — daily ones (meditation, ate to plan) or weekly
  ones with a target (journal 3×, nature walk 2×). Weekly progress shows on the
  week view.
- **Journal** entry per day.
- **Milestones** for a three-month plan, grouped by month, with the current
  month highlighted.

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
npm test         # plate/warmup/progression math + the scheduling rules
npm run lint
npm run build    # production build into dist/
npm run preview  # serve the production build
```

App icons are generated, not checked in by hand: `node scripts/gen-icons.mjs`.

## Architecture

```
src/
  lib/        pure logic — plate math, warmup ramps, progression, 1RM, units, backup
  store/      persisted state: defaults, versioned migrations, actions, selectors,
              and planning.ts (the late-night rule and week plan)
  components/ shared UI — set cells, plate chips, rest bar, charts, calendar
  pages/      Today, Week, Session, Program, Progress, History, Milestones, Settings
```

State is a single object in `localStorage` behind a `useSyncExternalStore`
store. Every update runs against a clone so each change publishes a new
top-level reference — mutating in place would leave subscribers rendering stale
values. Stored data carries a version and is run through `store/migrate.ts` on
load, which also normalizes anything malformed rather than throwing, so a bad
field costs one setting instead of your training history.

The scheduling logic lives in `store/planning.ts` and is pure: given the stored
data and a date it returns what should happen that morning and evening, what
was adjusted, and why. That keeps it testable — see `store/planning.test.ts`.

## Deployment

`.github/workflows/deploy.yml` builds and deploys to GitHub Pages on every push
to `main`.
