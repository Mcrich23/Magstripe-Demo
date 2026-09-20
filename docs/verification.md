# Verification

Checked locally on macOS on September 20, 2026.

- `npm test`: 14 passing tests for parsing, masking, track disagreements, invalid dates, incomplete reads, capture timing, Enter/Tab framing, paste, cancellation, input bounds, static asset serving, loopback host restrictions, HTTP method restrictions, and response headers.
- UI controller lifecycle regression covers focus loss, automatic resume, discarding partial reads, visibility changes, successive swipes, and 60-second clearing with a controlled clock.
- `npm run check`: JavaScript syntax passes.
- `sh -n scripts/start.sh Start.command`: launcher syntax passes.
- Real in-app browser: hands-free capture immediately after page load; two-track keyboard simulation with Enter after each track; a second Track 2-only swipe replaces the first with no intervening click; all six result fields are visible without disclosure controls. No buttons, input fields, or menus remain.
- Desktop rendering inspected. A narrower 780 CSS-pixel layout was also inspected with no horizontal overflow. Phone-sized layout was not verified.
- App uses DOM text content for decoded values, with no HTML interpolation of card data. No client-side fetch, persistent storage, third-party scripts, or external resources. The server accepts only static GET/HEAD requests; CSP blocks connections and form submission.

Not yet physically tested with the user's reader. Ubuntu execution has not been tested on an Ubuntu machine; the server and launch scripts use cross-platform Node and POSIX shell without native dependencies. Configure the real reader for keyboard mode and verify its sentinel and inter-track timing settings before using it at the booth.
