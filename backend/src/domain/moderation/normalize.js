'use strict';
// BR-MOD-01: leetspeak normalisation. `!` is both a leet "i" and punctuation, so a token has two variants.
const ZERO_WIDTH = /[​-‍⁠﻿]/g;
const LEET = { '@': 'a', 0: 'o', 1: 'i', 3: 'e', $: 's' };

function variants(token) {
  const base = token.normalize('NFKC').toLowerCase().replace(ZERO_WIDTH, '');
  const clean = (s) => [...s].map((c) => (Object.hasOwn(LEET, c) ? LEET[c] : c)).join('').replace(/[^\p{L}\p{N}]/gu, '');
  return [...new Set([clean(base.replace(/!/g, 'i')), clean(base.replace(/!/g, ''))])].filter(Boolean);
}

module.exports = { variants };
