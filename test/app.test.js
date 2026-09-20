import { test } from 'node:test';
import assert from 'node:assert/strict';
import { samples } from '../public/samples.js';

// Exercise the actual UI controller with document lifecycle events and a clock.
// Browser rendering and physical reader behavior are verified separately.
test('hands-free lifecycle: successive swipes, focus recovery, and automatic clearing', async t => {
  class Node {
    textContent = ''; hidden = false; children = [];
    classList = { remove() {}, toggle() {} };
    append(...nodes) { this.children.push(...nodes); }
    replaceChildren(...nodes) { this.children = nodes; }
  }
  class Document extends EventTarget {
    hidden = false; focused = true; nodes = new Map();
    hasFocus() { return this.focused; }
    getElementById(id) { if (!this.nodes.has(id)) this.nodes.set(id, new Node()); return this.nodes.get(id); }
    querySelector(selector) { return this.getElementById(selector); }
    createElement() { return new Node(); }
  }
  const doc = new Document(), win = new EventTarget();
  const originalDocument = Object.getOwnPropertyDescriptor(globalThis, 'document');
  const originalWindow = Object.getOwnPropertyDescriptor(globalThis, 'window');
  Object.defineProperty(globalThis, 'document', { configurable: true, value: doc });
  Object.defineProperty(globalThis, 'window', { configurable: true, value: win });
  t.after(() => {
    if (originalDocument) Object.defineProperty(globalThis, 'document', originalDocument); else delete globalThis.document;
    if (originalWindow) Object.defineProperty(globalThis, 'window', originalWindow); else delete globalThis.window;
  });
  const pending = new Map(); let id = 0, tick, now = 1000;
  t.mock.method(globalThis, 'setTimeout', callback => { pending.set(++id, callback); return id; });
  t.mock.method(globalThis, 'clearTimeout', key => pending.delete(key));
  t.mock.method(globalThis, 'setInterval', callback => { tick = callback; return 1; });
  t.mock.method(Date, 'now', () => now);
  await import('../public/app.js');
  const node = key => doc.getElementById(key);
  const type = raw => {
    for (const key of raw) doc.dispatchEvent(Object.assign(new Event('keydown', { cancelable: true }), { key: key === '\n' ? 'Enter' : key }));
  };
  const finish = () => { for (const callback of [...pending.values()]) callback(); };
  const number = () => node('fields').children[0].children[1].textContent;
  assert.equal(node('status').textContent, 'Ready for a swipe');
  type(samples.payment.replace('?;', '?\n;')); finish();
  assert.equal(number(), '•••• 4242');
  assert.equal(node('fields').children.length, 4);
  assert.equal(node('extra-fields').children.length, 2);
  assert.equal(node('extra-fields').hidden, false);
  type(';4111111111111111=2912101000?'); finish();
  assert.equal(number(), '•••• 1111');
  type('%B4242'); doc.focused = false; win.dispatchEvent(new Event('blur')); finish();
  assert.equal(node('result-card').hidden, true);
  assert.equal(node('status').textContent, 'Waiting for this window');
  doc.focused = true; win.dispatchEvent(new Event('focus'));
  assert.equal(node('status').textContent, 'Ready for a swipe');
  type(samples.payment); finish(); assert.equal(number(), '•••• 4242');
  now += 60_000; tick(); assert.equal(node('result-card').hidden, true);
  type(samples.payment); finish(); assert.equal(number(), '•••• 4242');
  doc.hidden = true; doc.dispatchEvent(new Event('visibilitychange')); finish();
  assert.equal(node('result-card').hidden, true);
  doc.hidden = false; doc.dispatchEvent(new Event('visibilitychange'));
  type(';4111111111111111=2912101000?'); finish(); assert.equal(number(), '•••• 1111');
});
