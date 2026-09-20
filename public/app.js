import { parseSwipe, mask } from './parser.js';
import { samples } from './samples.js';
import { SwipeCapture } from './capture.js';

const $ = id => document.getElementById(id);
let result = null;
let deadline = 0;
const capture = new SwipeCapture({
  onSwipe: raw => showResult(raw),
  onProgress: count => {
    if (count && result) clearResult(false, false);
    $('reader-input').value = capture.buffer;
    $('process-button').disabled = !count;
    if (count) $('status').textContent = 'Reading card…';
  },
  onError: () => {
    clearResult(false);
    $('status').textContent = 'Too much input — try one swipe';
  },
});

function readerStatus() {
  const active = capture.armed;
  $('input-status').classList.toggle('inactive', !active);
  $('input-status-text').textContent = active ? 'Reader input active' : 'Click the input to resume';
}
function focusReader() {
  if (!capture.armed) capture.arm();
  $('reader-input').focus({ preventScroll: true });
  readerStatus();
}
function clearResult(refocus = true, resetCapture = true) {
  if (resetCapture) { capture.reset(); $('reader-input').value = ''; }
  result = null; deadline = 0;
  $('fields').replaceChildren(); $('extra-fields').replaceChildren();
  $('read-note').textContent = ''; $('read-note').hidden = true;
  $('sample-note').hidden = true;
  $('result-card').hidden = true; $('empty-state').hidden = false;
  $('more-details').open = false;
  $('process-button').disabled = true;
  document.querySelector('.status-card').classList.remove('has-result');
  $('status').textContent = 'Ready for a swipe';
  if (refocus) focusReader();
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
function showResult(raw, sample = false) {
  capture.reset(); $('reader-input').value = ''; $('process-button').disabled = true;
  result = parseSwipe(raw); deadline = Date.now() + 60_000;
  const get = key => result.fields.find(field => field.key === key)?.value;
  const tracks = [...new Set(result.tracks.filter(track => track.decoded).map(track => track.number))];
  $('fields').replaceChildren(); $('extra-fields').replaceChildren();
  addField($('fields'), 'Card number', get('pan') ? mask(get('pan'), true) : null);
  addField($('fields'), 'Cardholder', formatName(get('name')));
  addField($('fields'), 'Expiration', get('expiry'));
  addField($('fields'), 'Track format', tracks.length ? `Track ${tracks.join(' + ')}` : 'Unknown');
  addField($('extra-fields'), 'Service code', get('service'));
  addField($('extra-fields'), 'Issuer data', get('discretionary'));
  $('more-details').open = false; $('more-details').hidden = result.kind === 'unknown';
  $('sample-note').hidden = !sample;
  $('read-note').hidden = !result.warnings.length;
  $('read-note').textContent = result.warnings.length ? result.warnings[0] : '';
  $('empty-state').hidden = true; $('result-card').hidden = false;
  document.querySelector('.status-card').classList.toggle('has-result', result.kind === 'payment');
  $('status').textContent = result.kind === 'unknown' ? 'Swipe received — unrecognized format'
    : result.warnings.length ? 'Swipe received — check the read' : 'Card read';
}

$('reader-input').addEventListener('focus', () => { if (!capture.armed) capture.arm(); readerStatus(); });
// Native input events support paste, accessibility input, and readers that insert text.
$('reader-input').addEventListener('input', event => { capture.replace(event.target.value); });
$('process-button').addEventListener('click', () => { capture.flush(); focusReader(); });
$('sample-button').addEventListener('click', () => { showResult(samples.payment, true); focusReader(); });
$('clear-button').addEventListener('click', () => clearResult());
document.addEventListener('keydown', event => {
  if (event.key === 'Escape') { event.preventDefault(); clearResult(); return; }
  if (event.ctrlKey || event.metaKey || event.altKey || event.isComposing) return;
  if (event.target.closest('input,textarea,select') && event.target !== $('reader-input')) return;
  if (capture.push(event.key)) event.preventDefault();
}, true);
function pauseReader() {
  capture.stop(); $('reader-input').value = ''; $('process-button').disabled = true; readerStatus();
}
window.addEventListener('blur', () => { pauseReader(); clearResult(false); });
document.addEventListener('visibilitychange', () => { if (document.hidden) { pauseReader(); clearResult(false); } });
window.addEventListener('pagehide', () => { pauseReader(); clearResult(false); });
window.addEventListener('pageshow', event => { if (event.persisted) { clearResult(false); focusReader(); } });
setInterval(() => { if (result && Date.now() >= deadline) clearResult(false); }, 1000);
focusReader();
