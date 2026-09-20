# Verification

Checked locally on macOS on September 20, 2026.

- `npm test`: 17 passing tests for parsing, masking, track disagreements, invalid dates, incomplete reads, capture timing, Enter/Tab framing, paste, cancellation, input bounds, static asset serving, loopback host restrictions, HTTP method restrictions, and response headers.
- UI controller lifecycle regression covers focus loss, automatic resume, discarding partial reads, visibility changes, successive swipes, and 30-second clearing and the live countdown (including reset on a new swipe) with a controlled clock.
- `npm run check`: JavaScript syntax passes.
- `sh -n scripts/start.sh Start.command`: launcher syntax passes.
- Real in-app browser: hands-free capture immediately after page load; two-track keyboard simulation with Enter after each track; a second Track 2-only swipe replaces the first with no intervening click; continuous track strings and a color-matched breakdown table are visible without disclosure controls. The encoded strings preserve original field order with masked PAN and visible issuer values; track lengths, markers, and checksum/agreement results accompany them. No buttons, input fields, or menus remain.
- Desktop rendering inspected. A narrower 780 CSS-pixel layout was also inspected with no horizontal overflow. Phone-sized layout was not verified.
- App uses DOM text content for decoded values, with no HTML interpolation of card data. No client-side fetch, persistent storage, third-party scripts, or external resources. The server accepts only static GET/HEAD requests; CSP blocks connections and form submission.

Not yet physically tested with the user's reader. Ubuntu execution has not been tested on an Ubuntu machine; the server and launch scripts use cross-platform Node and POSIX shell without native dependencies. Configure the real reader for keyboard mode and verify its sentinel and inter-track timing settings before using it at the booth.

The anatomy regression tests cover field order and lengths, masking, long issuer fields, unreadable content, checksum failure, shared-field disagreement, duplicate tracks, and single-track reads. UI lifecycle checks verify the breakdown is removed when the swipe clears.

The consolidated display was visually checked in the browser with a two-track fictional swipe. The UI regression also verifies that inline spans join into the original track sequence, with only the PAN masked.
