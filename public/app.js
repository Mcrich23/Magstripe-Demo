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
    if (count) {
      $('empty-state').hidden = true;
      $('reading-state').hidden = false;
      $('reading-progress').textContent = `${count} ${count === 1 ? 'character' : 'characters'} received. Waiting for the rest of the swipe…`;
    }
  },
  onError: () => {
    clearResult();
    $('swipe-prompt').textContent = 'Too much input — try one swipe';
  },
});

function clearResult(resetCapture = true) {
  if (resetCapture) capture.reset();
  result = null; deadline = 0;
  updateCountdown();
  $('fields').replaceChildren();
  $('track-structures').replaceChildren(); $('checks').replaceChildren();
  $('read-note').textContent = ''; $('read-note').hidden = true;
  $('reading-state').hidden = true; $('reading-progress').textContent = '';
  $('result-card').hidden = true; $('empty-state').hidden = false;
  $('clear-swipe').hidden = true;
  $('swipe-prompt').textContent = 'See the text on the stripe and what each part means.';
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
  $('reading-state').hidden = true; $('reading-progress').textContent = '';
  result = parseSwipe(raw); deadline = Date.now() + CLEAR_AFTER_SECONDS * 1000;
  updateCountdown();
  $('fields').replaceChildren();
  const definitions = [
    ['pan', 'Card number'], ['name', 'Cardholder'], ['expiry', 'Expiration'],
    ['service', 'Service code'], ['discretionary', 'Issuer data'],
  ];
  for (const [key, label] of definitions) {
    const track = result.tracks.find(track => track.decoded && track.parts.some(part => part.key === key));
    const part = track?.parts.find(part => part.key === key);
    const raw = part ? track.raw.slice(part.start, part.end) : '';
    const encoded = key === 'pan' && raw ? mask(raw, true) : raw || '—';
    const meanings = {
      pan: raw ? `${raw.length}-digit card number · only the last four shown` : 'Not available',
      name: raw.trim() ? `${formatName(raw)} · stored last name first` : 'Not available',
      expiry: part ? `${part.value} · stored as year, then month` : 'Not available',
      service: 'Rules for where and how the card can be used',
      discretionary: `Extra data chosen by the card issuer${raw ? ` · ${raw.length} characters` : ''}`,
    };
    const row = document.createElement('tr'); row.className = `key-${key}`;
    const heading = document.createElement('th'); heading.scope = 'row'; heading.textContent = label;
    const value = document.createElement('td'); value.className = 'encoded'; value.textContent = encoded;
    const meaning = document.createElement('td'); meaning.textContent = meanings[key];
    row.append(heading, value, meaning); $('fields').append(row);
  }
  $('fields-table').hidden = result.kind === 'unknown';
  $('read-note').hidden = !result.warnings.length;
  $('read-note').textContent = result.warnings.length ? result.warnings[0] : '';
  $('empty-state').hidden = true; $('result-card').hidden = false;
  $('clear-swipe').hidden = false;
  $('reader-note').textContent = 'Ready for the next swipe.';
  showTechnicalDetails();
}

function showTechnicalDetails() {
  const info = describeSwipe(result);
  $('checks').replaceChildren(); $('track-structures').replaceChildren();
  addField($('checks'), 'Number check (Luhn)', info.checksum);
  addField($('checks'), 'Same details on both tracks', info.agreement);
  for (const track of info.tracks) {
    const row = document.createElement('div'); row.className = 'track-structure';
    const label = document.createElement('p'); label.className = 'track-label';
    const name = document.createElement('strong'); name.textContent = `Track ${track.number}`;
    const length = document.createElement('span'); length.textContent = `${track.characters} characters`;
    label.append(name, length);
    const layout = document.createElement('code'); layout.className = 'track-stream';
    for (const segment of track.segments) {
      const piece = document.createElement('span');
      piece.className = segment.kind === 'marker' ? 'marker' : `data key-${segment.key}`;
      piece.textContent = segment.text;
      layout.append(piece);
    }
    if (track.note) layout.textContent = track.note;
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
  $('reader-note').textContent = result ? 'Ready for the next swipe.' : 'Keep this window active. Swipes appear automatically.';
}
$('clear-swipe').addEventListener('click', () => clearResult());
document.addEventListener('keydown', event => {
  if (event.ctrlKey || event.metaKey || event.altKey || event.isComposing || document.hidden) return;
  // A delivered key also resumes capture if focus events arrived out of order.
  if (!capture.armed) resumeReader();
  if (event.key === 'Escape') { event.preventDefault(); clearResult(); return; }
  // Readers send Enter between or after tracks; only clear a finished result.
  if (event.key === 'Enter' && result && !capture.buffer) { event.preventDefault(); clearResult(); return; }
  if (capture.push(event.key) || event.key === 'Enter') event.preventDefault();
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
