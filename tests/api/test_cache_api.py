"""REQ-INF-03: Redis cache-aside. Reads are cached, writes invalidate before responding."""
import os
import shutil
import subprocess
import time
import uuid

import pytest

pytestmark = [pytest.mark.api, pytest.mark.req("REQ-INF-03")]

REPO_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))


def _unique_query():
    # A fresh q= gives a cache key no other test has touched, so tests stay order-independent.
    return f"/api/items?q=zz{uuid.uuid4().hex[:10]}"


def _cache_up(api):
    return api.get("/health").json().get("cache") is True


@pytest.fixture
def need_cache(api):
    if not _cache_up(api):
        pytest.skip("cache is disabled or Redis is down")


def test_req_inf03_list_miss_then_hit(api, need_cache):
    url = _unique_query()
    first = api.get(url)
    second = api.get(url)
    assert first.status_code == second.status_code == 200
    assert first.headers["X-Cache"] == "MISS"
    assert second.headers["X-Cache"] == "HIT"
    assert first.json() == second.json()


def test_req_inf03_detail_miss_then_hit(api, need_cache, created_item):
    url = f"/api/items/{created_item['id']}"
    assert api.get(url).headers["X-Cache"] == "MISS"
    second = api.get(url)
    assert second.headers["X-Cache"] == "HIT"
    assert second.json() == created_item


def test_req_inf03_read_your_writes_after_post(api, need_cache):
    tag = f"ryw{uuid.uuid4().hex[:10]}"
    url = f"/api/items?q={tag}"
    api.get(url)
    assert api.get(url).headers["X-Cache"] == "HIT"
    created = api.post("/api/items", json={"name": f"item {tag}"}).json()
    try:
        after = api.get(url)
        assert after.headers["X-Cache"] == "MISS"
        assert [i["id"] for i in after.json()["data"]] == [created["id"]]
    finally:
        api.delete(f"/api/items/{created['id']}")


def test_req_inf03_patch_invalidates(api, need_cache, created_item):
    url = f"/api/items/{created_item['id']}"
    api.get(url)
    assert api.get(url).headers["X-Cache"] == "HIT"
    assert api.patch(url, json={"quantity": 42}).status_code == 200
    after = api.get(url)
    assert after.headers["X-Cache"] == "MISS"
    assert after.json()["quantity"] == 42


def test_req_inf03_delete_invalidates(api, need_cache):
    item = api.post("/api/items", json={"name": "to delete"}).json()
    url = f"/api/items/{item['id']}"
    api.get(url)
    assert api.get(url).headers["X-Cache"] == "HIT"
    assert api.delete(url).status_code == 204
    assert api.get(url).status_code == 404


def test_req_inf03_404_is_never_cached(api, need_cache):
    for _ in range(2):
        resp = api.get("/api/items/999998")
        assert resp.status_code == 404
        assert resp.headers.get("X-Cache") != "HIT"


def _compose(*args):
    subprocess.run(["docker", "compose", *args], cwd=REPO_ROOT, check=True, capture_output=True, timeout=120)


@pytest.mark.destructive
@pytest.mark.skipif(os.environ.get("RUN_DESTRUCTIVE") != "1", reason="set RUN_DESTRUCTIVE=1 to stop/start Redis")
@pytest.mark.skipif(shutil.which("docker") is None, reason="needs the docker CLI (run on the host, not in --docker mode)")
def test_req_inf03_redis_outage_bypasses(api):
    _compose("stop", "redis")
    try:
        resp = api.get("/api/items")
        assert resp.status_code == 200
        assert resp.headers["X-Cache"] == "BYPASS"
        created = api.post("/api/items", json={"name": "during outage"})
        assert created.status_code == 201
        api.delete(f"/api/items/{created.json()['id']}")
        health = api.get("/health")
        assert health.status_code == 200
        assert health.json()["cache"] is False
    finally:
        _compose("start", "redis")
    deadline = time.time() + 30
    while time.time() < deadline and not _cache_up(api):
        time.sleep(0.5)
    assert _cache_up(api), "cache did not recover after Redis restart"
    url = _unique_query()
    assert api.get(url).headers["X-Cache"] == "MISS"
    assert api.get(url).headers["X-Cache"] == "HIT"
