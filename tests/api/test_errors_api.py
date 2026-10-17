"""REQ-INF-01: every failure path returns the same {error_code, message} contract."""
import pytest

from conftest import assert_error

pytestmark = [pytest.mark.api, pytest.mark.req("REQ-INF-01")]


def test_req_inf01_malformed_json(api):
    resp = api.post("/api/items", data="{bad", headers={"Content-Type": "application/json"})
    assert_error(resp, 400, "INVALID_JSON")


def test_req_inf01_unknown_route(api):
    assert_error(api.get("/definitely/not/a/route"), 404, "NOT_FOUND")


@pytest.mark.parametrize("bad_id", ["abc", "0", "-1", "1.5", "99999999999"])
def test_req_inf01_malformed_id_is_400(api, bad_id):
    assert_error(api.get(f"/api/items/{bad_id}"), 400, "VALIDATION_ERROR")


@pytest.mark.parametrize("method", ["get", "patch", "delete"])
def test_req_inf01_missing_id_is_404(api, method):
    kwargs = {"json": {"name": "x"}} if method == "patch" else {}
    assert_error(getattr(api, method)("/api/items/999999", **kwargs), 404, "NOT_FOUND")


@pytest.mark.parametrize("body", ["[1, 2]", '"text"', "null", "42"])
def test_req_inf01_body_not_object(api, body):
    resp = api.post("/api/items", data=body, headers={"Content-Type": "application/json"})
    assert_error(resp, 400)


def test_req_inf01_payload_too_large(api):
    resp = api.post("/api/items", json={"name": "x", "description": "y" * (2 * 1024 * 1024)})
    assert_error(resp, 413, "PAYLOAD_TOO_LARGE")
