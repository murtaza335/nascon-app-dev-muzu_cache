"""FR-2.2-01..04 API-09/10/11: roster setup, transfer/loan/release, audit history."""
import re
import uuid

import pytest

from conftest import assert_error
from helpers import uid

TA, TB = "tenant-alpha", "tenant-beta"


def setup_body(lid, **over):
    b = {
        "league": {"league_id": lid, "tenant_id": TA, "sport_id": "football",
                   "transfer_window": {"open": "2026-09-01", "close": "2026-09-30"}, "max_squad_size": 3, "required_positions": {"gk": 1}},
        "squads": [{"squad_id": "sq-a", "club_id": "club-a", "tenant_id": TA, "name": "A"},
                   {"squad_id": "sq-b", "club_id": "club-b", "tenant_id": TA, "name": "B"},
                   {"squad_id": "sq-x", "club_id": "club-x", "tenant_id": TB, "name": "X"}],
        "players": [{"player_id": f"{lid}-p1", "name": "Ali", "position": "gk", "squad_id": "sq-a", "role": "captain"},
                    {"player_id": f"{lid}-p2", "name": "Bilal", "position": "df", "squad_id": "sq-a", "role": "starter"},
                    {"player_id": f"{lid}-p3", "name": "Chaudhry", "position": "df", "squad_id": "sq-a", "role": "vice_captain"}],
        "matches_in_progress": [],
    }
    b.update(over)
    return b


@pytest.fixture
def lg(api):
    lid = uid("lgr")
    r = api.post("/audit/v1/roster/setup", json=setup_body(lid))
    assert r.status_code == 201, r.text
    return lid


def tr(lid, player="p2", type_="transfer", frm="sq-a", to="sq-b", eff="2026-09-30", end=None, rid=None, reason="Tactical move", by="user-77"):
    return {"request_id": rid or uid("tr"), "league_id": lid, "player_id": f"{lid}-{player}", "type": type_, "from_squad_id": frm,
            "to_squad_id": to, "effective_date": eff, "loan_end_date": end, "reason": reason, "requested_by": by}


def post(api, body):
    return api.post("/audit/v1/roster/transfer", json=body)


@pytest.mark.api
@pytest.mark.req("FR-2.2-01")
def test_fr_2_2_01_setup_response_and_defaults(api):
    lid = uid("lgr")
    r = api.post("/audit/v1/roster/setup", json=setup_body(lid))
    assert r.status_code == 201
    assert r.json() == {"league_id": lid, "status": "configured", "squad_counts": {"sq-a": 3, "sq-b": 0, "sq-x": 0}}
    d = setup_body(lid + "d")
    del d["league"]["max_squad_size"], d["league"]["required_positions"]
    assert api.post("/audit/v1/roster/setup", json=d).status_code == 201
    # defaults come from the football roster config: max 25, gk >= 1 → releasing the only gk is refused
    assert_error(post(api, tr(lid + "d", "p1", "release", to=None)), 409, "MIN_POSITION_VIOLATION")


@pytest.mark.api
@pytest.mark.req("FR-2.2-01")
def test_fr_2_2_01_setup_errors(api):
    lid = uid("lgr")
    b = setup_body(lid)
    b["league"]["sport_id"] = "nope"
    assert_error(api.post("/audit/v1/roster/setup", json=b), 404, "SPORT_NOT_FOUND")
    b = setup_body(lid)
    b["players"][0]["squad_id"] = "missing"
    assert_error(api.post("/audit/v1/roster/setup", json=b), 400, "VALIDATION_ERROR", ["players[0].squad_id"])
    b = setup_body(lid)
    b["matches_in_progress"] = [{"match_id": "m", "home_squad_id": "sq-a", "away_squad_id": "missing"}]
    assert_error(api.post("/audit/v1/roster/setup", json=b), 400, "VALIDATION_ERROR", ["matches_in_progress[0].away_squad_id"])
    b = setup_body(lid)
    b["league"]["transfer_window"] = {"open": "2026-10-01", "close": "2026-09-01"}
    assert_error(api.post("/audit/v1/roster/setup", json=b), 400, "VALIDATION_ERROR", ["league.transfer_window.close"])
    assert_error(api.post("/audit/v1/roster/setup", json={}), 400, "VALIDATION_ERROR", ["league", "squads", "players"])


@pytest.mark.api
@pytest.mark.req("FR-2.2-01")
def test_fr_2_2_01_resetup_replaces_state_and_audit(api, lg):
    assert post(api, tr(lg, "p2")).status_code == 201
    assert len(api.get(f"/audit/v1/roster/history/{lg}-p2?as_of=2026-09-30").json()["history"]) == 1
    assert api.post("/audit/v1/roster/setup", json=setup_body(lg)).status_code == 201
    h = api.get(f"/audit/v1/roster/history/{lg}-p2?as_of=2026-09-30").json()
    assert h["history"] == [] and h["current_squad_id"] == "sq-a"
    rid = "tr-after-resetup"
    first = post(api, tr(lg, "p2", rid=rid))
    assert first.status_code == 201


@pytest.mark.api
@pytest.mark.req("FR-2.2-02")
def test_fr_2_2_02_transfer_success_shape(api, lg):
    b = tr(lg, "p2", rid="tr-shape-" + uuid.uuid4().hex[:6])
    r = post(api, b)
    assert r.status_code == 201, r.text
    out = r.json()
    assert list(out) == ["request_id", "status", "state", "blocking_match_id", "registration", "audit_entry"]
    assert (out["status"], out["state"], out["blocking_match_id"]) == ("accepted", "active", None)
    assert out["registration"] == {"player_id": f"{lg}-p2", "league_id": lg, "squad_id": "sq-b", "parent_squad_id": None,
                                   "registration_type": "transfer", "start_date": "2026-09-30", "loan_end_date": None, "role": "substitute"}
    a = out["audit_entry"]
    assert list(a) == ["audit_id", "action", "player_id", "league_id", "from_squad_id", "to_squad_id", "effective_date", "state", "who", "when", "why"]
    assert re.fullmatch(r"au-\d{4}", a["audit_id"]) and a["action"] == "transfer" and (a["who"], a["why"]) == ("user-77", "Tactical move")
    assert re.fullmatch(r"\d{4}-\d\d-\d\dT\d\d:\d\d:\d\dZ", a["when"])
    again = post(api, b)
    assert again.status_code == 200 and again.json() == out


@pytest.mark.api
@pytest.mark.req("FR-2.2-04")
def test_fr_2_2_04_audit_ids_start_at_one_after_reset(api):
    api.post("/audit/v1/reset")
    lid = uid("lgr")
    api.post("/audit/v1/roster/setup", json=setup_body(lid))
    assert post(api, tr(lid, "p2")).json()["audit_entry"]["audit_id"] == "au-0001"
    assert post(api, tr(lid, "p3")).json()["audit_entry"]["audit_id"] == "au-0002"


@pytest.mark.api
@pytest.mark.req("FR-2.2-02")
def test_fr_2_2_02_replay_with_different_body_conflicts_and_failures_are_not_stored(api, lg):
    rid = uid("tr")
    ok = post(api, tr(lg, "p2", rid=rid))
    assert ok.status_code == 201
    assert_error(post(api, tr(lg, "p3", rid=rid)), 409, "DUPLICATE_REQUEST_ID")
    bad = tr(lg, "p3", eff="2026-12-01", rid="tr-fail-then-ok")
    assert_error(post(api, bad), 409, "TRANSFER_WINDOW_CLOSED")
    assert post(api, dict(bad, effective_date="2026-09-15")).status_code == 201  # failed request left no trace


@pytest.mark.api
@pytest.mark.req("FR-2.2-02")
def test_fr_2_2_02_loan_effects_and_squad_counts(api, lg):
    r = post(api, tr(lg, "p2", "loan", end="2026-10-20"))
    assert r.status_code == 201, r.text
    reg = r.json()["registration"]
    assert (reg["registration_type"], reg["squad_id"], reg["parent_squad_id"], reg["loan_end_date"], reg["role"]) == ("loan", "sq-b", "sq-a", "2026-10-20", "substitute")
    assert r.json()["audit_entry"]["action"] == "loan"
    # lender's slot is free again, borrower's count includes the loaned player
    assert post(api, tr(lg, "p3", to="sq-b")).status_code == 201
    # a loaned player cannot be transferred, loaned or released
    for t in ("transfer", "loan", "release"):
        body = tr(lg, "p2", t, frm="sq-b", to=None if t == "release" else "sq-a", end="2026-10-25" if t == "loan" else None)
        assert_error(post(api, body), 409, "PLAYER_ON_LOAN")


@pytest.mark.api
@pytest.mark.req("FR-2.2-02")
def test_fr_2_2_02_release(api, lg):
    r = post(api, tr(lg, "p2", "release", to=None, eff="2030-01-01"))
    assert r.status_code == 201, r.text
    out = r.json()
    assert out["registration"] is None and out["audit_entry"]["action"] == "release" and out["audit_entry"]["to_squad_id"] is None
    h = api.get(f"/audit/v1/roster/history/{lg}-p2?as_of=2030-01-02").json()
    assert h["current_squad_id"] is None and h["parent_squad_id"] is None and len(h["history"]) == 1
    assert_error(post(api, tr(lg, "p2", "transfer")), 409, "NOT_IN_SQUAD")


@pytest.mark.api
@pytest.mark.req("FR-2.2-02")
def test_fr_2_2_02_each_error_code(api, lg):
    assert_error(post(api, tr(lg, eff="2026-08-31")), 409, "TRANSFER_WINDOW_CLOSED")
    assert_error(post(api, tr(lg, eff="2026-10-01")), 409, "TRANSFER_WINDOW_CLOSED")
    assert post(api, tr(lg, "p2", eff="2026-09-01")).status_code == 201  # inclusive open day
    assert_error(post(api, tr(lg, "p3", frm="sq-b", to="sq-a")), 409, "NOT_IN_SQUAD")
    assert_error(post(api, tr(lg, "p1")), 409, "MIN_POSITION_VIOLATION")
    assert_error(post(api, tr(lg, "p3", to="sq-x")), 409, "CROSS_TENANT_TRANSFER")
    assert_error(post(api, tr(lg, "p3", frm="sq-x", to="sq-b")), 409, "CROSS_TENANT_TRANSFER")


@pytest.mark.api
@pytest.mark.req("FR-2.2-02")
def test_fr_2_2_02_squad_full(api):
    lid = uid("lgr")
    b = setup_body(lid)
    b["league"]["max_squad_size"] = 2
    b["players"] = [{"player_id": f"{lid}-p1", "name": "a", "position": "gk", "squad_id": "sq-a", "role": "starter"},
                    {"player_id": f"{lid}-p2", "name": "b", "position": "df", "squad_id": "sq-a", "role": "starter"},
                    {"player_id": f"{lid}-p3", "name": "c", "position": "df", "squad_id": "sq-b", "role": "starter"},
                    {"player_id": f"{lid}-p4", "name": "d", "position": "df", "squad_id": "sq-b", "role": "starter"}]
    assert api.post("/audit/v1/roster/setup", json=b).status_code == 201
    assert_error(post(api, tr(lid, "p2")), 409, "SQUAD_FULL")
    assert_error(post(api, tr(lid, "p3", frm="sq-b", to="sq-a")), 409, "SQUAD_FULL")
    assert_error(post(api, tr(lid, "p4", "loan", frm="sq-b", to="sq-a", end="2026-12-01")), 409, "SQUAD_FULL")
    assert post(api, tr(lid, "p4", "release", frm="sq-b", to=None)).status_code == 201  # sq-b now has 1
    assert post(api, tr(lid, "p2")).status_code == 201  # 1 + 1 <= 2


@pytest.mark.api
@pytest.mark.req("FR-2.2-02")
def test_fr_2_2_02_404_order_league_player_squad(api, lg):
    assert_error(post(api, dict(tr(lg), league_id="nope")), 404, "LEAGUE_NOT_FOUND")
    assert_error(post(api, dict(tr(lg), league_id="nope", player_id="also-nope", from_squad_id="zz")), 404, "LEAGUE_NOT_FOUND")
    assert_error(post(api, dict(tr(lg), player_id="no-such-player")), 404, "PLAYER_NOT_FOUND")
    assert_error(post(api, dict(tr(lg), player_id="no-such-player", from_squad_id="zz")), 404, "PLAYER_NOT_FOUND")
    assert_error(post(api, tr(lg, frm="zz")), 404, "SQUAD_NOT_FOUND")
    assert_error(post(api, tr(lg, to="zz")), 404, "SQUAD_NOT_FOUND")


@pytest.mark.api
@pytest.mark.req("FR-2.2-02")
@pytest.mark.parametrize("mut,fields", [
    (lambda b: b.update(type="swap"), ["type"]), (lambda b: b.update(to_squad_id=None), ["to_squad_id"]),
    (lambda b: b.update(to_squad_id="sq-a"), ["to_squad_id"]), (lambda b: b.update(effective_date="2026-02-30"), ["effective_date"]),
    (lambda b: b.update(effective_date="30-09-2026"), ["effective_date"]), (lambda b: b.update(type="loan", loan_end_date=None), ["loan_end_date"]),
    (lambda b: b.update(type="loan", loan_end_date="2026-09-30"), ["loan_end_date"]), (lambda b: b.update(reason=""), ["reason"]),
    (lambda b: b.update(reason="x" * 501), ["reason"]), (lambda b: b.pop("requested_by"), ["requested_by"]),
    (lambda b: b.update(request_id="a|b"), ["request_id"]),
])
def test_fr_2_2_02_validation_400(api, lg, mut, fields):
    b = tr(lg)
    mut(b)
    assert_error(post(api, b), 400, "VALIDATION_ERROR", fields)


@pytest.mark.api
@pytest.mark.req("FR-2.2-02")
def test_fr_2_2_02_precedence_validation_over_404_over_409(api, lg):
    assert_error(post(api, dict(tr(lg), league_id="nope", reason="")), 400, "VALIDATION_ERROR", ["reason"])
    assert_error(post(api, dict(tr(lg, eff="2026-12-01"), to_squad_id="zz")), 404, "SQUAD_NOT_FOUND")
    assert_error(post(api, tr(lg, "p1", to="sq-x")), 409, "CROSS_TENANT_TRANSFER")  # before min-position
    assert_error(post(api, tr(lg, "p1", eff="2026-12-01")), 409, "TRANSFER_WINDOW_CLOSED")  # before min-position


@pytest.mark.api
@pytest.mark.req("FR-2.2-02")
def test_fr_2_2_02_edge_case_6_deferred_until_match_end(api):
    lid = uid("lgr")
    b = setup_body(lid, matches_in_progress=[{"match_id": "m-live", "home_squad_id": "sq-a", "away_squad_id": "sq-b"}])
    assert api.post("/audit/v1/roster/setup", json=b).status_code == 201
    r = post(api, tr(lid, "p2", eff="2026-09-30"))
    assert r.status_code == 201, r.text
    out = r.json()
    assert (out["state"], out["blocking_match_id"]) == ("deferred_until_match_end", "m-live")
    assert out["audit_entry"]["state"] == "deferred_until_match_end"
    other = uid("lgr")
    assert api.post("/audit/v1/roster/setup", json=setup_body(other, matches_in_progress=[{"match_id": "m-1", "home_squad_id": "sq-x", "away_squad_id": "sq-b"}])).status_code == 201
    out = post(api, tr(other, "p2")).json()
    assert (out["state"], out["blocking_match_id"]) == ("active", None)


@pytest.mark.api
@pytest.mark.req("FR-2.2-03")
def test_fr_2_2_03_loan_return_written_once(api, lg):
    assert post(api, tr(lg, "p2", "loan", end="2026-09-20", eff="2026-09-10")).status_code == 201
    pid = f"{lg}-p2"
    during = api.get(f"/audit/v1/roster/history/{pid}?as_of=2026-09-15").json()
    assert (during["current_squad_id"], during["parent_squad_id"], len(during["history"])) == ("sq-b", "sq-a", 1)
    on_last_day = api.get(f"/audit/v1/roster/history/{pid}?as_of=2026-09-20").json()
    assert (on_last_day["current_squad_id"], len(on_last_day["history"])) == ("sq-b", 1)
    after = api.get(f"/audit/v1/roster/history/{pid}?as_of=2026-09-21").json()
    assert (after["current_squad_id"], after["parent_squad_id"], after["league_id"]) == ("sq-a", None, lg)
    assert [e["action"] for e in after["history"]] == ["loan", "loan_return"]
    ret = after["history"][1]
    assert (ret["from_squad_id"], ret["to_squad_id"], ret["effective_date"], ret["who"], ret["state"], ret["why"]) == ("sq-b", "sq-a", "2026-09-21", "system", "active", "loan period ended")
    for _ in range(3):
        again = api.get(f"/audit/v1/roster/history/{pid}?as_of=2026-12-01").json()
        assert [e["action"] for e in again["history"]] == ["loan", "loan_return"]
    # an earlier as_of still answers from the log
    early = api.get(f"/audit/v1/roster/history/{pid}?as_of=2026-09-12").json()
    assert (early["current_squad_id"], early["parent_squad_id"]) == ("sq-b", "sq-a")


@pytest.mark.api
@pytest.mark.req("FR-2.2-03")
def test_fr_2_2_03_returned_player_is_transferable_and_counts_for_lender(api, lg):
    assert post(api, tr(lg, "p2", "loan", end="2026-09-12", eff="2026-09-10")).status_code == 201
    r = post(api, tr(lg, "p2", frm="sq-a", to="sq-b", eff="2026-09-15"))  # loan ended 09-12 → back with sq-a
    assert r.status_code == 201, r.text
    actions = [e["action"] for e in api.get(f"/audit/v1/roster/history/{lg}-p2?as_of=2026-09-15").json()["history"]]
    assert actions == ["loan", "loan_return", "transfer"]


@pytest.mark.api
@pytest.mark.req("FR-2.2-04")
def test_fr_2_2_04_history_basics(api, lg):
    h = api.get(f"/audit/v1/roster/history/{lg}-p2").json()
    assert list(h) == ["player_id", "as_of", "league_id", "current_squad_id", "parent_squad_id", "history"]
    assert re.fullmatch(r"\d{4}-\d\d-\d\d", h["as_of"]) and h["history"] == [] and h["current_squad_id"] == "sq-a"
    assert_error(api.get("/audit/v1/roster/history/nobody"), 404, "PLAYER_NOT_FOUND")
    assert_error(api.get(f"/audit/v1/roster/history/{lg}-p2?as_of=nope"), 400, "VALIDATION_ERROR", ["as_of"])
    assert_error(api.get(f"/audit/v1/roster/history/{lg}-p2?as_of=2026-02-30"), 400, "VALIDATION_ERROR", ["as_of"])
    assert post(api, tr(lg, "p2")).status_code == 201
    assert post(api, tr(lg, "p3")).status_code == 201
    assert [e["player_id"] for e in api.get(f"/audit/v1/roster/history/{lg}-p2?as_of=2026-09-30").json()["history"]] == [f"{lg}-p2"]


@pytest.mark.api
@pytest.mark.req("FR-2.2-04")
def test_fr_2_2_04_rejected_requests_write_no_entry(api, lg):
    for body in (tr(lg, eff="2026-12-01"), tr(lg, "p1"), tr(lg, frm="sq-b", to="sq-a")):
        assert post(api, body).status_code == 409
    assert api.get(f"/audit/v1/roster/history/{lg}-p2?as_of=2026-09-30").json()["history"] == []
    assert api.get(f"/audit/v1/roster/history/{lg}-p1?as_of=2026-09-30").json()["history"] == []


@pytest.mark.api
@pytest.mark.req("FR-2.2-02")
def test_fr_2_2_02_parallel_same_request_id_applies_once(api, lg):
    import threading
    body = tr(lg, "p2", rid="tr-par-" + uuid.uuid4().hex[:6])
    out, barrier = [], threading.Barrier(6)

    def go():
        barrier.wait()
        out.append(post(api, body))

    ts = [threading.Thread(target=go) for _ in range(6)]
    [t.start() for t in ts]
    [t.join() for t in ts]
    assert sorted(r.status_code for r in out) == [200] * 5 + [201]
    assert len(api.get(f"/audit/v1/roster/history/{lg}-p2?as_of=2026-09-30").json()["history"]) == 1
