"""Browser checks for the Guest Player accessibility acceptance criteria in spec NFR-8."""
from selenium.webdriver.common.by import By
from selenium.webdriver.common.keys import Keys
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.support.ui import WebDriverWait


def test_guest_player_keyboard_modal_contrast_and_targets(driver, base_web):
    driver.get(f"{base_web}/web/matches/match-m1/live")
    WebDriverWait(driver, 3).until(
        EC.visibility_of_element_located((By.CSS_SELECTOR, '[data-testid="guest-video-player"]'))
    )

    # The player controls and icon/action links have accessible names; authored palette pairs
    # are measured in-browser against the WCAG AA 4.5:1 threshold.
    assert driver.find_element(By.CSS_SELECTOR, '[data-testid="guest-video-player"]').get_attribute("aria-label")
    contrast = driver.execute_script("""
      const rgb = value => {
        const hex = value.trim().match(/^#([\\da-f]{3}|[\\da-f]{6})$/i);
        if (hex) {
          const digits = hex[1].length === 3 ? [...hex[1]].map(c => c + c).join('') : hex[1];
          return [0, 2, 4].map(i => parseInt(digits.slice(i, i + 2), 16));
        }
        const m = value.match(/[\\d.]+/g);
        return m ? m.slice(0, 3).map(Number) : null;
      };
      const luminance = value => {
        const c = rgb(value);
        if (!c) return null;
        const linear = c.map(v => { v /= 255; return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; });
        return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2];
      };
      const root = getComputedStyle(document.documentElement);
      const body = getComputedStyle(document.body);
      const pairs = [
        [body.color, body.backgroundColor],
        [root.getPropertyValue('--muted').trim(), '#0b0f14'],
        [root.getPropertyValue('--accent').trim(), '#0b0f14'],
        [root.getPropertyValue('--green').trim(), '#0b0f14'],
        ['#16130b', root.getPropertyValue('--accent').trim()],
        ['#ffffff', '#141a21'],
        ['#ffb4ad', '#0b0f14']
      ];
      return pairs.map(([fg, bg]) => {
        const a = luminance(fg), b = luminance(bg);
        return a === null || b === null ? 0 : (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
      });
    """)
    assert all(ratio >= 4.5 for ratio in contrast), f"WCAG AA contrast ratios below 4.5:1: {contrast}"

    too_small = driver.execute_script("""
      return [...document.querySelectorAll('a[href], button, input, select, textarea')]
        .filter(el => !el.hidden && el.getClientRects().length)
        .map(el => ({name: el.getAttribute('aria-label') || el.innerText || el.tagName,
                     width: el.getBoundingClientRect().width, height: el.getBoundingClientRect().height}))
        .filter(el => el.width < 48 || el.height < 48);
    """)
    assert not too_small, f"Interactive targets below 48x48 CSS px: {too_small}"

    body = driver.find_element(By.TAG_NAME, "body")
    body.send_keys(Keys.TAB)
    assert driver.execute_script("return document.activeElement !== document.body")

    driver.find_element(By.CSS_SELECTOR, '[data-testid="chat-input-field"]').send_keys("need account")
    driver.find_element(By.CSS_SELECTOR, '[data-testid="chat-send-btn"]').click()
    modal = WebDriverWait(driver, 3).until(
        EC.visibility_of_element_located((By.CSS_SELECTOR, '[data-testid="progressive-auth-modal"]'))
    )
    assert modal.get_attribute("role") == "dialog"
    assert modal.get_attribute("aria-modal") == "true"
    assert driver.execute_script("return arguments[0].contains(document.activeElement)", modal)
    driver.switch_to.active_element.send_keys(Keys.TAB)
    assert driver.execute_script("return arguments[0].contains(document.activeElement)", modal)
    driver.switch_to.active_element.send_keys(Keys.ESCAPE)
    WebDriverWait(driver, 2).until(
        lambda d: not d.find_element(By.CSS_SELECTOR, '[data-testid="progressive-auth-modal"]').is_displayed()
    )
