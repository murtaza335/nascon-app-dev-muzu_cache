'use strict';
// =============================================================================
// EXAMPLE ONLY: delete or replace on the day. Shows the conventions every
// resource route should follow:
//   1. validate() every input before any DB or cache call   (REQ-INF-02)
//   2. errors only via errors.js helpers                     (REQ-INF-01)
//   3. cached() on GETs, await invalidate() after a successful write and
//      before responding, so reads right after a write are fresh  (REQ-INF-03)
// =============================================================================
const { Router } = require('express');
const db = require('../db');
const { cached, invalidate } = require('../cache');
const { notFound, validationError } = require('../errors');
const { validate, idParam, paginationQuery } = require('../validate');

const router = Router();
const RESOURCE = 'items';

const createSchema = {
  name: { type: 'string', required: true, minLength: 1, maxLength: 100 },
  description: { type: 'string', maxLength: 500 },
  quantity: { type: 'integer', min: 0, max: 1000000, default: 0 },
};
// PATCH: same rules, nothing required, no defaults (absent means "leave unchanged").
const updateSchema = {
  name: { type: 'string', minLength: 1, maxLength: 100 },
  description: { type: 'string', maxLength: 500, nullable: true },
  quantity: { type: 'integer', min: 0, max: 1000000 },
};
const listSchema = { ...paginationQuery, q: { type: 'string', maxLength: 100 } };

const COLUMNS = 'id, name, description, quantity, created_at, updated_at';

// Single serialization point: ISO-8601 UTC timestamps, integer ids, snake_case keys.
const toDto = (row) => ({
  id: row.id,
  name: row.name,
  description: row.description,
  quantity: row.quantity,
  created_at: row.created_at.toISOString(),
  updated_at: row.updated_at.toISOString(),
});

// POST /api/items -> 201
router.post('/', async (req, res) => {
  const body = validate(createSchema, req.body, { source: 'body' });
  const { rows } = await db.query(
    `INSERT INTO items (name, description, quantity) VALUES ($1, $2, $3) RETURNING ${COLUMNS}`,
    [body.name, body.description ?? null, body.quantity],
  );
  await invalidate(RESOURCE);
  res.status(201).json(toDto(rows[0]));
});

// GET /api/items?limit&offset&q -> 200 { data, total, limit, offset }
router.get('/', async (req, res) => {
  const query = validate(listSchema, req.query, { source: 'query' });
  const { value, status } = await cached(RESOURCE, ['list', query], async () => {
    const params = [];
    let where = '';
    if (query.q) {
      params.push(`%${query.q}%`);
      where = `WHERE name ILIKE $${params.length}`;
    }
    const total = await db.query(`SELECT count(*)::int AS n FROM items ${where}`, params);
    const page = await db.query(
      `SELECT ${COLUMNS} FROM items ${where} ORDER BY id LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, query.limit, query.offset],
    );
    return { data: page.rows.map(toDto), total: total.rows[0].n, limit: query.limit, offset: query.offset };
  });
  res.set('X-Cache', status).json(value);
});

// GET /api/items/:id -> 200 | 400 bad id | 404
router.get('/:id', async (req, res) => {
  const { id } = validate(idParam, req.params, { source: 'params' });
  const { value, status } = await cached(RESOURCE, ['detail', id], async () => {
    const { rows } = await db.query(`SELECT ${COLUMNS} FROM items WHERE id = $1`, [id]);
    return rows[0] ? toDto(rows[0]) : null; // null is never cached
  });
  if (!value) throw notFound('Item not found');
  res.set('X-Cache', status).json(value);
});

// PATCH /api/items/:id -> 200 | 400 | 404
router.patch('/:id', async (req, res) => {
  const { id } = validate(idParam, req.params, { source: 'params' });
  const body = validate(updateSchema, req.body, { source: 'body' });
  const fields = Object.keys(body);
  if (fields.length === 0) {
    throw validationError(
      [{ field: 'body', issue: `must contain at least one of: ${Object.keys(updateSchema).join(', ')}` }],
      'No updatable fields provided',
    );
  }
  const sets = fields.map((f, i) => `${f} = $${i + 2}`);
  const { rows } = await db.query(
    `UPDATE items SET ${sets.join(', ')}, updated_at = now() WHERE id = $1 RETURNING ${COLUMNS}`,
    [id, ...fields.map((f) => body[f])],
  );
  if (!rows[0]) throw notFound('Item not found');
  await invalidate(RESOURCE);
  res.status(200).json(toDto(rows[0]));
});

// DELETE /api/items/:id -> 204 | 400 | 404
router.delete('/:id', async (req, res) => {
  const { id } = validate(idParam, req.params, { source: 'params' });
  const { rowCount } = await db.query('DELETE FROM items WHERE id = $1', [id]);
  if (rowCount === 0) throw notFound('Item not found');
  await invalidate(RESOURCE);
  res.status(204).end();
});

module.exports = router;
