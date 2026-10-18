# Guest Web Player frontend source

This directory contains frontend-owned source for the backend-served Guest Web Player. The backend owner integrates these files into `backend/src/web/` and mounts the routes. No backend source files are maintained here.

## Integration contract

`live.html` is the live-match server-rendered template. `preview.html`, `vod.html`, `notice.html`, `player.html`, `club.html`, and `costream.html` are route-specific copies of `route-shell.html`; the backend should render the matching file and replace `{{PAGE_TITLE}}`, `{{PAGE_KICKER}}`, `{{ENTITY_ID}}`, `{{OPEN_APP_URI}}`, and `{{BOOT_JSON}}`. Use `nascon://stream/{session_id}` for a co-stream open-in-app link and `nascon://entity/{entity_id}` for all other entities. Escape HTML tokens, and JSON embedded in HTML must escape at least `<` as `\\u003c` (also escape `>`, `&`, U+2028, and U+2029) to prevent script termination/injection. Do not construct boot payloads from fixture data.

The API-D2-57 fields used by the live page are `match_id`, `status`, `home`, `away`, `score_text`, `pinned_product`, `stream`, and `chat_room_id`. Keep all nine required `data-testid` attributes in the initial HTML on the live and co-stream pages. Serve `assets/app.css`, `assets/live.js`, `assets/page.js`, and `assets/stream-poster.svg` from `/web/assets/`.

`assets/page.js` renders upcoming previews, replay/VOD, match notices, public athlete and club profiles, and co-stream tiles/chat. The browser client consumes only root `day2/API-CONTRACT.md` paths. It sends guest chat and follow attempts with the guest bearer and opens progressive auth only after `GUEST_WRITE_FORBIDDEN`; it never inserts a rejected message into chat history. QR short-link resolution and dynamic target mutation remain server-owned (`/q/{code}` redirects to the current route), and the page makes no QR telemetry request or stores device identifiers.

## Files

- `live.html` — live match template and mandatory initial DOM.
- `assets/app.css` — responsive layout, focus states, contrast, and 48 px controls.
- `assets/live.js` — guest session/cart, chat, realtime reconnect, progressive auth, and playback adapter.
- `route-shell.html` — shared accessible shell copied for route-specific rendering.
- `preview.html`, `vod.html`, `notice.html`, `player.html`, `club.html`, `costream.html` — route-specific server-rendered templates.
- `assets/page.js` — API-backed route rendering and co-stream chat/realtime behavior.
- `assets/stream-poster.svg` — accessible no-stream poster.

The backend integration must wire `/web/matches/{id}/live` to API-D2-57 and the route templates to API-D2-57/58/59/61 as appropriate; missing entities must return the contract's HTML 404 page. It must serve the pages from the API origin, not a separate dev-server origin. The route handlers/mount do not exist in this frontend-owned directory and are not claimed as integrated here.
