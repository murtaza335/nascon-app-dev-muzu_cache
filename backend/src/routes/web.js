'use strict';
// Guest Web Player host (FRONTEND-CONTRACT §1): serves the static files in src/web/ and fills each page's boot snapshot
// so the score banner and merch card are visible without waiting for JavaScript (§2.3 step 1).
//
// Frontend file convention (src/web/):
//   live.html preview.html vod.html notice.html   match pages (the route decides nothing; all four get the same data)
//   player.html club.html costream.html notfound.html
//   static/**  css/js/images, served at /web/static/**
// Placeholders replaced in every HTML file:
//   <!--BOOT-->      → <script type="application/json" id="boot">{…API-D2-57/58/59/61 body…}</script>
//   {{TITLE}} {{SCORE_TEXT}} {{HOME}} {{AWAY}} {{STATUS}}   (HTML-escaped; empty when not applicable)
const fs = require('node:fs');
const path = require('node:path');
const express = require('express');
const { Router } = require('express');
const reads = require('../services/publicReads');
const { AppError, E } = require('../errors');

const DIR = path.join(__dirname, '..', 'web');
const router = Router();

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
// "</script>" and U+2028/9 must never end the JSON block early.
const safeJson = (o) => JSON.stringify(o).replace(/</g, '\\u003c').replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029');

function render(file, data, vars = {}) {
  let html;
  try { html = fs.readFileSync(path.join(DIR, file), 'utf8'); } catch {
    return `<!doctype html><html lang="en"><meta charset="utf-8"><title>Not installed</title><body><h1>Page not installed</h1><p>${esc(file)} is missing from backend/src/web.</p></body></html>`;
  }
  const boot = `<script type="application/json" id="boot">${safeJson(data)}</script>`;
  const all = { TITLE: '', SCORE_TEXT: '', HOME: '', AWAY: '', STATUS: '', ...vars };
  return html.replace('<!--BOOT-->', () => boot).replace(/\{\{(TITLE|SCORE_TEXT|HOME|AWAY|STATUS)\}\}/g, (_, k) => esc(all[k]));
}

const send = (res, status, html) => res.status(status).set('Content-Type', 'text/html; charset=utf-8').set('Cache-Control', 'no-store').send(html);

// Unknown entity → HTML 404 page (not the JSON envelope); other errors still go to the error handler.
async function page(res, next, file, load, vars) {
  try {
    const data = await load();
    send(res, 200, render(file, data, vars ? vars(data) : {}));
  } catch (err) {
    if (err instanceof AppError && err.status === 404) return send(res, 404, render('notfound.html', { error: err.code }, { TITLE: "We couldn't find that" }));
    next(err);
  }
}

router.use('/web/static', express.static(path.join(DIR, 'static'), { index: false, maxAge: 0, fallthrough: false }));

const VIEWS = ['live', 'preview', 'vod', 'notice'];
router.get('/web/matches/:id/:view', (req, res, next) => (!VIEWS.includes(req.params.view) ? next() : page(res, next, `${req.params.view}.html`,
  () => reads.match(req.params.id), (m) => ({ TITLE: `${m.home.name} vs ${m.away.name}`, SCORE_TEXT: m.score_text, HOME: m.home.name, AWAY: m.away.name, STATUS: m.status }))));
router.get('/web/players/:id', (req, res, next) => page(res, next, 'player.html', () => reads.player(req.params.id), (p) => ({ TITLE: p.name })));
router.get('/web/clubs/:id', (req, res, next) => page(res, next, 'club.html', () => reads.club(req.params.id), (c) => ({ TITLE: c.name })));
router.get('/web/costream/:id', (req, res, next) => page(res, next, 'costream.html', () => reads.costream(req.params.id),
  (s) => ({ TITLE: `Co-stream ${s.session_id}`, SCORE_TEXT: '0 - 0', STATUS: s.status })));

router.get('/web', (req, res) => res.redirect(302, '/web/matches/match-m1/live'));

module.exports = router;
module.exports.render = render;
module.exports.E = E;
