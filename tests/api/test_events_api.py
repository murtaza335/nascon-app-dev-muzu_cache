"""FR-1.1-04 API-06 / API-07: event-sourced scoring (event, innings, round models)."""
import copy
import hashlib
import hmac
import json
import os
import uuid

import pytest

from conftest import assert_error

SALT = os.environ.get("DAY1_SALT", "dev-salt")


def canonical(obj):
    return json.dumps(obj, sort_keys=True, separators=(",", ":"), ensure_ascii=False)


def expected_sig(event_id, payload):
    return hmac.new(SALT.encode(), f"{event_id}|{canonical(payload)}".encode(), hashlib.sha256).hexdigest()


class Stream:
    """Helper that appends events to one match and numbers event ids."""

    def __init__(self, api, sport_id="football", home="t1", away="t2", league_id=None):
        self.api = api
        self.match_id = "m-" + uuid.uuid4().hex[:10]
        self.n = 0
        payload = {"sport_id": sport_id, "home_team_id": home, "away_team_id": away}
        if league_id:
            payload["league_id"] = league_id
        self.init = self.post("match_init", payload)

    def eid(self):
        self.n += 1
        return f"e-{self.match_id}-{self.n}"

    def post(self, type_, payload=None, event_id=None, match_id=None):
        return self.api.post("/audit/v1/events", json={
            "event_id": event_id or self.eid(), "match_id": match_id or self.match_id, "type": type_, "payload": payload or {}})

    def ok(self, type_, payload=None):
        r = self.post(type_, payload)
        assert r.status_code == 201, r.text
        return r.json()

    def score(self):
        r = self.api.get(f"/audit/v1/score/{self.match_id}")
        assert r.status_code == 200, r.text
        return r.json()


@pytest.fixture(autouse=True, scope="module")
def _reset(api):
    api.post("/audit/v1/reset")


@pytest.mark.api
@pytest.mark.req("FR-1.1-04")
def test_fr_1_1_04_match_init_and_signature(api):
    s = Stream(api)
    assert s.init.status_code == 201
    body = s.init.json()
    assert list(body) == ["event_id", "match_id", "type", "sequence", "match_version", "signature"]
    assert (body["type"], body["sequence"], body["match_version"]) == ("match_init", 1, 1)
    payload = {"sport_id": "football", "home_team_id": "t1", "away_team_id": "t2"}
    assert body["signature"] == expected_sig(body["event_id"], payload)


@pytest.mark.api
@pytest.mark.req("NFR-SIG")
def test_nfr_sig_signature_over_exact_payload_with_unknown_fields_and_unicode(api):
    s = Stream(api)
    s.ok("match_start")
    payload = {"team_id": "t1", "event_type": "goal", "note": "gol é€😀", "extra": {"b": 1, "a": [2, 1]}}
    eid = s.eid()
    r = s.post("score", payload, event_id=eid)
    assert r.status_code == 201, r.text
    assert r.json()["signature"] == expected_sig(eid, payload)


@pytest.mark.api
@pytest.mark.req("NFR-SIG")
def test_nfr_sig_decimal_lexeme_preserved(api):
    s = Stream(api)
    s.ok("match_start")
    eid = s.eid()
    raw = '{"event_id":"%s","match_id":"%s","type":"score","payload":{"team_id":"t1","event_type":"goal","weight":1.50,"z":2.0}}' % (eid, s.match_id)
    r = api.post("/audit/v1/events", data=raw, headers={"Content-Type": "application/json"})
    assert r.status_code == 201, r.text
    msg = f'{eid}|{{"event_type":"goal","team_id":"t1","weight":1.50,"z":2.0}}'
    assert r.json()["signature"] == hmac.new(SALT.encode(), msg.encode(), hashlib.sha256).hexdigest()


@pytest.mark.api
@pytest.mark.req("FR-1.1-04")
def test_fr_1_1_04_score_flow_event_model(api):
    s = Stream(api)
    s.ok("match_start")
    s.ok("score", {"team_id": "t1", "event_type": "goal"})
    s.ok("score", {"team_id": "t1", "event_type": "goal"})
    s.ok("score", {"team_id": "t2", "event_type": "goal"})
    s.ok("discipline", {"team_id": "t2", "points": -1})
    last = s.ok("match_end")
    assert (last["sequence"], last["match_version"]) == (7, 7)
    sc = s.score()
    assert sc["status"] == "completed" and sc["outcome"] == "home_win" and sc["winner_team_id"] == "t1"
    assert sc["tiebreak_winner_team_id"] is None
    assert sc["home"] == {"team_id": "t1", "score": 2, "wickets": None, "balls": None, "overs": None, "fair_play": 0}
    assert sc["away"]["score"] == 1 and sc["away"]["fair_play"] == -1
    assert (sc["version"], sc["league_id"], sc["sport_id"]) == (7, None, "football")
    assert [e["sequence"] for e in sc["events"]] == [1, 2, 3, 4, 5, 6, 7]
    assert list(sc) == ["match_id", "sport_id", "league_id", "status", "outcome", "winner_team_id", "tiebreak_winner_team_id",
                        "home", "away", "version", "events"]
    assert list(sc["events"][0]) == ["sequence", "event_id", "type", "payload", "signature", "compensated", "compensated_by"]


@pytest.mark.api
@pytest.mark.req("FR-1.1-04")
def test_fr_1_1_04_compensation_flow(api):
    s = Stream(api)
    s.ok("match_start")
    goal = s.ok("score", {"team_id": "t1", "event_type": "goal"})
    comp = s.ok("compensation", {"compensates": goal["event_id"], "reason": "offside"})
    assert comp["sequence"] == 4
    sc = s.score()
    assert sc["home"]["score"] == 0 and len(sc["events"]) == 4
    target = sc["events"][2]
    assert (target["compensated"], target["compensated_by"]) == (True, comp["event_id"])
    assert sc["events"][3]["compensated"] is False
    assert sc["events"][2]["signature"] == goal["signature"]  # original row unchanged
    assert_error(s.post("compensation", {"compensates": goal["event_id"], "reason": "again"}), 409, "INVALID_COMPENSATION")


@pytest.mark.api
@pytest.mark.req("FR-1.1-04")
def test_fr_1_1_04_compensation_errors(api):
    a, b = Stream(api), Stream(api)
    a.ok("match_start")
    b.ok("match_start")
    other = b.ok("score", {"team_id": "t1", "event_type": "goal"})
    assert_error(a.post("compensation", {"compensates": "no-such-event", "reason": "r"}), 404, "EVENT_NOT_FOUND")
    assert_error(a.post("compensation", {"compensates": other["event_id"], "reason": "r"}), 409, "INVALID_COMPENSATION")
    assert_error(a.post("compensation", {"compensates": a.init.json()["event_id"], "reason": "r"}), 409, "INVALID_COMPENSATION")
    assert_error(a.post("compensation", {"compensates": "x", "reason": ""}), 400, "VALIDATION_ERROR", ["payload.reason"])


@pytest.mark.api
@pytest.mark.req("FR-1.1-04")
def test_fr_1_1_04_compensation_allowed_after_completion(api):
    s = Stream(api)
    s.ok("match_start")
    goal = s.ok("score", {"team_id": "t1", "event_type": "goal"})
    s.ok("match_end")
    s.ok("compensation", {"compensates": goal["event_id"], "reason": "var"})
    sc = s.score()
    assert (sc["status"], sc["outcome"], sc["home"]["score"]) == ("completed", "draw", 0)


@pytest.mark.api
@pytest.mark.req("FR-1.1-04")
def test_fr_1_1_04_replay_and_duplicate_id(api):
    s = Stream(api)
    s.ok("match_start")
    eid = s.eid()
    payload = {"team_id": "t1", "event_type": "goal"}
    first = s.post("score", payload, event_id=eid)
    again = s.post("score", payload, event_id=eid)
    assert first.status_code == 201 and again.status_code == 200
    assert first.json() == again.json()
    assert len(s.score()["events"]) == 3
    assert_error(s.post("score", {"team_id": "t2", "event_type": "goal"}, event_id=eid), 409, "DUPLICATE_EVENT_ID")
    assert_error(s.post("match_start", {}, event_id=eid), 409, "DUPLICATE_EVENT_ID")


@pytest.mark.api
@pytest.mark.req("FR-1.1-04")
def test_fr_1_1_04_state_machine_errors(api):
    s = Stream(api)
    assert_error(s.post("score", {"team_id": "t1", "event_type": "goal"}), 409, "MATCH_NOT_IN_PROGRESS")
    assert_error(s.post("discipline", {"team_id": "t1", "points": -1}), 409, "MATCH_NOT_IN_PROGRESS")
    assert_error(s.post("tiebreak_winner", {"team_id": "t1"}), 409, "MATCH_NOT_IN_PROGRESS")
    assert_error(s.post("match_end"), 409, "ILLEGAL_TRANSITION")
    s.ok("match_start")
    assert_error(s.post("match_start"), 409, "ILLEGAL_TRANSITION")
    s.ok("match_end")
    assert_error(s.post("match_start"), 409, "ILLEGAL_TRANSITION")
    assert_error(s.post("match_end"), 409, "ILLEGAL_TRANSITION")
    assert_error(s.post("score", {"team_id": "t1", "event_type": "goal"}), 409, "MATCH_NOT_IN_PROGRESS")


@pytest.mark.api
@pytest.mark.req("FR-1.1-04")
def test_fr_1_1_04_tie_rules(api):
    s = Stream(api, sport_id="basketball")
    s.ok("match_start")
    s.ok("score", {"team_id": "t1", "event_type": "two_pointer"})
    s.ok("score", {"team_id": "t2", "event_type": "two_pointer"})
    assert_error(s.post("match_end"), 409, "TIE_NOT_ALLOWED")
    tb = s.ok("tiebreak_winner", {"team_id": "t2"})
    s.ok("compensation", {"compensates": tb["event_id"], "reason": "wrong team"})
    assert_error(s.post("match_end"), 409, "TIE_NOT_ALLOWED")
    s.ok("tiebreak_winner", {"team_id": "t2"})
    s.ok("match_end")
    sc = s.score()
    assert (sc["outcome"], sc["winner_team_id"], sc["tiebreak_winner_team_id"]) == ("away_win", "t2", "t2")


@pytest.mark.api
@pytest.mark.req("FR-1.1-03")
def test_fr_1_1_03_innings_model_and_limit(api):
    s = Stream(api, sport_id="cricket")
    s.ok("match_start")
    for et in ["six", "wide", "dot_ball", "wicket", "single", "no_ball"]:
        s.ok("score", {"team_id": "t1", "event_type": et})
    h = s.score()["home"]
    assert (h["score"], h["wickets"], h["balls"], h["overs"]) == (9, 1, 4, "0.4")
    for _ in range(116):
        s.ok("score", {"team_id": "t1", "event_type": "dot_ball"})
    h = s.score()["home"]
    assert (h["balls"], h["overs"]) == (120, "20.0")
    assert_error(s.post("score", {"team_id": "t1", "event_type": "six"}), 409, "INNINGS_COMPLETE")
    assert_error(s.post("score", {"team_id": "t1", "event_type": "wide"}), 409, "INNINGS_COMPLETE")
    s.ok("score", {"team_id": "t2", "event_type": "four"})
    sc = s.score()
    assert sc["away"]["score"] == 4


@pytest.mark.api
@pytest.mark.req("FR-1.1-03")
def test_fr_1_1_03_innings_wicket_limit_and_compensation_reopens(api):
    s = Stream(api, sport_id="cricket")
    s.ok("match_start")
    last = None
    for _ in range(10):
        last = s.ok("score", {"team_id": "t2", "event_type": "wicket"})
    assert_error(s.post("score", {"team_id": "t2", "event_type": "single"}), 409, "INNINGS_COMPLETE")
    s.ok("compensation", {"compensates": last["event_id"], "reason": "not out"})
    s.ok("score", {"team_id": "t2", "event_type": "single"})


@pytest.mark.api
@pytest.mark.req("FR-1.1-03")
def test_fr_1_1_03_round_model_series(api):
    s = Stream(api, sport_id="esports")
    s.ok("match_start")
    s.ok("score", {"team_id": "t1", "event_type": "round_win"})
    s.ok("score", {"team_id": "t2", "event_type": "round_win"})
    decider = s.ok("score", {"team_id": "t1", "event_type": "round_win"})
    assert_error(s.post("score", {"team_id": "t2", "event_type": "round_win"}), 409, "SERIES_ALREADY_DECIDED")
    s.ok("compensation", {"compensates": decider["event_id"], "reason": "dispute"})
    s.ok("score", {"team_id": "t2", "event_type": "round_win"})
    s.ok("match_end")
    sc = s.score()
    assert (sc["home"]["score"], sc["away"]["score"], sc["outcome"]) == (1, 2, "away_win")


@pytest.mark.api
@pytest.mark.req("FR-1.1-01")
def test_fr_1_1_01_custom_sport_usable_without_restart(api):
    sid = "kab" + uuid.uuid4().hex[:8]
    sport = {"sport_id": sid, "name": "Kabaddi", "scoring_model": "event", "periods": {"count": 2, "duration_minutes": 20},
             "scoring_events": {"raid_point": {"points": 1}, "all_out": {"points": 2}}, "draw_allowed": False,
             "overtime": {"policy": "golden_score", "duration_minutes": 5},
             "roster": {"min_squad_size": 7, "max_squad_size": 12, "required_positions": {}}}
    assert api.post("/audit/v1/sports", json=sport).status_code == 201
    s = Stream(api, sport_id=sid)
    assert s.init.status_code == 201
    s.ok("match_start")
    s.ok("score", {"team_id": "t1", "event_type": "all_out"})
    s.ok("score", {"team_id": "t1", "event_type": "raid_point"})
    assert s.score()["home"]["score"] == 3
    assert_error(s.post("score", {"team_id": "t1", "event_type": "goal"}), 400, "UNKNOWN_EVENT_TYPE")


@pytest.mark.api
@pytest.mark.req("FR-1.1-04")
def test_fr_1_1_04_validation_and_existence_precedence(api):
    s = Stream(api)
    s.ok("match_start")
    p = {"team_id": "t1", "event_type": "goal"}
    assert_error(s.post("score", {"team_id": "nope", "event_type": "goal"}), 400, "VALIDATION_ERROR", ["payload.team_id"])
    assert_error(s.post("score", {"team_id": "t1", "event_type": "six"}), 400, "UNKNOWN_EVENT_TYPE")
    assert_error(s.post("score", p, match_id="no-such-match"), 404, "MATCH_NOT_FOUND")
    assert_error(s.post("match_start", match_id="no-such-match"), 404, "MATCH_NOT_FOUND")
    assert_error(s.post("score", {}, match_id="no-such-match"), 400, "VALIDATION_ERROR", ["payload.team_id", "payload.event_type"])
    assert_error(s.post("bogus"), 400, "VALIDATION_ERROR", ["type"])
    assert_error(api.post("/audit/v1/events", json={"type": "score"}), 400, "VALIDATION_ERROR", ["event_id", "match_id", "payload"])
    assert_error(s.post("discipline", {"team_id": "t1", "points": 1.5}), 400, "VALIDATION_ERROR", ["payload.points"])
    assert_error(api.post("/audit/v1/events", json=[1]), 400, "VALIDATION_ERROR", ["body"])


@pytest.mark.api
@pytest.mark.req("FR-1.1-04")
def test_fr_1_1_04_match_init_rules(api):
    s = Stream(api)
    assert_error(s.post("match_init", {"sport_id": "football", "home_team_id": "a", "away_team_id": "b"}, match_id=s.match_id), 409, "MATCH_EXISTS")
    new = "m-" + uuid.uuid4().hex[:8]
    base = {"sport_id": "football", "home_team_id": "a", "away_team_id": "b"}
    assert_error(s.post("match_init", {**base, "sport_id": "nope"}, match_id=new), 404, "SPORT_NOT_FOUND")
    assert_error(s.post("match_init", {**base, "away_team_id": "a"}, match_id=new), 400, "VALIDATION_ERROR")
    assert_error(s.post("match_init", {**base, "league_id": "no-league"}, match_id=new), 404, "LEAGUE_NOT_FOUND")
    assert_error(s.post("match_init", {"sport_id": "football"}, match_id=new), 400, "VALIDATION_ERROR", ["payload.home_team_id", "payload.away_team_id"])


@pytest.mark.api
@pytest.mark.req("NFR-5")
def test_nfr5_hostile_strings_never_5xx(api):
    s = Stream(api)
    s.ok("match_start")
    for reason in ["x'; DROP TABLE match_events;--", "\u0000", "<script>", "é" * 400]:
        r = s.post("compensation", {"compensates": "nope", "reason": reason})
        assert r.status_code in (400, 404), r.text
    r = api.post("/audit/v1/events", data='{"event_id":"e\\u0000x","match_id":"m","type":"score","payload":{}}',
                 headers={"Content-Type": "application/json"})
    assert r.status_code == 400
    assert api.get("/audit/v1/score/x'; DROP TABLE matches;--").status_code == 404


@pytest.mark.api
@pytest.mark.req("FR-1.1-04")
def test_fr_1_1_04_score_404(api):
    assert_error(api.get("/audit/v1/score/does-not-exist"), 404, "MATCH_NOT_FOUND")


@pytest.mark.api
@pytest.mark.req("FR-1.1-04")
def test_fr_1_1_04_parallel_appends_get_distinct_sequences(api):
    from concurrent.futures import ThreadPoolExecutor
    s = Stream(api)
    s.ok("match_start")
    def fire(i):
        return s.api.post("/audit/v1/events", json={"event_id": f"par-{s.match_id}-{i}", "match_id": s.match_id, "type": "score",
                                                    "payload": {"team_id": "t1", "event_type": "goal"}})
    with ThreadPoolExecutor(10) as ex:
        results = list(ex.map(fire, range(10)))
    assert all(r.status_code == 201 for r in results)
    assert sorted(r.json()["sequence"] for r in results) == list(range(3, 13))
    assert s.score()["home"]["score"] == 10
