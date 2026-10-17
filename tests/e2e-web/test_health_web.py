"""Optional Selenium smoke: a browser container can reach the backend by service name."""
import os

import pytest

pytestmark = [pytest.mark.web, pytest.mark.req("REQ-00")]


def test_req00_health_in_browser(driver):
    base = os.environ.get("BROWSER_BASE_URL", "http://backend:3000").rstrip("/")
    driver.get(f"{base}/health")
    assert "ok" in driver.page_source
