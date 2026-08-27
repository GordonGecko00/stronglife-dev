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

### Money and markets
- **Portfolio**: accounts (taxable, TFSA, RRSP, 401(k), crypto wallet…), the
  holdings inside them, uninvested cash, and debts — netted into one net worth
  figure with today's change and total gain since you bought in.
- **Where you're invested**: a stacked breakdown by asset type or by account,
  so the split is obvious at a glance.
- **Net worth over time** — a snapshot is taken whenever you open the page, so
  the curve fills in from ordinary use rather than a chore.
- **Market view**: a watchlist (the three US indexes to start), live-ish day
  changes with sparklines, a market open/closed indicator, and your own
  holdings ranked by what moved today.
- **Prices without an account.** Daily closes come from a free public source —
  no API key, no sign-up, nothing to deploy. Yahoo-style tickers are translated
  automatically (`^GSPC`, `SHOP.TO`, `BTC-USD` all work).
- **It degrades honestly.** The source is a courtesy endpoint that can
  rate-limit or be unreachable, and a static page can only read it while it
  keeps sending permissive CORS headers. Every failure is reported on screen,
  the last known prices are kept, and you can enter a price by hand for
  anything — a private position, or the whole portfolio if you'd rather not
  fetch at all.
- **Hide balances** with one tap for reading on a train.

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
- **Export** a full JSON backup, a CSV with one row per logged set, or a CSV
  of your holdings. Restore from a file or pasted JSON.
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
npm test         # plate/warmup/progression math, scheduling rules, portfolio math
npm run lint
npm run build    # production build into dist/
npm run preview  # serve the production build
```

App icons are generated, not checked in by hand: `node scripts/gen-icons.mjs`.

## Architecture

```
src/
  lib/        pure logic — plate math, warmup ramps, progression, 1RM, units, backup,
              portfolio valuation, money formatting, quote fetching and parsing
  store/      persisted state: defaults, versioned migrations, actions, selectors,
              planning.ts (the late-night rule and week plan) and finance.ts
  components/ shared UI — set cells, plate chips, rest bar, charts, calendar,
              sparklines, allocation bar
  pages/      Today, Week, Session, Program, Progress, History, Money, Market,
              MoneySetup, Milestones, Settings
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

Money works the same way. `lib/portfolio.ts` values holdings and totals them,
`lib/quotes.ts` translates tickers and parses the price feed, and both are pure
— see `lib/finance.test.ts`. Network access is confined to `lib/quotes.ts`,
which reports failures instead of throwing, so `store/finance.ts` can always
render the portfolio from whatever is cached.

## Deployment

`.github/workflows/deploy.yml` builds and deploys to GitHub Pages on every push
to `main`.
