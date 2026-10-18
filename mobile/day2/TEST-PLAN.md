# Day 2 Frontend Test Plan

## 1. Unit and component tests

Cover:

- QR target routing for every match state;
- entity-type route parsing;
- deep-link parsing;
- guest cart quantity and scope rules;
- idempotent cart-merge result handling;
- guest write error mapping;
- realtime event deduplication;
- host handoff rendering;
- layout capacity rendering;
- chat masking/display behavior;
- loading, empty, offline, error, and retry states;
- accessibility labels and selector presence.

## 2. Selenium Grid tests

Run in parallel across at least three Grid sessions.

Use the exact harness and environment rules in root `day2/QA-HARNESS.md`. The required web suite is executed against the real static backend-served page, not a separate dev server.

### Test 1: QR resolution and zero-friction load

- Navigate to `http://localhost:8080/q/m1-live`.
- Confirm redirect to `/web/matches/match-m1/live`.
- Find `guest-video-player`.
- Find `live-score-banner`.
- Confirm both render within three seconds.
- Confirm `progressive-auth-modal` is not visible initially.

### Test 2: Guest write block

- Start a fresh guest session.
- Enter text in `chat-input-field`.
- Click `chat-send-btn`.
- Confirm message is not appended to `chat-message-list`.
- Confirm `progressive-auth-modal` becomes visible.

### Test 3: Guest cart and score sync

- Click `add-to-guest-cart-btn`.
- Confirm `guest-cart-count` becomes `1`.
- Post a score event through the API.
- Confirm `live-score-banner` changes within 500 ms without reload.

Additional browser coverage:

- keyboard-only navigation;
- WCAG AA palette contrast checks, visible keyboard focus, native dialog focus containment/Escape behavior, and 48 × 48 CSS px target checks (automated in `tests/selenium/test_guest_accessibility.py`);
- Chrome and Firefox;
- mobile and desktop widths;
- co-stream route;
- changed QR target after match completion;
- cart merge and return-to-stream behavior.

## 3. Appium tests

- Verify Appium status is ready.
- Launch `nascon://entity/match-m1`.
- Launch `nascon://stream/cs-session-101`.
- Confirm direct target navigation within two seconds.
- Confirm no crash and no login dead end.
- Exercise QR scanner permission and successful scan.
- Exercise native co-stream join and chat.

If no device is available, the Appium suite may skip with an explicit “no device” reason and must still produce its report; never report a skipped device run as passing.

## 4. Cross-surface test

Run native co-stream participation while Selenium opens `/web/costream/cs-session-101`. Send a chat message through the permitted authenticated path and verify synchronized delivery within three seconds. Verify host handoff updates both surfaces.

## 5. Accessibility checks

- DOM selector inspection;
- contrast ratio;
- keyboard Tab/Enter traversal;
- focus trap and restore for modal;
- accessible names for media controls;
- 48 × 48 touch targets;
- no color-only state meaning;
- readable error and offline text.

## 6. Phase I regression

Run the existing mobile typecheck, tests, Android build, and the established Phase I API/offline tests. Day 2 changes must not remove authenticated store, roster, scoring, or sync behavior.

## 7. Evidence to commit

- Selenium XML/HTML report;
- Appium report;
- screenshots or captures for the mandatory journeys;
- mobile test output;
- APK at the required release path;
- updated `TRACEABILITY.md`.
