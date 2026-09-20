import { MAX_INPUT } from './parser.js';

/** Combine tracks across per-track Enter/Tab terminators, with a bounded buffer. */
export class SwipeCapture {
  constructor({ onSwipe, onProgress = () => {}, onError = () => {}, delay = 700,
    schedule = (callback, ms) => setTimeout(callback, ms), cancel = id => clearTimeout(id) }) {
    Object.assign(this, { onSwipe, onProgress, onError, delay, schedule, cancel });
    this.buffer = ''; this.timer = null; this.armed = false;
  }
  reset() { this.cancel(this.timer); this.timer = null; this.buffer = ''; }
  arm() { this.reset(); this.armed = true; }
  stop() { this.armed = false; this.reset(); }
  flush() {
    const raw = this.buffer; this.reset();
    if (raw) this.onSwipe(raw);
  }
  replace(value) {
    if (!this.armed) return false;
    this.cancel(this.timer);
    if (value.length > MAX_INPUT) {
      this.reset(); this.onError('Too much input. Try one swipe.'); return true;
    }
    this.buffer = value;
    this.onProgress(value.length);
    if (value) this.timer = this.schedule(() => this.flush(), this.delay);
    return true;
  }
  push(key) {
    if (!this.armed) return false;
    if (key === 'Escape') { this.reset(); this.onProgress(0); return true; }
    if (key.length !== 1 && !['Enter', 'Tab'].includes(key)) return false;
    if (!this.buffer && !/^[%;#+!]$/.test(key)) return false;
    return this.replace(this.buffer + (key.length === 1 ? key : ''));
  }
}
