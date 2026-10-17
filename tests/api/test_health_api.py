import pytest


@pytest.mark.api
@pytest.mark.req("REQ-00")
def test_req00_health_ok(api):
    resp = api.get("/health")
    assert resp.status_code == 200
    assert resp.headers["Content-Type"].startswith("application/json")
    body = resp.json()
    assert body["status"] == "ok"
    assert body["db"] is True
    assert isinstance(body["cache"], bool)


@pytest.mark.api
@pytest.mark.req("REQ-00")
def test_req00_root_ok(api):
    resp = api.get("/")
    assert resp.status_code == 200
    assert resp.json() == {"service": "backend", "status": "ok"}
