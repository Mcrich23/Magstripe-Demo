# Magstripe Reader

A small, offline booth demo for a keyboard-style USB magstripe reader. Swipe a payment card to see its masked number, cardholder, expiration, and track format. Inspired by the simple layout of the companion SwiftUI app.

## Run on macOS or Ubuntu

Install **Node.js 22 or newer**, then run:

```sh
npm start
```

Open **http://127.0.0.1:4173**. No `npm install`, build step, or internet connection is needed. Stop with Ctrl+C.

You can also double-click `Start.command` on macOS or run `./scripts/start.sh` on Ubuntu. If the port is busy, use `PORT=4174 npm start`. Copy this folder to another computer with Node installed to take the demo with you. Do not open `index.html` directly.

## Use

- Connect a USB reader in **keyboard mode**, then keep the page active and swipe. Track format is detected automatically.
- Results appear after 700 ms without input, allowing Enter/Tab between tracks. Wait for a result before the next swipe.
- **Try a sample** uses fictional data. You can also paste into the reader input and click **Process**.
- **More details** shows the service code and issuer-data length.
- **Clear** or **Esc** clears the result. A new swipe replaces it. Results also clear after 60 seconds or when the window loses focus. Click the input to resume after leaving the window.

Configure the reader to send start/end markers (`%`, `;`, `?`), all available tracks, and no custom prefix or transmitted LRC. Match the OS keyboard layout to the reader, usually US English. The active indicator describes the page, not whether a USB device was detected.

## Scope and privacy

Supports plain-text payment-card Tracks 1 and 2. State IDs, PDF417 barcodes, encrypted readers, chips and NFC are outside this demo’s scope. Incomplete, conflicting, or unfamiliar data is flagged. This does not authenticate cards or process payments. See [format details and sources](docs/formats.md).

Card numbers stay masked; names and expiration dates are visible in the results. The app never shows the full raw stripe. Use cards whose owners have agreed to the demo, or use the fictional sample.

Parsing happens entirely in browser memory. The local server only serves static files, binds to `127.0.0.1`, and accepts no swipe submissions. There is no storage, analytics, history, export, or external dependency. Clearing discards app state; it cannot erase OS memory, screenshots, extensions, or a clipboard used to paste input. This is an educational demo, not a payment-data vault.

## Development

```sh
npm test       # parser, capture, and loopback HTTP regression tests
npm run check # JavaScript syntax checks
```

Source: `public/app.js` (UI), `public/parser.js` (decoder), `public/capture.js` (reader buffer), `server.mjs` (local server). See [verification notes](docs/verification.md) for checks and hardware limitations. Use synthetic values in tests and bug reports, never real card data.
