"""FR-5.2 / FR-5.3 / API-D2-09 + EC-3, API-D2-10 metrics, API-D2-11 privacy."""
import re
import threading

import pytest

from conftest import assert_error
from day2_helpers import day2_sig, uid

URL = "/audit/v1/moderation/test"
ROOM = "chat-cs-session-101"


@pytest.fixture(autouse=True)
def _reset(api):
    api.post("/audit/v1/reset")


def probe(api, msgs, **kw):
    return api.post(URL, json={"chat_room_id": ROOM, "incoming_messages": [{"message_id": f"m{i}", "sender": s, "text": t} for i, (s, t) in enumerate(msgs)], **kw})


@pytest.mark.api
@pytest.mark.req("FR-5.3")
def test_spec_example(api):
    r = probe(api, [("user-guest-1", "Clean sports commentary"), ("user-spammer", "Watch this illegal stream b@d_w0rd now!"), ("user-flooder", "GOAL! AAAA!!!")], check_dlq=True, simulate_failed_notifications=0)
    assert r.status_code == 200, r.text
    j = r.json()
    assert j["filtered_messages"] == [
        {"message_id": "m0", "sender": "user-guest-1", "text": "Clean sports commentary", "flagged": False, "reason": None},
        {"message_id": "m1", "sender": "user-spammer", "text": "Watch this illegal stream *** now!", "flagged": True, "reason": "profanity_leetspeak"}]
    assert j["kicked_users"] == ["user-spammer"] and j["muted_users"] == ["user-flooder"]
    assert j["dlq_status"] == {"queue_depth": 0, "undelivered_events": []}
    assert j["signature"] == day2_sig(ROOM, {"chat_room_id": ROOM, "flagged_count": 1, "kicked_users": ["user-spammer"], "queue_depth": 0})


@pytest.mark.api
@pytest.mark.req("FR-5.3")
@pytest.mark.parametrize("text,masked", [
    ("p0rn here", "*** here"), ("this is sc@m!", "this is ***!"), ("s!c@m alert", "*** alert"), ("you idiot_spam", "you ***"),
    ("SH1T and f.u.c.k", "*** and ***"), ("b.i.t.c.h", "***"), ("a$$h0le", "***"), ("bad_word, really", "***, really"),
])
def test_masking(api, text, masked):
    m = probe(api, [("u", text)]).json()["filtered_messages"]
    assert m[0]["text"] == masked and m[0]["flagged"] is True


@pytest.mark.api
@pytest.mark.req("FR-5.3")
@pytest.mark.parametrize("text", ["AAAA", "aAaA", "great!!!", "what???", "huh?!?", "wooow"])
def test_flood_is_dropped_and_muted(api, text):
    j = probe(api, [("flooder", text)]).json()
    if text == "wooow":
        assert j["muted_users"] == []  # three o's only
    else:
        assert j["filtered_messages"] == [] and j["muted_users"] == ["flooder"] and j["kicked_users"] == []


@pytest.mark.api
@pytest.mark.req("FR-5.3")
def test_flood_before_profanity_and_dedupe_order(api):
    j = probe(api, [("z", "b@dword!!!"), ("a", "scam"), ("z", "porn"), ("a", "scam again"), ("m", "xxxx")]).json()
    assert j["muted_users"] == ["z", "m"]
    assert j["kicked_users"] == ["a", "z"]


@pytest.mark.api
@pytest.mark.req("FR-5.3")
def test_empty_and_max_batches(api):
    j = probe(api, []).json()
    assert j["filtered_messages"] == [] and j["kicked_users"] == [] and j["muted_users"] == []
    many = probe(api, [(f"user-{i}", "fine") for i in range(500)])
    assert many.status_code == 200 and len(many.json()["filtered_messages"]) == 500
    assert_error(probe(api, [(f"u{i}", "x") for i in range(501)]), 400, "VALIDATION_ERROR", fields=["incoming_messages"])


@pytest.mark.api
@pytest.mark.req("BR-MOD-05")
def test_rate_limit_inside_one_request(api):
    j = probe(api, [("burst", f"hi {i}") for i in range(5)]).json()
    assert len(j["filtered_messages"]) == 3 and j["muted_users"] == ["burst"]


@pytest.mark.api
@pytest.mark.req("FR-5.2-02")
def test_dlq_simulation_and_persistence(api):
    j = probe(api, [], simulate_failed_notifications=3).json()
    d = j["dlq_status"]
    assert d["queue_depth"] == 3 and [e["event_id"] for e in d["undelivered_events"]] == ["dlq-000001", "dlq-000002", "dlq-000003"]
    e = d["undelivered_events"][0]
    assert e["topic"] == "notification.simulated" and e["target"] == "simulated-subscriber" and e["attempts"] == 3
    assert e["last_error"] == "simulated_delivery_failure" and re.fullmatch(r"\d{4}-\d\d-\d\dT\d\d:\d\d:\d\dZ", e["dead_lettered_at"])
    assert j["signature"] == day2_sig(ROOM, {"chat_room_id": ROOM, "flagged_count": 0, "kicked_users": [], "queue_depth": 3})
    again = probe(api, [], check_dlq=False).json()["dlq_status"]
    assert again["queue_depth"] == 3
    assert "nascon_dlq_depth 3" in api.get("/metrics").text
    api.post("/audit/v1/reset")
    assert probe(api, []).json()["dlq_status"]["queue_depth"] == 0


@pytest.mark.api
@pytest.mark.req("EC-3")
def test_concurrent_kick_race(api):
    results = []
    def go(i):
        results.append(api.post(URL, json={"chat_room_id": "chat-race", "incoming_messages": [
            {"message_id": "a", "sender": "user-bad", "text": "b@d_w0rd"}, {"message_id": "b", "sender": "user-flood", "text": "!!!!"}], "simulate_failed_notifications": 1}))
    ts = [threading.Thread(target=go, args=(i,)) for i in range(10)]
    [t.start() for t in ts]; [t.join() for t in ts]
    assert [r.status_code for r in results] == [200] * 10
    assert {tuple(r.json()["kicked_users"]) for r in results} == {("user-bad",)}
    final = probe(api, []).json()["dlq_status"]
    assert final["queue_depth"] == 10 == len(final["undelivered_events"])
    assert len({e["event_id"] for e in final["undelivered_events"]}) == 10


@pytest.mark.api
@pytest.mark.req("FR-5.3")
@pytest.mark.parametrize("patch,fields", [
    ({"chat_room_id": ""}, ["chat_room_id"]), ({"chat_room_id": 5}, ["chat_room_id"]), ({"incoming_messages": "x"}, ["incoming_messages"]),
    ({"incoming_messages": [{"message_id": "1", "sender": "s"}]}, ["incoming_messages[0].text"]),
    ({"incoming_messages": [{"message_id": "1", "sender": "s", "text": "x" * 2001}]}, ["incoming_messages[0].text"]),
    ({"check_dlq": "no"}, ["check_dlq"]), ({"simulate_failed_notifications": -1}, ["simulate_failed_notifications"]),
    ({"simulate_failed_notifications": 101}, ["simulate_failed_notifications"]), ({"simulate_failed_notifications": 1.5}, ["simulate_failed_notifications"]),
])
def test_validation(api, patch, fields):
    base = {"chat_room_id": ROOM, "incoming_messages": [{"message_id": "1", "sender": "s", "text": "hello"}]}
    base.update(patch)
    assert_error(api.post(URL, json=base), 400, "VALIDATION_ERROR", fields=fields)


# ---- /metrics (NFR-6) ----------------------------------------------------------------------------------------------
@pytest.mark.api
@pytest.mark.req("NFR-6")
def test_metrics_format(api):
    r = api.get("/metrics")
    assert r.status_code == 200 and r.headers["Content-Type"] == "text/plain; version=0.0.4"
    for name, kind in [("nascon_active_ws_connections", "gauge"), ("nascon_active_streams_total", "gauge"), ("nascon_stream_bitrate_kbps", "gauge"),
                       ("nascon_dlq_depth", "gauge"), ("nascon_qr_scans_total", "counter")]:
        assert f"# TYPE {name} {kind}" in r.text and f"# HELP {name} " in r.text
        assert re.search(rf"^{name} \d+$", r.text, re.M), name


@pytest.mark.api
@pytest.mark.req("NFR-6")
def test_metrics_qr_counter_tracks_scans(api):
    api.get("/audit/v1/qr/match-m1")
    api.get("/q/p-alpha-1", allow_redirects=False)
    assert "nascon_qr_scans_total 2" in api.get("/metrics").text


# ---- privacy (NFR-9) ------------------------------------------------------------------------------------------------
@pytest.mark.api
@pytest.mark.req("NFR-9")
def test_erasure_response_idempotent_and_unknown(api):
    expected = {"user_id": "player-alpha-1", "status": "anonymized", "pii_retained": False, "tokens_wiped": True}
    api.post("/audit/v1/guest/cart-merge", json={"guest_token": "guest_anon_tok_7721", "registered_user_id": "player-alpha-1", "guest_cart": [{"variant_id": "var-jersey-001-L", "quantity": 1}]})
    t0 = __import__("time").time()
    assert api.delete("/audit/v1/privacy/user/player-alpha-1").json() == expected
    assert __import__("time").time() - t0 < 1
    assert api.delete("/audit/v1/privacy/user/player-alpha-1").json() == expected
    assert_error(api.delete("/audit/v1/privacy/user/user-ghost"), 404, "PLAYER_NOT_FOUND")
    assert api.get("/api/v1/public/players/player-alpha-1").json()["name"] == "Anonymized Player"
    # the merged guest token is wiped: it can be merged again by someone else
    assert api.post("/audit/v1/guest/cart-merge", json={"guest_token": "guest_anon_tok_7721", "registered_user_id": "player-alpha-2", "guest_cart": [{"variant_id": "var-jersey-001-L", "quantity": 1}]}).status_code == 200


@pytest.mark.api
@pytest.mark.req("NFR-9")
def test_erasure_kills_tokens_of_the_user(api):
    login = api.post("/api/v1/auth/login", json={"email": "player@nascon.test", "password": "Nascon@26"}).json()
    h = {"Authorization": f"Bearer {login['token']}"}
    assert api.get("/api/v1/me", headers=h).status_code == 200
    assert api.delete("/audit/v1/privacy/user/user-player").status_code == 200
    assert_error(api.get("/api/v1/me", headers=h), 401, "UNAUTHENTICATED")
    assert_error(api.post("/api/v1/auth/login", json={"email": "player@nascon.test", "password": "Nascon@26"}), 401, "INVALID_CREDENTIALS")
