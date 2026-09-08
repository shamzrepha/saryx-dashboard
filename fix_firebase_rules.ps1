# SARYX - fix Firebase connectivity (open rules for testing + deploy)
# Run from inside your web_app folder in PowerShell:
#   cd ~\Downloads\web_app
#   .\fix_firebase_rules.ps1

Write-Host ">> Setting Realtime Database rules to open (testing only)..." -ForegroundColor Cyan
@"
{
  "rules": {
    ".read": true,
    ".write": true
  }
}
"@ | Set-Content -Path "database.rules.json" -Encoding UTF8

Write-Host ">> Setting Firestore rules to open (testing only)..." -ForegroundColor Cyan
@"
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if true;
    }
  }
}
"@ | Set-Content -Path "firestore.rules" -Encoding UTF8

Write-Host ">> Making sure Firestore database itself exists..." -ForegroundColor Cyan
firebase init firestore

Write-Host ">> Deploying database rules..." -ForegroundColor Cyan
firebase deploy --only database

Write-Host ">> Deploying Firestore rules..." -ForegroundColor Cyan
firebase deploy --only firestore:rules

Write-Host ""
Write-Host "============================================================" -ForegroundColor Green
Write-Host "Done. Now force-close and reopen the Android app so it makes"
Write-Host "a fresh connection, and refresh the web dashboard page."
Write-Host ""
Write-Host "REMINDER: these rules are wide open (anyone with your Firebase"
Write-Host "config can read/write) - fine for your own bench testing, but"
Write-Host "lock these down with Firebase Auth before using this outside"
Write-Host "your own testing." -ForegroundColor Yellow
Write-Host "============================================================" -ForegroundColor Green
