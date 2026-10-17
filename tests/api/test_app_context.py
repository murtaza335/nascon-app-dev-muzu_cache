"""APP-03 discovery; no reset or synthetic client dataset is needed."""
import pytest
from conftest import assert_error

@pytest.mark.api
@pytest.mark.req("APP-03")
@pytest.mark.parametrize("role", ["viewer", "player", "club_manager", "league_organizer", "super_admin"])
def test_context_scope(app, H, role):
    response = app.get("/api/v1/context", headers=H(role))
    assert response.status_code == 200, response.text
    data = response.json()
    assert set(data) == {"tenants", "clubs", "squads", "sports", "players", "registrations"}
    if role != "super_admin":
        for key in ("tenants", "clubs", "squads"):
            assert all(row["tenant_id"] == "tenant-alpha" for row in data[key])
    assert all("config" in sport for sport in data["sports"])

@pytest.mark.api
@pytest.mark.req("APP-03")
def test_context_auth_and_errors(app, H):
    assert_error(app.get("/api/v1/context"), 401, "UNAUTHENTICATED")
    assert_error(app.get("/api/v1/context?tenant_id=tenant-beta", headers=H("viewer")), 403, "FORBIDDEN")
    assert_error(app.get("/api/v1/context?tenant_id=missing", headers=H("super_admin")), 404, "TENANT_NOT_FOUND")
    assert_error(app.get("/api/v1/context?tenant_id=bad%20id", headers=H("super_admin")), 400, "VALIDATION_ERROR", ["tenant_id"])
    response = app.get("/api/v1/context?tenant_id=tenant-beta", headers=H("super_admin"))
    assert response.status_code == 200
    assert all(row["tenant_id"] == "tenant-beta" for row in response.json()["clubs"])
