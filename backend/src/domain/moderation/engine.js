'use strict';
// FR-5.3 / BR-MOD: pure, deterministic. Per message the order is rate window → flood → profanity → clean.
const { variants } = require('./normalize');
const LEXICON = require('./lexicon');

const SUFFIXES = ['', 's', 'es', 'ed', 'er', 'ing'];
const FLOOD = [/(.)\1{3,}/iu, /[!?]{3,}/];
const RATE_MAX = 3;
const RATE_WINDOW_MS = 2000;

const isProfane = (variant) => LEXICON.some((w) => SUFFIXES.some((s) => variant === w + s));

// "b@d_w0rd," → "***,": trailing sentence punctuation is kept outside the mask.
function maskText(text) {
  let hit = false;
  const out = text.split(/(\s+)/).map((tok) => {
    if (!tok || /^\s+$/.test(tok)) return tok;
    const m = /^(.*?)([.,;:!?]*)$/su.exec(tok);
    const core = m[1];
    if (core && variants(core).some(isProfane)) { hit = true; return `***${m[2]}`; }
    return tok;
  }).join('');
  return { hit, text: out };
}

const isFlood = (text) => FLOOD.some((re) => re.test(text));

const pushOnce = (list, v) => { if (!list.includes(v)) list.push(v); };

// messages: [{message_id, sender, text}]. windows: Map sender → [timestamps ms] (mutated; pass a fresh Map to ignore history).
// → {filtered, kicked, muted, dropped:[{message_id, sender, reason}]}
function evaluate(messages, { now = 0, windows = new Map(), useRateWindow = true } = {}) {
  const filtered = []; const kicked = []; const muted = []; const dropped = [];
  for (const m of messages) {
    const stamps = (windows.get(m.sender) || []).filter((ts) => now - ts < RATE_WINDOW_MS);
    stamps.push(now);
    windows.set(m.sender, stamps);
    if (useRateWindow && stamps.length > RATE_MAX) {
      pushOnce(muted, m.sender); dropped.push({ message_id: m.message_id, sender: m.sender, reason: 'rate_limit_exceeded' });
      continue;
    }
    if (isFlood(m.text)) {
      pushOnce(muted, m.sender); dropped.push({ message_id: m.message_id, sender: m.sender, reason: 'flood' });
      continue;
    }
    const masked = maskText(m.text);
    if (masked.hit) {
      pushOnce(kicked, m.sender);
      filtered.push({ message_id: m.message_id, sender: m.sender, text: masked.text, flagged: true, reason: 'profanity_leetspeak' });
    } else {
      filtered.push({ message_id: m.message_id, sender: m.sender, text: m.text, flagged: false, reason: null });
    }
  }
  return { filtered, kicked, muted, dropped };
}

const sigPayload = (roomId, flaggedCount, kicked, queueDepth) => ({
  chat_room_id: roomId, flagged_count: flaggedCount, kicked_users: kicked, queue_depth: queueDepth,
});

module.exports = { evaluate, maskText, isFlood, sigPayload, RATE_MAX, RATE_WINDOW_MS };
