"""RT-01: WebSocket at /api/v1/ws (needs SEED_DEMO_DATA=true for fixtures)."""
import json
import time

import pytest
import websocket

from helpers import uid

LA1 = "league-alpha-1"


def ws_url(base_url, token):
    return base_url.replace("http://", "ws://") + f"/api/v1/ws?token={token}"


def recv_until(ws, predicate, timeout=5):
    """Read frames until predicate(frame) is true; returns that frame."""
    end = time.time() + timeout
    ws.settimeout(1)
    seen = []
    while time.time() < end:
        try:
            frame = json.loads(ws.recv())
        except websocket.WebSocketTimeoutException:
            continue
        seen.append(frame)
        if predicate(frame):
            return frame
    raise AssertionError(f"no matching frame; saw {seen}")


def connect(base_url, tokens, role):
    ws = websocket.create_connection(ws_url(base_url, tokens[role]), timeout=5)
    assert json.loads(ws.recv())["type"] == "hello"
    return ws


def sub(ws, topic):
    ws.send(json.dumps({"type": "subscribe", "topic": topic}))
    return recv_until(ws, lambda f: f.get("topic") == topic)


@pytest.fixture(scope="module", autouse=True)
def demo(api, app, tokens):
    api.post("/audit/v1/reset")
    r = app.get(f"/api/v1/leagues/{LA1}/fixtures", headers={"Authorization": f"Bearer {tokens['super_admin']}"})
    if r.status_code != 200 or not r.json()["data"]:
        pytest.skip("server was not started with SEED_DEMO_DATA=true")


@pytest.mark.api
@pytest.mark.req("RT-01")
def test_rt_01_close_code_is_4401(base_url):
    import socket, base64, os
    host, port = base_url.replace("http://", "").split(":")
    s = socket.create_connection((host, int(port)), timeout=5)
    key = base64.b64encode(os.urandom(16)).decode()
    s.sendall((f"GET /api/v1/ws?token=bad HTTP/1.1\r\nHost: {host}\r\nUpgrade: websocket\r\nConnection: Upgrade\r\n"
               f"Sec-WebSocket-Key: {key}\r\nSec-WebSocket-Version: 13\r\n\r\n").encode())
    data = b""
    s.settimeout(3)
    try:
        while b"\x88" not in data[data.find(b"\r\n\r\n") + 4:]:
            chunk = s.recv(4096)
            if not chunk:
                break
            data += chunk
    except socket.timeout:
        pass
    frame = data[data.find(b"\r\n\r\n") + 4:]
    assert frame[0] == 0x88 and int.from_bytes(frame[2:4], "big") == 4401


@pytest.mark.api
@pytest.mark.req("RT-01")
def test_rt_01_event_status_and_standings_frames(base_url, tokens, app):
    ws = connect(base_url, tokens, "viewer")
    ws_l = connect(base_url, tokens, "player")
    try:
        assert sub(ws, "match:demo-m4") == {"type": "subscribed", "topic": "match:demo-m4"}
        sub(ws_l, f"league:{LA1}")
        h = {"Authorization": f"Bearer {tokens['league_organizer']}"}
        start = {"event_id": uid("e"), "match_id": "demo-m4", "type": "match_start", "payload": {}}
        t0 = time.time()
        assert app.post("/api/v1/matches/demo-m4/events", json=start, headers=h).status_code == 201
        ev = recv_until(ws, lambda f: f["type"] == "match.event_appended")
        assert time.time() - t0 < 1.5
        assert (ev["match_id"], ev["version"], ev["event"]["type"], ev["event"]["sequence"]) == ("demo-m4", 1, "match_start", 1)
        assert recv_until(ws, lambda f: f["type"] == "match.status_changed") == {"type": "match.status_changed", "match_id": "demo-m4", "from": "upcoming", "to": "in_progress"}
        assert recv_until(ws_l, lambda f: f["type"] == "standings.changed") == {"type": "standings.changed", "league_id": LA1}
        goal = {"event_id": uid("e"), "match_id": "demo-m4", "type": "score", "payload": {"team_id": "club-alpha-2", "event_type": "goal"}}
        app.post("/api/v1/matches/demo-m4/events", json=goal, headers=h)
        ev = recv_until(ws, lambda f: f["type"] == "match.event_appended")
        assert ev["version"] == 2 and ev["event"]["payload"] == goal["payload"] and len(ev["event"]["signature"]) == 64
    finally:
        ws.close(); ws_l.close()


@pytest.mark.api
@pytest.mark.req("RT-01")
def test_rt_01_audit_writes_are_broadcast_too(base_url, tokens, api):
    ws = connect(base_url, tokens, "viewer")
    try:
        sub(ws, "match:demo-m3")
        e = {"event_id": uid("e"), "match_id": "demo-m3", "type": "match_start", "payload": {}}
        assert api.post("/audit/v1/events", json=e).status_code == 201
        assert recv_until(ws, lambda f: f["type"] == "match.event_appended")["match_id"] == "demo-m3"
    finally:
        ws.close()


@pytest.mark.api
@pytest.mark.req("RT-01")
def test_rt_01_offline_sync_events_are_broadcast(base_url, tokens, api):
    ws = connect(base_url, tokens, "viewer")
    try:
        sub(ws, "match:demo-m2")
        ev = {"event_id": uid("e"), "match_id": "demo-m2", "type": "score", "payload": {"team_id": "demo-eagles", "event_type": "goal"}}
        body = {"device_id": uid("dev"), "actions": [{"action_id": "a1", "type": "score_event", "queued_at": "2026-10-17T11:00:00Z", "base_version": 2, "payload": ev}]}
        assert api.post("/audit/v1/offline-sync", json=body).json()["results"][0]["status"] == "applied"
        assert recv_until(ws, lambda f: f["type"] == "match.event_appended")["event"]["event_id"] == ev["event_id"]
    finally:
        ws.close()


@pytest.mark.api
@pytest.mark.req("FR-2.3-05")
def test_fr_2_3_05_pin_frame(base_url, tokens, app):
    ws = connect(base_url, tokens, "viewer")
    try:
        sub(ws, "match:demo-m4")
        h = {"Authorization": f"Bearer {tokens['league_organizer']}"}
        t0 = time.time()
        app.put("/api/v1/matches/demo-m4/pin", json={"product_id": "demo-prod-scarf"}, headers=h)
        f = recv_until(ws, lambda x: x["type"] == "match.pinned_product_changed")
        assert time.time() - t0 < 1.5
        assert f["match_id"] == "demo-m4" and f["product"]["product_id"] == "demo-prod-scarf"
        app.put("/api/v1/matches/demo-m4/pin", json={"product_id": None}, headers=h)
        assert recv_until(ws, lambda x: x["type"] == "match.pinned_product_changed")["product"] is None
    finally:
        ws.close()


@pytest.mark.api
@pytest.mark.req("RT-01")
def test_rt_01_inventory_frames_after_checkout(base_url, tokens, app):
    ws = connect(base_url, tokens, "viewer")
    try:
        assert sub(ws, "store:tenant-alpha")["type"] == "subscribed"
        body = {"order_id": uid("ord"), "customer_id": "x", "items": [{"variant_id": "demo-var-ebook", "quantity": 2}], "discount_code": None, "payment": {"token": "tok_success"}}
        assert app.post("/api/v1/store/checkout", json=body, headers={"Authorization": f"Bearer {tokens['viewer']}"}).status_code == 201
        f = recv_until(ws, lambda x: x["type"] == "inventory.changed")
        assert f["variant_id"] == "demo-var-ebook" and f["stock"] <= 98
    finally:
        ws.close()


@pytest.mark.api
@pytest.mark.req("RT-01")
def test_rt_01_tenant_isolation_and_bad_topics(base_url, tokens):
    ws = connect(base_url, tokens, "viewer")
    try:
        for topic, code in [("league:league-beta-1", "FORBIDDEN"), ("store:tenant-beta", "FORBIDDEN"), ("match:nope", "MATCH_NOT_FOUND"), ("league:nope", "LEAGUE_NOT_FOUND")]:
            ws.send(json.dumps({"type": "subscribe", "topic": topic}))
            f = recv_until(ws, lambda x: x.get("topic") == topic)
            assert (f["type"], f["code"]) == ("error", code), f
        for bad in ('{"type":"subscribe","topic":"x"}', '{"type":"nope","topic":"match:demo-m1"}', "not json", '{"type":"subscribe"}'):
            ws.send(bad)
            assert recv_until(ws, lambda x: x["type"] == "error")["code"] == "VALIDATION_ERROR"
        ws.send(json.dumps({"type": "subscribe", "topic": "match:demo-m1"}))
        assert recv_until(ws, lambda x: x.get("topic") == "match:demo-m1")["type"] == "subscribed"
        ws.send(json.dumps({"type": "unsubscribe", "topic": "match:demo-m1"}))
        assert recv_until(ws, lambda x: x["type"] == "unsubscribed")["topic"] == "match:demo-m1"
    finally:
        ws.close()


@pytest.mark.api
@pytest.mark.req("RT-01")
def test_rt_01_super_admin_may_subscribe_across_tenants(base_url, tokens):
    ws = connect(base_url, tokens, "super_admin")
    try:
        assert sub(ws, "league:league-beta-1")["type"] == "subscribed"
    finally:
        ws.close()


@pytest.mark.api
@pytest.mark.req("RT-01")
def test_rt_01_non_ws_path_is_not_upgraded(base_url, tokens):
    with pytest.raises(Exception):
        websocket.create_connection(base_url.replace("http://", "ws://") + "/api/v1/other", timeout=3)
