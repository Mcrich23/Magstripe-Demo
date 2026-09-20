import { parseSwipe, mask, describeSwipe } from './parser.js';
import { SwipeCapture } from './capture.js';

const $ = id => document.getElementById(id);
const CLEAR_AFTER_SECONDS = 30;
let result = null;
let deadline = 0;
const capture = new SwipeCapture({
  onSwipe: raw => showResult(raw),
  onProgress: count => {
    // Discard the old card without resetting the new swipe's buffer.
    if (count && result) clearResult(false);
    if (count) $('status').textContent = 'Reading card…';
  },
  onError: () => {
    clearResult();
    $('status').textContent = 'Too much input — try one swipe';
  },
});

function clearResult(resetCapture = true) {
  if (resetCapture) capture.reset();
  result = null; deadline = 0;
  updateCountdown();
  $('fields').replaceChildren(); $('extra-fields').replaceChildren();
  $('track-structures').replaceChildren(); $('checks').replaceChildren();
  $('read-note').textContent = ''; $('read-note').hidden = true;
  $('result-card').hidden = true; $('empty-state').hidden = false;
  document.querySelector('.status-card').classList.remove('has-result');
  $('status').textContent = capture.armed ? 'Ready for a swipe' : 'Waiting for this window';
}
function addField(container, label, value) {
  const row = document.createElement('div'); row.className = 'field';
  const term = document.createElement('dt'); term.textContent = label;
  const detail = document.createElement('dd'); detail.textContent = value || 'Not available';
  row.append(term, detail); container.append(row);
}
function formatName(value) {
  if (!value || value === 'Not provided') return 'Not available';
  const [family, ...given] = value.trim().split('/');
  return (given.length ? `${given.join(' ')} ${family}` : family).replace(/\s+/g, ' ').trim();
}
function showResult(raw) {
  capture.reset();
  result = parseSwipe(raw); deadline = Date.now() + CLEAR_AFTER_SECONDS * 1000;
  updateCountdown();
  const get = key => result.fields.find(field => field.key === key)?.value;
  const tracks = [...new Set(result.tracks.filter(track => track.decoded).map(track => track.number))];
  $('fields').replaceChildren(); $('extra-fields').replaceChildren();
  addField($('fields'), 'Card number', get('pan') ? mask(get('pan'), true) : null);
  addField($('fields'), 'Cardholder', formatName(get('name')));
  addField($('fields'), 'Expiration', get('expiry'));
  addField($('fields'), 'Track format', tracks.length ? `Track ${tracks.join(' + ')}` : 'Unknown');
  addField($('extra-fields'), 'Service code', get('service'));
  addField($('extra-fields'), 'Issuer data', get('discretionary'));
  $('extra-fields').hidden = result.kind === 'unknown';
  $('read-note').hidden = !result.warnings.length;
  $('read-note').textContent = result.warnings.length ? result.warnings[0] : '';
  $('empty-state').hidden = true; $('result-card').hidden = false;
  document.querySelector('.status-card').classList.toggle('has-result', result.kind === 'payment');
  $('status').textContent = result.kind === 'unknown' ? 'Swipe received — unrecognized format'
    : result.warnings.length ? 'Swipe received — check the read' : 'Card read';
  $('reader-note').textContent = 'Ready for the next swipe.';
  showTechnicalDetails();
}

function showTechnicalDetails() {
  const info = describeSwipe(result);
  $('checks').replaceChildren(); $('track-structures').replaceChildren();
  addField($('checks'), 'Luhn checksum', info.checksum);
  addField($('checks'), 'Shared fields', info.agreement);
  for (const track of info.tracks) {
    const row = document.createElement('div'); row.className = 'track-structure';
    const label = document.createElement('p');
    label.textContent = `Track ${track.number} · ${track.characters} characters`;
    const layout = document.createElement('div'); layout.className = 'track-segments';
    for (const segment of track.segments) {
      const piece = document.createElement('div'); piece.className = `track-piece${segment.kind === 'marker' ? ' marker' : ''}`;
      const code = document.createElement('code'); code.textContent = segment.text;
      const caption = document.createElement('span'); caption.textContent = segment.label;
      piece.append(code, caption); layout.append(piece);
    }
    if (track.note) { const note = document.createElement('p'); note.textContent = track.note; layout.append(note); }
    row.append(label, layout); $('track-structures').append(row);
  }
}

function pauseReader() {
  capture.stop(); clearResult();
  $('reader-note').textContent = 'Listening resumes when this window is active.';
}
function resumeReader() {
  if (document.hidden || !document.hasFocus()) return;
  if (!capture.armed) capture.arm();
  if (!result && !capture.buffer) $('status').textContent = 'Ready for a swipe';
  $('reader-note').textContent = result ? 'Ready for the next swipe.' : 'Keep this window active. Swipes appear automatically.';
}
document.addEventListener('keydown', event => {
  if (event.ctrlKey || event.metaKey || event.altKey || event.isComposing || document.hidden) return;
  // A delivered key also resumes capture if focus events arrived out of order.
  if (!capture.armed) resumeReader();
  if (event.key === 'Escape') { event.preventDefault(); clearResult(); return; }
  if (capture.push(event.key) || event.key === 'Enter' || event.key === 'Tab') event.preventDefault();
}, true);
window.addEventListener('blur', pauseReader);
window.addEventListener('focus', resumeReader);
document.addEventListener('visibilitychange', () => { if (document.hidden) pauseReader(); else resumeReader(); });
window.addEventListener('pagehide', pauseReader);
window.addEventListener('pageshow', resumeReader);
function updateCountdown() {
  const seconds = result ? Math.max(0, Math.ceil((deadline - Date.now()) / 1000)) : CLEAR_AFTER_SECONDS;
  if (result && seconds === 0) { clearResult(); return; }
  const text = result ? `Swipe clears in ${seconds} ${seconds === 1 ? 'second' : 'seconds'}.`
    : `Swipes clear after ${CLEAR_AFTER_SECONDS} seconds.`;
  if ($('countdown').textContent !== text) $('countdown').textContent = text;
}
setInterval(updateCountdown, 250);
updateCountdown();
resumeReader();
