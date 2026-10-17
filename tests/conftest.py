"""Shared fixtures for every test suite. Configuration comes from env vars (see .env.example)."""
import os
import socket
from urllib.parse import urlparse

import pytest
import requests

DEFAULT_TIMEOUT = 10
_REQS_TOUCHED = set()


def _reachable(url, timeout=2.0):
    parsed = urlparse(url)
    try:
        with socket.create_connection((parsed.hostname, parsed.port or 80), timeout=timeout):
            return True
    except OSError:
        return False


class ApiClient(requests.Session):
    """requests.Session that prefixes the base URL and always applies a timeout."""

    def __init__(self, base_url):
        super().__init__()
        self.base_url = base_url.rstrip("/")

    def request(self, method, url, *args, **kwargs):
        kwargs.setdefault("timeout", DEFAULT_TIMEOUT)
        if url.startswith("/"):
            url = self.base_url + url
        return super().request(method, url, *args, **kwargs)


@pytest.fixture(scope="session")
def base_url():
    return os.environ.get("BASE_URL", "http://localhost:8080").rstrip("/")


@pytest.fixture(scope="session")
def api(base_url):
    with ApiClient(base_url) as session:
        yield session


@pytest.fixture
def driver():
    selenium_url = os.environ.get("SELENIUM_URL", "http://localhost:4444")
    if not _reachable(selenium_url):
        pytest.skip(f"Selenium hub not reachable at {selenium_url}")
    from selenium import webdriver

    options = webdriver.ChromeOptions()
    options.add_argument("--headless=new")
    drv = webdriver.Remote(command_executor=selenium_url, options=options)
    try:
        yield drv
    finally:
        drv.quit()


@pytest.fixture
def appium_driver():
    appium_url = os.environ.get("APPIUM_URL", "http://localhost:4723")
    if not _reachable(appium_url):
        pytest.skip(f"Appium server not reachable at {appium_url}")
    from appium import webdriver
    from appium.options.android import UiAutomator2Options

    options = UiAutomator2Options()
    options.platform_name = "Android"
    options.automation_name = "UiAutomator2"
    app_path = os.environ.get("APP_PATH")
    if app_path:
        options.app = os.path.abspath(app_path)
    drv = webdriver.Remote(appium_url, options=options)
    try:
        yield drv
    finally:
        drv.quit()


def pytest_collection_modifyitems(config, items):
    for item in items:
        for mark in item.iter_markers(name="req"):
            if mark.args:
                _REQS_TOUCHED.add(mark.args[0])


def pytest_terminal_summary(terminalreporter):
    if _REQS_TOUCHED:
        terminalreporter.write_sep("=", "requirements touched")
        terminalreporter.write_line(", ".join(sorted(_REQS_TOUCHED)))

