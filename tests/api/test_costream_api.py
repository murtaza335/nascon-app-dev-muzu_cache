"""FR-3.3-01 / API-D2-04 + EC-1."""
import pytest

from conftest import assert_error
from day2_helpers import day2_sig, uid

URL = "/audit/v1/costream/session"
FOUR = ["player-alpha-1", "player-alpha-2", "player-beta-1", "player-beta-2"]


def req(**kw):
    base = {"session_id": uid("cs-session"), "host_player_id": "player-alpha-1", "participants": FOUR, "layout": "grid_4", "simulate_host_drop": False}
    base.update(kw)
    return base


@pytest.fixture(autouse=True, scope="module")
def _reset(api):
    api.post("/audit/v1/reset")


@pytest.mark.api
@pytest.mark.req("FR-3.3-01")
def test_no_drop(api):
    b = req()
    r = api.post(URL, json=b)
    assert r.status_code == 201, r.text
    j = r.json()
    assert (j["status"], j["active_host"], j["handoff_occurred"], j["participant_count"]) == ("active", "player-alpha-1", False, 4)
    assert j["active_participants"] == FOUR
    assert j["composite_playback_url"] == f"http://localhost:8888/costream/{b['session_id']}/index.m3u8"
    assert j["chat_room_id"] == f"chat-{b['session_id']}"
    assert j["signature"] == day2_sig(b["session_id"], {
        "active_host": "player-alpha-1", "handoff_occurred": False, "layout": "grid_4", "participant_count": 4, "session_id": b["session_id"], "status": "active"})


@pytest.mark.api
@pytest.mark.req("FR-3.3-01")
@pytest.mark.req("EC-1")
def test_host_drop_handoff(api):
    b = req(simulate_host_drop=True)
    j = api.post(URL, json=b).json()
    assert j["active_host"] == "player-alpha-2" and j["handoff_occurred"] is True and j["participant_count"] == 3
    assert j["active_participants"] == FOUR[1:]
    assert j["signature"] == day2_sig(b["session_id"], {
        "active_host": "player-alpha-2", "handoff_occurred": True, "layout": "grid_4", "participant_count": 3, "session_id": b["session_id"], "status": "active"})


@pytest.mark.api
@pytest.mark.req("EC-1")
def test_host_drop_non_first_host(api):
    j = api.post(URL, json=req(host_player_id="player-beta-1", simulate_host_drop=True)).json()
    assert j["active_host"] == "player-alpha-1" and j["active_participants"] == ["player-alpha-1", "player-alpha-2", "player-beta-2"]


@pytest.mark.api
@pytest.mark.req("FR-3.3-01")
def test_sole_host_drop_terminates(api):
    b = req(participants=["player-alpha-1"], layout="solo", simulate_host_drop=True)
    j = api.post(URL, json=b).json()
    assert (j["status"], j["active_host"], j["handoff_occurred"], j["participant_count"], j["active_participants"]) == ("terminated", None, False, 0, [])
    assert j["chat_room_id"] == f"chat-{b['session_id']}" and "composite_playback_url" in j
    assert j["signature"] == day2_sig(b["session_id"], {
        "active_host": None, "handoff_occurred": False, "layout": "solo", "participant_count": 0, "session_id": b["session_id"], "status": "terminated"})


@pytest.mark.api
@pytest.mark.req("FR-3.3-01")
def test_replay_identical_200_and_different_reinitialises(api):
    b = req()
    first = api.post(URL, json=b)
    again = api.post(URL, json=b)
    assert first.status_code == 201 and again.status_code == 200 and again.json() == first.json()
    changed = api.post(URL, json={**b, "simulate_host_drop": True})
    assert changed.status_code == 201 and changed.json()["handoff_occurred"] is True


@pytest.mark.api
@pytest.mark.req("FR-3.3-01")
def test_default_layout_and_drop_flag(api):
    b = req(); b.pop("layout"); b.pop("simulate_host_drop")
    j = api.post(URL, json=b).json()
    assert j["layout"] == "grid_4" and j["handoff_occurred"] is False


@pytest.mark.api
@pytest.mark.req("FR-3.3-01")
def test_check_order(api):
    five = FOUR + ["player-alpha-9"]
    assert_error(api.post(URL, json=req(participants=five)), 404, "PLAYER_NOT_FOUND")  # existence precedes capacity
    assert_error(api.post(URL, json=req(participants=FOUR[1:])), 400, "VALIDATION_ERROR", fields=["host_player_id"])
    assert_error(api.post(URL, json=req(participants=FOUR + ["player-alpha-1"])), 400, "VALIDATION_ERROR", fields=["participants"])
    assert_error(api.post(URL, json=req(layout="solo")), 400, "UNSUPPORTED_LAYOUT")
    assert_error(api.post(URL, json=req(layout="grid_2")), 400, "UNSUPPORTED_LAYOUT")
    assert_error(api.post(URL, json=req(host_player_id="ghost")), 404, "PLAYER_NOT_FOUND")


@pytest.mark.api
@pytest.mark.req("FR-3.3-01")
def test_full_session_409(api, monkeypatch=None):
    # five existing players are needed: create a throw-away fifth via the roster-free path — players come from the seed,
    # so use the four seeded plus a duplicate-free fifth by reusing the Phase I player list (alpha-1/2, beta-1/2 are all there are).
    pytest.skip("only four seeded players exist; the >4 rule is covered by unit tests (isFull) and the 404-before-409 vector above")


@pytest.mark.api
@pytest.mark.req("FR-3.3-01")
@pytest.mark.parametrize("patch,fields", [
    ({"session_id": 3}, ["session_id"]), ({"host_player_id": None}, ["host_player_id"]), ({"participants": []}, ["participants"]),
    ({"participants": "x"}, ["participants"]), ({"simulate_host_drop": "yes"}, ["simulate_host_drop"]), ({"layout": "grid_9"}, ["layout"]),
    ({"session_id": 3, "layout": 1}, ["session_id", "layout"]),
])
def test_validation(api, patch, fields):
    assert_error(api.post(URL, json=req(**patch)), 400, "VALIDATION_ERROR", fields=fields)
