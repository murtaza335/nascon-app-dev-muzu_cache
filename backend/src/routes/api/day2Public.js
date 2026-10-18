'use strict';
// Part II routes that need no member token (guest, optional JWT, or none). Mounted before `authenticate`.
const { Router } = require('express');
const auth = require('../../services/auth');
const guest = require('../../services/guest');
const reads = require('../../services/publicReads');
const athletes = require('../../services/athletes');
const chat = require('../../services/chat');
const feed = require('../../services/sseFeed');
const { guestTokenOf } = require('../../domain/guest/guard');
const { AppError, E } = require('../../errors');

const router = Router();
const wrap = (fn) => async (req, res, next) => { try { await fn(req, res); } catch (err) { next(err); } };

// Optional member identity for G routes (bad / guest tokens simply mean "anonymous").
function viewerOf(req) {
  const m = /^Bearer ([^\s]+)$/i.exec(req.get('authorization') || '');
  const claims = m ? auth.verifyToken(m[1]) : null;
  return claims ? claims.sub : '';
}

async function guestAuth(req, res, next) {
  try {
    const token = guestTokenOf(req.get('authorization'));
    if (!token) throw new AppError(E.UNAUTHENTICATED);
    await guest.requireGuest(token);
    req.guestToken = token;
    next();
  } catch (err) { next(err); }
}

router.post('/guest/session', wrap(async (req, res) => res.status(201).json(await guest.createSession())));
router.get('/guest/cart', guestAuth, wrap(async (req, res) => res.status(200).json(await guest.guestCart(req.guestToken))));
router.post('/guest/cart/items', guestAuth, wrap(async (req, res) => res.status(200).json(await guest.addItem(req.guestToken, req.body))));
router.delete('/guest/cart/items/:variant_id', guestAuth, wrap(async (req, res) => res.status(200).json(await guest.removeItem(req.guestToken, req.params.variant_id))));
router.post('/auth/register', wrap(async (req, res) => res.status(201).json(await guest.register(req.body))));

router.get('/public/matches/:id', wrap(async (req, res) => res.status(200).json(await reads.match(req.params.id))));
router.get('/public/players/:id', wrap(async (req, res) => res.status(200).json(await reads.player(req.params.id))));
router.get('/public/clubs/:id', wrap(async (req, res) => res.status(200).json(await reads.club(req.params.id))));
router.get('/public/costreams/:id', wrap(async (req, res) => res.status(200).json(await reads.costream(req.params.id))));
router.get('/athletes/:id', wrap(async (req, res) => res.status(200).json(await athletes.profile(req.params.id, viewerOf(req)))));
router.get('/streams/live', wrap(async (req, res) => res.status(200).json(await reads.liveStreams())));
router.get('/vods', wrap(async (req, res) => res.status(200).json(await reads.vods(req.query))));
router.get('/chat/:room/messages', wrap(async (req, res) => res.status(200).json(await chat.history(req.params.room, req.query))));
router.get('/matches/:id/stream', wrap(async (req, res) => feed.open(req, res, req.params.id)));

module.exports = router;
