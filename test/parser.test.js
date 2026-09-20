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
test('Luhn and redaction handle sensitive values', () => {
  assert.equal(luhn('4242424242424242'), true); assert.equal(luhn('0000000000000000'), false);
  assert.equal(luhn('123'), false); assert.equal(mask('4242424242424242', true), '•••• 4242');
  assert.equal(mask('EXAMPLE/JAMIE'), '••••••••');
});

test('invalid payment dates and unsupported tracks remain explicit', () => {
  assert.ok(parseSwipe(samples.payment.replaceAll('2912', '2913')).warnings.some(w => w.includes('month')));
  const r = parseSwipe(samples.payment + '+0123456789?');
  assert.equal(r.tracks.length, 3); assert.equal(r.tracks[2].decoded, false);
  assert.ok(r.warnings.some(w => w.includes('unsupported')));
});
test('non-payment ID data is not decoded as a payment card', () => {
  const r = parseSwipe('%CASAMPLE CITY^EXAMPLE$JAMIE^123 DEMO LANE^?');
  assert.equal(r.kind, 'unknown'); assert.equal(r.fields.length, 0);
});
