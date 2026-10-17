'use strict';
// FR-1.1-01: sports are plain data; creation is immediately usable (no cache, no restart).
const { query } = require('../db');
const { AppError, E, validationError } = require('../errors');
const { validateSport } = require('../domain/scoring/sportSchema');
const sportsRepo = require('../repos/sports');

async function createSport(input) {
  const r = validateSport(input);
  if (!r.ok) throw validationError(r.details.fields);
  const sport = r.value;
  try {
    await sportsRepo.insertSport({ query }, sport);
  } catch (err) {
    if (err.code === '23505') throw new AppError(E.SPORT_EXISTS);
    throw err;
  }
  return { sport_id: sport.sport_id, status: 'created', config: sport.config };
}

module.exports = { createSport };
