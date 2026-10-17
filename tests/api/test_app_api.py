"""APP-01..55: production API for the mobile app (needs SEED_DEMO_DATA=true on the server for fixtures and rosters)."""
import uuid

import pytest

from conftest import assert_error
from helpers import uid

LA1 = "league-alpha-1"


@pytest.fixture(scope="module", autouse=True)
def demo_world(api, app):
    api.post("/audit/v1/reset")
    r = app.post("/api/v1/auth/login", json={"email": "admin@nascon.test", "password": "Nascon@26"})
    token = r.json()["token"]
    f = app.get(f"/api/v1/leagues/{LA1}/fixtures", headers={"Authorization": f"Bearer {token}"})
    if f.status_code != 200 or not f.json()["data"]:
        pytest.skip("server was not started with SEED_DEMO_DATA=true")


# ---- auth ------------------------------------------------------------------------------------------------------------
@pytest.mark.api
@pytest.mark.req("APP-01")
@pytest.mark.parametrize("role,email", [("super_admin", "admin@nascon.test"), ("league_organizer", "organizer@nascon.test"),
                                         ("club_manager", "manager@nascon.test"), ("player", "player@nascon.test"), ("viewer", "viewer@nascon.test")])
def test_app_01_login_each_demo_account(app, role, email):
    r = app.post("/api/v1/auth/login", json={"email": email, "password": "Nascon@26"})
    assert r.status_code == 200, r.text
    b = r.json()
    assert list(b) == ["token", "expires_at", "user", "tenant"]
    assert list(b["user"]) == ["user_id", "email", "role", "tenant_id", "display_name", "league_ids", "club_id", "player_id"]
    assert b["user"]["role"] == role and b["user"]["email"] == email
    assert b["expires_at"].endswith("Z")
    if role == "super_admin":
        assert b["tenant"] is None
    else:
        assert list(b["tenant"]) == ["tenant_id", "name", "logo_url", "colors"] and b["tenant"]["name"] == "Alpha Sports"
        assert set(b["tenant"]["colors"]) == {"primary", "secondary"}


@pytest.mark.api
@pytest.mark.req("APP-01")
def test_app_01_email_is_case_insensitive_and_credentials_errors_are_identical(app):
    assert app.post("/api/v1/auth/login", json={"email": "ADMIN@Nascon.Test", "password": "Nascon@26"}).status_code == 200
    wrong = app.post("/api/v1/auth/login", json={"email": "admin@nascon.test", "password": "bad"})
    unknown = app.post("/api/v1/auth/login", json={"email": "nobody@nascon.test", "password": "bad"})
    e1 = assert_error(wrong, 401, "INVALID_CREDENTIALS")
    e2 = assert_error(unknown, 401, "INVALID_CREDENTIALS")
    assert e1 == e2


@pytest.mark.api
@pytest.mark.req("APP-01")
@pytest.mark.parametrize("body,fields", [({}, ["email", "password"]), ({"email": "a@b.c"}, ["password"]), ({"email": 5, "password": "x"}, ["email"]), ({"email": "", "password": ""}, ["email", "password"])])
def test_app_01_validation_400(app, body, fields):
    assert_error(app.post("/api/v1/auth/login", json=body), 400, "VALIDATION_ERROR", fields)


@pytest.mark.api
@pytest.mark.req("APP-02")
def test_app_02_me_and_auth_required(app, H):
    r = app.get("/api/v1/me", headers=H("club_manager"))
    assert r.status_code == 200 and r.json()["user"]["club_id"] == "club-alpha-1" and r.json()["tenant"]["tenant_id"] == "tenant-alpha"
    assert_error(app.get("/api/v1/me"), 401, "UNAUTHENTICATED")
    assert_error(app.get("/api/v1/me", headers={"Authorization": "Bearer junk"}), 401, "UNAUTHENTICATED")
    assert_error(app.get("/api/v1/leagues"), 401, "UNAUTHENTICATED")


# ---- leagues, fixtures, standings ------------------------------------------------------------------------------------
@pytest.mark.api
@pytest.mark.req("APP-10")
def test_app_10_leagues_scoped_by_tenant_and_paginated(app, H):
    b = app.get("/api/v1/leagues", headers=H("viewer")).json()
    assert list(b) == ["data", "total", "limit", "offset"] and (b["total"], b["limit"], b["offset"]) == (2, 50, 0)
    assert [x["league_id"] for x in b["data"]] == ["league-alpha-1", "league-alpha-2"]
    assert list(b["data"][0]) == ["league_id", "name", "sport_id", "tenant_id", "season"] and all(x["tenant_id"] == "tenant-alpha" for x in b["data"])
    assert app.get("/api/v1/leagues", headers=H("super_admin")).json()["total"] == 3
    p = app.get("/api/v1/leagues?limit=1&offset=1", headers=H("viewer")).json()
    assert [x["league_id"] for x in p["data"]] == ["league-alpha-2"] and (p["total"], p["limit"], p["offset"]) == (2, 1, 1)
    for q in ("limit=0", "limit=101", "limit=x", "offset=-1", "offset=1.5"):
        assert_error(app.get(f"/api/v1/leagues?{q}", headers=H("viewer")), 400, "VALIDATION_ERROR")


@pytest.mark.api
@pytest.mark.req("APP-11")
def test_app_11_fixtures_list_filter_and_isolation(app, H):
    b = app.get(f"/api/v1/leagues/{LA1}/fixtures", headers=H("player")).json()
    assert b["total"] == 4
    assert [f["match_id"] for f in b["data"]] == ["demo-m1", "demo-m2", "demo-m3", "demo-m4"]
    f1 = b["data"][0]
    assert list(f1) == ["match_id", "home_team_id", "away_team_id", "status", "scheduled_at", "venue", "score", "version"]
    assert (f1["status"], f1["score"], f1["version"], f1["scheduled_at"]) == ("completed", {"home": 2, "away": 1}, 5, "2026-10-10T15:00:00Z")
    assert [f["status"] for f in b["data"]] == ["completed", "in_progress", "upcoming", "upcoming"]
    live = app.get(f"/api/v1/leagues/{LA1}/fixtures?status=in_progress", headers=H("player")).json()
    assert [f["match_id"] for f in live["data"]] == ["demo-m2"]
    assert_error(app.get(f"/api/v1/leagues/{LA1}/fixtures?status=nope", headers=H("player")), 400, "VALIDATION_ERROR", ["status"])
    assert_error(app.get("/api/v1/leagues/league-beta-1/fixtures", headers=H("player")), 403, "FORBIDDEN")
    assert_error(app.get("/api/v1/leagues/nope/fixtures", headers=H("player")), 404, "LEAGUE_NOT_FOUND")
    assert app.get("/api/v1/leagues/league-beta-1/fixtures", headers=H("super_admin")).status_code == 200


@pytest.mark.api
@pytest.mark.req("APP-16")
def test_app_16_standings_match_the_audit_computation(app, api, H):
    b = app.get(f"/api/v1/leagues/{LA1}/standings", headers=H("viewer")).json()
    assert b == api.get(f"/audit/v1/standings/{LA1}").json()
    top = b["table"][0]
    assert (top["team_id"], top["points"], top["rank"]) == ("club-alpha-1", 3, 1)
    assert_error(app.get("/api/v1/leagues/league-beta-1/standings", headers=H("viewer")), 403, "FORBIDDEN")
    assert_error(app.get("/api/v1/leagues/nope/standings", headers=H("viewer")), 404, "LEAGUE_NOT_FOUND")


# ---- matches ---------------------------------------------------------------------------------------------------------
@pytest.mark.api
@pytest.mark.req("APP-13")
def test_app_13_match_detail_has_projection_and_pinned_product(app, H):
    b = app.get("/api/v1/matches/demo-m2", headers=H("viewer")).json()
    assert (b["status"], b["home"]["score"], b["away"]["score"], b["version"]) == ("in_progress", 1, 0, 2)
    assert b["pinned_product"]["product_id"] == "prod-jersey-001" and b["venue"] is None
    assert "scheduled_at" in b and [e["type"] for e in b["events"]] == ["match_start", "score"]
    assert app.get("/api/v1/matches/demo-m3", headers=H("viewer")).json()["pinned_product"] is None
    assert_error(app.get("/api/v1/matches/nope", headers=H("viewer")), 404, "MATCH_NOT_FOUND")


@pytest.mark.api
@pytest.mark.req("APP-15")
def test_app_15_organizer_scores_and_readers_see_it_immediately(app, H):
    before = app.get("/api/v1/matches/demo-m3", headers=H("viewer")).json()
    standings_before = app.get(f"/api/v1/leagues/{LA1}/fixtures", headers=H("viewer")).json()
    assert before["version"] == 0
    eid = uid("e")
    start = {"event_id": eid, "match_id": "demo-m3", "type": "match_start", "payload": {}}
    r = app.post("/api/v1/matches/demo-m3/events", json=start, headers=H("league_organizer"))
    assert r.status_code == 201 and r.json()["sequence"] == 1
    goal = {"event_id": uid("e"), "match_id": "demo-m3", "type": "score", "payload": {"team_id": "club-alpha-1", "event_type": "goal"}}
    assert app.post("/api/v1/matches/demo-m3/events", json=goal, headers=H("league_organizer")).status_code == 201
    after = app.get("/api/v1/matches/demo-m3", headers=H("viewer")).json()  # cache invalidated after the write
    assert (after["status"], after["home"]["score"], after["version"]) == ("in_progress", 1, 2)
    fx = {f["match_id"]: f for f in app.get(f"/api/v1/leagues/{LA1}/fixtures", headers=H("viewer")).json()["data"]}
    assert (fx["demo-m3"]["status"], fx["demo-m3"]["score"]) == ("in_progress", {"home": 1, "away": 0})
    assert standings_before["data"][2]["status"] == "upcoming"
    again = app.post("/api/v1/matches/demo-m3/events", json=goal, headers=H("league_organizer"))
    assert again.status_code == 200


@pytest.mark.api
@pytest.mark.req("APP-15")
def test_app_15_authorization_and_validation(app, H):
    body = {"event_id": uid("e"), "match_id": "demo-m4", "type": "match_start", "payload": {}}
    for role in ("club_manager", "player", "viewer"):
        assert_error(app.post("/api/v1/matches/demo-m4/events", json=body, headers=H(role)), 403, "FORBIDDEN")
    assert_error(app.post("/api/v1/matches/nope/events", json=body, headers=H("viewer")), 404, "MATCH_NOT_FOUND")  # 404 before 403
    assert_error(app.post("/api/v1/matches/demo-m4/events", json=dict(body, match_id="demo-m3"), headers=H("league_organizer")), 400, "VALIDATION_ERROR", ["match_id"])
    assert_error(app.post("/api/v1/matches/demo-m4/events", json=dict(body, type="score", payload={}), headers=H("league_organizer")), 400, "VALIDATION_ERROR")
    assert app.post("/api/v1/matches/demo-m4/events", json=body, headers=H("super_admin")).status_code == 201


@pytest.mark.api
@pytest.mark.req("APP-14")
def test_app_14_pin_and_unpin(app, H):
    r = app.put("/api/v1/matches/demo-m3/pin", json={"product_id": "demo-prod-scarf"}, headers=H("league_organizer"))
    assert r.status_code == 200 and r.json() == {"match_id": "demo-m3", "pinned_product_id": "demo-prod-scarf"}
    assert app.get("/api/v1/matches/demo-m3", headers=H("viewer")).json()["pinned_product"]["name"] == "Lions Match Scarf"
    assert app.put("/api/v1/matches/demo-m3/pin", json={"product_id": None}, headers=H("super_admin")).json()["pinned_product_id"] is None
    assert app.get("/api/v1/matches/demo-m3", headers=H("viewer")).json()["pinned_product"] is None
    assert_error(app.put("/api/v1/matches/demo-m3/pin", json={"product_id": "nope"}, headers=H("league_organizer")), 404, "PRODUCT_NOT_FOUND")
    assert_error(app.put("/api/v1/matches/demo-m3/pin", json={}, headers=H("league_organizer")), 400, "VALIDATION_ERROR", ["product_id"])
    for role in ("club_manager", "player", "viewer"):
        assert_error(app.put("/api/v1/matches/demo-m3/pin", json={"product_id": None}, headers=H(role)), 403, "FORBIDDEN")


# ---- clubs, roster, players ------------------------------------------------------------------------------------------
@pytest.mark.api
@pytest.mark.req("APP-30")
def test_app_30_club_profile_and_isolation(app, H):
    b = app.get("/api/v1/clubs/club-alpha-1", headers=H("viewer")).json()
    assert list(b) == ["club_id", "tenant_id", "name", "home_venue", "socials", "staff", "stats_by_season", "roster"]
    assert b["home_venue"] == {"name": "Alpha Arena", "lat": 31.5204, "lng": 74.3587} and b["staff"][0]["role"] in ("manager", "coach")
    assert b["stats_by_season"] == [{"season": LA1, "played": 1, "won": 1, "drawn": 0, "lost": 0}]
    ids = [p["player_id"] for p in b["roster"]]
    assert "player-alpha-1" in ids and "demo-p-1" in ids and all(list(p) == ["player_id", "name", "position", "squad_id", "role", "on_loan"] for p in b["roster"])
    assert_error(app.get("/api/v1/clubs/club-beta-1", headers=H("viewer")), 403, "FORBIDDEN")
    assert_error(app.get("/api/v1/clubs/club-beta-1", headers=H("club_manager")), 403, "FORBIDDEN")
    assert app.get("/api/v1/clubs/club-beta-1", headers=H("super_admin")).status_code == 200
    assert_error(app.get("/api/v1/clubs/nope", headers=H("viewer")), 404, "CLUB_NOT_FOUND")


@pytest.mark.api
@pytest.mark.req("APP-31")
def test_app_31_add_player_and_profile_refresh(app, H):
    app.get("/api/v1/clubs/club-alpha-1", headers=H("viewer"))  # warm the cache
    body = {"name": "New Signing", "position": "fw", "league_id": LA1, "squad_id": "sq-alpha-1", "role": "substitute"}
    r = app.post("/api/v1/clubs/club-alpha-1/players", json=body, headers=H("club_manager"))
    assert r.status_code == 201, r.text
    pid = r.json()["player"]["player_id"]
    assert r.json()["registration"]["squad_id"] == "sq-alpha-1" and r.json()["player"]["club_id"] == "club-alpha-1"
    assert pid in [p["player_id"] for p in app.get("/api/v1/clubs/club-alpha-1", headers=H("viewer")).json()["roster"]]
    assert_error(app.post("/api/v1/clubs/club-alpha-1/players", json=dict(body, player_id=pid), headers=H("club_manager")), 400, "VALIDATION_ERROR", ["player_id"])
    assert_error(app.post("/api/v1/clubs/club-alpha-1/players", json=dict(body, squad_id="sq-alpha-2"), headers=H("club_manager")), 404, "SQUAD_NOT_FOUND")
    assert_error(app.post("/api/v1/clubs/club-alpha-1/players", json=dict(body, league_id="nope"), headers=H("club_manager")), 404, "LEAGUE_NOT_FOUND")
    assert_error(app.post("/api/v1/clubs/club-alpha-1/players", json={}, headers=H("club_manager")), 400, "VALIDATION_ERROR", ["name", "position", "league_id", "squad_id", "role"])
    for role in ("league_organizer", "player", "viewer"):
        assert_error(app.post("/api/v1/clubs/club-alpha-1/players", json=body, headers=H(role)), 403, "FORBIDDEN")
    assert_error(app.post("/api/v1/clubs/club-alpha-2/players", json=dict(body, squad_id="sq-alpha-2"), headers=H("club_manager")), 403, "FORBIDDEN")
    assert_error(app.post("/api/v1/clubs/nope/players", json=body, headers=H("viewer")), 404, "CLUB_NOT_FOUND")


@pytest.mark.api
@pytest.mark.req("APP-32")
def test_app_32_manager_transfers_with_server_set_requested_by(app, H):
    b = {"request_id": uid("tr"), "league_id": LA1, "player_id": "demo-p-2", "type": "transfer", "from_squad_id": "sq-alpha-1", "to_squad_id": "sq-alpha-2",
         "effective_date": "2026-10-20", "loan_end_date": None, "reason": "Rebalance", "requested_by": "someone-else"}
    r = app.post("/api/v1/roster/transfers", json=b, headers=H("club_manager"))
    assert r.status_code == 201, r.text
    assert r.json()["audit_entry"]["who"] == "user-club-manager"
    assert app.post("/api/v1/roster/transfers", json=b, headers=H("club_manager")).status_code == 200
    roster = app.get("/api/v1/clubs/club-alpha-2", headers=H("viewer")).json()["roster"]
    assert "demo-p-2" in [p["player_id"] for p in roster]
    for role in ("league_organizer", "player", "viewer"):
        assert_error(app.post("/api/v1/roster/transfers", json=dict(b, request_id=uid("tr")), headers=H(role)), 403, "FORBIDDEN")
    assert_error(app.post("/api/v1/roster/transfers", json=dict(b, request_id=uid("tr"), league_id="nope"), headers=H("viewer")), 404, "LEAGUE_NOT_FOUND")
    assert_error(app.post("/api/v1/roster/transfers", json=dict(b, request_id=uid("tr"), from_squad_id="zz"), headers=H("club_manager")), 404, "SQUAD_NOT_FOUND")
    assert_error(app.post("/api/v1/roster/transfers", json=dict(b, request_id=uid("tr"), reason=""), headers=H("club_manager")), 400, "VALIDATION_ERROR", ["reason"])
    bad = dict(b, request_id=uid("tr"), player_id="demo-p-3", from_squad_id="sq-alpha-1")
    assert_error(app.post("/api/v1/roster/transfers", json=bad, headers=H("club_manager")), 409, "NOT_IN_SQUAD")


@pytest.mark.api
@pytest.mark.req("APP-33")
def test_app_33_history_for_any_role_in_tenant(app, H):
    r = app.get("/api/v1/players/demo-p-2/history?as_of=2026-10-21", headers=H("viewer"))
    assert r.status_code == 200 and r.json()["player_id"] == "demo-p-2"
    assert_error(app.get("/api/v1/players/nope/history", headers=H("viewer")), 404, "PLAYER_NOT_FOUND")
    assert_error(app.get("/api/v1/players/player-beta-1/history", headers=H("viewer")), 403, "FORBIDDEN")
    assert_error(app.get("/api/v1/players/demo-p-2/history?as_of=zzz", headers=H("viewer")), 400, "VALIDATION_ERROR", ["as_of"])


@pytest.mark.api
@pytest.mark.req("APP-34")
def test_app_34_patch_player_p5_rule(app, H):
    ok = app.patch("/api/v1/players/player-alpha-1", json={"name": "Ali A."}, headers=H("player"))
    assert ok.status_code == 200 and ok.json() == {"player_id": "player-alpha-1", "name": "Ali A.", "position": "gk", "club_id": "club-alpha-1"}
    assert app.patch("/api/v1/players/player-alpha-1", json={"position": "df"}, headers=H("club_manager")).status_code == 200
    assert app.patch("/api/v1/players/player-alpha-1", json={"position": "gk", "name": "Ali Alpha"}, headers=H("super_admin")).status_code == 200
    assert_error(app.patch("/api/v1/players/player-alpha-2", json={"name": "x"}, headers=H("player")), 403, "FORBIDDEN")
    assert_error(app.patch("/api/v1/players/player-alpha-2", json={"name": "x"}, headers=H("club_manager")), 403, "FORBIDDEN")
    assert_error(app.patch("/api/v1/players/player-alpha-1", json={"name": "x"}, headers=H("viewer")), 403, "FORBIDDEN")
    assert_error(app.patch("/api/v1/players/player-alpha-1", json={"name": ""}, headers=H("player")), 400, "VALIDATION_ERROR", ["name"])
    assert_error(app.patch("/api/v1/players/nope", json={}, headers=H("player")), 404, "PLAYER_NOT_FOUND")
    assert_error(app.patch("/api/v1/players/player-beta-1", json={"name": "x"}, headers=H("player")), 403, "FORBIDDEN")


# ---- store -----------------------------------------------------------------------------------------------------------
def _checkout(app, role_headers, variant="demo-var-scarf-OS", qty=1, oid=None, code=None, token="tok_success"):
    return app.post("/api/v1/store/checkout", headers=role_headers, json={
        "order_id": oid or uid("ord"), "customer_id": "ignored", "items": [{"variant_id": variant, "quantity": qty}], "discount_code": code, "payment": {"token": token}})


@pytest.mark.api
@pytest.mark.req("APP-50")
def test_app_50_51_catalogue(app, H):
    b = app.get("/api/v1/store/products", headers=H("viewer")).json()
    assert list(b) == ["data", "total", "limit", "offset"] and b["total"] == 3
    jersey = next(p for p in b["data"] if p["product_id"] == "prod-jersey-001")
    assert list(jersey) == ["product_id", "name", "category", "image_url", "club_id", "variants"]
    assert {v["variant_id"] for v in jersey["variants"]} == {"var-jersey-001-M", "var-jersey-001-L"}
    assert all(list(v) == ["variant_id", "size", "color", "price_minor", "stock"] for v in jersey["variants"])
    assert [p["product_id"] for p in app.get("/api/v1/store/products?club_id=club-alpha-2", headers=H("viewer")).json()["data"]] == []
    assert app.get("/api/v1/store/products", headers=H("super_admin")).json()["total"] == 3
    one = app.get("/api/v1/store/products/prod-jersey-001", headers=H("viewer")).json()
    assert one["product_id"] == "prod-jersey-001" and len(one["variants"]) == 2
    assert_error(app.get("/api/v1/store/products/nope", headers=H("viewer")), 404, "PRODUCT_NOT_FOUND")


@pytest.mark.api
@pytest.mark.req("APP-52")
def test_app_52_checkout_customer_is_caller_and_catalogue_stock_updates(app, H):
    before = next(v for p in app.get("/api/v1/store/products", headers=H("viewer")).json()["data"] for v in p["variants"] if v["variant_id"] == "demo-var-scarf-OS")["stock"]
    r = _checkout(app, H("viewer"), oid="app-ord-1")
    assert r.status_code == 201, r.text
    assert r.json()["receipt"]["payload"]["customer_id"] == "user-viewer" and r.json()["total_minor"] == 120000
    after = next(v for p in app.get("/api/v1/store/products", headers=H("viewer")).json()["data"] for v in p["variants"] if v["variant_id"] == "demo-var-scarf-OS")["stock"]
    assert after == before - 1
    assert _checkout(app, H("viewer"), oid="app-ord-1").status_code == 200
    assert_error(_checkout(app, H("player"), oid="app-ord-1"), 409, "DUPLICATE_ORDER_ID")  # another caller → different body
    assert_error(_checkout(app, H("viewer"), variant="nope"), 404, "VARIANT_NOT_FOUND")
    assert_error(_checkout(app, H("viewer"), token="tok_declined"), 402, "PAYMENT_DECLINED")
    assert_error(app.post("/api/v1/store/checkout", json={}, headers=H("viewer")), 400, "VALIDATION_ERROR")
    assert _checkout(app, H("viewer"), variant="demo-var-scarf-OS", code="WELCOME10", oid="app-ord-2").json()["discount_minor"] == 12000


@pytest.mark.api
@pytest.mark.req("APP-53")
def test_app_53_54_orders_are_private_to_owner_manager_and_admin(app, H):
    oid = "app-priv-1"
    assert _checkout(app, H("player"), oid=oid).status_code == 201
    mine = app.get("/api/v1/store/orders", headers=H("player")).json()
    assert oid in [o["order_id"] for o in mine["data"]]
    o = app.get(f"/api/v1/store/orders/{oid}", headers=H("player")).json()
    assert list(o) == ["order_id", "customer_id", "status", "currency", "items", "subtotal_minor", "discount_minor", "total_minor", "payment", "receipt", "created_at"]
    assert "pdf_base64" not in o["receipt"] and o["customer_id"] == "user-player" and o["status"] == "paid"
    assert oid not in [x["order_id"] for x in app.get("/api/v1/store/orders", headers=H("viewer")).json()["data"]]
    assert_error(app.get(f"/api/v1/store/orders/{oid}", headers=H("viewer")), 403, "FORBIDDEN")
    assert_error(app.get(f"/api/v1/store/orders/{oid}/receipt.pdf", headers=H("viewer")), 403, "FORBIDDEN")
    assert app.get(f"/api/v1/store/orders/{oid}", headers=H("club_manager")).status_code == 200
    assert app.get(f"/api/v1/store/orders/{oid}", headers=H("super_admin")).status_code == 200
    assert oid in [x["order_id"] for x in app.get("/api/v1/store/orders", headers=H("club_manager")).json()["data"]]
    pdf = app.get(f"/api/v1/store/orders/{oid}/receipt.pdf", headers=H("player"))
    assert pdf.status_code == 200 and pdf.headers["Content-Type"].startswith("application/pdf") and pdf.content.startswith(b"%PDF") and oid.encode() in pdf.content
    assert_error(app.get("/api/v1/store/orders/nope", headers=H("player")), 404, "ORDER_NOT_FOUND")
    assert_error(app.get("/api/v1/store/orders/nope/receipt.pdf", headers=H("player")), 404, "ORDER_NOT_FOUND")


@pytest.mark.api
@pytest.mark.req("APP-55")
def test_app_55_order_transitions_and_restock(app, api, H):
    api.post("/audit/v1/reset", json={"stock": {"var-jersey-001-M": 1}})
    oid = uid("app-tr")
    assert _checkout(app, H("viewer"), variant="var-jersey-001-M", oid=oid).status_code == 201
    inv = lambda: api.get("/audit/v1/inventory/var-jersey-001-M").json()["stock"]
    assert inv() == 0
    t = lambda role, to: app.post(f"/api/v1/store/orders/{oid}/transition", json={"to": to}, headers=H(role))
    assert_error(t("player", "packed"), 403, "FORBIDDEN")
    assert_error(t("viewer", "packed"), 403, "FORBIDDEN")
    assert_error(t("club_manager", "delivered"), 409, "ILLEGAL_TRANSITION")
    assert_error(t("club_manager", "bogus"), 400, "VALIDATION_ERROR", ["to"])
    assert t("club_manager", "packed").json()["status"] == "packed"
    assert t("super_admin", "cancelled").json()["status"] == "cancelled"
    assert inv() == 1  # cancelled before shipment → restocked
    assert_error(t("club_manager", "paid"), 409, "ILLEGAL_TRANSITION")
    assert_error(app.post("/api/v1/store/orders/nope/transition", json={"to": "packed"}, headers=H("club_manager")), 404, "ORDER_NOT_FOUND")


# ---- offline sync via the production route ---------------------------------------------------------------------------
def _act(aid, type_, payload, base=0, at="2026-10-17T11:00:00Z"):
    return {"action_id": aid, "type": type_, "queued_at": at, "base_version": base, "payload": payload}


@pytest.mark.api
@pytest.mark.req("APP-40")
def test_app_40_actions_are_authorized_like_their_online_equivalents(app, H):
    dev = uid("dev")
    score = {"event_id": uid("e"), "match_id": "demo-m2", "type": "score", "payload": {"team_id": "demo-wolves", "event_type": "goal"}}
    move = {"request_id": uid("tr"), "league_id": LA1, "player_id": "demo-p-3", "type": "transfer", "from_squad_id": "sq-alpha-2", "to_squad_id": "sq-alpha-1",
            "effective_date": "2026-10-20", "loan_end_date": None, "reason": "sync", "requested_by": "x"}
    acts = [_act("s1", "score_event", score, base=2), _act("r1", "roster_transfer", move, base=0, at="2026-10-17T11:01:00Z")]
    viewer = app.post("/api/v1/offline-sync", json={"device_id": dev, "actions": acts}, headers=H("viewer")).json()
    assert [(x["status"], x["error_code"]) for x in viewer["results"]] == [("rejected", "FORBIDDEN")] * 2
    org = app.post("/api/v1/offline-sync", json={"device_id": uid("dev"), "actions": acts}, headers=H("league_organizer")).json()
    assert [(x["action_id"], x["status"], x["error_code"]) for x in org["results"]] == [("s1", "applied", None), ("r1", "rejected", "FORBIDDEN")]
    mgr_dev = uid("dev")
    mgr = app.post("/api/v1/offline-sync", json={"device_id": mgr_dev, "actions": [_act("r2", "roster_transfer", dict(move, request_id=uid("tr")))]}, headers=H("club_manager")).json()
    assert mgr["results"][0]["status"] == "applied" and mgr["summary"] == {"applied": 1, "rejected": 0, "duplicate": 0}
    assert_error(app.post("/api/v1/offline-sync", json={"device_id": "d", "actions": []}, headers=H("viewer")), 400, "VALIDATION_ERROR", ["actions"])
    assert_error(app.post("/api/v1/offline-sync", json={"device_id": "d", "actions": []}), 401, "UNAUTHENTICATED")
