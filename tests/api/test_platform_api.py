"""Phase 0 platform vectors: health, reset, body limit, malformed JSON, unknown route."""
import json
import time

import pytest

from conftest import assert_error

SPORTS = ["football", "basketball", "cricket", "esports"]


@pytest.mark.api
@pytest.mark.req("FR-SYS-01")
def test_fr_sys_01_health_exact_body(api):
    resp = api.get("/health")
    assert resp.status_code == 200
    assert resp.json() == {"status": "ok"}


@pytest.mark.api
@pytest.mark.req("FR-SYS-02")
def test_fr_sys_02_reset_default_body(api):
    start = time.time()
    resp = api.post("/audit/v1/reset")
    assert time.time() - start < 10
    assert resp.status_code == 200
    assert resp.json() == {
        "status": "reset_complete",
        "seed": 42,
        "sports": SPORTS,
        "tenants": ["tenant-alpha", "tenant-beta"],
        "stock": {"var-jersey-001-M": 1, "var-jersey-001-L": 5},
    }


@pytest.mark.api
@pytest.mark.req("FR-SYS-02")
def test_fr_sys_02_reset_twice_identical(api):
    first = api.post("/audit/v1/reset", json={"seed": 7})
    second = api.post("/audit/v1/reset", json={"seed": 7})
    assert first.status_code == second.status_code == 200
    assert first.json() == second.json()
    assert first.json()["seed"] == 7


@pytest.mark.api
@pytest.mark.req("FR-SYS-02")
def test_fr_sys_02_reset_stock_override_and_health_after(api):
    resp = api.post("/audit/v1/reset", json={"stock": {"var-jersey-001-M": 3}})
    assert resp.status_code == 200
    assert resp.json()["stock"] == {"var-jersey-001-M": 3, "var-jersey-001-L": 5}
    assert api.get("/health").json() == {"status": "ok"}
    api.post("/audit/v1/reset")


@pytest.mark.api
@pytest.mark.req("FR-SYS-02")
def test_fr_sys_02_reset_unknown_variant_404(api):
    assert_error(api.post("/audit/v1/reset", json={"stock": {"nope": 1}}), 404, "VARIANT_NOT_FOUND")


@pytest.mark.api
@pytest.mark.req("FR-SYS-02")
@pytest.mark.parametrize("body,fields", [
    ({"seed": "42"}, ["seed"]),
    ({"seed": 4.5}, ["seed"]),
    ({"seed": True}, ["seed"]),
    ({"stock": {"var-jersey-001-M": -1}}, ["stock.var-jersey-001-M"]),
    ({"stock": {"var-jersey-001-M": 1.0 + 0.5}}, ["stock.var-jersey-001-M"]),
    ({"seed": "x", "stock": []}, ["seed", "stock"]),
])
def test_fr_sys_02_reset_validation_400(api, body, fields):
    assert_error(api.post("/audit/v1/reset", json=body), 400, "VALIDATION_ERROR", fields)


@pytest.mark.api
@pytest.mark.req("NFR-5")
def test_nfr5_malformed_json_400_body(api):
    resp = api.post("/audit/v1/reset", data="{not json", headers={"Content-Type": "application/json"})
    assert_error(resp, 400, "VALIDATION_ERROR", ["body"])


@pytest.mark.api
@pytest.mark.req("NFR-5")
def test_nfr5_json_parsed_regardless_of_content_type(api):
    resp = api.post("/audit/v1/reset", data=json.dumps({"seed": 42}), headers={"Content-Type": "text/plain"})
    assert resp.status_code == 200
    assert resp.json()["seed"] == 42


@pytest.mark.api
@pytest.mark.req("NFR-5")
def test_nfr5_body_over_1mb_413(api):
    big = json.dumps({"x": "a" * (1024 * 1024 + 10)})
    assert_error(api.post("/audit/v1/reset", data=big, headers={"Content-Type": "application/json"}), 413, "PAYLOAD_TOO_LARGE")
    assert api.get("/health").status_code == 200


@pytest.mark.api
@pytest.mark.req("NFR-5")
@pytest.mark.parametrize("method,path", [("get", "/nope"), ("post", "/audit/v1/nope"), ("delete", "/health")])
def test_nfr5_unknown_route_envelope(api, method, path):
    assert_error(getattr(api, method)(path), 404, "ROUTE_NOT_FOUND")


@pytest.mark.api
@pytest.mark.req("FR-SYS-02")
def test_fr_sys_02_error_responses_have_request_id(api):
    resp = api.get("/nope")
    assert resp.headers.get("X-Request-Id")
