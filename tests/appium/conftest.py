"""Appium 2 fixtures. No device → tests skip with a reason (never faked as a pass)."""
import json
import os
import shutil
import subprocess

import pytest

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
