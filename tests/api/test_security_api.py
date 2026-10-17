"""FR-SYS-03 / BR-RL-01: ping and the per-IP rate limit. Audit routes and /health are exempt."""
import time

import pytest

from conftest import assert_error


@pytest.mark.api
@pytest.mark.req("FR-SYS-03")
def test_fr_sys_03_burst_then_429_then_recovery(api):
    time.sleep(10.5)  # clear any quota left by earlier tests
    codes, retry = [], None
    for _ in range(105):
        r = api.get("/api/v1/ping")
        codes.append(r.status_code)
        if r.status_code == 429:
            retry = r.headers.get("Retry-After")
            err = assert_error(r, 429, "RATE_LIMITED")
    assert codes[:100] == [200] * 100
    assert codes[100:] == [429] * 5
    assert retry is not None and 1 <= int(retry) <= 10
    assert api.get("/api/v1/ping").status_code == 429
    time.sleep(int(retry) + 1)
    r = api.get("/api/v1/ping")
    assert r.status_code == 200 and r.json() == {"pong": True}


@pytest.mark.api
@pytest.mark.req("FR-SYS-03")
def test_fr_sys_03_audit_and_health_are_never_limited(api):
    for _ in range(150):
        assert api.get("/health").status_code == 200
    for _ in range(150):
        assert api.post("/audit/v1/rbac-matrix").status_code == 200


@pytest.mark.api
@pytest.mark.req("FR-SYS-03")
def test_fr_sys_03_forwarded_for_is_ignored(api):
    time.sleep(10.5)
    last = None
    for i in range(105):
        last = api.get("/api/v1/ping", headers={"X-Forwarded-For": f"10.0.0.{i}"})
    assert last.status_code == 429
    time.sleep(10.5)
