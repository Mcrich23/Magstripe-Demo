#!/bin/sh
set -eu
cd "$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)"
if ! command -v node >/dev/null 2>&1; then
  printf '%s\n' 'Install Node.js 22 or newer, then run this launcher again.' >&2
  exit 1
fi
node -e 'if (Number(process.versions.node.split(".")[0]) < 22) { console.error("Node.js 22 or newer is required."); process.exit(1); }'
exec node server.mjs
