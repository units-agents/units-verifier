#!/bin/sh
# Entry point of the units/verifier image. The first word picks a tool; anything that is not a tool
# of the kit goes to the worker CLI (vendor/packages/worker/src/main.ts) unchanged.
set -eu
V=/opt/units
cmd=${1:-help}
[ $# -gt 0 ] && shift
case "$cmd" in
  verify)            exec bun "$V/scripts/verify.ts" "$@" ;;
  verify-generation) exec bun "$V/scripts/identity/verify-generation.ts" "$@" ;;
  replay)            exec bun "$V/scripts/replay.ts" "$@" ;;
  images)            exec bun "$V/scripts/local-images.ts" "$@" ;;
  calibrate)         exec bun "$V/scripts/calibrate-recipe.ts" "$@" ;;
  baseline)          exec bun "$V/kit/baseline.ts" "$@" ;;
  params)            exec bun "$V/kit/params.ts" "$@" ;;
  latest)            exec bun "$V/kit/latest.ts" "$@" ;;
  source)            exec bun "$V/kit/source.ts" "$@" ;;
  worker-help)       exec bun "$V/packages/worker/src/main.ts" --help ;;
  *)                 exec bun "$V/packages/worker/src/main.ts" "$cmd" "$@" ;;
esac
