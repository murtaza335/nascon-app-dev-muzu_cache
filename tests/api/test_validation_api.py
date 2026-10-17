"""REQ-INF-02: strict input validation, every invalid vector is 400 VALIDATION_ERROR with details."""
import pytest

from conftest import assert_error, make_cases

pytestmark = [pytest.mark.api, pytest.mark.req("REQ-INF-02")]

VALID_ITEM = {"name": "Valid item", "description": "ok", "quantity": 5}
ITEM_FIELDS = {
    "name": {"type": "string", "required": True, "max_length": 100},
    "description": {"type": "string", "max_length": 500},
    "quantity": {"type": "integer", "min": 0, "max": 1_000_000},
}
# PATCH: nothing required, description may be cleared with null.
PATCH_FIELDS = {
    "name": {"type": "string", "min_length": 1, "max_length": 100},
    "quantity": {"type": "integer", "min": 0, "max": 1_000_000},
}


@pytest.mark.parametrize("payload,status,code", make_cases(VALID_ITEM, ITEM_FIELDS, ok_status=201))
def test_req_inf02_create_item_vectors(api, payload, status, code):
    resp = api.post("/api/items", json=payload)
    if status == 201:
        assert resp.status_code == 201, resp.text
        body = resp.json()
        assert isinstance(body["id"], int)
        assert body["name"] == payload["name"]
        assert body["created_at"].endswith("Z")
        api.delete(f"/api/items/{body['id']}")
    else:
        body = assert_error(resp, status, code)
        assert body.get("details"), body


@pytest.mark.parametrize("payload,status,code", make_cases({"quantity": 9}, PATCH_FIELDS, ok_status=200))
def test_req_inf02_patch_item_vectors(api, created_item, payload, status, code):
    resp = api.patch(f"/api/items/{created_item['id']}", json=payload)
    if status == 200:
        assert resp.status_code == 200, resp.text
        assert resp.json()["quantity"] == 9
    else:
        body = assert_error(resp, status, code)
        assert body.get("details"), body


def test_req_inf02_patch_empty_body(api, created_item):
    body = assert_error(api.patch(f"/api/items/{created_item['id']}", json={}), 400, "VALIDATION_ERROR")
    assert body.get("details")


def test_req_inf02_multiple_errors_reported_together(api):
    body = assert_error(api.post("/api/items", json={"quantity": -5, "description": 7}), 400, "VALIDATION_ERROR")
    fields = {d["field"] for d in body["details"]}
    assert {"name", "quantity", "description"} <= fields


def test_req_inf02_unknown_fields_are_stripped(api):
    resp = api.post("/api/items", json={"name": "strip me", "is_admin": True})
    assert resp.status_code == 201, resp.text
    body = resp.json()
    assert "is_admin" not in body
    api.delete(f"/api/items/{body['id']}")


@pytest.mark.parametrize("query", ["limit=0", "limit=101", "offset=-1", "limit=abc", "limit=1.5"])
def test_req_inf02_pagination_bounds(api, query):
    body = assert_error(api.get(f"/api/items?{query}"), 400, "VALIDATION_ERROR")
    assert body.get("details")


def test_req_inf02_pagination_defaults(api):
    resp = api.get("/api/items")
    assert resp.status_code == 200
    body = resp.json()
    assert body["limit"] == 20 and body["offset"] == 0
    assert isinstance(body["data"], list) and isinstance(body["total"], int)
