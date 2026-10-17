"""Placeholder Appium smoke. Skipped unless APPIUM_URL is reachable.

Run: appium (in another terminal), phone on USB with `adb devices` showing `device`,
APP_PATH=mobile/android/app/build/outputs/apk/debug/app-debug.apk pytest tests/e2e-mobile
"""
import pytest

pytestmark = [pytest.mark.mobile, pytest.mark.req("REQ-00")]


def test_req00_app_launches(appium_driver):
    # Replace with real screen checks on the day, e.g. find by accessibility id.
    assert appium_driver.session_id
    assert appium_driver.current_package
