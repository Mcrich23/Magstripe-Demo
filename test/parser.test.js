import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseSwipe, luhn, mask, MAX_INPUT } from '../public/parser.js';
import { samples } from '../public/samples.js';
const value = (r, key) => r.fields.find(f => f.key === key)?.value;

test('payment tracks decode and annotate exact byte ranges', () => {
  const r = parseSwipe(samples.payment);
  assert.equal(r.kind, 'payment'); assert.equal(r.tracks.length, 2); assert.deepEqual(r.warnings, []);
  assert.equal(value(r, 'pan'), '4242424242424242'); assert.equal(value(r, 'expiry'), '12 / 29');
  assert.equal(value(r, 'name'), 'EXAMPLE/JAMIE'); assert.equal(value(r, 'service'), '101');
  for (const t of r.tracks) for (const part of t.parts) {
    assert.ok(part.start < part.end); assert.ok(part.end < t.raw.length);
    if (part.key === 'pan') assert.equal(t.raw.slice(part.start, part.end), part.value);
  }
});
test('single payment track and CR/LF/tab framing', () => {
  for (const track of samples.payment.match(/[^?]+\?/g)) assert.equal(parseSwipe(track).kind, 'payment');
  assert.equal(parseSwipe('\x02' + samples.payment.replace('?;', '?\r\n\t;') + '\x03\r\n').tracks.length, 2);
});
test('legacy ID decodes all three tracks with fixed-width spaces preserved', () => {
  const r = parseSwipe(samples.id);
  assert.equal(r.kind, 'id'); assert.deepEqual(r.warnings, []);
  assert.equal(value(r, 'name'), 'EXAMPLE / JAMIE'); assert.equal(value(r, 'dob'), '1990-06-15');
  assert.equal(value(r, 'id'), '000000001'); assert.equal(value(r, 'class'), 'C');
  assert.equal(value(r, 'postal'), '00000'); assert.equal(value(r, 'eyes'), 'GRN');
});
test('ID track 2 is not mistaken for a payment card', () => {
  const r = parseSwipe(';636014000000001=291219900615=?');
  assert.equal(r.kind, 'id'); assert.equal(value(r, 'dob'), '1990-06-15');
});
test('ID overflow appended; no alpha reconstruction is guessed', () => {
  const r = parseSwipe(';6360140123456789012=29121990061534567?');
  assert.equal(value(r, 'id'), '012345678901234567');
});
test('maximum-width ID city and name may omit separators', () => {
  const city = 'ABCDEFGHIJKLM', name = 'EXAMPLE$JAMIE'.padEnd(35, ' ');
  const r = parseSwipe(`%CA${city}${name}123 DEMO LANE?`);
  assert.equal(value(r, 'city'), city); assert.equal(value(r, 'name'), 'EXAMPLE / JAMIE');
  assert.equal(value(r, 'address'), '123 DEMO LANE');
});
test('date validity, leap years, and special ID expiration values', () => {
  assert.ok(parseSwipe(';6360141=291219900230=?').warnings.some(w => w.includes('calendar')));
  assert.equal(value(parseSwipe(';6360141=291220000229=?'), 'dob'), '2000-02-29');
  assert.ok(parseSwipe(';6360141=291219000229=?').warnings.some(w => w.includes('calendar')));
  for (const month of ['77', '88', '99']) assert.ok(!parseSwipe(`;6360141=29${month}19900615=?`).warnings.length);
  assert.equal(value(parseSwipe(';6360141=297719900615=?'), 'expiry'), 'Non-expiring (77)');
  assert.ok(parseSwipe(samples.payment.replaceAll('2912', '2913')).warnings.some(w => w.includes('month')));
});
test('damaged, unsupported, duplicate and contradictory data produce diagnostics', () => {
  assert.ok(parseSwipe(samples.payment.replace('?;', ';')).warnings.some(w => w.includes('incomplete')));
  assert.equal(parseSwipe('%Bbroken').kind, 'unknown');
  assert.equal(parseSwipe('encrypted-output').kind, 'unknown');
  assert.ok(parseSwipe(samples.payment + samples.payment).warnings.some(w => w.includes('More than one')));
  assert.ok(parseSwipe(samples.payment.replace(';4242424242424242', ';4111111111111111')).warnings.some(w => w.includes('differs')));
  assert.ok(parseSwipe(samples.payment.replaceAll('4242424242424242', '4242424242424241')).warnings.some(w => w.includes('Luhn')));
  assert.equal(parseSwipe('x'.repeat(MAX_INPUT + 1)).tracks.length, 0);
  assert.equal(parseSwipe(null).kind, 'unknown');
  assert.ok(parseSwipe('@\n\x1e\rANSI 636014').warnings[0].includes('PDF417'));
});
test('unknown track 3 remains opaque; translated AAMVA track 3 works', () => {
  assert.ok(parseSwipe(samples.id.replace('%00', '%10')).warnings.some(w => w.includes('unsupported')));
  assert.equal(value(parseSwipe(samples.id.replace('%00', '#00')), 'postal'), '00000');
});
test('manual ID mode permits unknown issuer without claiming it is known', () => {
  const r = parseSwipe(';699999123=291219900615=?', 'id');
  assert.equal(r.kind, 'id'); assert.ok(r.warnings.some(w => w.includes('issuer list')));
});
test('Luhn and redaction handle sensitive values', () => {
  assert.equal(luhn('4242424242424242'), true); assert.equal(luhn('0000000000000000'), false);
  assert.equal(luhn('123'), false); assert.equal(mask('4242424242424242', true), '•••• 4242');
  assert.equal(mask('EXAMPLE/JAMIE'), '••••••••');
});
