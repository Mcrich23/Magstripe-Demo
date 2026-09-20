import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseSwipe, luhn, mask, MAX_INPUT } from '../public/parser.js';
import { samples } from '../public/samples.js';
const value = (r, key) => r.fields.find(f => f.key === key)?.value;

test('membership Track 1 decodes numeric ID, name, and extra data without payment assumptions', () => {
  const r = parseSwipe(samples.membership);
  assert.equal(r.kind, 'membership'); assert.deepEqual(r.warnings, []);
  assert.equal(value(r, 'memberId'), '7000000012345678');
  assert.equal(value(r, 'name'), 'EXAMPLE/JAMIE');
  assert.equal(value(r, 'extra'), '000000000000');
  for (const key of ['pan', 'expiry', 'service']) assert.equal(value(r, key), undefined);
  for (const part of r.tracks[0].parts) assert.equal(r.tracks[0].raw.slice(part.start, part.end), part.value);
  const other = parseSwipe('%00123456^SAMPLE/CASEY^ABC123?');
  assert.equal(value(other, 'memberId'), '00123456');
  assert.equal(value(other, 'extra'), 'ABC123');
  assert.equal(parseSwipe('%12345^^?').kind, 'membership');
});

test('membership read survives missing Track 2 while incomplete Track 1 stays hidden', () => {
  const r = parseSwipe(samples.membership + ';');
  assert.equal(r.kind, 'membership'); assert.equal(r.tracks[0].decoded, true);
  assert.equal(r.tracks[1].decoded, false);
  assert.ok(r.warnings.some(w => w.includes('Track 2 is incomplete')));
  assert.ok(!r.warnings.some(w => /Luhn|expiration|Track 1/.test(w)));
  assert.equal(parseSwipe(samples.membership.slice(0, -1)).kind, 'unknown');
  assert.equal(parseSwipe('%abc^EXAMPLE/JAMIE^000?').kind, 'unknown');
  assert.equal(parseSwipe(samples.membership + samples.payment).kind, 'payment');
});

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

test('student profile decodes the repeated ID at exact offsets', () => {
  const r = parseSwipe(samples.student.replace('?;', '?\r\n;'));
  assert.equal(r.kind, 'student'); assert.deepEqual(r.warnings, []);
  assert.deepEqual(r.tracks.map(t => t.number), [1, 2]);
  assert.equal(value(r, 'studentId'), '1234567');
  assert.equal(value(r, 'suffix'), undefined);
  assert.equal(value(r, 'pan'), undefined);
  for (const t of r.tracks) for (const part of t.parts) {
    assert.equal(t.raw.slice(part.start, part.end), part.value);
  }
  const zero = parseSwipe('%0123456?;012345600?');
  assert.equal(value(zero, 'studentId'), '0123456');
});

test('student detection is limited to the supplied layout and flags mismatches', () => {
  for (const raw of ['%1234567?', ';12345678?', ';1234567890?', ';1234567XX?', ';123456742', '%1234567?;123456742',
    '%123456?;12345642?', '%1234567?;1234567XX?', samples.student + samples.student]) {
    assert.equal(parseSwipe(raw).kind, 'unknown');
  }
  const mismatch = parseSwipe('%1234567?;765432142?');
  assert.equal(mismatch.kind, 'student');
  assert.ok(mismatch.warnings.some(w => w.includes('Student ID differs')));
  assert.equal(parseSwipe(samples.student + samples.payment).kind, 'payment');
});

test('single student Track 2 accepts different IDs and preserves leading zeros', () => {
  for (const [id, tail] of [['1234567', '42'], ['7654321', '09'], ['0123456', '00']]) {
    const r = parseSwipe(`;${id}${tail}?\r\n`);
    assert.equal(r.kind, 'student'); assert.deepEqual(r.warnings, []);
    assert.equal(r.tracks.length, 1); assert.equal(r.tracks[0].number, 2);
    assert.equal(value(r, 'studentId'), id);
    assert.equal(r.fields.length, 1);
  }
});
