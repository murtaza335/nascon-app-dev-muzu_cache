"""QA-01: Selenium Grid 4 hub is ready with at least three nodes."""
import os

import requests


def test_grid_ready_with_three_nodes():
    base = os.environ.get("SELENIUM_URL", "http://localhost:4444/wd/hub").split("/wd/hub")[0]
    v = requests.get(f"{base}/status", timeout=10).json()["value"]
    assert v["ready"] is True
    assert len(v["nodes"]) >= 3
