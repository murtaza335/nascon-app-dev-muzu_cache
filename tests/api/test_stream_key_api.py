"""FR-3.2-01 / API-D2-03: stream key lifecycle."""
import re

import pytest

from conftest import assert_error
from day2_helpers import day2_sig

URL = "/audit/v1/stream/key"


@pytest.fixture(autouse=True)
def _reset(api):
    assert api.post("/audit/v1/reset").status_code == 200


def body(**kw):
    base = {"action": "generate", "player_id": "player-alpha-1"}
    base.update(kw)
    return base


@pytest.mark.api
@pytest.mark.req("FR-3.2-01")
def test_generate_shape_and_signature(api):
    r = api.post(URL, json=body(label="OBS-Main-Desk"))
    assert r.status_code == 201, r.text
    j = r.json()
    assert re.fullmatch(r"sk_live_[a-f0-9]{16}", j["stream_key"])
    assert j["status"] == "active" and j["label"] == "OBS-Main-Desk" and j["player_id"] == "player-alpha-1"
    k = j["stream_key"]
    assert j["ingest_endpoints"] == {"rtmp": f"rtmp://localhost:1935/live/{k}", "webrtc": f"http://localhost:8889/live/{k}/whip"}
    assert j["playback_url"] == f"http://localhost:8888/live/{k}/index.m3u8"
    assert j["signature"] == day2_sig(k, {"action": "generate", "player_id": "player-alpha-1", "status": "active", "stream_key": k})


@pytest.mark.api
@pytest.mark.req("FR-3.2-01")
def test_rotate_with_override_is_verbatim_and_200(api):
    r = api.post(URL, json=body(action="rotate", stream_key_override="sk_live_9f83a1b2c3d4e5f6", label="x"))
    assert r.status_code == 200
    j = r.json()
    assert j["stream_key"] == "sk_live_9f83a1b2c3d4e5f6"
    assert j["signature"] == day2_sig(j["stream_key"], {"action": "rotate", "player_id": "player-alpha-1", "status": "active", "stream_key": j["stream_key"]})


@pytest.mark.api
@pytest.mark.req("FR-3.2-01")
def test_default_label_and_rotate_without_prior_key(api):
    j = api.post(URL, json=body(action="rotate")).json()
    assert j["label"] == "default" and j["status"] == "active"


@pytest.mark.api
@pytest.mark.req("FR-3.2-01")
def test_revoke_then_revoke_again(api):
    k = api.post(URL, json=body(label="L1")).json()["stream_key"]
    r = api.post(URL, json=body(action="revoke"))
    assert r.status_code == 200
    j = r.json()
    assert j["status"] == "revoked" and j["ingest_endpoints"] is None and j["playback_url"] is None
    assert j["stream_key"] == k and j["label"] == "L1"
    assert j["signature"] == day2_sig(k, {"action": "revoke", "player_id": "player-alpha-1", "status": "revoked", "stream_key": k})
    assert_error(api.post(URL, json=body(action="revoke")), 409, "KEY_REVOKED")


@pytest.mark.api
@pytest.mark.req("FR-3.2-01")
def test_rotation_revokes_previous_key(api):
    old = api.post(URL, json=body()).json()["stream_key"]
    new = api.post(URL, json=body(action="rotate")).json()["stream_key"]
    assert old != new
    assert api.post(URL, json=body(action="revoke")).json()["stream_key"] == new


@pytest.mark.api
@pytest.mark.req("FR-3.2-01")
def test_revoke_without_any_key_is_404(api):
    assert_error(api.post(URL, json=body(action="revoke", player_id="player-beta-2")), 404, "STREAM_NOT_FOUND")


@pytest.mark.api
@pytest.mark.req("FR-3.2-01")
def test_unknown_player_404(api):
    assert_error(api.post(URL, json=body(player_id="player-nope")), 404, "PLAYER_NOT_FOUND")


@pytest.mark.api
@pytest.mark.req("FR-3.2-01")
@pytest.mark.parametrize("patch,fields", [
    ({"action": "burn"}, ["action"]), ({"action": None}, ["action"]), ({"player_id": 5}, ["player_id"]),
    ({"label": ""}, ["label"]), ({"label": "x" * 65}, ["label"]), ({"stream_key_override": ""}, ["stream_key_override"]),
    ({"stream_key_override": "k" * 129}, ["stream_key_override"]), ({"label": 7, "action": "x"}, ["action", "label"]),
])
def test_validation(api, patch, fields):
    assert_error(api.post(URL, json=body(**patch)), 400, "VALIDATION_ERROR", fields=fields)


@pytest.mark.api
@pytest.mark.req("FR-3.2-01")
def test_missing_body_and_malformed_json(api):
    assert_error(api.post(URL), 400, "VALIDATION_ERROR")
    assert_error(api.post(URL, data="{nope", headers={"Content-Type": "application/json"}), 400, "VALIDATION_ERROR")


@pytest.mark.api
@pytest.mark.req("FR-4.3-01")
def test_guest_bearer_is_rejected_first(api):
    r = api.post(URL, data="garbage", headers={"Authorization": "Bearer guest_anon_tok_7721"})
    err = assert_error(r, 403, "GUEST_WRITE_FORBIDDEN")
    assert err["details"] == {"guest_token": "guest_anon_tok_7721"}
