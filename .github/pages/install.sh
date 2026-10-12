#!/usr/bin/env bash
# Installs only the dependencies the web build needs, skipping native module builds.
set -euo pipefail
cd "$(dirname "$0")/../.."
npm ci --ignore-scripts --no-audit --no-fund
for d in build extensions remote/web $(ls -d extensions/*/ extensions/*/server 2>/dev/null | sed 's#/$##' | sort -u); do
	[ -f "$d/package-lock.json" ] || continue
	(cd "$d" && npm ci --ignore-scripts --no-audit --no-fund)
done
