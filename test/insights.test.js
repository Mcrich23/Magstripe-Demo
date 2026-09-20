import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseSwipe, describeSwipe } from '../public/parser.js';
import { samples } from '../public/samples.js';
const describe = raw => describeSwipe(parseSwipe(raw));

test('annotated tracks preserve encoded order while masking PAN and showing issuer values', () => {
  const r = describe(samples.payment.replaceAll('0000000000', '1234567890'));
  assert.equal(r.checksum, 'Pass'); assert.equal(r.agreement, 'Match');
  assert.equal(r.tracks[0].characters, 51);
  assert.deepEqual(r.tracks[0].segments.map(s => s.text), ['%', 'B', '••••••••••••4242', '^', 'EXAMPLE/JAMIE', '^', '2912', '101', '1234567890', '?']);
  assert.equal(r.tracks[0].segments[2].label, 'Card number · 16');
  assert.equal(r.tracks[1].segments[2].text, '=');
  assert.ok(!JSON.stringify(r).includes('4242424242424242'));
  assert.ok(JSON.stringify(r).includes('1234567890'));
});
test('checks distinguish failed checksum, contradictory fields, duplicate and partial tracks', () => {
  assert.equal(describe(samples.payment.replaceAll('4242424242424242', '4242424242424241')).checksum, 'Fail');
  assert.equal(describe(samples.payment.replace(';4242424242424242', ';4111111111111111')).agreement, 'Mismatch');
  assert.equal(describe(samples.payment.replace(';4242424242424242=2912', ';4242424242424242=3012')).agreement, 'Mismatch');
  assert.equal(describe(';4242424242424242=2912101000?').agreement, 'Single track');
  assert.equal(describe(samples.payment + samples.payment).agreement, 'Duplicate tracks');
  const partial = describe(samples.payment.slice(0, -1));
  assert.equal(partial.agreement, 'Not checked'); assert.deepEqual(partial.tracks[1].segments, []);
  assert.equal(describe('unrecognized').checksum, 'Not checked');
});
test('unsupported data stays hidden and long issuer data is shown exactly', () => {
  const unknown = describe('%SECRET CARD DATA?');
  assert.deepEqual(unknown.tracks[0].segments, []);
  assert.ok(!JSON.stringify(unknown).includes('SECRET CARD DATA'));
  const long = describe(';4242424242424242=2912101' + '1'.repeat(100) + '?');
  const issuer = long.tracks[0].segments.find(s => s.label.startsWith('Issuer'));
  assert.equal(issuer.label, 'Issuer data · 100'); assert.equal(issuer.text, '1'.repeat(100));
});

test('student explanation preserves the swipe without inventing separators or a checksum', () => {
  const r = describe(samples.student);
  assert.equal(r.checksum, 'Not checked'); assert.equal(r.agreement, 'Match');
  assert.deepEqual(r.tracks[0].segments.map(s => s.text), ['%', '1234567', '?']);
  assert.deepEqual(r.tracks[1].segments.map(s => s.text), [';', '1234567', '42', '?']);
  assert.deepEqual(r.tracks[1].segments[2], { text: '42', kind: 'literal' });
  assert.equal(r.tracks.map(t => t.segments.map(s => s.text).join('')).join(''), samples.student);
  assert.equal(describe('%1234567?;765432142?').agreement, 'Mismatch');
  assert.equal(describe(';123456742?%1234567?').agreement, 'Match');
});
