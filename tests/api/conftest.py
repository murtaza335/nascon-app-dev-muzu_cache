"""Test-vector helpers for API tests.

Note: the tie-breaker counts "automated test vectors passed". If that means the
autograder's own vectors, these local tests do not change the count, but they are
cheap and prove correctness. Check the spec on the day.
"""
import re

import pytest

MISSING = object()  # sentinel: remove the field from the payload

FORBIDDEN_IN_ERRORS = ("stack", "node_modules", "SELECT", "pg_")
# " at " as a plain substring would flag "must be at most"; match real stack frames instead:
# "    at fn (/app/src/x.js:12:5)" or "at /app/src/x.js:12:5".
STACK_FRAME = re.compile(r"\bat\s+(?:\S+\s+\()?/?[\w./-]+:\d+:\d+")


def _mutations_for(rule):
    """Yield (label, value) invalid values for a field rule.

    rule keys: type ('string'|'integer'|'number'|'boolean'), required, max_length,
    min, max, enum.
    """
    t = rule["type"]
    if rule.get("required"):
        yield "missing", MISSING
    yield "null", None
    yield "wrong_type", 123 if t == "string" else "not-a-number" if t in ("integer", "number") else "x"
    if t == "string":
        yield "wrong_type_list", ["a"]
        if rule.get("required") or rule.get("min_length", 0) > 0:
            yield "empty", ""
            yield "whitespace", "   "
        if "max_length" in rule:
            yield "too_long", "x" * (rule["max_length"] + 1)
        if "enum" in rule:
            yield "bad_enum", "__not_an_option__"
    if t in ("integer", "number"):
        if "min" in rule:
            yield "below_min", rule["min"] - 1
            if rule["min"] > 0:
                yield "zero", 0
        if rule.get("min", 0) >= 0:
            yield "negative", -1
        if "max" in rule:
            yield "above_max", rule["max"] + 1
        yield "huge", 10**12
        if t == "integer":
            yield "float", 1.5
            yield "numeric_string", "5"


def make_cases(valid_payload, fields, ok_status=201, error_code="VALIDATION_ERROR"):
    """Build pytest.param(payload, expected_status, expected_code) vectors.

    valid_payload: dict that must succeed.
    fields: {name: rule} as described in _mutations_for.
    One valid base case plus one invalid case per (field, mutation).
    """
    cases = [pytest.param(dict(valid_payload), ok_status, None, id="valid")]
    seen = set()
    for field, rule in fields.items():
        for label, value in _mutations_for(rule):
            case_id = f"{field}-{label}"
            if case_id in seen:
                continue
            seen.add(case_id)
            payload = dict(valid_payload)
            if value is MISSING:
                payload.pop(field, None)
            else:
                payload[field] = value
            cases.append(pytest.param(payload, 400, error_code, id=case_id))
    return cases


def assert_error(resp, status, code=None, fields=None):
    """Every error: exact status, JSON, {"error":{code,message,details}}, no leaks (REQUIREMENTS §7)."""
    assert resp.status_code == status, f"expected {status}, got {resp.status_code}: {resp.text}"
    assert resp.headers.get("Content-Type", "").startswith("application/json"), resp.headers
    err = resp.json()["error"]
    assert isinstance(err.get("code"), str) and err["code"], err
    assert isinstance(err.get("message"), str) and err["message"], err
    assert isinstance(err.get("details"), dict), err
    if code is not None:
        assert err["code"] == code, err
    if fields is not None:
        assert sorted(err["details"]["fields"]) == sorted(fields), err
    for needle in FORBIDDEN_IN_ERRORS:
        assert needle not in resp.text, f"error body leaks {needle!r}: {resp.text}"
    assert not STACK_FRAME.search(resp.text), f"error body leaks a stack frame: {resp.text}"
    return err


# ---- production API (/api/v1) helpers ----------------------------------------------------------------------------------
import requests  # noqa: E402
import time as _time  # noqa: E402

ROLE_EMAILS = {
    "super_admin": "admin@nascon.test", "league_organizer": "organizer@nascon.test", "club_manager": "manager@nascon.test",
    "player": "player@nascon.test", "viewer": "viewer@nascon.test",
}
DEMO_PASSWORD = "Nascon@26"


class RetryClient(requests.Session):
    """Session for /api/v1 that waits out 429 (the 100 req / 10 s limit) so suites cannot flake on it."""

    def __init__(self, base_url):
        super().__init__()
        self.base_url = base_url.rstrip("/")

    def request(self, method, url, *args, **kwargs):
        kwargs.setdefault("timeout", 10)
        if url.startswith("/"):
            url = self.base_url + url
        for _ in range(8):
            resp = super().request(method, url, *args, **kwargs)
            if resp.status_code != 429:
                return resp
            _time.sleep(int(resp.headers.get("Retry-After", "1")) + 0.2)
        return resp


@pytest.fixture(scope="session")
def app(base_url):
    with RetryClient(base_url) as session:
        yield session


@pytest.fixture(scope="session")
def tokens(app):
    out = {}
    for role, email in ROLE_EMAILS.items():
        r = app.post("/api/v1/auth/login", json={"email": email, "password": DEMO_PASSWORD})
        assert r.status_code == 200, r.text
        out[role] = r.json()["token"]
    return out


@pytest.fixture(scope="session")
def H(tokens):
    return lambda role: {"Authorization": f"Bearer {tokens[role]}"}
