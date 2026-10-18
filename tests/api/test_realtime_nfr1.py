"""NFR-1 / RT-D2-01..03: 25-client WebSocket probe, SSE variant, unknown match, co-stream host-drop handoff."""
import json
import threading
import time
from urllib.parse import urlparse

import pytest
import requests

from day2_helpers import uid

websocket = pytest.importorskip("websocket")


def ws_url(base_url, path):
    u = urlparse(base_url)
    return f"ws://{u.netloc}{path}"


@pytest.fixture(autouse=True)
def _reset(api):
    api.post("/audit/v1/reset")


def score_event(api, n):
    return api.post("/audit/v1/events", json={"event_id": uid(f"nfr1-{n}"), "match_id": "match-m1", "type": "score", "payload": {"team_id": "club-alpha-1", "event_type": "goal"}})


@pytest.mark.api
@pytest.mark.req("NFR-1")
def test_25_clients_receive_score_updated_under_500ms(api, base_url):
    clients, lat, lock, ready = [], [], threading.Lock(), threading.Barrier(26)
    posted = {}

    def run(i):
        ws = websocket.create_connection(ws_url(base_url, "/ws/matches/match-m1"), timeout=10)
        hello = json.loads(ws.recv())
        assert hello["type"] == "hello" and hello["match_id"] == "match-m1" and hello["status"] == "in_progress"
        ready.wait()
        seen = 0
        while seen < 5:
            m = json.loads(ws.recv())
            if m["type"] == "score.updated":
                t = time.time()
                with lock:
                    lat.append((m["event_id"], t))
                seen += 1
        ws.close()

    ts = [threading.Thread(target=run, args=(i,)) for i in range(25)]
    [t.start() for t in ts]
    ready.wait()
    for n in range(5):
        r = score_event(api, n)
        posted[r.json()["event_id"]] = time.time()
        time.sleep(0.2)
    [t.join(timeout=15) for t in ts]
    assert len(lat) == 125
    lat = sorted(t - posted[eid] for eid, t in lat)  # negative = the frame beat the HTTP response (allowed, even better)
    assert lat[int(len(lat) * 0.95)] < 0.5, f"p95={lat[int(len(lat) * 0.95)]:.3f}s"


@pytest.mark.api
@pytest.mark.req("RT-D2-01")
def test_frame_shapes_and_unknown_match(api, base_url):
    ws = websocket.create_connection(ws_url(base_url, "/ws/matches/match-m1"), timeout=5)
    json.loads(ws.recv())
    score_event(api, 99)
    m = json.loads(ws.recv())
    assert m["type"] == "score.updated" and m["home_score"] == 2 and m["away_score"] == 0 and m["score_text"] == "2 - 0"
    assert set(m) >= {"match_id", "status", "version", "event_id", "emitted_at"} and m["emitted_at"].endswith("Z")
    api.post("/audit/v1/events", json={"event_id": uid("end"), "match_id": "match-m1", "type": "match_end", "payload": {}})
    frames = [json.loads(ws.recv()), json.loads(ws.recv())]
    assert {"type": "match.status_changed", "match_id": "match-m1", "from": "in_progress", "to": "completed"} in frames
    ws.close()
    bad = websocket.create_connection(ws_url(base_url, "/ws/matches/ghost"), timeout=5)
    frame = bad.recv_frame()
    assert frame.opcode == websocket.ABNF.OPCODE_CLOSE and int.from_bytes(frame.data[:2], "big") == 4404


@pytest.mark.api
@pytest.mark.req("RT-D2-02")
def test_sse_receives_score_updated(api, base_url):
    got = []
    def listen():
        with requests.get(f"{base_url}/api/v1/matches/match-m1/stream", stream=True, timeout=8, headers={"Authorization": "Bearer guest_anon_tok_7721"}) as r:
            assert r.headers["Content-Type"].startswith("text/event-stream")
            for line in r.iter_lines(decode_unicode=True):
                if line and line.startswith("event: "):
                    got.append(line)
                    return
    t = threading.Thread(target=listen); t.start(); time.sleep(0.5)
    score_event(api, 7)
    t.join(timeout=8)
    assert got == ["event: score.updated"]
    assert requests.get(f"{base_url}/api/v1/matches/ghost/stream", timeout=5).status_code == 404


@pytest.mark.api
@pytest.mark.req("FR-3.3-04")
def test_host_socket_drop_triggers_handoff(api, base_url):
    sid = uid("cs-session")
    api.post("/audit/v1/costream/session", json={"session_id": sid, "host_player_id": "player-alpha-1", "participants": ["player-alpha-1", "player-alpha-2", "player-beta-1"], "layout": "grid_4"})
    tok = requests.post(f"{base_url}/api/v1/auth/login", json={"email": "player@nascon.test", "password": "Nascon@26"}).json()["token"]  # player-alpha-1
    host = websocket.create_connection(ws_url(base_url, f"/ws/costream/{sid}?token={tok}"), timeout=5)
    assert json.loads(host.recv())["type"] == "hello"
    viewer = websocket.create_connection(ws_url(base_url, f"/ws/costream/{sid}"), timeout=5)
    assert json.loads(viewer.recv())["session"]["active_host"] == "player-alpha-1"
    t0 = time.time()
    host.close()
    frame = None
    while time.time() - t0 < 3:
        m = json.loads(viewer.recv())
        if m["type"] == "costream.host_changed":
            frame = m; break
    assert frame == {"type": "costream.host_changed", "from": "player-alpha-1", "to": "player-alpha-2", "handoff_occurred": True}
    assert time.time() - t0 < 1.5
    state = requests.get(f"{base_url}/api/v1/public/costreams/{sid}").json()
    assert state["active_host"] == "player-alpha-2" and state["composite_playback_url"].endswith(f"/costream/{sid}/index.m3u8")
