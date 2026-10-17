'use strict';
// The single place that defines the error contract (REQUIREMENTS §7, ADR-003).
// Every non-2xx body: {"error":{"code","message","details"}}; details is always an object.

// Appendix B catalogue plus implementation-only codes. Domain code returns these constants;
// services throw AppError built from them.
const E = Object.freeze({
  VALIDATION_ERROR: { status: 400, code: 'VALIDATION_ERROR', message: 'Request validation failed' },
  UNKNOWN_EVENT_TYPE: { status: 400, code: 'UNKNOWN_EVENT_TYPE', message: 'Unknown event type for this sport' },
  INVALID_DISCOUNT_CODE: { status: 400, code: 'INVALID_DISCOUNT_CODE', message: 'Discount code is not valid' },
  UNAUTHENTICATED: { status: 401, code: 'UNAUTHENTICATED', message: 'Authentication required' },
  INVALID_CREDENTIALS: { status: 401, code: 'INVALID_CREDENTIALS', message: 'Invalid email or password' },
  PAYMENT_DECLINED: { status: 402, code: 'PAYMENT_DECLINED', message: 'Payment was declined' },
  PAYMENT_CAPTURE_FAILED: { status: 402, code: 'PAYMENT_CAPTURE_FAILED', message: 'Payment capture failed' },
  FORBIDDEN: { status: 403, code: 'FORBIDDEN', message: 'You do not have access to this resource' },
  SPORT_NOT_FOUND: { status: 404, code: 'SPORT_NOT_FOUND', message: 'Sport not found' },
  MATCH_NOT_FOUND: { status: 404, code: 'MATCH_NOT_FOUND', message: 'Match not found' },
  LEAGUE_NOT_FOUND: { status: 404, code: 'LEAGUE_NOT_FOUND', message: 'League not found' },
  EVENT_NOT_FOUND: { status: 404, code: 'EVENT_NOT_FOUND', message: 'Event not found' },
  PLAYER_NOT_FOUND: { status: 404, code: 'PLAYER_NOT_FOUND', message: 'Player not found' },
  SQUAD_NOT_FOUND: { status: 404, code: 'SQUAD_NOT_FOUND', message: 'Squad not found' },
  VARIANT_NOT_FOUND: { status: 404, code: 'VARIANT_NOT_FOUND', message: 'Variant not found' },
  CLUB_NOT_FOUND: { status: 404, code: 'CLUB_NOT_FOUND', message: 'Club not found' },
  TENANT_NOT_FOUND: { status: 404, code: 'TENANT_NOT_FOUND', message: 'Tenant not found' },
  PRODUCT_NOT_FOUND: { status: 404, code: 'PRODUCT_NOT_FOUND', message: 'Product not found' },
  ORDER_NOT_FOUND: { status: 404, code: 'ORDER_NOT_FOUND', message: 'Order not found' },
  ROUTE_NOT_FOUND: { status: 404, code: 'ROUTE_NOT_FOUND', message: 'Route not found' },
  SPORT_EXISTS: { status: 409, code: 'SPORT_EXISTS', message: 'Sport already exists' },
  LEAGUE_EXISTS: { status: 409, code: 'LEAGUE_EXISTS', message: 'League already exists' },
  MATCH_EXISTS: { status: 409, code: 'MATCH_EXISTS', message: 'Match already exists' },
  DUPLICATE_EVENT_ID: { status: 409, code: 'DUPLICATE_EVENT_ID', message: 'Event id was already used with a different body' },
  DUPLICATE_ORDER_ID: { status: 409, code: 'DUPLICATE_ORDER_ID', message: 'Order id was already used with a different body' },
  DUPLICATE_REQUEST_ID: { status: 409, code: 'DUPLICATE_REQUEST_ID', message: 'Request id was already used with a different body' },
  ILLEGAL_TRANSITION: { status: 409, code: 'ILLEGAL_TRANSITION', message: 'That status change is not allowed' },
  MATCH_NOT_IN_PROGRESS: { status: 409, code: 'MATCH_NOT_IN_PROGRESS', message: 'Match is not in progress' },
  TIE_NOT_ALLOWED: { status: 409, code: 'TIE_NOT_ALLOWED', message: 'A tied match cannot end without a winner' },
  INNINGS_COMPLETE: { status: 409, code: 'INNINGS_COMPLETE', message: 'The innings is already complete' },
  SERIES_ALREADY_DECIDED: { status: 409, code: 'SERIES_ALREADY_DECIDED', message: 'The series is already decided' },
  INVALID_COMPENSATION: { status: 409, code: 'INVALID_COMPENSATION', message: 'That event cannot be compensated' },
  NO_VALID_PAIRING: { status: 409, code: 'NO_VALID_PAIRING', message: 'No valid pairing exists for this round' },
  OUT_OF_STOCK: { status: 409, code: 'OUT_OF_STOCK', message: 'Not enough stock' },
  CROSS_TENANT_TRANSFER: { status: 409, code: 'CROSS_TENANT_TRANSFER', message: 'Squads belong to a different tenant' },
  NOT_IN_SQUAD: { status: 409, code: 'NOT_IN_SQUAD', message: 'Player is not in the given squad' },
  TRANSFER_WINDOW_CLOSED: { status: 409, code: 'TRANSFER_WINDOW_CLOSED', message: 'The transfer window is closed' },
  PLAYER_ON_LOAN: { status: 409, code: 'PLAYER_ON_LOAN', message: 'Player is currently on loan' },
  SQUAD_FULL: { status: 409, code: 'SQUAD_FULL', message: 'Squad is full' },
  MIN_POSITION_VIOLATION: { status: 409, code: 'MIN_POSITION_VIOLATION', message: 'Squad would fall below the required positions' },
  SCHEDULE_CONFLICT: { status: 409, code: 'SCHEDULE_CONFLICT', message: 'Schedule conflict' },
  PAYLOAD_TOO_LARGE: { status: 413, code: 'PAYLOAD_TOO_LARGE', message: 'Request body is too large' },
  RATE_LIMITED: { status: 429, code: 'RATE_LIMITED', message: 'Too many requests' },
  INTERNAL_ERROR: { status: 500, code: 'INTERNAL_ERROR', message: 'Internal server error' },
  SERVICE_UNAVAILABLE: { status: 503, code: 'SERVICE_UNAVAILABLE', message: 'Service is not ready' },
});

class AppError extends Error {
  constructor(def, details = {}, message) {
    super(message || def.message);
    this.name = 'AppError';
    this.status = def.status;
    this.code = def.code;
    this.details = details;
  }
}

const appError = (def, details, message) => new AppError(def, details, message);

// Dotted-path field list, e.g. ["periods.count", "items[0].quantity"].
const validationError = (fields, message) => new AppError(E.VALIDATION_ERROR, { fields }, message);

function formatError(code, message, details) {
  const d = details && typeof details === 'object' && !Array.isArray(details) ? details : {};
  return { error: { code, message, details: d } };
}

function notFoundHandler(req, res, next) {
  next(new AppError(E.ROUTE_NOT_FOUND));
}

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  let appErr = err instanceof AppError ? err : null;
  // Hostile text that PostgreSQL cannot store (e.g. \u0000 in jsonb) is a client error, never a 500 (NFR-5).
  if (!appErr && err && ['22P05', '22021', '22P02', '22003', '22001'].includes(err.code)) appErr = validationError(['body']);
  if (!appErr) {
    // Full detail stays server-side only.
    console.error(`[error] request_id=${req.id || '-'} ${req.method} ${req.originalUrl.split('?')[0]}`, err);
    appErr = new AppError(E.INTERNAL_ERROR);
  }
  if (res.headersSent) return;
  if (appErr.headers) for (const [k, v] of Object.entries(appErr.headers)) res.set(k, v);
  res.status(appErr.status).json(formatError(appErr.code, appErr.message, appErr.details));
}

// A single bad request must never take the process down.
function installProcessHandlers() {
  process.on('unhandledRejection', (reason) => console.error('[unhandledRejection]', reason));
  process.on('uncaughtException', (err) => console.error('[uncaughtException]', err));
}

module.exports = { E, AppError, appError, validationError, formatError, notFoundHandler, errorHandler, installProcessHandlers };
