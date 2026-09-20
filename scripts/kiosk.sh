#!/bin/sh
# Launched by the user's systemd service after the desktop session starts.
set -eu
: "${XDG_RUNTIME_DIR:?A logged-in desktop session is required}"
if [ -z "${WAYLAND_DISPLAY:-}${DISPLAY:-}" ]; then
  printf '%s\n' 'No desktop display is available.' >&2
  exit 1
fi
if command -v chromium >/dev/null 2>&1; then
  browser=$(command -v chromium)
elif command -v chromium-browser >/dev/null 2>&1; then
  browser=$(command -v chromium-browser)
else
  printf '%s\n' 'Install Chromium before starting the kiosk.' >&2
  exit 1
fi
# The app is entirely local, so boot never waits for an internet connection.
until curl --fail --silent --max-time 2 --output /dev/null http://127.0.0.1:4173/; do
  sleep 1
done
if [ -n "${WAYLAND_DISPLAY:-}" ]; then
  platform=wayland
else
  platform=x11
fi
exec "$browser" \
  --ozone-platform="$platform" \
  --user-data-dir="$XDG_RUNTIME_DIR/magstripe-kiosk/profile" \
  --incognito \
  --no-first-run \
  --no-default-browser-check \
  --disable-session-crashed-bubble \
  --password-store=basic \
  --kiosk http://127.0.0.1:4173/
