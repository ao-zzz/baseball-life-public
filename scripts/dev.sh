#!/usr/bin/env bash
# Fixed development commands, so each one can be allowed once in .claude/settings.local.json.
# Run from Windows as: wsl -e bash -ic "bash ~/baseball-life/scripts/dev.sh <command>"
set -o pipefail
cd "$(dirname "$0")/.." || exit 1

case "$1" in
  typecheck) npx tsc -b 2>&1 | tail -40 ;;
  lint) npm run lint 2>&1 | tail -40 ;;
  test) npx vitest run 2>&1 | tail -60 ;;
  # all tests except the long calibration check (400,000 lives), for quick rounds between full runs
  unit) npx vitest run --exclude src/engine/calibration.test.ts 2>&1 | tail -60 ;;
  build) npm run build 2>&1 | tail -12 ;;
  check)
    # lint + tests + build, before a checkpoint report
    npm run lint 2>&1 | tail -40 && npx vitest run 2>&1 | tail -40 && npm run build 2>&1 | tail -12
    ;;
  calibrate) node scripts/calibrate.ts 2>&1 | tail -60 ;;
  mortality) node scripts/calibrate.ts --mortality-only 2>&1 | tail -40 ;;
  events) node scripts/eventstats.ts 3000 2>&1 | tail -40 ;;
  life) node scripts/lifestats.ts 3000 2>&1 | tail -20 ;;
  # play diversity and event reach (PROJECT_PLAN §11.10)
  diversity) node scripts/diversity.ts 3000 300 2>&1 | tail -30 ;;
  # Japan-mode guard: calibrated draws and careers against scripts/fingerprint-jp.txt (never rewrites it)
  fingerprint) node scripts/fingerprint.ts check 2>&1 | tail -5 ;;
  preview) npm run preview -- --host --port 4173 --strictPort ;;
  *)
    echo "usage: bash scripts/dev.sh <typecheck|lint|test|unit|build|check|calibrate|mortality|events|life|diversity|fingerprint|preview>" >&2
    exit 2
    ;;
esac
