"""Spec §6.3: Appium status, then both nascon:// deep links bring the app to the foreground within 2 s."""
import subprocess
import time

import pytest
import requests
from appium.webdriver.common.appiumby import AppiumBy
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.support.ui import WebDriverWait

from conftest import APPIUM_URL

LINKS = [("nascon://entity/match-m1", "match-live-screen"), ("nascon://stream/cs-session-101", "costream-screen")]


def test_appium_server_ready():
    try:
        r = requests.get(f"{APPIUM_URL}/status", timeout=5)
    except requests.RequestException as exc:
        pytest.skip(f"appium server not running ({exc.__class__.__name__}); start it with scripts/appium-up.sh")
    assert r.status_code == 200 and r.json()["value"]["ready"] is True


@pytest.mark.parametrize("url,testid", LINKS)
def test_deep_link_opens_expected_screen_within_2s(device, app_package, mobile_driver, url, testid):
    subprocess.run(["adb", "-s", device, "shell", "am", "force-stop", app_package], check=True, timeout=10)
    t0 = time.perf_counter()
    out = subprocess.run(["adb", "-s", device, "shell", "am", "start", "-W", "-a", "android.intent.action.VIEW", "-d", url],
                         capture_output=True, text=True, timeout=15).stdout
    assert "Error" not in out and "Status: ok" in out, out
    assert time.perf_counter() - t0 < 2.0
    focus = subprocess.run(["adb", "-s", device, "shell", "dumpsys", "window", "windows"], capture_output=True, text=True, timeout=10).stdout
    assert app_package in focus, "app is not in the foreground"
    WebDriverWait(mobile_driver, 2).until(EC.presence_of_element_located((AppiumBy.ACCESSIBILITY_ID, testid)))
