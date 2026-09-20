import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SwipeCapture } from '../public/capture.js';
import { samples } from '../public/samples.js';
function setup() {
  const jobs = new Map(), swipes = [], errors = []; let seq = 0;
  const capture = new SwipeCapture({ onSwipe: s => swipes.push(s), onError: e => errors.push(e),
    schedule: f => { jobs.set(++seq, f); return seq; }, cancel: id => jobs.delete(id) });
  return { capture, swipes, errors, flush: () => { const pending = [...jobs.values()]; jobs.clear(); pending.forEach(f => f()); } };
}
test('explicit arming; per-track Enter/Tab wait for entire swipe', () => {
  const { capture: c, swipes, flush } = setup();
  assert.equal(c.push('%'), false); c.arm();
  assert.equal(c.push('x'), false); assert.equal(c.push('Enter'), false);
  for (const track of samples.payment.match(/[^?]+\?/g)) {
    [...track].forEach(k => c.push(k)); c.push('Enter'); c.push('Tab');
  }
  assert.equal(swipes.length, 0); flush(); assert.deepEqual(swipes, [samples.payment]);
  assert.equal(c.buffer, ''); assert.equal(c.armed, true);
});
test('idle completes without terminator; subsequent swipes are independent', () => {
  const { capture: c, swipes, flush } = setup(); c.arm();
  [...samples.payment].forEach(k => c.push(k)); flush();
  const singleTrack = ';4111111111111111=2912101000?';
  [...singleTrack].forEach(k => c.push(k)); flush();
  assert.deepEqual(swipes, [samples.payment, singleTrack]);
});
test('stop/escape clear partial input and pending callback', () => {
  const { capture: c, swipes, flush } = setup(); c.arm();
  c.push('%'); c.stop(); flush(); assert.equal(swipes.length, 0);
  c.arm(); c.push(';'); c.push('Escape'); flush(); assert.equal(swipes.length, 0);
});
test('bounded capture fails without emitting the oversized payload', () => {
  const { capture: c, errors, swipes, flush } = setup(); c.arm();
  c.push('%'); for (let i = 0; i < 4096; i++) c.push('1');
  flush(); assert.equal(errors.length, 1); assert.equal(swipes.length, 0); assert.equal(c.buffer, '');
});
