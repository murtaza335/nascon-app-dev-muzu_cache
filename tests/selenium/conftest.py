"""Selenium Grid 4 fixtures (day2/QA-HARNESS §1). Browsers run inside the grid network, so BASE_WEB is the compose service name."""
import fcntl
import os
import tempfile

import pytest
import requests
from selenium import webdriver

SELENIUM_URL = os.environ.get("SELENIUM_URL", "http://localhost:4444/wd/hub")
BASE_WEB = os.environ.get("BASE_WEB", "http://backend:8080")
API_BASE = os.environ.get("API_BASE", "http://localhost:8080")


def pytest_generate_tests(metafunc):
    if "browser" in metafunc.fixturenames:
        metafunc.parametrize("browser", ["chrome", "firefox"])


@pytest.fixture(scope="session", autouse=True)
def reset_once():
    """One /audit/v1/reset per session even under xdist (file lock), never per test."""
    lock = os.path.join(tempfile.gettempdir(), "nascon-selenium-reset.lock")
    with open(lock, "w") as fh:
        fcntl.flock(fh, fcntl.LOCK_EX)
        requests.post(f"{API_BASE}/audit/v1/reset", timeout=15)
        fcntl.flock(fh, fcntl.LOCK_UN)


@pytest.fixture
def driver(browser):
    opts = webdriver.ChromeOptions() if browser == "chrome" else webdriver.FirefoxOptions()
    opts.add_argument("--headless=new" if browser == "chrome" else "-headless")
    drv = webdriver.Remote(command_executor=SELENIUM_URL, options=opts)
    drv.implicitly_wait(0)
    try:
        yield drv
    finally:
        drv.quit()


@pytest.fixture
def base_web():
    return BASE_WEB.rstrip("/")


@pytest.fixture
def api_base():
    return API_BASE.rstrip("/")
