"""FR-1.4-01 API-08: standings recomputed from events."""
import pytest

from conftest import assert_error
from helpers import Match, make_league


def standings(api, lid):
    r = api.get(f"/audit/v1/standings/{lid}")
    assert r.status_code == 200, r.text
    return r.json()


def row(st, team):
    return next(r for r in st["table"] if r["team_id"] == team)


@pytest.mark.api
@pytest.mark.req("FR-1.4-01")
def test_fr_1_4_01_shape_and_basic_table(api):
    lid, ms = make_league(api, ["t1", "t2", "t3"], [("t1", "t2"), ("t2", "t3"), ("t3", "t1")])
    Match(api, ms[0]).play("t1", "t2", 2, 1)
    Match(api, ms[1]).play("t2", "t3", 1, 1)
    st = standings(api, lid)
    assert list(st) == ["league_id", "sport_id", "qualification_spots", "table", "h2h"]
    assert list(st["table"][0]) == ["rank", "team_id", "played", "won", "drawn", "lost", "scored", "conceded", "diff", "points",
                                    "fair_play", "status", "resolved_by"]
    t1 = row(st, "t1")
    assert (t1["rank"], t1["played"], t1["won"], t1["points"], t1["scored"], t1["conceded"], t1["diff"]) == (1, 1, 1, 3, 2, 1, 1)
    assert (row(st, "t2")["points"], row(st, "t3")["points"]) == (1, 1)
    assert st["h2h"]["t1"]["t2"] == {"played": 1, "points": 3, "scored": 2, "conceded": 1}
    assert st["h2h"]["t2"]["t1"] == {"played": 1, "points": 0, "scored": 1, "conceded": 2}
    assert st["h2h"]["t1"]["t3"] == {"played": 0, "points": 0, "scored": 0, "conceded": 0}
    assert set(st["h2h"]["t1"]) == {"t2", "t3"}


@pytest.mark.api
@pytest.mark.req("FR-1.4-01")
def test_fr_1_4_01_unplayed_league_orders_by_lots_vector(api):
    api.post("/audit/v1/reset", json={"seed": 42})
    lid, _ = make_league(api, ["t1", "t2", "t3"], [], league_id="lg-1")
    st = standings(api, lid)
    assert [r["team_id"] for r in st["table"]] == ["t1", "t3", "t2"]
    assert [r["resolved_by"] for r in st["table"]] == ["draw_lots", "draw_lots", None]
    assert all(r["played"] == 0 and r["points"] == 0 for r in st["table"])
    api.post("/audit/v1/reset")


@pytest.mark.api
@pytest.mark.req("FR-1.4-01")
def test_fr_1_4_01_edge_case_4_three_way_tie_uses_h2h_among_tied_only(api):
    teams = ["a", "b", "c", "d", "e"]
    games = [("a", "b"), ("a", "c"), ("b", "c"), ("d", "a"), ("b", "d"), ("c", "d"), ("c", "e")]
    lid, ms = make_league(api, teams, games, qualification={"spots": 2})
    for m, (h, a) in zip(ms, games):
        Match(api, m).play(h, a, 1, 0)
    st = standings(api, lid)
    assert [row(st, t)["points"] for t in "abc"] == [6, 6, 6]
    assert [r["team_id"] for r in st["table"]][:3] == ["a", "b", "c"]
    assert [row(st, t)["resolved_by"] for t in "abc"] == ["h2h_points", "h2h_points", None]


@pytest.mark.api
@pytest.mark.req("FR-1.4-01")
def test_fr_1_4_01_edge_case_5_compensation_after_completion_recomputes(api):
    lid, ms = make_league(api, ["t1", "t2"], [("t1", "t2")], qualification={"spots": 1})
    m = Match(api, ms[0])
    m.ok("match_start")
    goal = m.ok("score", {"team_id": "t1", "event_type": "goal"})
    m.ok("match_end")
    before = standings(api, lid)
    assert (row(before, "t1")["points"], row(before, "t1")["status"]) == (3, "clinched")
    m.ok("compensation", {"compensates": goal["event_id"], "reason": "var"})
    after = standings(api, lid)
    assert (row(after, "t1")["points"], row(after, "t2")["points"], row(after, "t1")["drawn"]) == (1, 1, 1)
    sc = api.get(f"/audit/v1/score/{ms[0]}").json()
    assert sc["events"][1]["compensated"] is True and sc["events"][1]["signature"] == goal["signature"]


@pytest.mark.api
@pytest.mark.req("FR-1.4-01")
def test_fr_1_4_01_innings_nrr(api):
    lid, ms = make_league(api, ["a", "b"], [("a", "b")], sport_id="cricket", qualification={"spots": 1})
    m = Match(api, ms[0])
    m.ok("match_start")
    for _ in range(60):
        m.ok("score", {"team_id": "a", "event_type": "single"})   # 60 runs off 60 balls (10 overs)
    for _ in range(3):
        m.ok("score", {"team_id": "b", "event_type": "six"})      # 18 runs off 3 balls
    m.ok("match_end")
    st = standings(api, lid)
    a, b = row(st, "a"), row(st, "b")
    assert (a["scored"], a["conceded"], a["won"]) == (60, 18, 1)
    # a: 60/10 - 18/(3/6) = 6 - 36 = -30 ; b = +30
    assert (a["diff"], b["diff"]) == (-30, 30)


@pytest.mark.api
@pytest.mark.req("FR-1.4-01")
def test_fr_1_4_01_undecided_match_is_remaining_and_not_played(api):
    lid, ms = make_league(api, ["t1", "t2"], [("t1", "t2")], sport_id="basketball", qualification={"spots": 1})
    m = Match(api, ms[0])
    m.ok("match_start")
    m.ok("score", {"team_id": "t1", "event_type": "two_pointer"})
    m.ok("score", {"team_id": "t2", "event_type": "two_pointer"})
    tb = m.ok("tiebreak_winner", {"team_id": "t1"})
    m.ok("match_end")
    assert row(standings(api, lid), "t1")["points"] == 3
    m.ok("compensation", {"compensates": tb["event_id"], "reason": "wrong"})
    st = standings(api, lid)
    assert all(r["played"] == 0 and r["points"] == 0 for r in st["table"])


@pytest.mark.api
@pytest.mark.req("FR-1.4-01")
def test_fr_1_4_01_match_init_joins_league(api):
    lid, _ = make_league(api, ["t1", "t2"], [])
    mid = f"{lid}-adhoc"
    api.post("/audit/v1/events", json={"event_id": f"{mid}-0", "match_id": mid, "type": "match_init",
                                       "payload": {"sport_id": "football", "home_team_id": "t1", "away_team_id": "t2", "league_id": lid}})
    Match(api, mid).play("t1", "t2", 1, 0)
    assert row(standings(api, lid), "t1")["points"] == 3
    r = api.post("/audit/v1/events", json={"event_id": f"{mid}x-0", "match_id": f"{mid}x", "type": "match_init",
                                           "payload": {"sport_id": "football", "home_team_id": "t1", "away_team_id": "zzz", "league_id": lid}})
    assert_error(r, 400, "VALIDATION_ERROR", ["payload.league_id"])


@pytest.mark.api
@pytest.mark.req("FR-1.4-01")
def test_fr_1_4_01_404(api):
    assert_error(api.get("/audit/v1/standings/nope"), 404, "LEAGUE_NOT_FOUND")
