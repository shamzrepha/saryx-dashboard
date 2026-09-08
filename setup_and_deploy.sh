#!/bin/bash
# SARYX — install everything, set Firebase env vars on Vercel, deploy
# Run this from inside the web_app folder (cd ~/Downloads/web_app first)

set -e

# ---------------------------------------------------------------------------
# STEP 1: FILL THESE IN with your real values from:
# Firebase Console -> Project Settings -> General -> Your apps -> SDK config
# ---------------------------------------------------------------------------
FIREBASE_API_KEY="AIzaSyDfG8ZLqfqP3bsIv4pWVmYw1zjvwJ6z3T8"
FIREBASE_AUTH_DOMAIN="saryx-robot-shamz.firebaseapp.com"
FIREBASE_DATABASE_URL="https://saryx-robot-shamz-default-rtdb.europe-west1.firebasedatabase.app"
FIREBASE_PROJECT_ID="saryx-robot-shamz"
FIREBASE_STORAGE_BUCKET="saryx-robot-shamz.firebasestorage.app"
FIREBASE_MESSAGING_SENDER_ID="967240286598"
FIREBASE_APP_ID="1:967240286598:web:7c7eb4d4b9d78765a86c07"

if [ "$FIREBASE_API_KEY" = "PASTE_YOUR_VALUE_HERE" ]; then
  echo "STOP: open this script in a text editor and fill in your real Firebase"
  echo "values at the top before running it. Get them from:"
  echo "Firebase Console -> Project Settings -> General -> Your apps -> SDK setup"
  exit 1
fi

# ---------------------------------------------------------------------------
# STEP 2: Install CLIs (skips if already installed)
# ---------------------------------------------------------------------------
if ! command -v firebase &> /dev/null; then
  echo ">> Installing Firebase CLI..."
  npm install -g firebase-tools
fi

if ! command -v vercel &> /dev/null; then
  echo ">> Installing Vercel CLI..."
  npm install -g vercel
fi

# ---------------------------------------------------------------------------
# STEP 3: Log in to both (opens a browser each time)
# ---------------------------------------------------------------------------
echo ">> Logging into Firebase..."
firebase login

echo ">> Logging into Vercel..."
vercel login

# ---------------------------------------------------------------------------
# STEP 4: Also write .env.local for local `npm run dev` testing
# ---------------------------------------------------------------------------
cat > .env.local << EOF
NEXT_PUBLIC_FIREBASE_API_KEY=${FIREBASE_API_KEY}
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=${FIREBASE_AUTH_DOMAIN}
NEXT_PUBLIC_FIREBASE_DATABASE_URL=${FIREBASE_DATABASE_URL}
NEXT_PUBLIC_FIREBASE_PROJECT_ID=${FIREBASE_PROJECT_ID}
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=${FIREBASE_STORAGE_BUCKET}
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=${FIREBASE_MESSAGING_SENDER_ID}
NEXT_PUBLIC_FIREBASE_APP_ID=${FIREBASE_APP_ID}
EOF
echo ">> Wrote .env.local for local testing"

# ---------------------------------------------------------------------------
# STEP 5: Push each value to Vercel (production environment)
#    --force overwrites if the var already exists from a previous run
# ---------------------------------------------------------------------------
echo ">> Setting Vercel environment variables..."
echo "$FIREBASE_API_KEY" | vercel env add NEXT_PUBLIC_FIREBASE_API_KEY production --force
echo "$FIREBASE_AUTH_DOMAIN" | vercel env add NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN production --force
echo "$FIREBASE_DATABASE_URL" | vercel env add NEXT_PUBLIC_FIREBASE_DATABASE_URL production --force
echo "$FIREBASE_PROJECT_ID" | vercel env add NEXT_PUBLIC_FIREBASE_PROJECT_ID production --force
echo "$FIREBASE_STORAGE_BUCKET" | vercel env add NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET production --force
echo "$FIREBASE_MESSAGING_SENDER_ID" | vercel env add NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID production --force
echo "$FIREBASE_APP_ID" | vercel env add NEXT_PUBLIC_FIREBASE_APP_ID production --force

# ---------------------------------------------------------------------------
# STEP 6: Deploy
# ---------------------------------------------------------------------------
echo ">> Deploying to Vercel..."
vercel --prod

echo ""
echo "============================================================"
echo "Done. Your dashboard should now build successfully and be live."
echo "It'll show 'waiting-for-robot' until the Android app is running"
echo "and publishing telemetry/video — that's expected for now."
echo "============================================================"
