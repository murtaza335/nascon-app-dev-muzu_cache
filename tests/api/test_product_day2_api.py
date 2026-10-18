"""Part II product API (/api/v1): public reads, chat + moderation, athletes/follow, streams, co-stream controls, media hooks."""
import concurrent.futures as cf

import pytest

from conftest import assert_error
from day2_helpers import GUEST, uid


@pytest.fixture(autouse=True)
def _reset(api):
    api.post("/audit/v1/reset")


@pytest.fixture
def H2(app):
    def login(email):
        return {"Authorization": f"Bearer {app.post('/api/v1/auth/login', json={'email': email, 'password': 'Nascon@26'}).json()['token']}"}
    return login


@pytest.mark.api
@pytest.mark.req("API-D2-57")
def test_public_match(app):
    j = app.get("/api/v1/public/matches/match-m1").json()
    assert j["status"] == "in_progress" and j["score_text"] == "1 - 0" and j["chat_room_id"] == "chat-match-match-m1"
    assert j["home"]["team_id"] == "club-alpha-1" and j["home"]["score"] == 1 and j["away"]["score"] == 0
    assert j["pinned_product"]["product_id"] == "prod-jersey-001" and j["pinned_product"]["stock_available"] > 0
    assert j["stream"] is None and j["vod"] == []
    assert_error(app.get("/api/v1/public/matches/ghost"), 404, "MATCH_NOT_FOUND")


@pytest.mark.api
@pytest.mark.req("API-D2-59")
def test_public_players_clubs_costreams(app, api):
    assert app.get("/api/v1/public/players/player-alpha-1").json()["club"]["club_id"] == "club-alpha-1"
    assert_error(app.get("/api/v1/public/players/ghost"), 404, "PLAYER_NOT_FOUND")
    c = app.get("/api/v1/public/clubs/club-alpha-1").json()
    assert c["name"] == "Alpha Lions" and c["live_matches"][0]["match_id"] == "match-m1"
    assert_error(app.get("/api/v1/public/clubs/ghost"), 404, "CLUB_NOT_FOUND")
    assert_error(app.get("/api/v1/public/costreams/cs-session-nope"), 404, "STREAM_NOT_FOUND")
    sid = uid("cs-session")
    api.post("/audit/v1/costream/session", json={"session_id": sid, "host_player_id": "player-alpha-1", "participants": ["player-alpha-1", "player-beta-1"]})
    j = app.get(f"/api/v1/public/costreams/{sid}").json()
    assert [p["player_id"] for p in j["active_participants"]] == ["player-alpha-1", "player-beta-1"] and j["layout"] == "grid_4"


@pytest.mark.api
@pytest.mark.req("API-D2-45")
def test_chat_post_history_idempotency_and_moderation(api, app, H2):
    h = H2("viewer@nascon.test")
    room = "chat-match-match-m1"
    one = api.post("/api/v1/chat", headers=h, json={"chat_room_id": room, "text": "go team", "client_message_id": "c-1"})
    assert one.status_code == 201 and one.json()["seq"] == 1 and one.json()["flagged"] is False
    dup = api.post("/api/v1/chat", headers=h, json={"chat_room_id": room, "text": "go team", "client_message_id": "c-1"})
    assert dup.status_code == 200 and dup.json() == one.json()
    bad = api.post("/api/v1/chat", headers=h, json={"chat_room_id": room, "text": "what a b@dword", "client_message_id": "c-2"})
    assert bad.status_code == 201 and bad.json()["text"] == "what a ***" and bad.json()["flagged"] is True and bad.json()["seq"] == 2
    assert_error(api.post("/api/v1/chat", headers=h, json={"chat_room_id": room, "text": "hello", "client_message_id": "c-3"}), 429, "RATE_LIMITED")  # kicked sender is blocked
    h2 = H2("player@nascon.test")
    err = assert_error(api.post("/api/v1/chat", headers=h2, json={"chat_room_id": room, "text": "AAAAA", "client_message_id": "c-4"}), 429, "RATE_LIMITED")
    assert err["details"]["reason"] == "flood"
    err = assert_error(api.post("/api/v1/chat", headers=h2, json={"chat_room_id": room, "text": "hello", "client_message_id": "c-5"}), 429, "RATE_LIMITED")  # muted now
    assert err["details"]["reason"] == "muted"
    hist = app.get(f"/api/v1/chat/{room}/messages?after_seq=1&limit=10", headers=GUEST).json()
    assert [m["seq"] for m in hist["messages"]] == [2] and hist["last_seq"] == 2
    assert_error(app.get(f"/api/v1/chat/{room}/messages?limit=0"), 400, "VALIDATION_ERROR", fields=["limit"])
    assert_error(api.post("/api/v1/chat", headers=h, json={"chat_room_id": room}), 400, "VALIDATION_ERROR")
    assert_error(api.post("/api/v1/chat", json={"chat_room_id": room, "text": "x", "client_message_id": "z"}), 401, "UNAUTHENTICATED")


@pytest.mark.api
@pytest.mark.req("FR-3.3-03")
def test_chat_sequence_has_no_gaps_under_concurrency(app, H2):
    h = H2("player@nascon.test")
    def send(i):
        return app.post("/api/v1/chat", headers=h, json={"chat_room_id": "chat-seq-test", "text": f"msg {i} fine", "client_message_id": f"cm-{i}"})
    # one sender, so spread across distinct users to stay under the 3-per-2s rate window
    tokens = [H2(e) for e in ("viewer@nascon.test", "player@nascon.test", "manager@nascon.test", "organizer@nascon.test", "admin@nascon.test")]
    def send2(i):
        return app.post("/api/v1/chat", headers=tokens[i % 5], json={"chat_room_id": "chat-seq-test", "text": f"msg {i} fine", "client_message_id": f"cm-{i}"})
    with cf.ThreadPoolExecutor(10) as ex:
        rs = list(ex.map(send2, range(15)))
    assert [r.status_code for r in rs] == [201] * 15
    assert sorted(r.json()["seq"] for r in rs) == list(range(1, 16))


@pytest.mark.api
@pytest.mark.req("FR-3.1-02")
def test_follow_graph_is_idempotent_and_drift_free(app, H2):
    h = H2("viewer@nascon.test")
    p = "/api/v1/athletes/player-alpha-2/follow"
    assert app.put(p, headers=h).json() == {"player_id": "player-alpha-2", "following": True, "follower_count": 1}
    assert app.put(p, headers=h).json()["follower_count"] == 1
    assert app.get("/api/v1/athletes/player-alpha-2", headers=h).json()["is_following"] is True
    with cf.ThreadPoolExecutor(8) as ex:
        list(ex.map(lambda i: app.put(p, headers=H2("player@nascon.test")) if i % 2 else app.delete(p, headers=H2("player@nascon.test")), range(20)))
    final = app.get("/api/v1/athletes/player-alpha-2").json()
    assert final["follower_count"] in (1, 2) and final["is_following"] is False
    assert app.delete(p, headers=h).json() == {"player_id": "player-alpha-2", "following": False, "follower_count": final["follower_count"] - 1}
    assert_error(app.put("/api/v1/athletes/ghost/follow", headers=h), 404, "PLAYER_NOT_FOUND")
    assert_error(app.put(p), 401, "UNAUTHENTICATED")
    assert_error(app.put(p, headers=GUEST), 403, "GUEST_WRITE_FORBIDDEN")


@pytest.mark.api
@pytest.mark.req("FR-3.1-01")
def test_athlete_profile_career_from_event_logs(app, api):
    m = uid("match")
    def ev(t, p): return api.post("/audit/v1/events", json={"event_id": uid("e"), "match_id": m, "type": t, "payload": p})
    ev("match_init", {"sport_id": "football", "home_team_id": "club-alpha-1", "away_team_id": "club-beta-1"})
    ev("match_start", {})
    ev("score", {"team_id": "club-alpha-1", "event_type": "goal", "player_id": "player-alpha-1"})
    ev("match_end", {})
    c = app.get("/api/v1/athletes/player-alpha-1").json()["career"]
    assert c["matches"] == 1 and c["wins"] == 1 and c["losses"] == 0 and c["score_events"] == 1
    assert app.get("/api/v1/athletes/player-beta-1").json()["career"]["losses"] == 1


@pytest.mark.api
@pytest.mark.req("API-D2-31")
def test_member_stream_key_and_bind_match(app, H2):
    h = H2("player@nascon.test")
    assert_error(app.get("/api/v1/streams/me", headers=h), 404, "STREAM_NOT_FOUND")
    k = app.post("/api/v1/streams/key", headers=h, json={"action": "generate", "label": "phone"})
    assert k.status_code == 201 and k.json()["player_id"] == "player-alpha-1"
    assert_error(app.post("/api/v1/streams/key", headers=h, json={"action": "generate", "player_id": "player-alpha-2"}), 403, "FORBIDDEN")
    assert_error(app.post("/api/v1/streams/key", headers=H2("viewer@nascon.test"), json={"action": "generate"}), 403, "FORBIDDEN")
    me = app.get("/api/v1/streams/me", headers=h).json()
    assert me["stream_key"] == k.json()["stream_key"] and me["live"] is False
    assert app.put("/api/v1/streams/me/match", headers=h, json={"match_id": "match-m1"}).json()["match_id"] == "match-m1"
    assert_error(app.put("/api/v1/streams/me/match", headers=h, json={"match_id": "ghost"}), 404, "MATCH_NOT_FOUND")
    assert app.get("/api/v1/public/matches/match-m1").json()["stream"]["status"] == "offline"
    assert app.get("/api/v1/streams/live").json() == []


@pytest.mark.api
@pytest.mark.req("FR-3.3-02")
def test_costream_product_flow(app, H2):
    host, guest_p = H2("player@nascon.test"), H2("admin@nascon.test")
    s = app.post("/api/v1/costreams", headers=host, json={"layout": "grid_4"})
    assert s.status_code == 201 and s.json()["active_host"] == "player-alpha-1"
    sid = s.json()["session_id"]
    inv = app.post(f"/api/v1/costreams/{sid}/invites", headers=host, json={"player_id": "player-alpha-2"})
    assert inv.status_code == 201 and "." in inv.json()["invite_token"]
    assert_error(app.post(f"/api/v1/costreams/{sid}/invites", headers=H2("viewer@nascon.test"), json={"player_id": "player-alpha-2"}), 403, "FORBIDDEN")
    assert_error(app.post(f"/api/v1/costreams/{sid}/join", headers=host, json={"invite_token": "forged.token"}), 403, "FORBIDDEN")
    assert_error(app.post(f"/api/v1/costreams/{sid}/join", headers=host, json={"invite_token": inv.json()["invite_token"]}), 403, "FORBIDDEN")  # wrong player
    # the invited player has no demo login; the admin acts through the control path instead
    assert app.post(f"/api/v1/costreams/{sid}/participants/player-alpha-1/mute", headers=host).json()["active_participants"][0]["muted"] is True
    assert app.post(f"/api/v1/costreams/{sid}/participants/player-alpha-1/unmute", headers=host).json()["active_participants"][0]["muted"] is False
    assert app.post(f"/api/v1/costreams/{sid}/participants/player-alpha-1/spotlight", headers=guest_p).json()["active_participants"][0]["spotlight"] is True
    assert_error(app.post(f"/api/v1/costreams/{sid}/participants/player-beta-1/mute", headers=host), 404, "PLAYER_NOT_FOUND")
    left = app.post(f"/api/v1/costreams/{sid}/leave", headers=host).json()
    assert left["status"] == "terminated" and left["active_host"] is None
    assert_error(app.post("/api/v1/costreams", headers=H2("viewer@nascon.test"), json={}), 403, "FORBIDDEN")


@pytest.mark.api
@pytest.mark.req("API-D2-47")
def test_notification_test_requires_admin(app, H2):
    ok = app.post("/api/v1/notifications/test", headers=H2("admin@nascon.test"), json={"topic": "order.status_changed", "target_user_id": "user-player", "simulate_dlq": True})
    assert ok.status_code == 202 and ok.json()["notification_id"].startswith("notif-")
    assert "nascon_dlq_depth 1" in app.get("/metrics").text
    assert_error(app.post("/api/v1/notifications/test", headers=H2("viewer@nascon.test"), json={"topic": "t", "target_user_id": "u"}), 403, "FORBIDDEN")


@pytest.mark.api
@pytest.mark.req("API-D2-30")
def test_media_auth_hook(app, api):
    key = api.post("/audit/v1/stream/key", json={"action": "generate", "player_id": "player-alpha-1"}).json()["stream_key"]
    auth = lambda **b: app.post("/internal/media/auth", json={"user": "", "password": "", "ip": "1.1.1.1", "action": "publish", "path": "x", "protocol": "rtmp", "id": "1", "query": "", **b})
    assert auth(path=f"live/{key}").status_code == 200
    assert_error(auth(path="live/sk_live_unknown"), 404, "STREAM_NOT_FOUND")
    api.post("/audit/v1/stream/key", json={"action": "revoke", "player_id": "player-alpha-1"})
    assert_error(auth(path=f"live/{key}"), 409, "KEY_REVOKED")
    assert_error(auth(path=f"live/{key}", action="read"), 409, "KEY_REVOKED")
    assert_error(auth(path="costream/cs-session-1"), 401, "UNAUTHENTICATED")
    assert auth(path="costream/cs-session-1", action="read").status_code == 200
    assert auth(path="costream/cs-session-1", user="compositor", password="media-hook-dev").status_code == 200
    assert_error(app.post("/internal/media/events", json={"event": "ready", "path": f"live/{key}"}), 401, "UNAUTHENTICATED")
    assert app.post("/internal/media/events", headers={"X-Media-Hook-Token": "media-hook-dev"}, json={"event": "ready", "path": f"live/{key}"}).status_code == 200
