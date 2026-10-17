'use strict';
const { Router } = require('express');
const reads = require('../../services/appReads');
const writes = require('../../services/appWrites');
const orders = require('../../services/orders');
const { parsePage, page } = require('../../http/guard');

const router = Router();

// APP-50
router.get('/store/products', async (req, res, next) => {
  try {
    const { club_id: clubId } = req.query;
    res.status(200).json(await reads.listProducts(req.principal, typeof clubId === 'string' ? clubId : undefined, parsePage(req.query)));
  } catch (err) { next(err); }
});

// APP-51
router.get('/store/products/:id', async (req, res, next) => {
  try { res.status(200).json(await reads.getProduct(req.principal, req.params.id)); } catch (err) { next(err); }
});

// APP-52: 201 / 200 on replay
router.post('/store/checkout', async (req, res, next) => {
  try {
    const r = await writes.checkout(req.principal, req.body);
    res.status(r.status).json(r.body);
  } catch (err) { next(err); }
});

// APP-53
router.get('/store/orders', async (req, res, next) => {
  try { res.status(200).json(page(await orders.listFor(req.principal), parsePage(req.query))); } catch (err) { next(err); }
});
router.get('/store/orders/:id', async (req, res, next) => {
  try { res.status(200).json(await orders.getFor(req.principal, req.params.id)); } catch (err) { next(err); }
});

// APP-54
router.get('/store/orders/:id/receipt.pdf', async (req, res, next) => {
  try {
    const pdf = await orders.receiptPdf(req.principal, req.params.id);
    res.status(200).type('application/pdf').set('Content-Disposition', `inline; filename="receipt-${req.params.id}.pdf"`).send(pdf);
  } catch (err) { next(err); }
});

// APP-55
router.post('/store/orders/:id/transition', async (req, res, next) => {
  try { res.status(200).json(await orders.transition(req.principal, req.params.id, req.body)); } catch (err) { next(err); }
});

module.exports = router;
