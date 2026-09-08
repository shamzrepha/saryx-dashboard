# SARYX Dashboard (Web App)

Live video stream (WebRTC), live map, manual/training controls, and telemetry —
talks to the robot phone entirely through Firebase (Realtime Database for
commands/telemetry/position, Firestore for WebRTC signaling).

## 1. Set up Firebase (one-time, free tier)
1. Go to https://console.firebase.google.com -> Add project.
2. In the project, add a Web App (</> icon) -> copy the config values it shows you.
3. Enable **Realtime Database** (Build -> Realtime Database -> Create Database ->
   start in test mode for now, lock down rules before going public).
4. Enable **Firestore** (Build -> Firestore Database -> Create Database -> test mode
   for now, same note about rules).
5. Copy `.env.local.example` to `.env.local` and paste in the config values from step 2.

## 2. Run it locally
```
npm install
npm run dev
```
Visit http://localhost:3000 — you'll see "waiting-for-robot" on the video until the
robot phone app is running and publishing a stream.

## 3. Ship it to GitHub + Vercel
Run these from inside this `web_app` folder:

```bash
# GitHub
git init
git add .
git commit -m "Initial SARYX dashboard"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/saryx-dashboard.git
git push -u origin main

# Vercel (installs the CLI if you don't have it, then deploys)
npm install -g vercel
vercel login
vercel --prod
```

When Vercel asks about environment variables, or afterward in the Vercel dashboard
(Project -> Settings -> Environment Variables), add the same `NEXT_PUBLIC_FIREBASE_*`
values from your `.env.local` — Vercel doesn't read your local `.env.local` file, you
have to set them there separately.

**Before you make the GitHub repo public:** make sure `.env.local` is NOT committed
(the `.gitignore` here already excludes it) — your Firebase config values in
`NEXT_PUBLIC_*` vars are visible to the browser regardless (that's normal for
Firebase web apps), but lock down your Firebase Realtime Database & Firestore
security rules before this goes live publicly, since "test mode" allows anyone to
read/write. At minimum, require Firebase Auth for writes once you're past bench
testing.

## Data model this app expects in Firebase
**Realtime Database:**
- `robot/telemetry` — `{ leftTicks, rightTicks, ultrasonicCm, bump }`
- `robot/position` — `{ lat, lon, usingRelativeMode }`
- `robot/commands` — `{ throttle, steer, timestamp }` (dashboard writes, robot reads)
- `robot/lockCommand` — `{ open: bool, timestamp }` (dashboard writes, robot reads)
- `robot/recording` — `{ active: bool, startedAt }` (dashboard writes, robot reads to
  know when to log waypoints)

**Firestore:**
- `calls/robot-stream` — WebRTC signaling document (offer/answer), with
  `offerCandidates` and `answerCandidates` subcollections for ICE candidates.
