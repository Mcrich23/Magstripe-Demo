#!/bin/sh
# Run as the desktop user, including over SSH. sudo is only for the server.
set -eu

cd "$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)"
if [ "$(id -u)" -eq 0 ]; then
  printf '%s\n' 'Run this as the desktop user, without sudo.' >&2
  exit 1
fi
if [ -n "$(git status --porcelain)" ]; then
  printf '%s\n' 'Commit or stash local changes before updating.' >&2
  exit 1
fi

# Use the same Node installation as the service, even when SSH lacks its PATH.
node=$(systemctl show magstripe-demo.service --property=ExecStart --value |
  sed -n 's/^{ path=\([^ ;]*\) ;.*/\1/p')
if [ ! -x "$node" ]; then
  printf '%s\n' 'Cannot find the installed server runtime. Run deploy/install-kiosk.py first.' >&2
  exit 1
fi
PATH="$(dirname -- "$node"):$PATH"
export PATH
systemctl --user show-environment >/dev/null
sudo -v

git pull --ff-only --no-rebase
npm test
npm run check

sudo systemctl restart magstripe-demo.service
curl --fail --silent --show-error --retry 10 --retry-connrefused \
  --retry-delay 1 --max-time 2 --output /dev/null http://127.0.0.1:4173/
# Keep the desktop's display environment; do not import the SSH environment.
systemctl --user restart magstripe-kiosk.service
systemctl is-active --quiet magstripe-demo.service
systemctl --user is-active --quiet magstripe-kiosk.service
printf 'Updated to %s; app and kiosk restarted.\n' "$(git rev-parse --short HEAD)"
