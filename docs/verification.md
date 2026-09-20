# Verification

Checked locally on macOS on September 20, 2026.

- `npm test`: 13 passing tests for parsing, masking, track disagreements, invalid dates, incomplete reads, capture timing, Enter/Tab framing, paste, cancellation, input bounds, static asset serving, loopback host restrictions, HTTP method restrictions, and response headers.
- `npm run check`: JavaScript syntax passes.
- `sh -n scripts/start.sh Start.command`: launcher syntax passes.
- Real in-app browser: automatic input focus; fictional sample; masked card number; formatted name; two-track keyboard simulation with Enter after each track; replacement of a previous result; Track 2-only pasted input with Process; More details; Clear and Escape.
- Desktop rendering inspected. A narrower 780 CSS-pixel layout was also inspected with no horizontal overflow. Phone-sized layout was not verified.
- App uses DOM text content for decoded values, with no HTML interpolation of card data. No client-side fetch, persistent storage, third-party scripts, or external resources. The server accepts only static GET/HEAD requests; CSP blocks connections and form submission.

Not yet physically tested with the user's reader. Ubuntu execution has not been tested on an Ubuntu machine; the server and launch scripts use cross-platform Node and POSIX shell without native dependencies. Configure the real reader for keyboard mode and verify its sentinel and inter-track timing settings before using it at the booth.
