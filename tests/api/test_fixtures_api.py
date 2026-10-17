"""FR-1.3-01..04 API-04: fixture generation (pure compute; stores nothing)."""
import pytest

from conftest import assert_error


def T(n):
    return [f"t{i + 1}" for i in range(n)]


def gen(api, fmt, teams, params=None):
    body = {"format": fmt, "teams": teams}
    if params is not None:
        body["params"] = params
    return api.post("/audit/v1/fixtures", json=body)


@pytest.mark.api
@pytest.mark.req("FR-1.3-01")
def test_fr_1_3_01_round_robin_spec_example(api):
    r = gen(api, "round_robin", T(5), {"legs": 1, "withdrawals": [{"team_id": "t3", "after_round": 2}], "withdrawal_policy": "forfeit_remaining"})
    assert r.status_code == 200, r.text
    b = r.json()
    assert list(b) == ["format", "legs", "team_count", "round_count", "rounds", "summary"]
    assert (b["legs"], b["team_count"], b["round_count"]) == (1, 5, 5)
    assert b["summary"] == {"total": 10, "scheduled": 8, "forfeit": 2, "voided": 0}
    assert list(b["rounds"][0]) == ["round", "matches", "byes"]
    assert list(b["rounds"][0]["matches"][0]) == ["match_id", "leg", "home", "away", "status", "awarded_to"]
    assert b["rounds"][0]["matches"][0]["match_id"] == "RR-L1-R1-M1" and b["rounds"][0]["byes"] == ["t1"]


@pytest.mark.api
@pytest.mark.req("FR-1.3-01")
@pytest.mark.parametrize("n", [2, 3, 4, 7, 10, 16, 25, 40])
@pytest.mark.parametrize("legs", [1, 2])
def test_fr_1_3_01_round_robin_properties(api, n, legs):
    b = gen(api, "round_robin", T(n), {"legs": legs}).json()
    per_leg = n - 1 if n % 2 == 0 else n
    assert b["round_count"] == per_leg * legs
    pairs, ordered = {}, set()
    for rd in b["rounds"]:
        seen = list(rd["byes"])
        assert len(rd["matches"]) == n // 2 and len(rd["byes"]) == n % 2
        for m in rd["matches"]:
            seen += [m["home"], m["away"]]
            pairs[frozenset((m["home"], m["away"]))] = pairs.get(frozenset((m["home"], m["away"])), 0) + 1
            ordered.add((m["home"], m["away"]))
        assert sorted(seen) == sorted(T(n))
    assert len(pairs) == n * (n - 1) // 2 and set(pairs.values()) == {legs}
    if legs == 2:
        assert len(ordered) == n * (n - 1)


@pytest.mark.api
@pytest.mark.req("FR-1.3-01")
def test_fr_1_3_01_withdrawal_policies(api):
    b = gen(api, "round_robin", T(4), {"withdrawals": [{"team_id": "t2", "after_round": 1}], "withdrawal_policy": "void_all"}).json()
    assert b["summary"] == {"total": 6, "scheduled": 3, "forfeit": 0, "voided": 3}
    b = gen(api, "round_robin", T(4), {"withdrawals": [{"team_id": "t2", "after_round": 0}]}).json()
    assert b["summary"]["forfeit"] == 3
    for rd in b["rounds"]:
        for m in rd["matches"]:
            if m["status"] == "forfeit":
                assert m["awarded_to"] in (m["home"], m["away"]) and m["awarded_to"] != "t2"


@pytest.mark.api
@pytest.mark.req("FR-1.3-01")
@pytest.mark.parametrize("params,fields", [
    ({"withdrawals": [{"team_id": "zz", "after_round": 1}]}, ["params.withdrawals[0].team_id"]),
    ({"withdrawals": [{"team_id": "t1", "after_round": 99}]}, ["params.withdrawals[0].after_round"]),
    ({"withdrawals": [{"team_id": "t1", "after_round": -1}]}, ["params.withdrawals[0].after_round"]),
    ({"legs": 3}, ["params.legs"]), ({"legs": "1"}, ["params.legs"]), ({"withdrawal_policy": "x"}, ["params.withdrawal_policy"]),
])
def test_fr_1_3_01_round_robin_400(api, params, fields):
    assert_error(gen(api, "round_robin", T(5), params), 400, "VALIDATION_ERROR", fields)


@pytest.mark.api
@pytest.mark.req("FR-1.3-02")
def test_fr_1_3_02_swiss_spec_example(api):
    params = {"total_rounds": 3, "round": 2, "history": [{"round": 1, "bye": "t5", "matches": [
        {"home": "t1", "away": "t3", "result": "home"}, {"home": "t2", "away": "t4", "result": "draw"}]}]}
    r = gen(api, "swiss", T(5), params)
    assert r.status_code == 200, r.text
    b = r.json()
    assert list(b) == ["format", "round", "total_rounds", "pairings", "bye", "standings"]
    assert [(p["match_id"], p["home"], p["away"]) for p in b["pairings"]] == [("SW-R2-M1", "t1", "t2"), ("SW-R2-M2", "t5", "t4")]
    assert b["bye"] == "t3"
    assert b["standings"][:3] == [{"rank": 1, "team_id": "t1", "score": 1.0, "buchholz": 0.0},
                                  {"rank": 2, "team_id": "t5", "score": 1.0, "buchholz": 0.0},
                                  {"rank": 3, "team_id": "t2", "score": 0.5, "buchholz": 0.5}]


@pytest.mark.api
@pytest.mark.req("FR-1.3-02")
def test_fr_1_3_02_swiss_round1_exact_and_defaults(api):
    b = gen(api, "swiss", T(6)).json()
    assert (b["round"], b["total_rounds"], b["bye"]) == (1, 3, None)
    assert [(p["home"], p["away"]) for p in b["pairings"]] == [("t1", "t4"), ("t2", "t5"), ("t3", "t6")]
    b = gen(api, "swiss", T(7), {}).json()
    assert b["bye"] == "t7" and len(b["pairings"]) == 3


@pytest.mark.api
@pytest.mark.req("FR-1.3-02")
@pytest.mark.parametrize("params,fields", [
    ({"round": 2}, ["params.history"]), ({"total_rounds": 9}, ["params.total_rounds"]), ({"total_rounds": 0}, ["params.total_rounds"]),
    ({"round": 0}, ["params.round"]),
    ({"round": 2, "history": [{"round": 1, "matches": [{"home": "t1", "away": "t2", "result": "won"}]}]}, ["params.history[0].matches[0].result"]),
    ({"round": 2, "history": [{"round": 1, "matches": [{"home": "t1", "away": "nope", "result": "home"}]}]}, ["params.history[0].matches[0].away"]),
    ({"round": 3, "total_rounds": 3, "history": [{"round": 1, "matches": []}, {"round": 1, "matches": []}]}, ["params.history"]),
])
def test_fr_1_3_02_swiss_400(api, params, fields):
    assert_error(gen(api, "swiss", T(5), params), 400, "VALIDATION_ERROR", fields)


@pytest.mark.api
@pytest.mark.req("FR-1.3-03")
def test_fr_1_3_03_single_elim_six_teams(api):
    b = gen(api, "single_elim", T(6), {"third_place_match": False, "results": [{"match_id": "R1M2", "winner": "t4"}]}).json()
    assert list(b) == ["format", "bracket_size", "rounds"] and b["bracket_size"] == 8
    r1 = b["rounds"][0]["matches"]
    assert [(m["match_id"], m["home"], m["away"], m["bye"]) for m in r1] == [("R1M1", "t1", None, True), ("R1M2", "t4", "t5", False), ("R1M3", "t2", None, True), ("R1M4", "t3", "t6", False)]
    assert list(r1[1]) == ["match_id", "bracket", "round", "index", "home", "away", "home_seed", "away_seed", "bye", "winner", "loser", "winner_to", "loser_to"]
    assert (r1[1]["winner"], r1[1]["loser"], r1[1]["winner_to"]) == ("t4", "t5", {"match_id": "R2M1", "slot": "away"})
    assert b["rounds"][1]["matches"][0]["home"] == "t1" and b["rounds"][1]["matches"][0]["away"] == "t4"
    assert b["rounds"][2]["matches"][0]["winner_to"] is None


@pytest.mark.api
@pytest.mark.req("FR-1.3-03")
def test_fr_1_3_03_single_elim_third_place_and_limits(api):
    b = gen(api, "single_elim", T(8), {"third_place_match": True}).json()
    tp = b["rounds"][-1]["matches"][-1]
    assert (tp["match_id"], tp["bracket"]) == ("TP", "third_place")
    sf = b["rounds"][1]["matches"]
    assert sf[0]["loser_to"] == {"match_id": "TP", "slot": "home"} and sf[1]["loser_to"] == {"match_id": "TP", "slot": "away"}
    assert gen(api, "single_elim", T(128)).status_code == 200
    assert_error(gen(api, "single_elim", T(129)), 400, "VALIDATION_ERROR", ["teams"])
    assert_error(gen(api, "single_elim", T(1)), 400, "VALIDATION_ERROR", ["teams"])


@pytest.mark.api
@pytest.mark.req("FR-1.3-03")
@pytest.mark.parametrize("results", [
    [{"match_id": "NOPE", "winner": "t1"}], [{"match_id": "R1M2", "winner": "t1"}],
    [{"match_id": "R1M2", "winner": "t4"}, {"match_id": "R1M2", "winner": "t5"}], [{"match_id": "R2M1", "winner": "t1"}],
])
def test_fr_1_3_03_single_elim_bad_results_400(api, results):
    assert_error(gen(api, "single_elim", T(6), {"results": results}), 400, "VALIDATION_ERROR")


@pytest.mark.api
@pytest.mark.req("FR-1.3-04")
@pytest.mark.parametrize("B", [4, 8, 16, 32, 64, 128])
def test_fr_1_3_04_double_elim_counts_and_routing(api, B):
    b = gen(api, "double_elim", T(B), {"bracket_reset": True}).json()
    assert list(b) == ["format", "bracket_size", "bracket_reset", "winners", "losers", "grand_final"]
    w = [m for r in b["winners"] for m in r["matches"]]
    lo = [m for r in b["losers"] for m in r["matches"]]
    assert len(w) == B - 1 and len(lo) == B - 2 and [m["match_id"] for m in b["grand_final"]] == ["GF1", "GF2"]
    assert all(m["loser_to"] for m in w) and all(m["loser_to"] is None for m in lo)
    ids = {m["match_id"] for m in w + lo + b["grand_final"]}
    for m in w + lo + b["grand_final"]:
        for k in ("winner_to", "loser_to"):
            if m[k]:
                assert m[k]["match_id"] in ids and m[k]["slot"] in ("home", "away")
    k = B.bit_length() - 1
    wf = next(m for m in w if m["match_id"] == f"WR{k}M1")
    assert wf["winner_to"] == {"match_id": "GF1", "slot": "home"}
    assert next(m for m in lo if m["match_id"] == f"LR{2 * (k - 1)}M1")["winner_to"] == {"match_id": "GF1", "slot": "away"}
    assert b["grand_final"][1]["conditional"] is True and b["grand_final"][1]["required"] is None


@pytest.mark.api
@pytest.mark.req("FR-1.3-04")
def test_fr_1_3_04_edge_case_3_bracket_reset_required(api):
    results = [{"match_id": "WR1M1", "winner": "t1"}, {"match_id": "WR1M2", "winner": "t2"}, {"match_id": "WR2M1", "winner": "t1"},
               {"match_id": "LR1M1", "winner": "t4"}, {"match_id": "LR2M1", "winner": "t4"}, {"match_id": "GF1", "winner": "t4"}]
    gf = gen(api, "double_elim", T(4), {"bracket_reset": True, "results": results}).json()["grand_final"]
    assert gf[1]["required"] is True and (gf[1]["home"], gf[1]["away"]) == ("t4", "t1")
    gf = gen(api, "double_elim", T(4), {"bracket_reset": True, "results": results[:-1] + [{"match_id": "GF1", "winner": "t1"}]}).json()["grand_final"]
    assert gf[1]["required"] is False
    no_reset = gen(api, "double_elim", T(4), {"results": results[:-1]}).json()
    assert [m["match_id"] for m in no_reset["grand_final"]] == ["GF1"] and no_reset["bracket_reset"] is False


@pytest.mark.api
@pytest.mark.req("FR-1.3-04")
def test_fr_1_3_04_limits_and_bad_result(api):
    assert_error(gen(api, "double_elim", T(2)), 400, "VALIDATION_ERROR", ["teams"])
    assert gen(api, "double_elim", T(3)).status_code == 200
    assert_error(gen(api, "double_elim", T(8), {"bracket_reset": True, "results": [{"match_id": "GF2", "winner": "t1"}]}), 400, "VALIDATION_ERROR")


@pytest.mark.api
@pytest.mark.req("FR-1.3-01")
@pytest.mark.parametrize("body,fields", [
    ({}, ["format", "teams"]), ({"format": "nope", "teams": ["a", "b"]}, ["format"]), ({"format": "swiss", "teams": ["a", "a"]}, ["teams"]),
    ({"format": "swiss", "teams": "abc"}, ["teams"]), ({"format": "swiss", "teams": ["a|b", "c"]}, ["teams"]),
    ({"format": "round_robin", "teams": ["a", "b"], "params": {"legs": "x"}}, ["params.legs"]),
])
def test_fr_1_3_envelope_400(api, body, fields):
    assert_error(api.post("/audit/v1/fixtures", json=body), 400, "VALIDATION_ERROR", fields)


@pytest.mark.api
@pytest.mark.req("FR-1.3-01")
def test_fr_1_3_stores_nothing_and_unknown_params_ignored(api):
    r = api.post("/audit/v1/fixtures", json={"format": "round_robin", "teams": T(4), "params": {"legs": 1, "unknown": 1}, "extra": True})
    assert r.status_code == 200


@pytest.mark.api
@pytest.mark.req("FR-1.3-02")
def test_fr_1_3_02_edge_case_2_no_valid_pairing_409(api):
    # t1 has already met t2, t3 and t4: every perfect pairing of four teams needs a rematch.
    hist = [{"round": 1, "bye": None, "matches": [{"home": "t1", "away": "t2", "result": "home"}, {"home": "t1", "away": "t3", "result": "home"}]},
            {"round": 2, "bye": None, "matches": [{"home": "t1", "away": "t4", "result": "home"}, {"home": "t2", "away": "t3", "result": "draw"}]}]
    err = assert_error(gen(api, "swiss", T(4), {"total_rounds": 3, "round": 3, "history": hist}), 409, "NO_VALID_PAIRING")
    assert err["details"] == {"round": 3}
