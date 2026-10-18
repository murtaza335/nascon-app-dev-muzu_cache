"""Spec §6.3 cross-surface scenario: a chat message sent through the product API reaches a Selenium browser on
/web/costream/cs-session-101 within 3 s. The native-app side needs a device (skipped without one)."""
import os
import time

import pytest
import requests
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait

API = os.environ.get("API_BASE", "http://localhost:8080")
SELENIUM = os.environ.get("SELENIUM_URL", "http://localhost:4444/wd/hub")
BASE_WEB = os.environ.get("BASE_WEB", "http://backend:8080")


def test_chat_from_member_reaches_browser(device):
    requests.post(f"{API}/audit/v1/reset", timeout=15)
    tok = requests.post(f"{API}/api/v1/auth/login", json={"email": "player@nascon.test", "password": "Nascon@26"}, timeout=10).json()["token"]
    requests.post(f"{API}/audit/v1/costream/session", json={"session_id": "cs-session-101", "host_player_id": "player-alpha-1", "participants": ["player-alpha-1", "player-beta-1"]}, timeout=10)
    drv = webdriver.Remote(command_executor=SELENIUM, options=webdriver.ChromeOptions())
    try:
        drv.get(f"{BASE_WEB}/web/costream/cs-session-101")
        text = f"cross-{int(time.time())}"
        t0 = time.time()
        r = requests.post(f"{API}/api/v1/chat", headers={"Authorization": f"Bearer {tok}"}, json={"chat_room_id": "chat-cs-session-101", "text": text, "client_message_id": text}, timeout=10)
        assert r.status_code == 201
        WebDriverWait(drv, 3).until(lambda d: text in d.find_element(By.CSS_SELECTOR, '[data-testid="chat-message-list"]').text)
        assert time.time() - t0 < 3.0
    finally:
        drv.quit()
