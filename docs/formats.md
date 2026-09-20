# Supported formats

This is an educational magstripe text decoder, not a card authenticator or payment application. A readable stripe and a passing Luhn checksum do not prove ownership, available funds, or validity. No network lookup is performed.

## Payment cards

Supports plaintext ISO/ABA Format B Track 1 and numeric Track 2, with start/end sentinels, a 12–19-digit PAN, and numeric expiration/service fields. Decodes PAN, name, YYMM expiration, service code, and the presence of issuer-specific data. The interface summarizes these fields and annotates their positions in the received text. PAN values are masked and issuer values are shown as received; track headers include character counts, and a matching table explains each field. Luhn checks all parsed PANs. The shared-field check compares PAN, raw expiry, and service code between one decoded Track 1 and one decoded Track 2; duplicates or missing data do not claim a match. Does not infer bank, credit versus debit, PIN, or the internal layout of discretionary data. Century is not inferred. Unusual optional-field encodings, masked/encrypted output, and payment Track 3 remain unsupported.

Source: [MagTek tDynamo programmer manual, generic ISO/ABA data format, section 6](https://www.magtek.com/content/documentationfiles/d998200226.pdf). Reference checked September 20, 2026.

## University student cards

This local profile is based on the user-supplied swipe, not an external standard. It accepts a complete Track 2 (`;` followed by nine digits and `?`), alone or paired with a complete Track 1 (`%` followed by seven digits and `?`). Detection uses the shape of the tracks, not specific ID values. For example, the **synthetic** swipe `%1234567?;123456742?` contains student ID `1234567` on both tracks and suffix `42` on Track 2. Leading zeros are preserved. When both tracks are present, their ID values are compared and mismatches are flagged. A Track 2-only read reports Single track and makes no cross-track match claim. Incomplete, Track 1-only, duplicate, or differently shaped student reads stay unrecognized rather than guessing their fields.

Student tracks are displayed in full. Only the student ID is labeled; the trailing two digits remain plain, unlabeled track text without a table entry. No printed-card context is added, and no checksum or authentication claim is made. Payment-only markers and Luhn checks are omitted for student results. Clearing, focus loss, and the 30-second timeout discard student results just like payment results.

## Membership-style cards

Supports the user-supplied Costco-style Track 1 layout `%number^name^additional-data?`, without a `B` payment format marker, together with an optional numeric Track 2 `;number=additional-data?`. The numeric identifier may contain 1–32 digits; the name may contain up to 52 characters. Empty name and additional-data fields are accepted. This is a structural profile, not a lookup or verification of the issuer or membership status. Tests use fictional values such as `%7000000012345678^EXAMPLE/JAMIE^000000000000?`.

The member number, name, and additional data are shown in full. Each decoded track gets its own additional-data row, and the member numbers are compared across tracks. Extra data is kept intact, without assigning expiration, service-code, or checksum meanings. Luhn is not applied. Explicit payment Format B Track 1 takes precedence; otherwise a complete membership Track 1 determines how its numeric Track 2 is interpreted. Track order does not matter. A membership Track 2 alone cannot be distinguished from payment data by this profile; the existing payment detection rules apply when membership Track 1 is absent. A complete membership Track 1 is still decoded when a second track is missing or unsupported; a dangling `;` is shown as an incomplete Track 2, not an error in Track 1. Other proprietary membership layouts remain unsupported.

## Detection and limits

Detection is a structural heuristic, not verification of card type, institution, or authenticity. Duplicate or contradictory tracks are flagged; incomplete tracks are not decoded. An unsupported track does not prevent interpretation of other complete tracks. Unrecognized and incomplete tracks are shown as plain text with an Unrecognized layout label, without inferred fields. Decoded payment PANs stay masked; supported student and membership tracks are displayed in full.

Readers should send start/end sentinels, with no custom prefix or transmitted LRC. CR, LF, Tab, STX and ETX framing are accepted. Keyboard readers typically validate parity/LRC in hardware; this application receives text and cannot independently check the underlying magnetic encoding. Capture has a 4,096-character bound. It never decodes encrypted reader data. State IDs, PDF417 barcodes, chips and NFC are outside this demo’s scope.
