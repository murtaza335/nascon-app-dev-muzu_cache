"""FR-4.3 / FR-4.4 / API-D2-08 + EC-4, plus the guest product API."""
import threading

import pytest

from conftest import assert_error
from day2_helpers import GUEST, day2_sig

URL = "/audit/v1/guest/cart-merge"
L = "var-jersey-001-L"


@pytest.fixture(autouse=True)
def _reset(api):
    api.post("/audit/v1/reset")


def body(**kw):
    b = {"guest_token": "guest_anon_tok_7721", "registered_user_id": "player-alpha-1", "guest_cart": [{"variant_id": L, "quantity": 1}], "test_write_block": True}
    b.update(kw)
    return b


@pytest.mark.api
@pytest.mark.req("FR-4.4-02")
def test_merge_success_shape_and_signature(api):
    r = api.post(URL, json=body())
    assert r.status_code == 200, r.text
    j = r.json()
    assert j["write_block_verified"] is True and j["write_rejection_code"] == 403 and j["cart_merged"] is True
    assert j["active_cart"] == {"user_id": "player-alpha-1", "currency": "PKR", "total_items": 1, "subtotal_minor": 450000,
                                "items": [{"variant_id": L, "quantity": 1, "unit_price_minor": 450000}]}
    assert j["signature"] == day2_sig("guest_anon_tok_7721", {"cart_merged": True, "guest_token": "guest_anon_tok_7721", "registered_user_id": "player-alpha-1", "total_items": 1, "write_rejection_code": 403})


@pytest.mark.api
@pytest.mark.req("FR-4.4-02")
def test_write_block_off(api):
    j = api.post(URL, json=body(test_write_block=False)).json()
    assert j["write_block_verified"] is False and j["write_rejection_code"] is None
    assert j["signature"] == day2_sig("guest_anon_tok_7721", {"cart_merged": True, "guest_token": "guest_anon_tok_7721", "registered_user_id": "player-alpha-1", "total_items": 1, "write_rejection_code": None})


@pytest.mark.api
@pytest.mark.req("EC-4")
def test_replay_does_not_duplicate(api):
    first = api.post(URL, json=body(guest_cart=[{"variant_id": L, "quantity": 2}]))
    for _ in range(3):
        again = api.post(URL, json=body(guest_cart=[{"variant_id": L, "quantity": 2}]))
        assert again.status_code == 200 and again.json() == first.json()
    assert again.json()["active_cart"]["total_items"] == 2


@pytest.mark.api
@pytest.mark.req("EC-4")
def test_replay_survives_stock_exhaustion(api):
    first = api.post(URL, json=body(guest_cart=[{"variant_id": L, "quantity": 5}]))  # takes all available stock
    assert first.status_code == 200
    assert api.post(URL, json=body(guest_cart=[{"variant_id": L, "quantity": 5}])).status_code == 200


@pytest.mark.api
@pytest.mark.req("EC-4")
def test_concurrent_replays_merge_once(api):
    out = []
    def go():
        out.append(api.post(URL, json=body(guest_token="guest_race_1")).json())
    ts = [threading.Thread(target=go) for _ in range(8)]
    [t.start() for t in ts]; [t.join() for t in ts]
    assert {o["active_cart"]["total_items"] for o in out} == {1}


@pytest.mark.api
@pytest.mark.req("FR-4.4-02")
def test_other_user_or_payload_after_merge_409(api):
    api.post(URL, json=body())
    err = assert_error(api.post(URL, json=body(registered_user_id="player-alpha-2")), 409, "GUEST_TOKEN_ALREADY_MERGED")
    assert err["details"] == {"guest_token": "guest_anon_tok_7721", "merged_user_id": "player-alpha-1"}
    assert_error(api.post(URL, json=body(guest_cart=[{"variant_id": L, "quantity": 2}])), 409, "GUEST_TOKEN_ALREADY_MERGED")


@pytest.mark.api
@pytest.mark.req("FR-4.4-02")
def test_quantities_sum_and_accumulate_in_member_cart(api):
    j = api.post(URL, json=body(guest_cart=[{"variant_id": L, "quantity": 1}, {"variant_id": L, "quantity": 2}])).json()
    assert j["active_cart"]["items"] == [{"variant_id": L, "quantity": 3, "unit_price_minor": 450000}]
    j2 = api.post(URL, json=body(guest_token="guest_second", guest_cart=[{"variant_id": L, "quantity": 2}])).json()
    assert j2["active_cart"]["total_items"] == 5


@pytest.mark.api
@pytest.mark.req("FR-4.4-02")
def test_out_of_stock_is_atomic(api):
    err = assert_error(api.post(URL, json=body(guest_cart=[{"variant_id": L, "quantity": 1}, {"variant_id": "var-jersey-001-M", "quantity": 2}])), 409, "OUT_OF_STOCK")
    assert err["details"]["variant_id"] == "var-jersey-001-M" and err["details"]["available"] == 1
    assert api.post(URL, json=body(guest_token="guest_after")).json()["active_cart"]["total_items"] == 1  # nothing leaked from the failed merge


@pytest.mark.api
@pytest.mark.req("FR-4.4-02")
def test_not_found_before_stock_and_merge_state(api):
    assert_error(api.post(URL, json=body(registered_user_id="ghost")), 404, "PLAYER_NOT_FOUND")
    err = assert_error(api.post(URL, json=body(guest_cart=[{"variant_id": L, "quantity": 99}, {"variant_id": "var-ghost", "quantity": 1}])), 404, "VARIANT_NOT_FOUND")
    assert err["details"]["variant_id"] == "var-ghost"


@pytest.mark.api
@pytest.mark.req("FR-4.4-02")
@pytest.mark.parametrize("patch,fields", [
    ({"guest_token": "tok_1"}, ["guest_token"]), ({"guest_token": ""}, ["guest_token"]), ({"registered_user_id": 4}, ["registered_user_id"]),
    ({"guest_cart": []}, ["guest_cart"]), ({"guest_cart": [{"variant_id": L, "quantity": 0}]}, ["guest_cart[0].quantity"]),
    ({"guest_cart": [{"variant_id": L, "quantity": 1.5}]}, ["guest_cart[0].quantity"]), ({"guest_cart": [{"quantity": 1}]}, ["guest_cart[0].variant_id"]),
    ({"guest_cart": [{"variant_id": L, "quantity": 1}] * 11}, ["guest_cart"]), ({"test_write_block": "yes"}, ["test_write_block"]),
])
def test_validation(api, patch, fields):
    assert_error(api.post(URL, json=body(**patch)), 400, "VALIDATION_ERROR", fields=fields)


@pytest.mark.api
@pytest.mark.req("FR-4.3-02")
@pytest.mark.parametrize("method,path", [
    ("POST", "/api/v1/chat"), ("POST", "/audit/v1/checkout"), ("POST", "/audit/v1/events"), ("PUT", "/api/v1/athletes/player-alpha-1/follow"),
    ("DELETE", "/api/v1/athletes/player-alpha-1/follow"), ("POST", "/audit/v1/reset"), ("PATCH", "/api/v1/anything"),
])
def test_direct_writes_are_blocked_before_anything_else(api, method, path):
    r = api.request(method, path, data="not json", headers={**GUEST, "Content-Type": "application/json"})
    err = assert_error(r, 403, "GUEST_WRITE_FORBIDDEN")
    assert err["details"] == {"guest_token": "guest_anon_tok_7721"}
    assert err["message"] == "Anonymous guest tokens cannot perform write mutations."


@pytest.mark.api
@pytest.mark.req("FR-4.3-03")
def test_guest_can_read(api):
    assert api.get("/api/v1/public/matches/match-m1", headers=GUEST).status_code == 200
    assert api.get("/audit/v1/score/match-m1", headers=GUEST).status_code == 200


@pytest.mark.api
@pytest.mark.req("FR-4.2-02")
def test_guest_session_and_staged_cart(api):
    s = api.post("/api/v1/guest/session", json={}).json()
    assert s["guest_token"].startswith("guest_anon_tok_") and len(s["guest_token"]) == len("guest_anon_tok_") + 16
    assert s["role"] == "guest" and s["scopes"] == ["stream:read", "score:subscribe", "guest_cart:stage"]
    h = {"Authorization": f"Bearer {s['guest_token']}"}
    assert api.get("/api/v1/guest/cart", headers=h).json()["items"] == []
    c = api.post("/api/v1/guest/cart/items", headers=h, json={"variant_id": L, "quantity": 2}).json()
    assert c["total_items"] == 2 and c["subtotal_minor"] == 900000
    assert_error(api.post("/api/v1/guest/cart/items", headers=h, json={"variant_id": "ghost", "quantity": 1}), 404, "VARIANT_NOT_FOUND")
    assert_error(api.post("/api/v1/guest/cart/items", headers=h, json={"variant_id": L, "quantity": 9}), 409, "OUT_OF_STOCK")
    assert_error(api.post("/api/v1/guest/cart/items", headers=h, json={"variant_id": L, "quantity": 0}), 400, "VALIDATION_ERROR")
    assert api.delete(f"/api/v1/guest/cart/items/{L}", headers=h).json()["items"] == []
    assert_error(api.get("/api/v1/guest/cart"), 401, "UNAUTHENTICATED")


@pytest.mark.api
@pytest.mark.req("FR-4.4-01")
def test_register_then_merge_staged_cart(api):
    s = api.post("/api/v1/guest/session", json={}).json()["guest_token"]
    gh = {"Authorization": f"Bearer {s}"}
    api.post("/api/v1/guest/cart/items", headers=gh, json={"variant_id": L, "quantity": 2})
    email = f"reg-{s[-8:]}@example.com"
    reg = api.post("/api/v1/auth/register", json={"email": email, "password": "password1", "display_name": "Reg"})
    assert reg.status_code == 201 and reg.json()["user"]["role"] == "viewer"
    assert_error(api.post("/api/v1/auth/register", json={"email": email, "password": "password1", "display_name": "Reg"}), 400, "VALIDATION_ERROR", fields=["email"])
    assert_error(api.post("/api/v1/auth/register", json={"email": "x@y.z", "password": "short", "display_name": "R"}), 400, "VALIDATION_ERROR", fields=["password"])
    mh = {"Authorization": f"Bearer {reg.json()['token']}"}
    m = api.post("/api/v1/guest/cart/merge", headers=mh, json={"guest_token": s, "return_to": "/web/matches/match-m1/live?t=42"})
    assert m.status_code == 200 and m.json()["return_to"] == "/web/matches/match-m1/live?t=42" and m.json()["active_cart"]["total_items"] == 2
    assert api.post("/api/v1/guest/cart/merge", headers=mh, json={"guest_token": s}).json()["active_cart"]["total_items"] == 2  # replay
    assert api.get("/api/v1/cart", headers=mh).json()["total_items"] == 2
    assert_error(api.post("/api/v1/guest/cart/merge", json={"guest_token": s}), 401, "UNAUTHENTICATED")
