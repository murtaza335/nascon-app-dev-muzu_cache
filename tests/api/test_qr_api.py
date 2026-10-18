"""FR-4.1 / API-D2-05..07 + EC-2."""
import re
import struct

import pytest

from conftest import assert_error
from day2_helpers import day1_sig, day2_sig, uid

QR = "/audit/v1/qr"


@pytest.fixture(autouse=True)
def _reset(api):
    api.post("/audit/v1/reset")


def scan_total(api):
    m = re.search(r"^nascon_qr_scans_total (\d+)$", api.get("/metrics").text, re.M)
    return int(m.group(1))


@pytest.mark.api
@pytest.mark.req("FR-4.1-01")
def test_match_metadata_and_signature(api):
    r = api.get(f"{QR}/match-m1")
    assert r.status_code == 200
    j = r.json()
    assert j["entity_type"] == "match" and j["entity_status"] == "in_progress"
    assert j["short_url"] == "http://localhost:8080/q/m1-live" and j["target_route"] == "/web/matches/match-m1/live"
    assert j["deep_link_uri"] == "nascon://entity/match-m1" and j["scan_count"] == 1
    assert j["export_formats"] == {f: f"http://localhost:8080/audit/v1/qr/match-m1/export.{f}" for f in ("svg", "png", "pdf")}
    assert j["signature"] == day2_sig("match-m1", {"entity_id": "match-m1", "short_url": j["short_url"], "target_route": j["target_route"]})


@pytest.mark.api
@pytest.mark.req("FR-4.1-01")
def test_inspect_never_increments_and_scan_does(api):
    assert api.get(f"{QR}/match-m1?inspect=true").json()["scan_count"] == 0
    assert api.get(f"{QR}/match-m1?inspect=true").json()["scan_count"] == 0
    assert api.get(f"{QR}/match-m1").json()["scan_count"] == 1
    assert api.get(f"{QR}/match-m1").json()["scan_count"] == 2
    assert api.get(f"{QR}/match-m1?inspect=true").json()["scan_count"] == 2
    assert scan_total(api) == 2


@pytest.mark.api
@pytest.mark.req("FR-4.1-01")
def test_player_club_and_seeded_codes(api):
    p = api.get(f"{QR}/player-alpha-1?inspect=true").json()
    assert (p["entity_type"], p["entity_status"], p["short_url"], p["target_route"]) == ("player", "active", "http://localhost:8080/q/p-alpha-1", "/web/players/player-alpha-1")
    c = api.get(f"{QR}/club-alpha-1?inspect=true").json()
    assert (c["short_url"], c["target_route"]) == ("http://localhost:8080/q/c-alpha-1", "/web/clubs/club-alpha-1")


@pytest.mark.api
@pytest.mark.req("FR-4.1-06")
def test_lazy_code_is_stable(api):
    a = api.get(f"{QR}/player-beta-2?inspect=true").json()["short_url"]
    b = api.get(f"{QR}/player-beta-2?inspect=true").json()["short_url"]
    assert a == b and re.fullmatch(r"http://localhost:8080/q/[a-z2-7]{10}", a)


@pytest.mark.api
@pytest.mark.req("FR-4.1-01")
def test_unknown_entities_404(api):
    for e in ("match-ghost", "player-ghost", "club-ghost", "cs-session-ghost", "random-thing"):
        assert_error(api.get(f"{QR}/{e}"), 404, "QR_NOT_FOUND")


@pytest.mark.api
@pytest.mark.req("FR-4.1-04")
def test_short_link_redirects_and_counts(api):
    r = api.get("/q/m1-live", allow_redirects=False, headers={"User-Agent": "Mozilla/5.0 (Android) Mobile"})
    assert r.status_code == 302 and r.headers["Location"] == "/web/matches/match-m1/live" and r.headers["Cache-Control"] == "no-store"
    assert api.get(f"{QR}/match-m1?inspect=true").json()["scan_count"] == 1
    assert_error(api.get("/q/does-not-exist", allow_redirects=False), 404, "QR_NOT_FOUND")


@pytest.mark.api
@pytest.mark.req("EC-2")
@pytest.mark.parametrize("etype,route", [
    ("match_postponed", "/web/matches/{m}/notice?state=postponed"), ("match_cancelled", "/web/matches/{m}/notice?state=cancelled"),
    ("match_abandoned", "/web/matches/{m}/notice?state=abandoned"), ("match_end", "/web/matches/{m}/vod"),
])
def test_target_mutation_after_event(api, etype, route):
    m = uid("match")
    assert api.post("/audit/v1/events", json={"event_id": uid("e"), "match_id": m, "type": "match_init", "payload": {"sport_id": "football", "home_team_id": "club-alpha-1", "away_team_id": "club-alpha-2"}}).status_code == 201
    first = api.get(f"{QR}/{m}?inspect=true").json()
    assert first["target_route"] == f"/web/matches/{m}/preview" and first["entity_status"] == "upcoming"
    if etype == "match_end":
        assert api.post("/audit/v1/events", json={"event_id": uid("e"), "match_id": m, "type": "match_start", "payload": {}}).status_code == 201
        assert api.get(f"{QR}/{m}?inspect=true").json()["target_route"] == f"/web/matches/{m}/live"
    r = api.post("/audit/v1/events", json={"event_id": uid("e"), "match_id": m, "type": etype, "payload": {}})
    assert r.status_code == 201, r.text
    after = api.get(f"{QR}/{m}?inspect=true").json()
    assert after["target_route"] == route.format(m=m) and after["short_url"] == first["short_url"] and after["signature"] != first["signature"]
    assert api.get(after["short_url"].replace("http://localhost:8080", ""), allow_redirects=False).headers["Location"] == route.format(m=m)


@pytest.mark.api
@pytest.mark.req("BR-QR-05")
def test_lifecycle_aliases_and_terminal_state(api):
    m = uid("match")
    api.post("/audit/v1/events", json={"event_id": uid("e"), "match_id": m, "type": "match_init", "payload": {"sport_id": "football", "home_team_id": "club-alpha-1", "away_team_id": "club-alpha-2"}})
    r = api.post("/audit/v1/events", json={"event_id": uid("e"), "match_id": m, "type": "status_change", "payload": {"status": "cancelled"}})
    assert r.status_code == 201 and r.json()["type"] == "match_cancelled"
    assert api.get(f"/audit/v1/score/{m}").json()["status"] == "cancelled"
    assert_error(api.post("/audit/v1/events", json={"event_id": uid("e"), "match_id": m, "type": "match_postpone", "payload": {}}), 409, "ILLEGAL_TRANSITION")
    assert_error(api.post("/audit/v1/events", json={"event_id": uid("e"), "match_id": m, "type": "match_start", "payload": {}}), 409, "ILLEGAL_TRANSITION")


@pytest.mark.api
@pytest.mark.req("FR-4.1-03")
def test_exports(api):
    svg = api.get(f"{QR}/match-m1/export.svg")
    assert svg.status_code == 200 and svg.headers["Content-Type"].startswith("image/svg+xml") and svg.text.startswith("<svg")
    assert "http://localhost:8080/q/m1-live" in svg.text
    png = api.get(f"{QR}/match-m1/export.png")
    assert png.status_code == 200 and png.headers["Content-Type"] == "image/png" and png.content[:8] == b"\x89PNG\r\n\x1a\n"
    w, h = struct.unpack(">II", png.content[16:24])
    assert w == h and w >= (21 + 8) * 4
    pdf = api.get(f"{QR}/match-m1/export.pdf")
    assert pdf.status_code == 200 and pdf.headers["Content-Type"] == "application/pdf" and pdf.content.startswith(b"%PDF-")
    assert b"match-m1" in pdf.content and b"http://localhost:8080/q/m1-live" in pdf.content
    assert api.get(f"{QR}/match-m1?inspect=true").json()["scan_count"] == 0  # exports are not scans
    assert_error(api.get(f"{QR}/ghost-1/export.svg"), 404, "QR_NOT_FOUND")
    assert_error(api.get(f"{QR}/match-m1/export.gif"), 404, "ROUTE_NOT_FOUND")


@pytest.mark.api
@pytest.mark.req("FR-4.1-05")
def test_no_pii_in_telemetry_responses(api):
    api.get("/q/m1-live", allow_redirects=False, headers={"User-Agent": "SecretAgent/9.9", "X-Forwarded-For": "203.0.113.9"})
    text = api.get(f"{QR}/match-m1?inspect=true").text + api.get("/metrics").text
    assert "SecretAgent" not in text and "203.0.113.9" not in text
