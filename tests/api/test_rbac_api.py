"""FR-5.1 RBAC: the graded 13-row probe matrix (65 cells), security probes, token issuance."""
import base64
import json

import pytest

from conftest import assert_error

ROLES = ["super_admin", "league_organizer", "club_manager", "player", "viewer"]

# (probe, method, path template, context key, expected allow per role in ROLES order) — REQUIREMENTS §2.1
CELLS = [
    ("P1", "post", "/audit/v1/rbac/tenants", None, "10000"),
    ("P2-own", "post", "/audit/v1/rbac/leagues/{}/fixtures", "own_league_id", "11000"),
    ("P2-other", "post", "/audit/v1/rbac/leagues/{}/fixtures", "other_league_id", "10000"),
    ("P2-foreign", "post", "/audit/v1/rbac/leagues/{}/fixtures", "foreign_league_id", "10000"),
    ("P3-own", "post", "/audit/v1/rbac/clubs/{}/roster", "own_club_id", "10100"),
    ("P3-other", "post", "/audit/v1/rbac/clubs/{}/roster", "other_club_id", "10000"),
    ("P3-foreign", "post", "/audit/v1/rbac/clubs/{}/roster", "foreign_club_id", "10000"),
    ("P4-own", "post", "/audit/v1/rbac/clubs/{}/products", "own_club_id", "10100"),
    ("P4-other", "post", "/audit/v1/rbac/clubs/{}/products", "other_club_id", "10000"),
    ("P4-foreign", "post", "/audit/v1/rbac/clubs/{}/products", "foreign_club_id", "10000"),
    ("P5-own", "patch", "/audit/v1/rbac/players/{}", "own_player_id", "10110"),
    ("P5-other", "patch", "/audit/v1/rbac/players/{}", "other_player_id", "10000"),
    ("P5-foreign", "patch", "/audit/v1/rbac/players/{}", "foreign_player_id", "10000"),
    ("P6-own", "get", "/audit/v1/rbac/clubs/{}", "own_club_id", "11111"),
    ("P6-other", "get", "/audit/v1/rbac/clubs/{}", "other_club_id", "11111"),
    ("P6-foreign", "get", "/audit/v1/rbac/clubs/{}", "foreign_club_id", "10000"),
    ("P7", "get", "/audit/v1/rbac/platform/config", None, "10000"),
]
CASES = [(c[0], c[1], c[2], c[3], role, c[4][i] == "1") for c in CELLS for i, role in enumerate(ROLES)]


@pytest.fixture(scope="module")
def matrix(api):
    resp = api.post("/audit/v1/rbac-matrix")
    assert resp.status_code == 200, resp.text
    return resp.json()


def b64(obj):
    return base64.urlsafe_b64encode(json.dumps(obj).encode()).rstrip(b"=").decode()


@pytest.mark.api
@pytest.mark.req("FR-5.1-02")
def test_fr_5_1_02_rbac_matrix_shape(matrix):
    assert list(matrix) == ["tokens", "context"]
    assert sorted(matrix["tokens"]) == sorted(ROLES)
    assert all(len(t.split(".")) == 3 for t in matrix["tokens"].values())
    assert matrix["context"] == {
        "tenant_id": "tenant-alpha", "foreign_tenant_id": "tenant-beta",
        "own_league_id": "league-alpha-1", "other_league_id": "league-alpha-2", "foreign_league_id": "league-beta-1",
        "own_club_id": "club-alpha-1", "other_club_id": "club-alpha-2", "foreign_club_id": "club-beta-1",
        "own_player_id": "player-alpha-1", "other_player_id": "player-alpha-2", "foreign_player_id": "player-beta-1",
    }


@pytest.mark.api
@pytest.mark.req("FR-5.1-01")
@pytest.mark.parametrize("probe,method,path,ctx_key,role,allowed", CASES, ids=[f"{c[0]}-{c[4]}" for c in CASES])
def test_fr_5_1_01_probe_matrix(api, matrix, probe, method, path, ctx_key, role, allowed):
    url = path.format(matrix["context"][ctx_key]) if ctx_key else path
    resp = getattr(api, method)(url, headers={"Authorization": f"Bearer {matrix['tokens'][role]}"}, json={})
    if allowed:
        assert resp.status_code == 200, resp.text
        assert resp.json() == {"authorized": True}
    else:
        assert_error(resp, 403, "FORBIDDEN")


@pytest.mark.api
@pytest.mark.req("NFR-5")
def test_nfr5_p7_without_header_401(api):
    assert_error(api.get("/audit/v1/rbac/platform/config"), 401, "UNAUTHENTICATED")


@pytest.mark.api
@pytest.mark.req("NFR-5")
def test_nfr5_tampered_signature_401(api, matrix):
    h, p, s = matrix["tokens"]["super_admin"].split(".")
    bad = f"{h}.{p}.{s[:-3]}{'AAA' if not s.endswith('AAA') else 'BBB'}"
    assert_error(api.get("/audit/v1/rbac/platform/config", headers={"Authorization": f"Bearer {bad}"}), 401, "UNAUTHENTICATED")


@pytest.mark.api
@pytest.mark.req("NFR-5")
def test_nfr5_alg_none_401(api, matrix):
    payload = matrix["tokens"]["super_admin"].split(".")[1]
    forged = f"{b64({'alg': 'none', 'typ': 'JWT'})}.{payload}."
    assert_error(api.get("/audit/v1/rbac/platform/config", headers={"Authorization": f"Bearer {forged}"}), 401, "UNAUTHENTICATED")


@pytest.mark.api
@pytest.mark.req("NFR-5")
@pytest.mark.parametrize("header", ["Bearer", "Bearer not.a.jwt", "Basic abc", "garbage", "Bearer a b"])
def test_nfr5_malformed_authorization_401(api, header):
    assert_error(api.get("/audit/v1/rbac/platform/config", headers={"Authorization": header}), 401, "UNAUTHENTICATED")


@pytest.mark.api
@pytest.mark.req("FR-5.1-01")
def test_fr_5_1_01_unknown_id_is_404_after_auth(api, matrix):
    h = {"Authorization": f"Bearer {matrix['tokens']['viewer']}"}
    assert_error(api.post("/audit/v1/rbac/leagues/nope/fixtures", headers=h), 404, "LEAGUE_NOT_FOUND")
    assert_error(api.get("/audit/v1/rbac/clubs/nope", headers=h), 404, "CLUB_NOT_FOUND")
    assert_error(api.patch("/audit/v1/rbac/players/nope", headers=h), 404, "PLAYER_NOT_FOUND")
    assert_error(api.get("/audit/v1/rbac/clubs/nope"), 401, "UNAUTHENTICATED")  # 401 outranks 404


@pytest.mark.api
@pytest.mark.req("FR-5.1-01")
def test_fr_5_1_01_probe_ignores_malformed_body(api, matrix):
    h = {"Authorization": f"Bearer {matrix['tokens']['super_admin']}", "Content-Type": "application/json"}
    resp = api.post("/audit/v1/rbac/tenants", data="{broken", headers=h)
    assert resp.status_code == 200 and resp.json() == {"authorized": True}


@pytest.mark.api
@pytest.mark.req("FR-5.1-02")
def test_fr_5_1_02_tokens_survive_reset(api, matrix):
    api.post("/audit/v1/reset")
    h = {"Authorization": f"Bearer {matrix['tokens']['league_organizer']}"}
    resp = api.post(f"/audit/v1/rbac/leagues/{matrix['context']['own_league_id']}/fixtures", headers=h)
    assert resp.status_code == 200
