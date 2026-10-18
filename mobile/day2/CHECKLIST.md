# Day 2 Frontend Freeze Checklist

## Guest Web Player

- [ ] `/web/matches/match-m1/live` loads.
- [ ] `/q/m1-live` resolves to the live route.
- [ ] All nine required `data-testid` selectors exist.
- [ ] No login modal appears on initial guest load.
- [ ] HLS/WebRTC media container is visible.
- [ ] Score updates without page reload.
- [ ] Pinned merchandise renders.
- [ ] Guest cart count changes correctly.
- [ ] Guest chat write is rejected by the server.
- [ ] `GUEST_WRITE_FORBIDDEN` opens progressive auth.
- [ ] Cart and playback context survive auth.
- [ ] Chat shows masked messages and omits rejected flood messages.
- [ ] Preview/live/VOD/notice routes render.
- [ ] Co-stream route renders.

## Native Android

- [ ] `nascon://entity/match-m1` opens match live.
- [ ] `nascon://stream/cs-session-101` opens co-stream.
- [ ] Both deep links work without a login dead end.
- [ ] QR scanner handles permission and successful scan.
- [ ] Solo stream states render.
- [ ] Co-stream supports required layouts.
- [ ] Host handoff updates correctly.
- [ ] Native chat and web chat synchronize.
- [ ] Public athlete profile and VOD sections render.
- [ ] Notifications route to the correct screen.

## Accessibility

- [ ] Keyboard navigation passes.
- [ ] Media controls have accessible names.
- [ ] Modal focus is trapped and restored.
- [ ] Contrast is at least 4.5:1.
- [ ] Web and native targets are at least 48 px/dp.
- [ ] Status is not communicated by color alone.
- [ ] Loading, empty, error, offline, and success states are present.

## Tests and artifacts

- [ ] Selenium Grid reports at least three ready nodes.
- [ ] Selenium tests pass.
- [ ] Appium status is ready.
- [ ] Appium deep-link tests pass.
- [ ] Cross-surface test passes.
- [ ] Phase I mobile tests pass.
- [ ] Typecheck passes.
- [ ] Android release build passes.
- [ ] APK is present at `mobile/release/app-release.apk`.
- [ ] Test reports are committed.
- [ ] `TRACEABILITY.md` includes all Day 2 frontend IDs.
- [ ] No Day 2 commit is pushed after 14:05 PKT.
