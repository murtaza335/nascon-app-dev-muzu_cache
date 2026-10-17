# Requirements Traceability

## Convention

- Every spec requirement gets an ID: `REQ-01`, `REQ-02`, ... (infrastructure: `REQ-INF-xx`).
- Put the ID in a **code comment** at the implementing function (`// REQ-03: create booking`), in the **commit message** (`REQ-03: add booking endpoint`) and in the **test name** (`test_req03_...`) plus the marker `@pytest.mark.req("REQ-03")`.
- `Status`: Todo | In progress | Done | Tested | Descoped.

## Matrix

| REQ ID | Requirement | Day | Code (file:function) | Test (file::name) | Status |
|---|---|---|---|---|---|
| REQ-00 | Service exposes a health endpoint; DB required, cache optional | 1 | `backend/src/routes/health.js:GET /health` | `tests/api/test_health_api.py::test_req00_health_ok`, `backend/tests/health.test.js::req00_health_returns_ok` | Tested |
| REQ-INF-01 | Consistent error body `{error_code, message, details?}`, no stack traces | 1 | `backend/src/errors.js:errorHandler`, `formatError`, `mapPgError` | `tests/api/test_errors_api.py::test_req_inf01_*` | Tested |
| REQ-INF-02 | Strict input validation before any processing (400 + details) | 1 | `backend/src/validate.js:validate` | `tests/api/test_validation_api.py::test_req_inf02_*`, `backend/tests/validate.test.js` | Tested |
| REQ-INF-03 | Redis cache-aside on reads; writes invalidate before responding; Redis outage bypasses | 1 | `backend/src/cache.js:cached`, `invalidate` | `tests/api/test_cache_api.py::test_req_inf03_*` | Tested |
| REQ-01 | | | | | |
| REQ-02 | | | | | |
| REQ-03 | | | | | |
| REQ-04 | | | | | |
| REQ-05 | | | | | |
| REQ-06 | | | | | |
| REQ-07 | | | | | |
| REQ-08 | | | | | |
| REQ-09 | | | | | |
| REQ-10 | | | | | |

## Coverage check

List every REQ ID referenced in code and tests, and compare it with the matrix:

```bash
grep -rho --exclude-dir=node_modules --exclude-dir=.venv "REQ-[A-Z0-9-]*" backend tests mobile | sort -u
```

Any ID in the matrix that is missing from this output has no code or test reference yet.
