"""FR-1.1-01/02 API-03: sports as data."""
import copy
import uuid

import pytest

from conftest import assert_error


def kabaddi(sport_id):
    return {
        "sport_id": sport_id, "name": "Kabaddi", "scoring_model": "event",
        "periods": {"count": 2, "duration_minutes": 20},
        "scoring_events": {"raid_point": {"points": 1}, "tackle_point": {"points": 1}, "all_out": {"points": 2}},
        "draw_allowed": False, "overtime": {"policy": "golden_score", "duration_minutes": 5},
        "tie_break_order": ["h2h_points", "h2h_diff", "overall_diff", "scored", "fair_play", "draw_lots"],
        "roster": {"min_squad_size": 7, "max_squad_size": 12, "required_positions": {}},
    }


def new_id():
    return "k" + uuid.uuid4().hex[:10]


@pytest.mark.api
@pytest.mark.req("FR-1.1-01")
def test_fr_1_1_01_create_echoes_config(api):
    body = kabaddi(new_id())
    resp = api.post("/audit/v1/sports", json=body)
    assert resp.status_code == 201, resp.text
    out = resp.json()
    assert list(out) == ["sport_id", "status", "config"]
    assert out["sport_id"] == body["sport_id"] and out["status"] == "created"
    for k in ("name", "scoring_model", "periods", "scoring_events", "draw_allowed", "overtime", "tie_break_order", "roster"):
        assert out["config"][k] == body[k]


@pytest.mark.api
@pytest.mark.req("FR-1.1-01")
def test_fr_1_1_01_tie_break_default_and_unknown_keys_dropped(api):
    body = kabaddi(new_id())
    del body["tie_break_order"]
    body["periods"]["junk"] = 1
    out = api.post("/audit/v1/sports", json=body).json()
    assert out["config"]["tie_break_order"] == ["h2h_points", "h2h_diff", "overall_diff", "scored", "fair_play", "draw_lots"]
    assert "junk" not in out["config"]["periods"]


@pytest.mark.api
@pytest.mark.req("FR-1.1-01")
def test_fr_1_1_01_duplicate_409(api):
    body = kabaddi(new_id())
    assert api.post("/audit/v1/sports", json=body).status_code == 201
    assert_error(api.post("/audit/v1/sports", json=body), 409, "SPORT_EXISTS")


@pytest.mark.api
@pytest.mark.req("FR-1.1-02")
@pytest.mark.parametrize("sid", ["football", "basketball", "cricket", "esports"])
def test_fr_1_1_02_seeded_sports_exist(api, sid):
    api.post("/audit/v1/reset")
    assert_error(api.post("/audit/v1/sports", json=kabaddi(sid)), 409, "SPORT_EXISTS")


@pytest.mark.api
@pytest.mark.req("FR-1.1-01")
def test_fr_1_1_01_sql_injection_id_is_400_never_5xx(api):
    body = kabaddi("x'; DROP TABLE sports;--")
    assert_error(api.post("/audit/v1/sports", json=body), 400, "VALIDATION_ERROR", ["sport_id"])
    assert api.get("/health").status_code == 200


def mutate(path, value):
    body = kabaddi(new_id())
    node = body
    for p in path[:-1]:
        node = node[p]
    if value is KeyError:
        node.pop(path[-1], None)
    else:
        node[path[-1]] = value
    return body, ".".join(path)


BAD = [
    (["sport_id"], KeyError), (["sport_id"], "A"), (["sport_id"], "a"), (["sport_id"], 5),
    (["name"], KeyError), (["name"], ""), (["name"], "x" * 81), (["name"], 7),
    (["scoring_model"], KeyError), (["scoring_model"], "sets"),
    (["periods"], KeyError), (["periods", "count"], 0), (["periods", "count"], 1.5), (["periods", "count"], True),
    (["periods", "duration_minutes"], "20"),
    (["scoring_events"], {}), (["scoring_events"], KeyError), (["scoring_events", "BAD"], {"points": 1}),
    (["scoring_events", "raid_point", "points"], 0),
    (["draw_allowed"], KeyError), (["draw_allowed"], "yes"),
    (["overtime"], KeyError), (["overtime", "policy"], "nope"), (["overtime", "duration_minutes"], -1),
    (["tie_break_order"], ["scored", "scored"]), (["tie_break_order"], ["bogus"]), (["tie_break_order"], "scored"),
    (["roster"], KeyError), (["roster", "min_squad_size"], 0), (["roster", "required_positions", "gk"], -1),
]


@pytest.mark.api
@pytest.mark.req("FR-1.1-01")
@pytest.mark.parametrize("path,value", BAD, ids=[f"{'.'.join(p)}={v!r}"[:60] for p, v in BAD])
def test_fr_1_1_01_field_rules_400(api, path, value):
    body, field = mutate(path, value)
    err = assert_error(api.post("/audit/v1/sports", json=body), 400, "VALIDATION_ERROR")
    assert field in err["details"]["fields"], err


@pytest.mark.api
@pytest.mark.req("FR-1.1-01")
def test_fr_1_1_01_min_gt_max_and_multiple_fields(api):
    body = kabaddi(new_id())
    body["roster"]["min_squad_size"] = 99
    assert_error(api.post("/audit/v1/sports", json=body), 400, "VALIDATION_ERROR", ["roster.min_squad_size"])
    body = kabaddi(new_id())
    body["name"], body["periods"]["count"], body["draw_allowed"] = "", 0, 1
    assert_error(api.post("/audit/v1/sports", json=body), 400, "VALIDATION_ERROR", ["name", "periods.count", "draw_allowed"])


@pytest.mark.api
@pytest.mark.req("FR-1.1-01")
@pytest.mark.parametrize("body", [[], "str", 5])
def test_fr_1_1_01_non_object_body_400(api, body):
    assert_error(api.post("/audit/v1/sports", json=body), 400, "VALIDATION_ERROR", ["body"])


@pytest.mark.api
@pytest.mark.req("FR-1.1-01")
def test_fr_1_1_01_innings_and_round_models(api):
    inn = {"sport_id": new_id(), "name": "Tape", "scoring_model": "innings",
           "periods": {"innings_per_team": 1, "overs_per_innings": 5, "balls_per_over": 6, "wickets_per_innings": 3},
           "scoring_events": {"super_six": {"runs": 6, "legal_ball": True, "wicket": False}},
           "draw_allowed": True, "overtime": {"policy": "super_over"},
           "roster": {"min_squad_size": 6, "max_squad_size": 8, "required_positions": {}}}
    assert api.post("/audit/v1/sports", json=inn).status_code == 201
    rnd = copy.deepcopy(inn)
    rnd.update(sport_id=new_id(), scoring_model="round", periods={"best_of": 4}, scoring_events={"map_win": {"rounds": 1}})
    assert_error(api.post("/audit/v1/sports", json=rnd), 400, "VALIDATION_ERROR", ["periods.best_of"])
    rnd["periods"]["best_of"] = 3
    assert api.post("/audit/v1/sports", json=rnd).status_code == 201
