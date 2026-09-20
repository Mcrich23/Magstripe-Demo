/** Offline interpretation of text delivered by a keyboard-wedge reader.
 * This does not authenticate a card, check a balance, or validate a physical read.
 * Format references and intentional limitations: docs/formats.md.
 */
export const MAX_INPUT = 4096;
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

function expiry(raw) {
  const month = raw.slice(2);
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

export function parseSwipe(input) {
  const result = { kind: 'unknown', title: 'Unrecognized swipe', tracks: [], fields: [], warnings: [] };
  if (typeof input !== 'string' || !input.trim()) { result.warnings.push('No swipe data received. Focus this page and try again.'); return result; }
  if (input.length > MAX_INPUT) { result.warnings.push('The input is too long for a magnetic stripe. Clear it and try one swipe.'); return result; }
  if (/ANSI |AAMVA|^@\s*[\r\n]/.test(input)) { result.warnings.push('This looks like a PDF417 barcode, not a magnetic stripe. Barcode decoding is not supported in this demo.'); return result; }
  result.tracks = tokenize(input, result.warnings);
  const payEvidence = result.tracks.some(t => /^%B\d/.test(t.raw) || /^;\d{12,19}=\d{7}/.test(t.raw));
  result.kind = payEvidence ? 'payment' : 'unknown';
  for (const track of result.tracks) {
    if (!track.complete) { result.warnings.push(`Track ${track.number} is incomplete (missing ? end marker). Try swiping again.`); continue; }
    if (result.kind === 'payment') payment(result, track);
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
  result.title = result.kind === 'payment' ? 'Credit / debit card' : 'Unrecognized swipe';
  result.warnings = [...new Set(result.warnings)];
  return result;
}
