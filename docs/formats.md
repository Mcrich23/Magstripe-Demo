# Supported formats

This is an educational text decoder, not a card authenticator or payment application. A readable stripe and a passing Luhn checksum do not prove identity, ownership, available funds, or validity. No network lookup is performed.

## Payment cards

Supports plaintext ISO/ABA Format B Track 1 and numeric Track 2, with start/end sentinels and numeric expiration/service fields. Explains PAN, name, YYMM expiration, service code, and the presence of issuer-specific data. Does not infer bank, credit versus debit, PIN, or the internal layout of discretionary data. Century is not inferred. Unusual optional-field encodings, masked/encrypted output, and payment Track 3 remain unsupported.

Source: [MagTek tDynamo programmer manual, generic ISO/ABA data format, section 6](https://www.magtek.com/content/documentationfiles/d998200226.pdf).

## State IDs / driver licenses

Supports the **legacy AAMVA magnetic stripe** layout, not PDF417 barcodes. Track 1 includes jurisdiction, city, name, address; Track 2 includes IIN, encoded ID, expiration and birth date; version-0 Track 3 includes fixed-width attributes. Some readers translate Track 3’s `%` to `#`; both are accepted. Other encodings, old proprietary California layouts, and embedded control/sentinel characters may be unsupported. A card with only a barcode needs a barcode reader and a different parser. Actual jurisdiction layouts and reader capabilities vary; this is not a claim of compatibility with every state ID.

A maximum-width city or name need not have a separator. Track 2 ID overflow is appended, but numeric encodings are never guessed back into printed letters. Special expiration months 77, 88, and 99 are labeled. Track 3 codes stay as encoded; jurisdiction-specific descriptions/units are not invented. Its optional tail stays opaque.

Sources: [AAMVA 2020 standard, Annex F](https://www.aamva.org/getmedia/99ac7057-0f4d-4461-b0a2-3a5532e1b35c/AAMVA-2020-DLID-Card-Design-Standard.pdf), [AAMVA issuer numbers](https://www.aamva.org/identity/issuer-identification-numbers-(iin)), and [MagTek reader sentinel conventions](https://www.magtek.com/content/documentationfiles/d99875125.pdf). References checked September 20, 2026. The parser uses Annex F’s legacy format intentionally, not the 2025 barcode format.

## Detection and limits

Auto mode looks for a supported ID Track 1 or known AAMVA IIN before trying payment layouts. Auto-detection is a heuristic. Select the format manually for ambiguous input. Duplicate or contradictory tracks are flagged; incomplete tracks are not decoded. An unsupported track does not prevent interpretation of other complete tracks. All unparsed data is masked by default.

Readers should send start/end sentinels, with no custom prefix or transmitted LRC. CR, LF, Tab, STX and ETX framing are accepted. Keyboard readers typically validate parity/LRC in hardware; this application receives text and cannot independently check the underlying magnetic encoding. Capture has a 4,096-character bound. It never decodes encrypted reader data.
