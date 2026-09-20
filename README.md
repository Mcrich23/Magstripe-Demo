# Magstripe Reader

A small, offline booth demo for a keyboard-style USB magstripe reader. Swipe a payment card, a supported membership card, or a student card matching the configured university format to see its track data broken down. Inspired by the simple layout of the companion SwiftUI app.

## Run on macOS or Ubuntu

Install **Node.js 22 or newer**, then run:

```sh
npm start
```

Open **http://127.0.0.1:4173**. No `npm install`, build step, or internet connection is needed. Stop with Ctrl+C.

You can also double-click `Start.command` on macOS or run `./scripts/start.sh` on Ubuntu. If the port is busy, use `PORT=4174 npm start`. Copy this folder to another computer with Node installed to take the demo with you. Do not open `index.html` directly.

## Use

Connect a USB reader in **keyboard mode** and leave this browser window active. Swipe a card; its information appears automatically. No input field, menu, or manual processing step is required.

Each swipe replaces the previous result. Each track appears as a continuous line of encoded text with subtle field colors. One matching table below explains the card number, cardholder, expiration, service code, and issuer data; markers and track lengths are shown alongside. Full account numbers remain masked; issuer data is shown exactly as received, without interpreting its internal contents. Luhn and shared-field checks provide talking points about integrity versus authentication. The footer counts down, and results clear after 30 seconds or when the window loses focus. Listening resumes automatically when the window becomes active again. Use Clear now, Enter after a result appears, or Esc to clear immediately.

Results appear after 700 ms without input, allowing Enter/Tab between tracks. Wait for a result before the next swipe. Configure the reader to send start/end markers (`%`, `;`, `?`), all available tracks, and no custom prefix or transmitted LRC. Match the OS keyboard layout to the reader, usually US English.

A web page can receive reader keystrokes only while the browser page is active, not when the address bar or another application has focus. Keep it in the foreground at the booth; no field needs to be selected.

## Scope and privacy

Supports plain-text payment-card Tracks 1 and 2, membership-style Track 1 (`%number^name^additional-data?`, including the supplied Costco-style layout), and the supplied university student-card layout. Membership numbers, names, and additional data are shown without payment-specific assumptions. Student detection accepts a complete Track 2 (`;` plus a seven-digit ID and two trailing digits, ending in `?`), either alone or alongside Track 1 (`%` plus the seven-digit ID and `?`). Any digit values matching this layout are supported. The student ID is labeled; the trailing two digits stay visible in the track text without a label or table entry. This is a local format profile, not a general university-card standard. State IDs, PDF417 barcodes, encrypted readers, chips and NFC are outside this demo’s scope. Incomplete, conflicting, or unfamiliar data is flagged. This does not authenticate cards or process payments. See [format details and sources](docs/formats.md).

Card numbers stay masked; names, expiration dates, and issuer data are visible in the results. Supported student and membership tracks are displayed in full; payment account numbers stay masked. Use cards whose owners have agreed to the demo, or use the fictional sample.

Parsing happens entirely in browser memory. The local server only serves static files, binds to `127.0.0.1`, and accepts no swipe submissions. There is no storage, analytics, history, export, or external dependency. Clearing discards app state; it cannot erase OS memory, screenshots, extensions, or a clipboard used to paste input. This is an educational demo, not a payment-data vault.

## Automatic kiosk startup

See [Linux / Raspberry Pi kiosk setup](deploy/README.md) for a boot-time local server and full-screen Chromium that opens automatically with the desktop.

## Development

```sh
npm test       # parser, capture, and loopback HTTP regression tests
npm run check # JavaScript syntax checks
```

Source: `public/app.js` (UI), `public/parser.js` (decoder), `public/capture.js` (reader buffer), `server.mjs` (local server). See [verification notes](docs/verification.md) for checks and hardware limitations. Use synthetic values in tests and bug reports, never real card data.
