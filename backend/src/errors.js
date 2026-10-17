'use strict';
// REQ-INF-01: the single place that defines the error contract (ADR-004).
// Every error response: { error_code, message, details? }.
// If the spec defines another shape, change formatError() only.

class AppError extends Error {
  constructor(status, errorCode, message, details) {
    super(message);
    this.name = 'AppError';
    this.status = status;
    this.errorCode = errorCode;
    this.details = details;
  }
}

const badRequest = (message = 'Bad request', details) => new AppError(400, 'BAD_REQUEST', message, details);
const validationError = (details, message = 'Request validation failed') =>
  new AppError(400, 'VALIDATION_ERROR', message, details);
const notFound = (message = 'Resource not found') => new AppError(404, 'NOT_FOUND', message);
const conflict = (message = 'Resource already exists') => new AppError(409, 'CONFLICT', message);
const unauthorized = (message = 'Authentication required') => new AppError(401, 'UNAUTHORIZED', message);
const forbidden = (message = 'Forbidden') => new AppError(403, 'FORBIDDEN', message);

function formatError(errorCode, message, details) {
  const body = { error_code: errorCode, message };
  if (details && details.length) body.details = details;
  return body;
}

// Postgres SQLSTATE -> AppError. Messages are generic: never leak SQL, tables or constraints.
function mapPgError(err) {
  switch (err.code) {
    case '23505':
      return conflict('Resource already exists');
    case '23503':
      return conflict('Referenced resource does not exist or is still in use');
    case '23502':
    case '22P02':
    case '22003':
    case '22001':
    case '23514':
      return validationError([], 'Invalid value for one or more fields');
    default:
      return null;
  }
}

function notFoundHandler(req, res) {
  res.status(404).json(formatError('NOT_FOUND', 'Route not found'));
}

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  let appErr = null;
  if (err instanceof AppError) appErr = err;
  else if (err && err.type === 'entity.parse.failed') appErr = new AppError(400, 'INVALID_JSON', 'Malformed JSON body');
  else if (err && err.type === 'entity.too.large') appErr = new AppError(413, 'PAYLOAD_TOO_LARGE', 'Request body too large');
  else if (err && typeof err.code === 'string' && /^[0-9A-Z]{5}$/.test(err.code)) appErr = mapPgError(err);

  if (!appErr) {
    // Full detail stays server-side only.
    console.error(`[error] request_id=${req.id || '-'} ${req.method} ${req.originalUrl}`, err);
    appErr = new AppError(500, 'INTERNAL_ERROR', 'Internal server error');
  }
  if (res.headersSent) return;
  res.status(appErr.status).json(formatError(appErr.errorCode, appErr.message, appErr.details));
}

// A single bad request must never take the process down.
function installProcessHandlers() {
  process.on('unhandledRejection', (reason) => console.error('[unhandledRejection]', reason));
  process.on('uncaughtException', (err) => console.error('[uncaughtException]', err));
}

module.exports = {
  AppError,
  badRequest,
  validationError,
  notFound,
  conflict,
  unauthorized,
  forbidden,
  formatError,
  mapPgError,
  notFoundHandler,
  errorHandler,
  installProcessHandlers,
};
