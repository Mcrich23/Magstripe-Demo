# Magstripe Lab

A portable, offline demo that turns a USB card swipe into an interactive explanation of its magnetic tracks. Runs on **macOS and Ubuntu** with a local web interface. No npm dependencies, build step, account, cloud service, or database.

## Run

Install **Node.js 22 or newer**, then from this folder:

```sh
npm start
```

Open **http://127.0.0.1:4173** in a modern browser. Click **Start capture**, then swipe while the page is in front. Stop the server with Ctrl+C. `npm install` is not needed.

- **macOS:** you can also double-click `Start.command` (or run it from Terminal).
- **Ubuntu:** run `./scripts/start.sh`.
- **Different port:** `PORT=4174 npm start`.
- **Offline / portable:** copy this entire folder to the other computer, which needs Node installed. The app requires no internet connection to start or operate. All fonts, scripts, styles, and sample data are local. Do not open `index.html` directly; use the launcher/server for JavaScript modules.

The server binds only to `127.0.0.1`. There is intentionally no LAN or public deployment. No system services or global packages are installed by the launcher. The same Node code runs on both operating systems; see `docs/verification.md` for what was actually tested.

## At the demo table

1. Connect a **keyboard-wedge USB magstripe reader** (a swipe types characters like a keyboard).
2. Keep start/end sentinels enabled. Usually Track 1 begins with `%`, Track 2 with `;`, and each ends with `?`. Enable all available tracks and disable custom reader prefixes / transmitted LRC.
3. Click **Start capture**. This arms the page; it does not claim a reader has been detected.
4. Swipe one card. The app waits 700 ms after the last character to combine tracks, including readers that send Enter or Tab between them. A slower 1.5-second setting is available.
5. Choose a track, select a colored segment, and explore its fields. Use **Reveal details** deliberately if you want to show personal information.
6. **Clear** or **Esc** removes the current swipe before the next participant. A new swipe replaces the previous one and hides details again. Results automatically clear after one minute by default (configurable).

Try the **Payment card** and **State ID** samples before using a real card. Both contain fictional data. You can also paste text under **Input options → Paste a swipe instead**. Only use cards their owners have agreed to demonstrate.

## What it explains

- **Payment cards:** PAN, cardholder name, expiration, service code, and the presence of issuer data; Tracks 1 and 2.
- **Legacy AAMVA state IDs / driver licenses:** jurisdiction, city, name, address, encoded ID number, issuer number, expiration, birth date, and supported Track 3 attributes.
- **Track structure:** markers, separators, field locations, and original text on explicit reveal.
- **Read problems:** partial or duplicate tracks, conflicting payment fields, invalid dates, checksum failures, unrecognized formats, and barcode input.

See [format coverage and primary sources](docs/formats.md). Not every state ID has a compatible stripe. A PDF417 barcode needs a barcode reader and is not supported. Encrypted USB HID, serial readers, and proprietary layouts need separate adapters. This app cannot authenticate cards, verify identity, read balances, process payments, or read chips/NFC.

## Privacy behavior

Parsing happens in browser memory. The server serves an explicit list of static assets and has no swipe endpoint. There is no analytics, logging of swipes, browser storage, export, history, or service worker. Its Content Security Policy blocks application network connections and form submissions. Responses are marked `no-store`.

Personal fields and the original track are masked by default. Revealing displays sensitive data on screen. Losing window focus masks details, discards partial capture/paste input, and pauses listening; click Start capture to resume. Switching tabs clears results. Reloading, closing, timeout, or Clear also discards the app's references and removes rendered details. Print output is suppressed.

This is a local educational demo, not a secure payment-data vault: masking does not encrypt JavaScript memory; browser extensions, developer tools, operating-system memory, screenshots, and the clipboard used for manual paste are outside its control. Clear removes app state, not forensic traces from the computer. Use the fictional samples for public presentations whenever possible.

## Troubleshooting

| Symptom | Check |
| --- | --- |
| Nothing happens | Start capture; keep the page active; use USB keyboard mode. The browser cannot detect the physical reader. |
| Wrong punctuation | Match the OS keyboard layout to the reader (usually US English). Check Caps Lock and sentinel settings. |
| Tracks appear separately | Use the slower reader option. Swipe one card at a time, allowing the result to appear. |
| Incomplete track | Swipe again at a steady speed; clean the reader/card; enable end sentinels. |
| No ID details | Confirm the card has a magnetic stripe and the reader supports its tracks. Barcodes and proprietary state layouts need different support. |
| Unsupported or encrypted input | Configure plaintext keyboard output if your reader supports it; encrypted devices cannot be decoded by this app. |
| Port already in use | Run `PORT=4174 npm start`, then open that port. |
| macOS double-click cannot find Node | Run `npm start` in a terminal where your Node version manager is initialized. |

## Development

```sh
npm test       # Node's built-in test runner; server tests bind an ephemeral loopback port
npm run check # syntax checks
```

- `public/parser.js`: pure parsing and annotated field ranges
- `public/capture.js`: bounded keyboard-swipe accumulator
- `public/app.js`: rendering and in-memory lifecycle
- `server.mjs`: loopback-only static server
- `test/`: parser, capture, and HTTP regression tests

No real card data should be added to source, fixtures, issue reports, logs, or screenshots. Use synthetic values to reproduce a parsing issue.
