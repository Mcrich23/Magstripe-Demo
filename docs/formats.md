# Supported formats

This is an educational payment-card text decoder, not a card authenticator or payment application. A readable stripe and a passing Luhn checksum do not prove ownership, available funds, or validity. No network lookup is performed.

## Payment cards

Supports plaintext ISO/ABA Format B Track 1 and numeric Track 2, with start/end sentinels, a 12–19-digit PAN, and numeric expiration/service fields. Decodes PAN, name, YYMM expiration, service code, and the presence of issuer-specific data. The interface summarizes these fields and annotates their positions in the received text. PAN values are masked and issuer values are shown as received; track headers include character counts, and a matching table explains each field. Luhn checks all parsed PANs. The shared-field check compares PAN, raw expiry, and service code between one decoded Track 1 and one decoded Track 2; duplicates or missing data do not claim a match. Does not infer bank, credit versus debit, PIN, or the internal layout of discretionary data. Century is not inferred. Unusual optional-field encodings, masked/encrypted output, and payment Track 3 remain unsupported.

Source: [MagTek tDynamo programmer manual, generic ISO/ABA data format, section 6](https://www.magtek.com/content/documentationfiles/d998200226.pdf). Reference checked September 20, 2026.

## Detection and limits

Detection is a structural heuristic, not verification that the input is a genuine payment card. Duplicate or contradictory tracks are flagged; incomplete tracks are not decoded. An unsupported track does not prevent interpretation of other complete tracks. Unparsed data and full raw tracks are never displayed.

Readers should send start/end sentinels, with no custom prefix or transmitted LRC. CR, LF, Tab, STX and ETX framing are accepted. Keyboard readers typically validate parity/LRC in hardware; this application receives text and cannot independently check the underlying magnetic encoding. Capture has a 4,096-character bound. It never decodes encrypted reader data. State IDs, PDF417 barcodes, chips and NFC are outside this demo’s scope.
