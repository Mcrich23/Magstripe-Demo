# Linux / Raspberry Pi kiosk

The installer creates two services: a system service that serves the app on loopback at boot, and a user service that opens Chromium in kiosk mode when the desktop starts. Chromium waits for the app and restarts if it exits. The dedicated incognito browser profile lives in the user runtime directory. Chromium's sandbox remains enabled.

## Install

Requirements: a graphical Linux desktop with XDG autostart and systemd, Chromium, curl, Python 3, sudo, and Node.js 22+. Raspberry Pi OS with labwc is supported; its desktop must already be configured to log in automatically. Run as that desktop user:

```sh
python3 deploy/install-kiosk.py --node /absolute/path/to/node
```

The installer preserves existing desktop/autologin settings and refuses to overwrite service files it does not own. The repository must stay at its installed path. No internet is required at boot.

The server starts immediately. Chromium starts on the next desktop login. To start now, run `scripts/kiosk-session.sh` **inside the graphical session**. From SSH, if `systemctl --user show-environment` already contains the active display variables, use `systemctl --user restart magstripe-kiosk.service` instead; do not import the SSH session's empty display variables.

## Check / control

```sh
systemctl status magstripe-demo.service
systemctl --user status magstripe-kiosk.service
curl --fail http://127.0.0.1:4173/ >/dev/null
journalctl -u magstripe-demo.service -b
journalctl --user -u magstripe-kiosk.service -b
```

`systemctl --user stop magstripe-kiosk.service` closes the kiosk until the next login. Alt+F4 alone will cause the service to restart Chromium. To stop automatic desktop launch, remove `~/.config/autostart/magstripe-kiosk.desktop`. To stop the server: `sudo systemctl disable --now magstripe-demo.service`.

After a code update, run tests and then restart the server and kiosk services. A reboot verifies the complete boot → desktop login → local server → full-screen browser sequence. The 30-second swipe countdown still works as usual.

References: [Raspberry Pi kiosk startup](https://www.raspberrypi.com/tutorials/how-to-use-a-raspberry-pi-in-kiosk-mode/) and [Chromium profile isolation](https://www.chromium.org/developers/creating-and-using-profiles/).
