/** Offline interpretation of text delivered by a keyboard-wedge reader.
 * This does not authenticate a card, check a balance, or validate a physical read.
 * Format references and intentional limitations: docs/formats.md.
 */
export const MAX_INPUT = 4096;
const jurisdictions = new Set('AL AK AS AZ AR CA CO CT DE DC FL GA GU HI ID IL IN IA KS KY LA ME MD MA MI MN MS MO MT NE NV NH NJ NM NY NC ND MP OH OK OR PA PR RI SC SD TN TX UT VT VA VI WA WV WI WY AB BC MB NB NF NL NS NT NU ON PE QC SK YT'.split(' '));
const isIdIssuer = value => /^(6360(?:[0-5]\d|6[0-2])|60443[0-4]|60442[6-9])$/.test(value);

export function luhn(value) {
  if (!/^\d{12,19}$/.test(value) || /^0+$/.test(value)) return false;
  return [...value].reverse().reduce((sum, c, i) => {
    let n = Number(c); if (i % 2) n *= 2;
    return sum + (n > 9 ? n - 9 : n);
  }, 0) % 10 === 0;
}

export function mask(value, lastFour = false) {
  return lastFour && value.length > 4 ? '•••• ' + value.slice(-4) : '••••••••';
}

function dateOfBirth(raw) {
  if (!/^\d{8}$/.test(raw)) return null;
  const y = +raw.slice(0, 4), m = +raw.slice(4, 6), d = +raw.slice(6, 8);
  const date = new Date(Date.UTC(y, m - 1, d));
  return y >= 1800 && date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d
    ? `${raw.slice(0, 4)}-${raw.slice(4, 6)}-${raw.slice(6, 8)}` : null;
}

function expiry(raw, id = false) {
  const month = raw.slice(2);
  if (id && month === '77') return 'Non-expiring (77)';
  if (id && month === '88') return `Birth-month rule (88), year ${raw.slice(0, 2)}`;
  if (id && month === '99') return `On birthday, year ${raw.slice(0, 2)} (99)`;
  return /^\d{4}$/.test(raw) && +month >= 1 && +month <= 12 ? `${month} / ${raw.slice(0, 2)}` : null;
}

function tokenize(input, warnings) {
  const tracks = [];
  // A reader may add CR/LF, Tab, or STX/ETX framing. Keep spaces inside tracks.
  const text = input.replace(/[\r\n\t\x02\x03]/g, '').trim();
  let offset = 0;
  while (offset < text.length) {
    const start = text.slice(offset).search(/[% ;+#!]/);
    if (start < 0) { warnings.push('Extra characters outside the tracks were ignored. Check the reader’s prefix, suffix, and LRC settings.'); break; }
    offset += start;
    if (text[offset] === ' ') { offset++; continue; }
    if (start > 0) warnings.push('Extra characters outside the tracks were ignored.');
    const end = text.indexOf('?', offset + 1);
    const nextStart = text.slice(offset + 1).search(/[%;]/);
    // Preserve a later readable track if an earlier track has no end sentinel.
    const broken = nextStart >= 0 && (end < 0 || offset + 1 + nextStart < end);
    const stop = broken ? offset + 1 + nextStart : end < 0 ? text.length : end + 1;
    const raw = text.slice(offset, stop);
    const number = raw[0] === ';' ? 2 : raw[0] === '%' && !/^%\d/.test(raw) ? 1 : 3;
    tracks.push({ number, raw, complete: !broken && end >= 0, parts: [], decoded: false });
    offset = stop;
  }
  return tracks;
}

function field(result, track, key, label, value, start, end, description, sensitive = false, category = 'data') {
  const item = { key, label, value, description, sensitive, track: track.number, category };
  result.fields.push(item);
  track.parts.push({ start, end, ...item });
}

function payment(result, track) {
  let m;
  if (track.number === 1) m = /^%B(\d{12,19})\^([^\^?]{0,26})\^(\d{4})(\d{3})([^?]*)\?$/.exec(track.raw);
  if (track.number === 2) m = /^;(\d{12,19})=(\d{4})(\d{3})([\d=]*)\?$/.exec(track.raw);
  if (!m) return;
  const t1 = track.number === 1;
  const pan = m[1], name = t1 ? m[2] : null, exp = m[t1 ? 3 : 2], service = m[t1 ? 4 : 3], extra = m[t1 ? 5 : 4];
  let cursor = t1 ? 2 : 1;
  const add = (key, label, value, length, description, sensitive, category) => {
    field(result, track, key, label, value, cursor, cursor + length, description, sensitive, category); cursor += length;
  };
  add('pan', 'Card number', pan, pan.length, 'The primary account number (PAN). Only the last four digits are shown until you reveal details.', true, 'identity');
  cursor++;
  if (t1) { add('name', 'Cardholder name', name.trim() || 'Not provided', name.length, 'Usually encoded as FAMILY/GIVEN NAME. The stripe may abbreviate it.', true, 'identity'); cursor++; }
  add('expiry', 'Expiration', expiry(exp) || 'Invalid month', 4, 'Four digits in YYMM order. Displayed as MM / YY; the century is not encoded.', true, 'date');
  add('service', 'Service code', service, 3, 'Three issuer-defined digits describing interchange, authorization, and usage requirements.', false, 'service');
  if (extra.length) add('discretionary', 'Issuer data', `${extra.length} characters`, extra.length, 'Issuer-specific data. It may contain sensitive authentication values; its internal layout is not inferred.', true, 'issuer');
  if (!expiry(exp)) result.warnings.push(`Track ${track.number} contains an invalid expiration month.`);
  if (!luhn(pan)) result.warnings.push(`Track ${track.number}: the card number does not pass the Luhn checksum. It may be a bad read or a nonstandard card.`);
  track.decoded = true;
}

function idTrack1(result, track) {
  if (!jurisdictions.has(track.raw.slice(1, 3))) return;
  const bodyEnd = track.raw.length - 1;
  let cursor = 3;
  const take = max => {
    const start = cursor, separator = track.raw.indexOf('^', cursor);
    const end = separator >= cursor && separator <= cursor + max ? separator : Math.min(cursor + max, bodyEnd);
    cursor = end + (track.raw[end] === '^' ? 1 : 0);
    return { start, end, value: track.raw.slice(start, end) };
  };
  const city = take(13), name = take(35);
  let addressEnd = bodyEnd;
  if (track.raw[addressEnd - 1] === '^') addressEnd--;
  if (!city.value.trim() || !name.value.includes('$') || cursor >= addressEnd) return;
  field(result, track, 'jurisdiction', 'State / province', track.raw.slice(1, 3), 1, 3, 'The mailing or residential jurisdiction encoded on Track 1.', false, 'service');
  field(result, track, 'city', 'City', city.value.trim(), city.start, city.end, 'May be abbreviated to fit the stripe.', true, 'identity');
  field(result, track, 'name', 'Name', name.value.trim().replaceAll('$', ' / '), name.start, name.end, 'Family name, given name, and optional suffix are separated by $.', true, 'identity');
  field(result, track, 'address', 'Street address', track.raw.slice(cursor, addressEnd).trim().replaceAll('$', ', '), cursor, addressEnd, 'Address lines are separated by $.', true, 'identity');
  track.decoded = true;
}

function idTrack2(result, track) {
  const m = /^;(6\d{5})(\d{1,13})=(\d{4})(\d{8})(\d{0,5}|=)\?$/.exec(track.raw);
  if (!m) return;
  const [, issuer, id, exp, dob, overflow] = m;
  let cursor = 1;
  field(result, track, 'iin', 'Issuer number', issuer, cursor, cursor += 6, 'Six-digit issuing authority identifier (IIN).', false, 'service');
  field(result, track, 'id', 'Encoded ID number', id + (overflow === '=' ? '' : overflow), cursor, cursor += id.length, 'Numeric encoding on the stripe; letters and leading zeros may differ from the printed ID. Overflow, if present, is appended.', true, 'identity');
  cursor++;
  field(result, track, 'expiry', 'Expiration', expiry(exp, true) || 'Invalid month', cursor, cursor += 4, 'YYMM. Special months: 77 = non-expiring; 88 = end of birth month in the following year; 99 = birthday in the encoded year. The century is not encoded.', true, 'date');
  field(result, track, 'dob', 'Date of birth', dateOfBirth(dob) || 'Invalid date', cursor, cursor += 8, 'Eight digits in YYYYMMDD order.', true, 'date');
  if (overflow !== '=' && overflow.length) track.parts.push({ start: cursor, end: cursor + overflow.length, label: 'ID number overflow', sensitive: true, category: 'identity' });
  if (!dateOfBirth(dob)) result.warnings.push('The birth date is not a valid calendar date. Try swiping again.');
  if (!expiry(exp, true)) result.warnings.push('The ID expiration month is not recognized.');
  if (!isIdIssuer(issuer)) result.warnings.push('The issuer number is not in the bundled AAMVA issuer list. ID format was selected manually or inferred from another track.');
  track.decoded = true;
}

function idTrack3(result, track) {
  // The reader may translate the AAMVA % start sentinel to #.
  const body = track.raw.slice(1, -1);
  if (!/^[%#]/.test(track.raw) || !/^0\d/.test(body) || body.length < 42) return;
  let cursor = 1;
  const definitions = [
    ['version', 'Format version', 2, false, 'CDS version followed by the jurisdiction revision. Only CDS version 0 is decoded.'],
    ['postal', 'Postal code', 11, true, 'Fixed-width postal code, padded with spaces.'],
    ['class', 'License class', 2, false, 'Class code; its meaning depends on the issuing jurisdiction.'],
    ['restrictions', 'Restrictions', 10, false, 'Jurisdiction-specific restriction codes.'],
    ['endorsements', 'Endorsements', 4, false, 'Jurisdiction-specific endorsement codes.'],
    ['sex', 'Sex code', 1, true, 'Legacy AAMVA codes: 1 = male, 2 = female, 9 = not specified.'],
    ['height', 'Height code', 3, true, 'Encoded value. Units and interpretation depend on the jurisdiction.'],
    ['weight', 'Weight code', 3, true, 'Encoded value. Units and interpretation depend on the jurisdiction.'],
    ['hair', 'Hair color code', 3, true, 'The color code exactly as encoded.'],
    ['eyes', 'Eye color code', 3, true, 'The color code exactly as encoded.'],
  ];
  for (const [key, label, length, sensitive, description] of definitions) {
    const value = track.raw.slice(cursor, cursor + length).trim() || 'Not provided';
    field(result, track, key, label, value, cursor, cursor + length, description, sensitive, sensitive ? 'identity' : 'service');
    cursor += length;
  }
  if (cursor < track.raw.length - 1) field(result, track, 'discretionary', 'Jurisdiction data', `${track.raw.length - 1 - cursor} characters`, cursor, track.raw.length - 1, 'Optional data whose layout is specific to the issuer.', true, 'issuer');
  track.decoded = true;
}

export function parseSwipe(input, mode = 'auto') {
  const result = { kind: 'unknown', title: 'Unrecognized swipe', tracks: [], fields: [], warnings: [] };
  if (typeof input !== 'string' || !input.trim()) { result.warnings.push('No swipe data received. Focus this page and try again.'); return result; }
  if (input.length > MAX_INPUT) { result.warnings.push('The input is too long for a magnetic stripe. Clear it and try one swipe.'); return result; }
  if (/ANSI |AAMVA|^@\s*[\r\n]/.test(input)) { result.warnings.push('This looks like a PDF417 barcode, not a magnetic stripe. Barcode decoding is not supported in this demo.'); return result; }
  result.tracks = tokenize(input, result.warnings);
  const idEvidence = result.tracks.some(t => t.number === 1 && jurisdictions.has(t.raw.slice(1, 3)) && t.raw.includes('$')) ||
    result.tracks.some(t => t.number === 2 && isIdIssuer(t.raw.slice(1, 7)));
  const payEvidence = result.tracks.some(t => /^%B\d/.test(t.raw) || /^;\d{12,19}=\d{7}/.test(t.raw));
  result.kind = mode === 'id' || (mode === 'auto' && idEvidence) ? 'id' : mode === 'payment' || payEvidence ? 'payment' : 'unknown';
  for (const track of result.tracks) {
    if (!track.complete) { result.warnings.push(`Track ${track.number} is incomplete (missing ? end marker). Try swiping again.`); continue; }
    if (result.kind === 'payment') payment(result, track);
    if (result.kind === 'id') {
      if (track.number === 1) idTrack1(result, track);
      if (track.number === 2) idTrack2(result, track);
      if (track.number === 3) idTrack3(result, track);
    }
    if (!track.decoded) result.warnings.push(`Track ${track.number} is present but its layout is unsupported. Its data is left uninterpreted.`);
  }
  const seen = new Set();
  for (const t of result.tracks) {
    if (seen.has(t.number)) result.warnings.push(`More than one Track ${t.number} was received. Clear and swipe one card at a time.`);
    seen.add(t.number);
  }
  for (const key of ['pan', 'expiry', 'service']) {
    const values = result.fields.filter(f => f.key === key).map(f => f.value);
    if (new Set(values).size > 1) result.warnings.push(`${key === 'pan' ? 'Card number' : key === 'expiry' ? 'Expiration' : 'Service code'} differs between tracks. Try a fresh swipe; these may be mixed or damaged reads.`);
  }
  if (!result.fields.length) {
    result.kind = 'unknown';
    result.warnings.push('No supported fields found. Check that the reader sends plain-text tracks with start and end markers; encrypted and proprietary outputs cannot be decoded here.');
  }
  result.title = result.kind === 'id' ? 'State ID / driver license' : result.kind === 'payment' ? 'Credit / debit card' : 'Unrecognized swipe';
  result.warnings = [...new Set(result.warnings)];
  return result;
}
