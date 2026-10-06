#!/usr/bin/env bash
# Git hygiene gate: datasets and artifacts must never be tracked.
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"
if git ls-files | grep -Ei '\.(csv|parquet|feather|xlsx)$'; then
  echo "FAIL: dataset-like file tracked in git (see above)."
  exit 1
fi
echo "OK: no dataset files tracked in git."
