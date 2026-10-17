"""FR-1.2-02 API-05: register a league."""
import pytest

from conftest import assert_error
from helpers import uid


def body(lid=None, **over):
    lid = lid or uid("lg")
    b = {"league_id": lid, "sport_id": "football", "teams": ["t1", "t2", "t3", "t4"],
         "fixtures": [{"match_id": f"{lid}-m1", "home": "t1", "away": "t2"}, {"match_id": f"{lid}-m2", "home": "t3", "away": "t4"}],
         "points": {"win": 3, "draw": 1, "loss": 0},
         "tie_break_order": ["h2h_points", "h2h_diff", "overall_diff", "scored", "fair_play", "draw_lots"],
         "qualification": {"spots": 2}, "lots_seed": 42}
    b.update(over)
    return b


@pytest.mark.api
@pytest.mark.req("FR-1.2-02")
def test_fr_1_2_02_register_ok_and_fixtures_are_streams(api):
    b = body()
    r = api.post("/audit/v1/leagues", json=b)
    assert r.status_code == 201, r.text
    assert r.json() == {"league_id": b["league_id"], "status": "created", "team_count": 4, "fixture_count": 2}
    sc = api.get(f"/audit/v1/score/{b['league_id']}-m1").json()
    assert (sc["status"], sc["outcome"], sc["version"], sc["league_id"], sc["events"]) == ("upcoming", "pending", 0, b["league_id"], [])
    assert (sc["home"]["team_id"], sc["away"]["team_id"]) == ("t1", "t2")


@pytest.mark.api
@pytest.mark.req("FR-1.2-02")
def test_fr_1_2_02_defaults(api):
    api.post("/audit/v1/reset", json={"seed": 7})
    lid = uid("lg")
    b = body(lid)
    for k in ("points", "tie_break_order", "lots_seed"):
        del b[k]
    assert api.post("/audit/v1/leagues", json=b).status_code == 201
    st = api.get(f"/audit/v1/standings/{lid}").json()
    assert st["qualification_spots"] == 2 and len(st["table"]) == 4
    api.post("/audit/v1/reset")


@pytest.mark.api
@pytest.mark.req("FR-1.2-02")
def test_fr_1_2_02_partial_points_take_defaults(api):
    assert api.post("/audit/v1/leagues", json=body(points={"win": 2})).status_code == 201


@pytest.mark.api
@pytest.mark.req("FR-1.2-02")
def test_fr_1_2_02_errors_404_409(api):
    b = body()
    assert_error(api.post("/audit/v1/leagues", json=body(sport_id="nope")), 404, "SPORT_NOT_FOUND")
    assert api.post("/audit/v1/leagues", json=b).status_code == 201
    assert_error(api.post("/audit/v1/leagues", json=b), 409, "LEAGUE_EXISTS")
    other = body()
    other["fixtures"][0]["match_id"] = b["fixtures"][0]["match_id"]
    assert_error(api.post("/audit/v1/leagues", json=other), 409, "MATCH_EXISTS")
    assert api.get(f"/audit/v1/standings/{other['league_id']}").status_code == 404  # rolled back, nothing stored
    dup = body()
    dup["fixtures"][1]["match_id"] = dup["fixtures"][0]["match_id"]
    assert_error(api.post("/audit/v1/leagues", json=dup), 409, "MATCH_EXISTS")


BAD = [
    ("league_id", None, ["league_id"]), ("sport_id", None, ["sport_id"]), ("teams", None, ["teams"]),
    ("teams", ["t1"], ["teams"]),
    ("teams", ["t1", "t1"], ["teams"]),
    ("fixtures", None, ["fixtures"]), ("fixtures", [{"match_id": "m", "home": "t1", "away": "t1"}], ["fixtures[0].away"]),
    ("fixtures", [{"match_id": "m", "home": "t1", "away": "zz"}], ["fixtures[0].away"]),
    ("fixtures", [{"home": "t1", "away": "t2"}], ["fixtures[0].match_id"]),
    ("qualification", None, ["qualification"]), ("qualification", {"spots": 0}, ["qualification.spots"]),
    ("qualification", {"spots": 5}, ["qualification.spots"]), ("qualification", {"spots": 1.5}, ["qualification.spots"]),
    ("points", {"win": "3"}, ["points.win"]), ("lots_seed", "42", ["lots_seed"]),
    ("tie_break_order", ["scored", "scored"], ["tie_break_order"]), ("tie_break_order", ["nope"], ["tie_break_order"]),
]


@pytest.mark.api
@pytest.mark.req("FR-1.2-02")
@pytest.mark.parametrize("field,value,fields", BAD, ids=[f"{c[0]}-{i}" for i, c in enumerate(BAD)])
def test_fr_1_2_02_validation_400(api, field, value, fields):
    b = body()
    if value is None:
        b.pop(field)
    else:
        b[field] = value
    err = assert_error(api.post("/audit/v1/leagues", json=b), 400, "VALIDATION_ERROR")
    assert sorted(err["details"]["fields"]) == sorted(fields), err


@pytest.mark.api
@pytest.mark.req("FR-1.2-02")
def test_fr_1_2_02_more_than_40_teams_400(api):
    teams = [f"t{i}" for i in range(41)]
    err = assert_error(api.post("/audit/v1/leagues", json=body(teams=teams, fixtures=[])), 400, "VALIDATION_ERROR")
    assert "teams" in err["details"]["fields"]
