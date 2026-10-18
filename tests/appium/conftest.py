"""Appium 2 fixtures. No device → tests skip with a reason (never faked as a pass)."""
import json
import os
import shutil
import subprocess

import pytest
import requests
from appium import webdriver
from appium.options.android import UiAutomator2Options

APPIUM_URL = os.environ.get("APPIUM_URL", "http://localhost:4723")


def adb_devices():
    if not shutil.which("adb"):
        return []
    out = subprocess.run(["adb", "devices"], capture_output=True, text=True, timeout=10).stdout.splitlines()[1:]
    return [l.split()[0] for l in out if l.strip().endswith("device")]


@pytest.fixture(scope="session")
def device():
    d = adb_devices()
    if not d:
        pytest.skip("no device: no Android device or emulator is attached to adb")
    return d[0]


@pytest.fixture(scope="session")
def app_package():
    here = os.path.join(os.path.dirname(__file__), "..", "..", "mobile", "app.json")
    try:
        with open(here, encoding="utf-8") as fh:
            return json.load(fh)["expo"]["android"]["package"]
    except (OSError, KeyError):
        return os.environ.get("APP_PACKAGE", "com.nascon.league")


@pytest.fixture
def mobile_driver(device, app_package):
    """Attach to the installed Android build and expose real UI elements to Appium tests."""
    try:
        response = requests.get(f"{APPIUM_URL}/status", timeout=5)
    except requests.RequestException as exc:
        pytest.skip(f"Appium is unavailable ({exc.__class__.__name__}).")
    if response.status_code != 200 or response.json().get("value", {}).get("ready") is not True:
        pytest.skip("Appium is not ready; start Appium 2 and its UiAutomator2 driver.")

    options = UiAutomator2Options()
    options.platform_name = "Android"
    options.automation_name = "UiAutomator2"
    options.device_name = device
    options.app_package = app_package
    options.app_activity = ".MainActivity"
    options.no_reset = False
    options.auto_grant_permissions = True
    options.new_command_timeout = 120
    driver = webdriver.Remote(command_executor=APPIUM_URL, options=options)
    driver.implicitly_wait(0)
    try:
        yield driver
    finally:
        driver.quit()
