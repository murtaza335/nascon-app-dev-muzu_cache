"""FR-2.3-02/03 NFR-3 API-12/13: checkout, receipt, inventory, concurrency."""
import base64
import hashlib
import hmac
import io
import json
import os
import threading
import time
import uuid

import pytest
from pypdf import PdfReader

from conftest import assert_error

SALT = os.environ.get("DAY1_SALT", "dev-salt")
M, L = "var-jersey-001-M", "var-jersey-001-L"


def canonical(obj):
    return json.dumps(obj, sort_keys=True, separators=(",", ":"), ensure_ascii=False)


def order(items=None, token="tok_success", code=None, oid=None, cust="cust-001"):
    return {"order_id": oid or "ord-" + uuid.uuid4().hex[:10], "customer_id": cust,
            "items": items or [{"variant_id": M, "quantity": 1}], "discount_code": code, "payment": {"token": token}}


def inv(api, vid):
    r = api.get(f"/audit/v1/inventory/{vid}")
    assert r.status_code == 200, r.text
    return r.json()


@pytest.fixture(autouse=True)
def fresh(api):
    api.post("/audit/v1/reset", json={"stock": {M: 3, L: 5}})


@pytest.mark.api
@pytest.mark.req("FR-2.3-02")
def test_fr_2_3_02_success_shape_signature_and_ids(api):
    b = order(oid="ord-001")
    r = api.post("/audit/v1/checkout", json=b)
    assert r.status_code == 201, r.text
    out = r.json()
    assert list(out) == ["order_id", "status", "currency", "items", "subtotal_minor", "discount_minor", "total_minor", "payment", "receipt"]
    assert (out["status"], out["currency"], out["subtotal_minor"], out["discount_minor"], out["total_minor"]) == ("paid", "PKR", 450000, 0, 450000)
    assert out["items"] == [{"variant_id": M, "quantity": 1, "unit_price_minor": 450000}]
    assert out["payment"] == {"authorization_id": "auth_1", "capture_id": "cap_1", "state": "captured"}
    p = out["receipt"]["payload"]
    assert list(p) == ["order_id", "customer_id", "items", "subtotal_minor", "discount_minor", "total_minor", "currency", "paid_at"]
    assert p["paid_at"].endswith("Z") and len(p["paid_at"]) == 20
    want = hmac.new(SALT.encode(), f"ord-001|{canonical(p)}".encode(), hashlib.sha256).hexdigest()
    assert out["receipt"]["signature"] == want
    assert inv(api, M) == {"variant_id": M, "stock": 2, "reserved": 0}


@pytest.mark.api
@pytest.mark.req("FR-2.3-02")
def test_fr_2_3_02_pdf_is_valid_and_contains_order_id_and_total(api):
    r = api.post("/audit/v1/checkout", json=order(oid="ord-pdf-1"))
    pdf = base64.b64decode(r.json()["receipt"]["pdf_base64"])
    assert pdf.startswith(b"%PDF")
    text = "".join(page.extract_text() for page in PdfReader(io.BytesIO(pdf)).pages)
    assert "ord-pdf-1" in text and "PKR 4500.00" in text
    assert b"PKR 4500.00" in pdf and b"ord-pdf-1" in pdf


@pytest.mark.api
@pytest.mark.req("FR-2.3-02")
def test_fr_2_3_02_discount_and_multi_item_math(api):
    items = [{"variant_id": M, "quantity": 2}, {"variant_id": L, "quantity": 1}]
    r = api.post("/audit/v1/checkout", json=order(items, code="WELCOME10"))
    out = r.json()
    assert (out["subtotal_minor"], out["discount_minor"], out["total_minor"]) == (1350000, 135000, 1215000)
    assert out["receipt"]["payload"]["total_minor"] == 1215000
    pdf = base64.b64decode(out["receipt"]["pdf_base64"])
    assert b"PKR 12150.00" in pdf
    assert (inv(api, M)["stock"], inv(api, L)["stock"]) == (1, 4)


@pytest.mark.api
@pytest.mark.req("FR-2.3-02")
def test_fr_2_3_02_replay_and_duplicate_order_id(api):
    b = order(oid="ord-replay")
    first = api.post("/audit/v1/checkout", json=b)
    again = api.post("/audit/v1/checkout", json=b)
    assert (first.status_code, again.status_code) == (201, 200)
    assert first.json() == again.json()
    assert inv(api, M)["stock"] == 2  # no second reservation
    changed = dict(b, items=[{"variant_id": M, "quantity": 2}])
    assert_error(api.post("/audit/v1/checkout", json=changed), 409, "DUPLICATE_ORDER_ID")
    assert_error(api.post("/audit/v1/checkout", json=dict(b, customer_id="someone-else")), 409, "DUPLICATE_ORDER_ID")


@pytest.mark.api
@pytest.mark.req("FR-2.3-02")
def test_fr_2_3_02_error_precedence_400_404_400_409(api):
    assert_error(api.post("/audit/v1/checkout", json={}), 400, "VALIDATION_ERROR", ["order_id", "customer_id", "items", "payment"])
    bad = order([{"variant_id": "nope", "quantity": 1}], code="NOPE")
    err = assert_error(api.post("/audit/v1/checkout", json=bad), 404, "VARIANT_NOT_FOUND")
    assert err["details"]["variant_id"] == "nope"
    assert_error(api.post("/audit/v1/checkout", json=order(code="NOPE")), 400, "INVALID_DISCOUNT_CODE")
    assert_error(api.post("/audit/v1/checkout", json=order(code="")), 400, "INVALID_DISCOUNT_CODE")
    big = order([{"variant_id": L, "quantity": 6}], code="NOPE")
    assert_error(api.post("/audit/v1/checkout", json=big), 400, "INVALID_DISCOUNT_CODE")  # discount before stock
    assert_error(api.post("/audit/v1/checkout", json=order([{"variant_id": L, "quantity": 6}])), 409, "OUT_OF_STOCK")


@pytest.mark.api
@pytest.mark.req("FR-2.3-02")
@pytest.mark.parametrize("mut,fields", [
    (lambda b: b["items"][0].update(quantity=0), ["items[0].quantity"]),
    (lambda b: b["items"][0].update(quantity=11), ["items[0].quantity"]),
    (lambda b: b["items"][0].update(quantity=1.5), ["items[0].quantity"]),
    (lambda b: b["items"][0].update(quantity="1"), ["items[0].quantity"]),
    (lambda b: b.update(items=[]), ["items"]),
    (lambda b: b.update(items=[{"variant_id": M, "quantity": 1}] * 2), ["items[1].variant_id"]),
    (lambda b: b.update(items=[{"variant_id": f"v{i}", "quantity": 1} for i in range(11)]), ["items"]),
    (lambda b: b["payment"].update(token="tok_other"), ["payment.token"]),
    (lambda b: b.pop("payment"), ["payment"]), (lambda b: b.update(order_id="a|b"), ["order_id"]),
    (lambda b: b.update(discount_code=5), ["discount_code"]),
])
def test_fr_2_3_02_validation_400(api, mut, fields):
    b = order()
    mut(b)
    assert_error(api.post("/audit/v1/checkout", json=b), 400, "VALIDATION_ERROR", fields)


@pytest.mark.api
@pytest.mark.req("FR-2.3-02")
def test_fr_2_3_02_out_of_stock_reserves_nothing_for_any_item(api):
    items = [{"variant_id": L, "quantity": 2}, {"variant_id": M, "quantity": 4}]
    err = assert_error(api.post("/audit/v1/checkout", json=order(items)), 409, "OUT_OF_STOCK")
    assert err["details"] == {"variant_id": M}
    assert (inv(api, L), inv(api, M)) == ({"variant_id": L, "stock": 5, "reserved": 0}, {"variant_id": M, "stock": 3, "reserved": 0})


@pytest.mark.api
@pytest.mark.req("FR-2.3-02")
@pytest.mark.parametrize("token,code", [("tok_declined", "PAYMENT_DECLINED"), ("tok_capture_fail", "PAYMENT_CAPTURE_FAILED")])
def test_fr_2_3_02_payment_failures_release_stock_and_free_the_order_id(api, token, code):
    oid = "ord-" + uuid.uuid4().hex[:8]
    assert_error(api.post("/audit/v1/checkout", json=order(token=token, oid=oid)), 402, code)
    assert inv(api, M) == {"variant_id": M, "stock": 3, "reserved": 0}
    r = api.post("/audit/v1/checkout", json=order(oid=oid))  # no order was created, so the id is free
    assert r.status_code == 201 and r.json()["payment"]["authorization_id"] == "auth_1"
    assert inv(api, M)["stock"] == 2


@pytest.mark.api
@pytest.mark.req("FR-2.3-03")
def test_fr_2_3_03_inventory(api):
    assert inv(api, L) == {"variant_id": L, "stock": 5, "reserved": 0}
    err = assert_error(api.get("/audit/v1/inventory/nope"), 404, "VARIANT_NOT_FOUND")
    assert err["details"]["variant_id"] == "nope"


@pytest.mark.api
@pytest.mark.req("FR-2.3-02")
def test_fr_2_3_02_gateway_ids_are_per_reset_counters(api):
    ids = [api.post("/audit/v1/checkout", json=order()).json()["payment"] for _ in range(3)]
    assert [p["authorization_id"] for p in ids] == ["auth_1", "auth_2", "auth_3"]
    assert [p["capture_id"] for p in ids] == ["cap_1", "cap_2", "cap_3"]
    api.post("/audit/v1/reset")
    assert api.post("/audit/v1/checkout", json=order()).json()["payment"]["authorization_id"] == "auth_1"


@pytest.mark.api
@pytest.mark.req("NFR-3")
def test_nfr3_burst_20_on_last_unit_repeated(api):
    for rep in range(20):
        api.post("/audit/v1/reset", json={"stock": {M: 1}})
        barrier = threading.Barrier(20)
        results = [None] * 20

        def buy(i):
            barrier.wait()
            results[i] = api.post("/audit/v1/checkout", json=order(oid=f"burst-{rep}-{i}", cust=f"c{i}"))

        start = time.time()
        threads = [threading.Thread(target=buy, args=(i,)) for i in range(20)]
        for t in threads:
            t.start()
        for t in threads:
            t.join()
        assert time.time() - start < 10
        codes = sorted(r.status_code for r in results)
        assert codes == [201] + [409] * 19, f"rep {rep}: {codes}"
        assert all(r.json()["error"]["code"] == "OUT_OF_STOCK" for r in results if r.status_code == 409)
        assert inv(api, M) == {"variant_id": M, "stock": 0, "reserved": 0}


@pytest.mark.api
@pytest.mark.req("NFR-3")
def test_nfr3_same_order_id_in_parallel_creates_one_order(api):
    api.post("/audit/v1/reset", json={"stock": {M: 5}})
    b = order(oid="ord-par-same")
    barrier = threading.Barrier(8)
    out = []

    def go():
        barrier.wait()
        out.append(api.post("/audit/v1/checkout", json=b))

    ts = [threading.Thread(target=go) for _ in range(8)]
    for t in ts:
        t.start()
    for t in ts:
        t.join()
    assert sorted(r.status_code for r in out) == [200] * 7 + [201]
    assert len({r.text for r in out}) == 1
    assert inv(api, M)["stock"] == 4


@pytest.mark.api
@pytest.mark.req("NFR-3")
def test_nfr3_parallel_multi_item_orders_never_oversell_or_deadlock(api):
    api.post("/audit/v1/reset", json={"stock": {M: 4, L: 4}})
    barrier = threading.Barrier(12)
    out = []

    def go(i):
        barrier.wait()
        items = [{"variant_id": M, "quantity": 1}, {"variant_id": L, "quantity": 1}] if i % 2 == 0 else [{"variant_id": L, "quantity": 1}, {"variant_id": M, "quantity": 1}]
        out.append(api.post("/audit/v1/checkout", json=order(items, oid=f"mi-{i}-{uuid.uuid4().hex[:4]}")))

    ts = [threading.Thread(target=go, args=(i,)) for i in range(12)]
    for t in ts:
        t.start()
    for t in ts:
        t.join()
    assert sorted(r.status_code for r in out) == [201] * 4 + [409] * 8
    assert inv(api, M)["stock"] == 0 and inv(api, L)["stock"] == 0
