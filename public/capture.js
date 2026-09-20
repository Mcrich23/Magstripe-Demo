import { MAX_INPUT } from './parser.js';

/** Accumulate a whole swipe across per-track Enter/Tab terminators.
 * No timing-based human/scanner detection: capture is explicitly armed by the UI.
 */
export class SwipeCapture {
  constructor({ onSwipe, onProgress = () => {}, onError = () => {}, delay = 700,
    schedule = (callback, ms) => setTimeout(callback, ms), cancel = id => clearTimeout(id) }) {
    Object.assign(this, { onSwipe, onProgress, onError, delay, schedule, cancel });
    this.buffer = ''; this.timer = null; this.armed = false;
  }
  reset() { this.cancel(this.timer); this.timer = null; this.buffer = ''; }
  arm() { this.reset(); this.armed = true; }
  stop() { this.armed = false; this.reset(); }
  push(key) {
    if (!this.armed) return false;
    if (key === 'Escape') { this.reset(); this.onProgress(0); return true; }
    if (key.length !== 1 && !['Enter', 'Tab'].includes(key)) return false;
    if (!this.buffer && !/^[%;#+!]$/.test(key)) return false;
    if (key.length === 1) this.buffer += key;
    if (this.buffer.length > MAX_INPUT) { this.reset(); this.onError('Too much input. Clear the reader and try one swipe.'); return true; }
    this.onProgress(this.buffer.length);
    this.cancel(this.timer);
    this.timer = this.schedule(() => {
      const raw = this.buffer; this.reset();
      if (raw) this.onSwipe(raw);
    }, this.delay);
    return true;
  }
}
