'use strict';
// Part II member routes (M/H in API-CONTRACT §3). Mounted after `authenticate`.
const { Router } = require('express');
const streaming = require('../../services/streaming');
const costream = require('../../services/costream');
const athletes = require('../../services/athletes');
const chat = require('../../services/chat');
const guest = require('../../services/guest');
const cartService = require('../../services/cart');
const notifications = require('../../services/notifications');

const router = Router();
const wrap = (fn) => async (req, res, next) => { try { await fn(req, res); } catch (err) { next(err); } };

router.post('/guest/cart/merge', wrap(async (req, res) => { const r = await guest.mergeStaged(req.principal, req.body); res.status(r.status).json(r.body); }));
router.get('/cart', wrap(async (req, res) => res.status(200).json(await cartService.memberCart(req.principal.user_id))));

router.put('/athletes/:id/follow', wrap(async (req, res) => res.status(200).json(await athletes.setFollow(req.principal.user_id, req.params.id, true))));
router.delete('/athletes/:id/follow', wrap(async (req, res) => res.status(200).json(await athletes.setFollow(req.principal.user_id, req.params.id, false))));

router.post('/streams/key', wrap(async (req, res) => { const r = await streaming.manageForMember(req.principal, req.body); res.status(r.status).json(r.body); }));
router.get('/streams/me', wrap(async (req, res) => res.status(200).json(await streaming.myKey(req.principal))));
router.put('/streams/me/match', wrap(async (req, res) => res.status(200).json(await streaming.bindMatch(req.principal, req.body))));

router.post('/costreams', wrap(async (req, res) => { const r = await costream.createForMember(req.principal, req.body); res.status(r.status).json(r.body); }));
router.post('/costreams/:id/invites', wrap(async (req, res) => res.status(201).json(await costream.invite(req.principal, req.params.id, req.body))));
router.post('/costreams/:id/join', wrap(async (req, res) => res.status(200).json(await costream.join(req.principal, req.params.id, req.body))));
router.post('/costreams/:id/leave', wrap(async (req, res) => res.status(200).json(await costream.leave(req.principal, req.params.id))));
router.post('/costreams/:id/participants/:player_id/:action', wrap(async (req, res) => res.status(200).json(await costream.control(req.principal, req.params.id, req.params.player_id, req.params.action))));

router.post('/chat', wrap(async (req, res) => { const r = await chat.post(req.principal, req.body); res.status(r.status).json(r.body); }));
router.post('/notifications/test', wrap(async (req, res) => res.status(202).json(await notifications.sendTest(req.principal, req.body))));

module.exports = router;
