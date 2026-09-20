#!/bin/sh
# XDG autostart supplies the current Wayland/X11 display, even if it changes.
set -eu
for name in DISPLAY WAYLAND_DISPLAY XAUTHORITY XDG_SESSION_TYPE XDG_CURRENT_DESKTOP; do
  if printenv "$name" >/dev/null; then
    systemctl --user import-environment "$name"
  else
    systemctl --user unset-environment "$name"
  fi
done
exec systemctl --user restart magstripe-kiosk.service
