"""Spec §6.3: the Android app joins a co-stream and its chat reaches a Selenium guest."""
import os
import subprocess
import time
import uuid

import pytest
import requests
from appium.webdriver.common.appiumby import AppiumBy
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.support.ui import WebDriverWait

API = os.environ.get("API_BASE", "http://10.195.242.35:8080")
SELENIUM = os.environ.get("SELENIUM_URL", "http://localhost:4444/wd/hub")
BASE_WEB = os.environ.get("BASE_WEB", "http://10.195.242.35:8080")
PLAYER_EMAIL = os.environ.get("DAY2_TEST_PLAYER_EMAIL", "player@nascon.test")
PLAYER_PASSWORD = os.environ.get("DAY2_TEST_PLAYER_PASSWORD", "Nascon@26")


def test_android_co_stream_chat_reaches_guest_browser(mobile_driver):
    reset = requests.post(f"{API}/audit/v1/reset", timeout=15)
    assert reset.status_code == 200
    created = requests.post(
        f"{API}/audit/v1/costream/session",
        json={"session_id": "cs-session-101", "host_player_id": "player-beta-1",
              "participants": ["player-beta-1"]},
        timeout=10,
    )
    assert created.status_code in (200, 201), created.text
    admin = requests.post(
        f"{API}/api/v1/auth/login",
        json={"email": "admin@nascon.test", "password": PLAYER_PASSWORD},
        timeout=10,
    )
    assert admin.status_code == 200, admin.text
    invite = requests.post(
        f"{API}/api/v1/costreams/cs-session-101/invites",
        headers={"Authorization": f"Bearer {admin.json()['token']}"},
        json={"player_id": "player-alpha-1"},
        timeout=10,
    )
    assert invite.status_code == 201, invite.text

    # Authenticate through the actual mobile UI, then enter the seeded room by its public deep link.
    WebDriverWait(mobile_driver, 8).until(
        EC.presence_of_element_located((AppiumBy.ACCESSIBILITY_ID, "Email address"))
    ).send_keys(PLAYER_EMAIL)
    mobile_driver.find_element(AppiumBy.ACCESSIBILITY_ID, "Password").send_keys(PLAYER_PASSWORD)
    mobile_driver.find_element(AppiumBy.ACCESSIBILITY_ID, "Login").click()
    WebDriverWait(mobile_driver, 15).until(
        EC.presence_of_element_located((AppiumBy.ACCESSIBILITY_ID, "Home"))
    )
    mobile_driver.find_element(AppiumBy.ACCESSIBILITY_ID, "Create or join a co-stream").click()
    WebDriverWait(mobile_driver, 5).until(
        EC.presence_of_element_located((AppiumBy.ACCESSIBILITY_ID, "Co-stream invite token"))
    ).send_keys(invite.json()["invite_token"])
    mobile_driver.find_element(AppiumBy.ACCESSIBILITY_ID, "Accept invite").click()
    WebDriverWait(mobile_driver, 10).until(
        EC.presence_of_element_located((AppiumBy.ACCESSIBILITY_ID, "costream-screen"))
    )

    browser = webdriver.Remote(command_executor=SELENIUM, options=webdriver.ChromeOptions())
    try:
        browser.get(f"{BASE_WEB}/web/costream/cs-session-101")
        chat = WebDriverWait(browser, 5).until(
            EC.presence_of_element_located((By.CSS_SELECTOR, '[data-testid="chat-message-list"]'))
        )
        text = f"mobile-cross-{uuid.uuid4().hex[:10]}"
        started = time.perf_counter()
        mobile_driver.find_element(AppiumBy.ACCESSIBILITY_ID, "Chat message").send_keys(text)
        mobile_driver.find_element(AppiumBy.ACCESSIBILITY_ID, "Send message").click()
        WebDriverWait(browser, 3, poll_frequency=0.05).until(
            lambda d: text in d.find_element(By.CSS_SELECTOR, '[data-testid="chat-message-list"]').text
        )
        assert time.perf_counter() - started < 3.0
    finally:
        browser.quit()
