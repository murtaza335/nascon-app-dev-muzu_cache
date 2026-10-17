"""FR-OFF-01 API-17: offline sync replay and per-action conflict resolution."""
import uuid

import pytest

from conftest import assert_error
from helpers import Match, make_league, uid
from test_roster_api import setup_body, tr


def ev(match_id, type_="score", payload=None, eid=None):
    return {"event_id": eid or uid("se"), "match_id": match_id, "type": type_, "payload": payload or {}}


def goal(match_id, team="t1", eid=None):
    return ev(match_id, "score", {"team_id": team, "event_type": "goal"}, eid)


def action(aid, type_, payload, at="2026-10-17T11:00:00Z", base=0):
    return {"action_id": aid, "type": type_, "queued_at": at, "base_version": base, "payload": payload}


def sync(api, device, actions):
    return api.post("/audit/v1/offline-sync", json={"device_id": device, "actions": actions})


@pytest.fixture
def live(api):
    """A fixture match already in progress with version 1 (match_start)."""
    lid, ms = make_league(api, ["t1", "t2"], [("t1", "t2")])
    m = Match(api, ms[0])
    m.ok("match_start")
    return ms[0]


@pytest.mark.api
@pytest.mark.req("FR-OFF-01")
def test_fr_off_01_applied_appended_then_resend_is_all_duplicate(api, live):
    dev = uid("dev")
    acts = [action("a1", "score_event", goal(live), "2026-10-17T11:00:00Z", base=1)]
    r = sync(api, dev, acts)
    assert r.status_code == 200, r.text
    b = r.json()
    assert list(b) == ["device_id", "results", "summary"]
    res = b["results"][0]
    assert list(res) == ["action_id", "status", "resolution", "error_code", "processed_order", "server_version", "signature"]
    assert (res["status"], res["resolution"], res["error_code"], res["processed_order"], res["server_version"]) == ("applied", "appended", None, 1, 2)
    assert len(res["signature"]) == 64
    assert b["summary"] == {"applied": 1, "rejected": 0, "duplicate": 0}
    again = sync(api, dev, acts).json()
    assert again["results"][0]["status"] == "duplicate" and again["results"][0]["resolution"] == "skipped_duplicate"
    assert again["results"][0]["server_version"] == 2 and again["results"][0]["signature"] is None
    assert again["summary"] == {"applied": 0, "rejected": 0, "duplicate": 1}
    assert len(api.get(f"/audit/v1/score/{live}").json()["events"]) == 2


@pytest.mark.api
@pytest.mark.req("FR-OFF-01")
def test_fr_off_01_stale_base_version_rebased_append(api, live):
    Match(api, live).ok("score", {"team_id": "t1", "event_type": "goal"})  # version now 2
    r = sync(api, uid("dev"), [action("a1", "score_event", goal(live), base=1)]).json()["results"][0]
    assert (r["status"], r["resolution"], r["server_version"]) == ("applied", "rebased_append", 3)


@pytest.mark.api
@pytest.mark.req("FR-OFF-01")
def test_fr_off_01_base_version_ahead_rejected(api, live):
    r = sync(api, uid("dev"), [action("a1", "score_event", goal(live), base=99)]).json()
    res = r["results"][0]
    assert (res["status"], res["resolution"], res["error_code"], res["server_version"], res["signature"]) == ("rejected", "server_wins", "INVALID_BASE_VERSION", 1, None)
    assert r["summary"] == {"applied": 0, "rejected": 1, "duplicate": 0}
    assert len(api.get(f"/audit/v1/score/{live}").json()["events"]) == 1


@pytest.mark.api
@pytest.mark.req("FR-OFF-01")
def test_fr_off_01_rules_reject_with_their_code(api, live):
    dev = uid("dev")
    done = goal(live)
    first = sync(api, dev, [action("a0", "score_event", done, base=1)]).json()["results"][0]
    assert first["status"] == "applied"
    acts = [
        action("dup-id", "score_event", goal(live, "t2", eid=done["event_id"]), "2026-10-17T11:01:00Z", base=2),       # same id, other body
        action("bad-comp", "score_event", ev(live, "compensation", {"compensates": live, "reason": "x"}), "2026-10-17T11:02:00Z", base=2),
        action("unk-type", "score_event", ev(live, "score", {"team_id": "t1", "event_type": "nope"}), "2026-10-17T11:03:00Z", base=2),
        action("not-started", "score_event", ev("no-such-match", "score", {"team_id": "t1", "event_type": "goal"}), "2026-10-17T11:04:00Z", base=0),
        action("invalid", "score_event", {"event_id": "x"}, "2026-10-17T11:05:00Z", base=0),
    ]
    codes = {x["action_id"]: (x["status"], x["error_code"]) for x in sync(api, dev, acts).json()["results"]}
    assert codes == {"dup-id": ("rejected", "DUPLICATE_EVENT_ID"), "bad-comp": ("rejected", "EVENT_NOT_FOUND"),
                     "unk-type": ("rejected", "UNKNOWN_EVENT_TYPE"), "not-started": ("rejected", "MATCH_NOT_FOUND"), "invalid": ("rejected", "VALIDATION_ERROR")}


@pytest.mark.api
@pytest.mark.req("FR-OFF-01")
def test_fr_off_01_state_machine_rejection_and_unknown_server_version_zero(api):
    lid, ms = make_league(api, ["t1", "t2"], [("t1", "t2")])
    r = sync(api, uid("dev"), [action("a1", "score_event", goal(ms[0]), base=0), action("a2", "score_event", ev("ghost", "match_start"), base=0)]).json()
    by = {x["action_id"]: x for x in r["results"]}
    assert (by["a1"]["status"], by["a1"]["error_code"], by["a1"]["server_version"]) == ("rejected", "MATCH_NOT_IN_PROGRESS", 0)
    assert (by["a2"]["error_code"], by["a2"]["server_version"]) == ("MATCH_NOT_FOUND", 0)


@pytest.mark.api
@pytest.mark.req("FR-OFF-01")
def test_fr_off_01_same_event_identical_payload_is_duplicate_even_with_new_action_id(api, live):
    e = goal(live)
    assert api.post("/audit/v1/events", json=e).status_code == 201
    r = sync(api, uid("dev"), [action("fresh-action", "score_event", e, base=2)]).json()["results"][0]
    assert (r["status"], r["resolution"], r["error_code"]) == ("duplicate", "skipped_duplicate", None)
    assert len(api.get(f"/audit/v1/score/{live}").json()["events"]) == 2


@pytest.mark.api
@pytest.mark.req("FR-OFF-01")
def test_fr_off_01_processing_order_by_queued_at_results_in_request_order(api, live):
    start_next = ev(live, "match_end")
    # request order: a1 (queued later) = match_end, a2 (queued earlier) = score. a2 runs first, then a1.
    acts = [action("a1", "score_event", start_next, "2026-10-17T11:05:00Z", base=2),
            action("a2", "score_event", goal(live), "2026-10-17T11:00:00Z", base=1)]
    r = sync(api, uid("dev"), acts).json()
    assert [x["action_id"] for x in r["results"]] == ["a1", "a2"]
    assert [x["processed_order"] for x in r["results"]] == [2, 1]
    assert [x["status"] for x in r["results"]] == ["applied", "applied"]
    assert api.get(f"/audit/v1/score/{live}").json()["status"] == "completed"


@pytest.mark.api
@pytest.mark.req("FR-OFF-01")
def test_fr_off_01_ties_keep_array_order_and_same_action_id_twice(api, live):
    dev = uid("dev")
    acts = [action("same", "score_event", goal(live), "2026-10-17T11:00:00Z", base=1),
            action("same", "score_event", goal(live, "t2"), "2026-10-17T11:00:00Z", base=1)]
    r = sync(api, dev, acts).json()
    assert [x["status"] for x in r["results"]] == ["applied", "duplicate"]


@pytest.mark.api
@pytest.mark.req("FR-OFF-01")
def test_fr_off_01_rejected_actions_are_recorded_so_resend_is_duplicate(api, live):
    dev = uid("dev")
    acts = [action("a1", "score_event", goal(live), base=99)]
    assert sync(api, dev, acts).json()["results"][0]["status"] == "rejected"
    assert sync(api, dev, acts).json()["results"][0]["status"] == "duplicate"


@pytest.mark.api
@pytest.mark.req("FR-OFF-01")
def test_fr_off_01_roster_transfer_actions(api):
    lid = uid("lgr")
    assert api.post("/audit/v1/roster/setup", json=setup_body(lid)).status_code == 201
    dev = uid("dev")
    ok = tr(lid, "p2")
    full = tr(lid, "p3", frm="sq-b", to="sq-a")                       # p3 is in sq-a, not sq-b → NOT_IN_SQUAD
    ghost = dict(tr(lid, "p2"), player_id="nobody", request_id=uid("tr"))
    acts = [action("r1", "roster_transfer", ok, "2026-10-17T11:00:00Z", base=0),
            action("r2", "roster_transfer", full, "2026-10-17T11:01:00Z", base=0),
            action("r3", "roster_transfer", ghost, "2026-10-17T11:02:00Z", base=0),
            action("r4", "roster_transfer", dict(tr(lid, "p3"), reason=""), "2026-10-17T11:03:00Z", base=0)]
    r = sync(api, dev, acts).json()
    by = {x["action_id"]: x for x in r["results"]}
    assert (by["r1"]["status"], by["r1"]["resolution"], by["r1"]["server_version"], by["r1"]["signature"]) == ("applied", "appended", 1, None)
    assert (by["r2"]["status"], by["r2"]["error_code"], by["r2"]["server_version"]) == ("rejected", "NOT_IN_SQUAD", 0)
    assert (by["r3"]["error_code"], by["r3"]["server_version"]) == ("PLAYER_NOT_FOUND", 0)
    assert by["r4"]["error_code"] == "VALIDATION_ERROR"
    assert r["summary"] == {"applied": 1, "rejected": 3, "duplicate": 0}
    assert len(api.get(f"/audit/v1/roster/history/{lid}-p2?as_of=2026-09-30").json()["history"]) == 1
    assert all(x["status"] == "duplicate" for x in sync(api, dev, acts).json()["results"])


@pytest.mark.api
@pytest.mark.req("FR-OFF-01")
def test_fr_off_01_roster_stale_and_ahead_base_version(api):
    lid = uid("lgr")
    api.post("/audit/v1/roster/setup", json=setup_body(lid))
    assert api.post("/audit/v1/roster/transfer", json=tr(lid, "p2")).status_code == 201  # player p2 now has 1 audit entry
    back = tr(lid, "p2", frm="sq-b", to="sq-a")
    r = sync(api, uid("dev"), [action("s1", "roster_transfer", back, base=0)]).json()["results"][0]
    assert (r["status"], r["resolution"], r["server_version"]) == ("applied", "rebased_append", 2)
    ahead = tr(lid, "p3")
    r = sync(api, uid("dev"), [action("s2", "roster_transfer", ahead, base=7)]).json()["results"][0]
    assert (r["status"], r["error_code"], r["server_version"]) == ("rejected", "INVALID_BASE_VERSION", 0)


@pytest.mark.api
@pytest.mark.req("FR-OFF-01")
def test_fr_off_01_mixed_batch_summary_and_http_200(api, live):
    lid = uid("lgr")
    api.post("/audit/v1/roster/setup", json=setup_body(lid))
    acts = [action("m1", "score_event", goal(live), "2026-10-17T11:00:00Z", base=1),
            action("m2", "roster_transfer", tr(lid, "p2"), "2026-10-17T11:01:00Z", base=0),
            action("m3", "score_event", goal(live), "2026-10-17T11:02:00Z", base=50)]
    r = sync(api, uid("dev"), acts)
    assert r.status_code == 200
    assert r.json()["summary"] == {"applied": 2, "rejected": 1, "duplicate": 0}


@pytest.mark.api
@pytest.mark.req("FR-OFF-01")
@pytest.mark.parametrize("body,fields", [
    ({}, ["device_id", "actions"]), ({"device_id": "d", "actions": []}, ["actions"]),
    ({"device_id": "d", "actions": "x"}, ["actions"]), ({"device_id": "a|b", "actions": [action("a", "score_event", {})]}, ["device_id"]),
    ({"device_id": "d", "actions": [action("a", "bogus", {})]}, ["actions[0].type"]),
    ({"device_id": "d", "actions": [action("a", "score_event", {}, at="yesterday")]}, ["actions[0].queued_at"]),
    ({"device_id": "d", "actions": [action("a", "score_event", {}, base=-1)]}, ["actions[0].base_version"]),
    ({"device_id": "d", "actions": [{"action_id": "a", "type": "score_event", "queued_at": "2026-10-17T11:00:00Z", "base_version": 0}]}, ["actions[0].payload"]),
])
def test_fr_off_01_malformed_envelope_400(api, body, fields):
    assert_error(api.post("/audit/v1/offline-sync", json=body), 400, "VALIDATION_ERROR", fields)


@pytest.mark.api
@pytest.mark.req("FR-OFF-01")
def test_fr_off_01_more_than_100_actions_400(api):
    acts = [action(f"a{i}", "score_event", {}) for i in range(101)]
    assert_error(sync(api, "d", acts), 400, "VALIDATION_ERROR", ["actions"])
    assert sync(api, uid("dev"), acts[:100]).status_code == 200


@pytest.mark.api
@pytest.mark.req("FR-OFF-01")
def test_fr_off_01_signature_matches_online_event_signature(api, live):
    e = goal(live)
    r = sync(api, uid("dev"), [action("a1", "score_event", e, base=1)]).json()["results"][0]
    sc = api.get(f"/audit/v1/score/{live}").json()
    assert sc["events"][-1]["event_id"] == e["event_id"] and sc["events"][-1]["signature"] == r["signature"]
