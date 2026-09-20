import { test } from 'node:test';
import assert from 'node:assert/strict';
import { samples } from '../public/samples.js';

// Exercise the actual UI controller with document lifecycle events and a clock.
// Browser rendering and physical reader behavior are verified separately.
test('hands-free lifecycle: successive swipes, focus recovery, and automatic clearing', async t => {
  class Node extends EventTarget {
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
  assert.equal(node('reader-note').textContent, 'Keep this window active. Swipes appear automatically.');
  type('%');
  assert.equal(node('reading-state').hidden, false);
  assert.equal(node('empty-state').hidden, true);
  assert.match(node('reading-progress').textContent, /^1 character received/);
  type(samples.payment.slice(1).replace('?;', '?\n;'));
  assert.match(node('reading-progress').textContent, /^87 characters received/);
  type('\n'); // The reader's trailing Enter must not clear the incoming swipe.
  finish();
  assert.equal(node('reading-state').hidden, true);
  assert.equal(node('reading-progress').textContent, '');
  assert.equal(number(), '•••• 4242');
  assert.equal(node('fields').children.length, 5);
  assert.equal(node('fields-table').hidden, false);
  assert.equal(node('track-structures').children.length, 2);
  const stream = node('track-structures').children[0].children[1];
  assert.equal(stream.children.map(part => part.textContent).join(''), '%B••••••••••••4242^EXAMPLE/JAMIE^29121010000000000?');
  assert.equal(node('checks').children[0].children[1].textContent, 'Pass');
  assert.equal(node('checks').children[1].children[1].textContent, 'Match');
  assert.equal(node('clear-swipe').hidden, false);
  type('\n');
  assert.equal(node('result-card').hidden, true);
  assert.equal(node('empty-state').hidden, false);
  assert.equal(node('clear-swipe').hidden, true);
  assert.equal(node('fields').children.length, 0);
  assert.equal(node('track-structures').children.length, 0);
  assert.equal(node('countdown').textContent, 'Swipe automatically clears after 30 seconds.');
  type(samples.payment); finish();
  node('clear-swipe').dispatchEvent(new Event('click'));
  assert.equal(node('result-card').hidden, true);
  assert.equal(node('clear-swipe').hidden, true);
  assert.equal(node('fields').children.length, 0);
  assert.equal(node('checks').children.length, 0);
  type(';4111111111111111=2912101000?'); finish();
  assert.equal(number(), '•••• 1111');
  type('%B4242'); doc.focused = false; win.dispatchEvent(new Event('blur')); finish();
  assert.equal(node('result-card').hidden, true);
  assert.equal(node('reading-state').hidden, true);
  assert.equal(node('reader-note').textContent, 'Listening resumes when this window is active.');
  doc.focused = true; win.dispatchEvent(new Event('focus'));
  assert.equal(node('reader-note').textContent, 'Keep this window active. Swipes appear automatically.');
  type(samples.payment); finish(); assert.equal(number(), '•••• 4242');
  assert.equal(node('countdown').textContent, 'Swipe automatically clears in 30 seconds.');
  now += 1000; tick();
  assert.equal(node('countdown').textContent, 'Swipe automatically clears in 29 seconds.');
  // A new card receives a fresh countdown.
  type(samples.payment); finish();
  assert.equal(node('countdown').textContent, 'Swipe automatically clears in 30 seconds.');
  now += 29_000; tick();
  assert.equal(node('countdown').textContent, 'Swipe automatically clears in 1 second.');
  assert.equal(node('result-card').hidden, false);
  now += 1000; tick(); assert.equal(node('result-card').hidden, true);
  assert.equal(node('track-structures').children.length, 0);
  assert.equal(node('checks').children.length, 0);
  assert.equal(node('countdown').textContent, 'Swipe automatically clears after 30 seconds.');
  type(samples.payment); finish(); assert.equal(number(), '•••• 4242');
  doc.hidden = true; doc.dispatchEvent(new Event('visibilitychange')); finish();
  assert.equal(node('result-card').hidden, true);
  doc.hidden = false; doc.dispatchEvent(new Event('visibilitychange'));
  type(';4111111111111111=2912101000?'); finish(); assert.equal(number(), '•••• 1111');
});
