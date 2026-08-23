# 5x5 Lifts

A minimal StrongLifts 5x5-style strength training tracker. Installable as a
home-screen app on iPhone (PWA) — no App Store, no subscription, all data
stored on-device.

## Features

- **Weekly plan**: assign a workout (with its own exercises, sets, reps,
  starting weight, and weight increment) to each day of the week.
- **Quick set logging**: during a workout, tap a set, tap the number of reps
  you actually hit — one tap logs it. A built-in 90s rest timer starts
  automatically after each set.
- **Progressive overload**: finishing a workout where every set hit the
  target reps bumps that exercise's weight for next time; missing reps 3
  sessions in a row triggers a 10% deload — the same core loop StrongLifts
  uses.
- **History**: a log of every completed workout and what was actually lifted.
- **Home screen quick action**: long-press the app icon (once installed) for
  a "Start Today's Workout" shortcut that jumps straight into logging.
- **Works offline**: installable as a PWA with a service worker, so it works
  in a gym with no signal.

## Local development

```bash
npm install
npm run dev
```

## Build

```bash
npm run build   # outputs to dist/
npm run preview # serve the production build locally
```

## Installing on iPhone

1. Open the deployed URL in **Safari** on your iPhone (must be Safari, not
   Chrome — only Safari can install PWAs on iOS).
2. Tap the Share icon → **Add to Home Screen**.
3. Open the app from your home screen icon. It now runs full-screen, works
   offline, and long-pressing the icon shows a "Start Today's Workout" quick
   action.

## Deployment

A GitHub Actions workflow (`.github/workflows/deploy.yml`) builds this app
and deploys it to GitHub Pages on every push to `main`. One-time setup: in
the repo's **Settings → Pages**, set **Source** to "GitHub Actions" (free for
public repos). After that, pushes to `main` deploy automatically and the app
is available at `https://<your-username>.github.io/stronglife-dev/`.
