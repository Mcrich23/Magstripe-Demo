#!/usr/bin/env python3
"""Install boot-time server and desktop-session Chromium services on Linux.
Run as the desktop user, not root. sudo is used only for the system service.
Existing desktop/autologin settings are left intact.
"""
import argparse
import os
from pathlib import Path
import pwd
import re
import shutil
import subprocess
import sys
import tempfile

MANAGED = '# Managed by Magstripe Demo kiosk installer'


def run(*args):
    subprocess.run(args, check=True)


def safe_path(path):
    value = str(path)
    if not re.fullmatch(r'/[a-zA-Z0-9_./-]+', value):
        raise SystemExit('Install paths must use letters, digits, slashes, dots, underscores or hyphens.')
    return value


def check_existing(path):
    if path.exists() and MANAGED not in path.read_text():
        raise SystemExit(f'Refusing to overwrite an unmanaged file: {path}')


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--node', default=shutil.which('node'), help='Absolute path to Node.js 22+')
    args = parser.parse_args()
    if sys.platform != 'linux' or os.getuid() == 0:
        raise SystemExit('Run this installer on Linux as the desktop user (not root).')
    if not args.node:
        raise SystemExit('Install Node.js 22+ or supply --node /absolute/path/to/node.')
    node = safe_path(Path(args.node).resolve())
    root = safe_path(Path(__file__).resolve().parent.parent)
    user = pwd.getpwuid(os.getuid()).pw_name
    if not re.fullmatch(r'[a-zA-Z0-9_-]+', user):
        raise SystemExit('Unsupported username.')
    for command in ['systemctl', 'curl', 'sudo']:
        if not shutil.which(command):
            raise SystemExit(f'Missing dependency: {command}')
    if not (shutil.which('chromium') or shutil.which('chromium-browser')):
        raise SystemExit('Install Chromium first.')
    version = subprocess.check_output([node, '-p', 'process.versions.node'], text=True).strip()
    if int(version.split('.')[0]) < 22:
        raise SystemExit('Node.js 22+ is required.')

    system_file = Path('/etc/systemd/system/magstripe-demo.service')
    user_file = Path.home() / '.config/systemd/user/magstripe-kiosk.service'
    autostart_file = Path.home() / '.config/autostart/magstripe-kiosk.desktop'
    for path in [system_file, user_file, autostart_file]:
        check_existing(path)

    server = f'''{MANAGED}
[Unit]
Description=Magstripe Demo local web server
After=local-fs.target

[Service]
Type=simple
User={user}
WorkingDirectory={root}
ExecStart={node} {root}/server.mjs
Environment=PORT=4173
Restart=always
RestartSec=3
NoNewPrivileges=true
ProtectSystem=strict
ProtectHome=read-only
PrivateTmp=true
UMask=0077

[Install]
WantedBy=multi-user.target
'''
    kiosk = f'''{MANAGED}
[Unit]
Description=Magstripe Demo Chromium kiosk
StartLimitIntervalSec=0

[Service]
Type=simple
ExecStart={root}/scripts/kiosk.sh
Restart=always
RestartSec=5
TimeoutStopSec=15
KillMode=mixed
RuntimeDirectory=magstripe-kiosk
RuntimeDirectoryMode=0700
'''
    desktop = f'''{MANAGED}
[Desktop Entry]
Type=Application
Name=Magstripe Demo kiosk
Exec={root}/scripts/kiosk-session.sh
Terminal=false
X-GNOME-Autostart-enabled=true
'''
    with tempfile.TemporaryDirectory(prefix='magstripe-install-') as tmp:
        unit = Path(tmp) / system_file.name
        unit.write_text(server)
        run('sudo', 'install', '-m', '644', str(unit), str(system_file))
    for path, content in [(user_file, kiosk), (autostart_file, desktop)]:
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(content)
        path.chmod(0o644)
    run('sudo', 'systemctl', 'daemon-reload')
    run('sudo', 'systemctl', 'enable', '--now', 'magstripe-demo.service')
    run('sudo', 'systemctl', 'restart', 'magstripe-demo.service')
    run('systemctl', '--user', 'daemon-reload')
    print(f'Installed for {user}; Node {version}.')
    print('Server enabled at boot. Chromium starts at the next desktop login.')
    print('To launch in the current desktop, run scripts/kiosk-session.sh from that session.')
    print('Desktop autologin must already be configured for fully unattended boot.')


if __name__ == '__main__':
    main()
