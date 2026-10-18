"""Spec §6.2.3: the three required Guest Web Player cases, run on the Grid with `pytest -n 3` (chrome + firefox)."""
import time
import uuid

import requests
from selenium.webdriver.common.by import By
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.support.ui import WebDriverWait


def wait_visible(driver, testid, timeout=3):
    return WebDriverWait(driver, timeout).until(EC.visibility_of_element_located((By.CSS_SELECTOR, f'[data-testid="{testid}"]')))


def test_t1_qr_scan_lands_on_live_player_without_login(driver, base_web):
    driver.get(f"{base_web}/q/m1-live")
    assert driver.current_url.endswith("/web/matches/match-m1/live")
    wait_visible(driver, "guest-video-player")
    wait_visible(driver, "live-score-banner")
    assert not driver.find_element(By.CSS_SELECTOR, '[data-testid="progressive-auth-modal"]').is_displayed()


def test_t2_guest_cannot_chat_and_sees_progressive_auth(driver, base_web):
    driver.get(f"{base_web}/web/matches/match-m1/live")
    wait_visible(driver, "chat-input-field")
    text = f"hello-{uuid.uuid4().hex[:6]}"
    driver.find_element(By.CSS_SELECTOR, '[data-testid="chat-input-field"]').send_keys(text)
    driver.find_element(By.CSS_SELECTOR, '[data-testid="chat-send-btn"]').click()
    wait_visible(driver, "progressive-auth-modal", timeout=2)
    assert text not in driver.find_element(By.CSS_SELECTOR, '[data-testid="chat-message-list"]').text


def test_t3_cart_count_and_live_score_sync(driver, base_web, api_base):
    driver.get(f"{base_web}/web/matches/match-m1/live")
    wait_visible(driver, "add-to-guest-cart-btn")
    driver.find_element(By.CSS_SELECTOR, '[data-testid="add-to-guest-cart-btn"]').click()
    WebDriverWait(driver, 3).until(lambda d: d.find_element(By.CSS_SELECTOR, '[data-testid="guest-cart-count"]').text == "1")
    banner = driver.find_element(By.CSS_SELECTOR, '[data-testid="live-score-banner"]')
    before = banner.text
    home, away = (int(x) for x in before.split(" - "))
    r = requests.post(f"{api_base}/audit/v1/events", json={"event_id": f"sel-{uuid.uuid4().hex[:8]}", "match_id": "match-m1", "type": "score",
                                                           "payload": {"team_id": "club-alpha-1", "event_type": "goal"}}, timeout=10)
    assert r.status_code == 201
    response_received_at = time.perf_counter()
    WebDriverWait(driver, 0.5, poll_frequency=0.01).until(
        lambda d: d.find_element(By.CSS_SELECTOR, '[data-testid="live-score-banner"]').text == f"{home + 1} - {away}"
    )
    assert time.perf_counter() - response_received_at < 0.5
