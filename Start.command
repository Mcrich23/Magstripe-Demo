#!/bin/sh
# Double-click on macOS, or run ./Start.command from a terminal.
cd "$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)"
exec ./scripts/start.sh
