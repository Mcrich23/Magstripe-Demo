import { parseSwipe, mask } from './parser.js';
import { samples } from './samples.js';
import { SwipeCapture } from './capture.js';

const $ = id => document.getElementById(id);
const state = { result: null, revealed: false, selectedTrack: 0, source: '', deadline: 0 };
const el = (tag, className, text) => {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
};
function announce(text) { $('announcer').textContent = text; }
const capture = new SwipeCapture({
  onSwipe: raw => { showResult(raw, 'LIVE SWIPE'); renderCapture(); },
  onProgress: count => {
    if (count === 1 && state.result) clearResult(false, false);
    if (count) {
      $('capture-heading').textContent = 'Reading your swipe…';
      $('capture-instruction').textContent = `${count} characters received. Waiting for the remaining tracks.`;
      $('capture-state').textContent = 'READING';
    } else renderCapture();
  },
  onError: message => {
    clearResult(false);
    $('capture-heading').textContent = 'Let’s try that again.';
    $('capture-instruction').textContent = message;
    announce(message);
  },
});

function renderCapture() {
  const armed = capture.armed;
  $('capture-state').textContent = armed ? 'LISTENING' : 'PAUSED';
  $('capture-state').classList.toggle('active', armed);
  $('reader-dot').classList.toggle('active', armed);
  $('capture-heading').textContent = armed ? 'Ready when you are.' : 'Your reader. Your browser.';
  $('capture-instruction').textContent = armed ? 'Swipe a card while this window is active. We’ll take it from here.' : 'Connect your USB reader, start capture, then swipe a card.';
  $('capture-button-label').textContent = armed ? 'Pause capture' : 'Start capture';
  $('reader-status').textContent = armed ? 'This page is listening for a swipe' : 'Keyboard-style USB reader';
}
function clearResult(notify = true, resetCapture = true) {
  if (resetCapture) capture.reset();
  state.result = null; state.revealed = false; state.deadline = 0; state.source = ''; state.selectedTrack = 0;
  $('paste-input').value = '';
  $('result-content').hidden = true; $('empty-state').hidden = false;
  $('clear-button').disabled = true; $('countdown').hidden = true;
  for (const id of ['field-list', 'track-map', 'track-tabs', 'raw-track', 'warnings', 'stats', 'result-title', 'result-subtitle', 'announcer']) $(id).replaceChildren();
  $('raw-details').open = false;
  renderCapture();
  if (notify) announce('Swipe cleared. Ready for the next participant.');
}
function showResult(raw, source) {
  capture.reset();
  state.result = parseSwipe(raw); state.revealed = false; state.selectedTrack = 0; state.source = source;
  state.deadline = Date.now() + Number($('clear-after').value) * 1000;
  $('raw-details').open = false;
  $('empty-state').hidden = true; $('result-content').hidden = false; $('clear-button').disabled = false;
  renderResult(); updateCountdown();
  announce(`${state.result.title}. ${state.result.tracks.length} tracks received. ${state.result.warnings.length ? 'Check the read notes.' : 'Details are hidden.'}`);
}
function stat(value, label) {
  const node = el('div', 'stat'); node.append(el('strong', '', String(value)), el('span', '', label)); return node;
}
function renderResult() {
  const r = state.result;
  if (!r) return;
  $('result-source').textContent = state.source;
  $('result-status').textContent = r.warnings.length ? 'Read notes below' : 'Recognized format';
  $('result-title').textContent = r.title;
  $('result-subtitle').textContent = state.source === 'SAMPLE SWIPE' ? 'Fictional sample · no real personal information' : 'Personal details hidden by default · stored only in this page';
  $('reveal-button').textContent = state.revealed ? 'Hide details' : 'Reveal details';
  $('reveal-button').setAttribute('aria-pressed', String(state.revealed));
  $('warnings').replaceChildren(...r.warnings.map(w => el('p', '', w)));
  $('warnings').hidden = !r.warnings.length;
  $('stats').replaceChildren(stat(r.tracks.length, 'tracks received'), stat(r.fields.length, 'decoded fields'), stat(r.tracks.reduce((sum, t) => sum + t.raw.length, 0), 'encoded characters'));
  $('track-tabs').replaceChildren();
  r.tracks.forEach((t, index) => {
    const button = el('button', 'track-tab', `Track ${t.number}`);
    button.id = `track-tab-${index}`; button.type = 'button';
    button.setAttribute('role', 'tab'); button.setAttribute('aria-controls', 'track-panel');
    button.setAttribute('aria-selected', String(state.selectedTrack === index));
    button.tabIndex = state.selectedTrack === index ? 0 : -1;
    button.addEventListener('click', () => selectTrack(index));
    button.addEventListener('keydown', event => {
      let next = index;
      if (event.key === 'ArrowRight') next = (index + 1) % r.tracks.length;
      else if (event.key === 'ArrowLeft') next = (index + r.tracks.length - 1) % r.tracks.length;
      else if (event.key === 'Home') next = 0;
      else if (event.key === 'End') next = r.tracks.length - 1;
      else return;
      event.preventDefault(); selectTrack(next); $(`track-tab-${next}`).focus();
    });
    $('track-tabs').append(button);
  });
  $('interpretation-text').textContent = r.kind === 'payment'
    ? 'A stripe carries account information, not a balance or transaction history. Reading these fields does not verify a card or authorize a payment. A Luhn check is only a number-format check.'
    : 'Encrypted, proprietary, barcode, and incomplete data cannot always be interpreted. Check the reader setup and try a fresh swipe.';
  renderTrack();
}
function selectTrack(index) {
  state.selectedTrack = index;
  for (const [i, button] of [...$('track-tabs').children].entries()) {
    button.setAttribute('aria-selected', String(i === index)); button.tabIndex = i === index ? 0 : -1;
  }
  $('raw-details').open = false; renderTrack();
}
function fieldValue(field) {
  return field.sensitive && !state.revealed ? mask(field.value, field.key === 'pan') : field.value;
}
function renderTrack() {
  const track = state.result?.tracks[state.selectedTrack];
  $('track-map').replaceChildren(); $('field-list').replaceChildren(); $('raw-track').textContent = '';
  $('track-panel').hidden = !track;
  if (!track) return;
  $('track-panel').setAttribute('aria-labelledby', `track-tab-${state.selectedTrack}`);
  $('track-description').textContent = `${track.raw.length} characters · ${track.decoded ? 'Decoded' : track.complete ? 'Unsupported layout' : 'Incomplete read'}`;
  const parts = [...track.parts].sort((a, b) => a.start - b.start);
  let cursor = 0, fieldNumber = 0;
  const appendGap = (start, end) => {
    if (start >= end) return;
    const text = track.raw.slice(start, end);
    // Only expose recognized framing when hidden. Unknown content is opaque.
    const displayed = state.revealed ? text : [...text].map((c, i) => {
      const boundary = start + i === 0 || (start + i === track.raw.length - 1 && c === '?');
      return boundary || (track.decoded && '^='.includes(c)) || (track.decoded && start + i === 1 && /^%B\d/.test(track.raw)) ? c : '•';
    }).join('');
    const segment = el('span', 'segment segment-marker', displayed);
    segment.title = 'Track marker, separator, or uninterpreted data'; $('track-map').append(segment);
  };
  for (const part of parts) {
    appendGap(cursor, part.start);
    const segment = el('button', `segment ${part.category || 'identity'}`, state.revealed || !part.sensitive ? track.raw.slice(part.start, part.end) : '•'.repeat(Math.min(part.end - part.start, 18)));
    segment.type = 'button'; segment.title = part.label;
    segment.setAttribute('aria-label', `Explain ${part.label}`);
    if (part.description) {
      fieldNumber++;
      const row = el('div', 'field-row'); row.id = `field-${fieldNumber}`; row.tabIndex = -1;
      const index = el('span', `field-index ${part.category}`, String(fieldNumber).padStart(2, '0'));
      const copy = el('div', 'field-copy'); copy.append(el('h4', '', part.label), el('p', '', part.description));
      row.append(index, copy, el('div', 'field-value', fieldValue(part)));
      $('field-list').append(row);
      segment.addEventListener('click', () => {
        document.querySelectorAll('.field-row.focused').forEach(n => n.classList.remove('focused'));
        row.classList.add('focused'); row.focus({ preventScroll: true }); row.scrollIntoView({ behavior: 'instant', block: 'nearest' });
      });
    } else { segment.disabled = true; }
    $('track-map').append(segment); cursor = part.end;
  }
  appendGap(cursor, track.raw.length);
  if (!parts.length) $('field-list').append(el('p', 'small muted', 'This track is not decoded. Its original text is available below when details are revealed.'));
  $('raw-note').textContent = state.revealed ? 'Original reader text for this track. Personal and issuer data are visible.' : 'Reveal details to view the original text. All track content is masked here.';
  $('raw-track').textContent = state.revealed ? track.raw : '•'.repeat(Math.min(track.raw.length, 80));
}
function hideDetails() {
  if (state.revealed) { state.revealed = false; renderResult(); }
}
function updateCountdown() {
  if (!state.result) return;
  const remaining = Math.ceil((state.deadline - Date.now()) / 1000);
  if (remaining <= 0) { clearResult(false); announce('Swipe automatically cleared.'); return; }
  $('countdown').hidden = false; $('countdown').textContent = `Clears in ${remaining}s`;
}
setInterval(updateCountdown, 1000);

$('capture-button').addEventListener('click', () => {
  if (capture.armed) { capture.stop(); hideDetails(); } else capture.arm();
  renderCapture(); announce(capture.armed ? 'Listening. Swipe a card now.' : 'Capture paused.');
});
$('sample-payment').addEventListener('click', () => { showResult(samples.payment, 'SAMPLE SWIPE'); renderCapture(); });
$('clear-button').addEventListener('click', () => clearResult());
$('reveal-button').addEventListener('click', () => {
  if (!state.result) return;
  state.revealed = !state.revealed; renderResult();
  announce(state.revealed ? 'Personal details are now visible.' : 'Personal details hidden.');
});
$('delay').addEventListener('change', () => { capture.reset(); capture.delay = Number($('delay').value); renderCapture(); });
$('clear-after').addEventListener('change', () => {
  if (state.result) { state.deadline = Date.now() + Number($('clear-after').value) * 1000; updateCountdown(); }
});
function openDialog(id) {
  capture.stop(); hideDetails(); renderCapture(); $(id).showModal();
}
$('help-button').addEventListener('click', () => openDialog('help-dialog'));
$('paste-button').addEventListener('click', () => { openDialog('paste-dialog'); $('paste-input').focus(); });
for (const button of document.querySelectorAll('.close-dialog')) button.addEventListener('click', () => button.closest('dialog').close());
$('paste-dialog').addEventListener('close', () => { $('paste-input').value = ''; });
$('decode-button').addEventListener('click', () => {
  const raw = $('paste-input').value; $('paste-input').value = ''; $('paste-dialog').close(); showResult(raw, 'PASTED SWIPE');
});
document.addEventListener('keydown', event => {
  if (event.key === 'Escape') {
    clearResult();
    return; // Native dialog Escape behavior remains intact.
  }
  if (document.querySelector('dialog[open]') || event.ctrlKey || event.metaKey || event.altKey || event.isComposing) return;
  if (event.target.closest('textarea,input,select,[contenteditable="true"]')) return;
  if (capture.push(event.key)) event.preventDefault();
}, true);
window.addEventListener('blur', () => {
  capture.stop(); hideDetails(); $('paste-input').value = ''; renderCapture();
});
document.addEventListener('visibilitychange', () => {
  if (document.hidden) { capture.stop(); clearResult(false); document.querySelectorAll('dialog[open]').forEach(dialog => dialog.close()); }
});
window.addEventListener('pagehide', () => { capture.stop(); clearResult(false); });
window.addEventListener('pageshow', event => { if (event.persisted) { capture.stop(); clearResult(false); } });
renderCapture();
