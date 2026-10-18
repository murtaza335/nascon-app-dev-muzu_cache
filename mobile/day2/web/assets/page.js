(() => {
  'use strict';
  const $ = (selector, root = document) => root.querySelector(selector);
  const bootNode = $('#boot');
  let boot = {};
  try { boot = JSON.parse(bootNode?.textContent || '{}'); } catch { /* use route API */ }
  const main = $('#page-content');
  const status = $('#page-status');
  const path = location.pathname;
  let pendingFollowId = '';
  const parts = path.split('/').filter(Boolean);
  const kind = parts[1] === 'matches' ? parts[3] : parts[0] === 'web' ? parts[1] : parts[0];
  const id = parts[1] === 'matches' ? parts[2] : parts[0] === 'web' ? parts[2] : parts[1];
  const storage = (key) => { try { return localStorage.getItem(key); } catch { return null; } };
  const setStatus = (text, error = false) => { if (status) { status.textContent = text; status.classList.toggle('is-error', error); } };
  const safe = (value, fallback = '—') => typeof value === 'string' && value.trim() ? value : fallback;
  const el = (tag, cls, text) => { const node = document.createElement(tag); if (cls) node.className = cls; if (text != null) node.textContent = String(text); return node; };
  async function api(url, options = {}) {
    const headers = { Accept: 'application/json' };
    if (options.body !== undefined) headers['Content-Type'] = 'application/json';
    let storedMember = ''; try { storedMember = sessionStorage.getItem('nascon_jwt') || ''; } catch { /* storage may be blocked */ }
    const token = Object.prototype.hasOwnProperty.call(options, 'token') ? options.token : (storedMember || storage('nascon_guest_token'));
    if (token) headers.Authorization = `Bearer ${token}`;
    let response;
    try { response = await fetch(url, { ...options, headers, credentials: 'omit', cache: 'no-store', body: options.body === undefined ? undefined : JSON.stringify(options.body) }); }
    catch { const e = new Error("You're offline. Check your connection and try again."); e.code = 'NETWORK_ERROR'; throw e; }
    const data = await response.json().catch(() => ({}));
    if (!response.ok) { const e = new Error(data?.error?.message || data?.error?.code || 'This content is temporarily unavailable.'); e.code = data?.error?.code || 'REQUEST_FAILED'; e.status = response.status; throw e; }
    return data;
  }
  async function guest() {
    const existing = storage('nascon_guest_token'); const expiry = Date.parse(storage('nascon_guest_expires_at') || '');
    if (existing?.startsWith('guest_') && (!Number.isFinite(expiry) || expiry > Date.now() + 30000)) return existing;
    try { localStorage.removeItem('nascon_guest_token'); localStorage.removeItem('nascon_guest_expires_at'); } catch { /* private mode */ }
    const result = await api('/api/v1/guest/session', { method: 'POST', token: '', body: {} });
    if (!result.guest_token?.startsWith('guest_')) throw new Error('Guest session could not be started.');
    try { localStorage.setItem('nascon_guest_token', result.guest_token); if (result.expires_at) localStorage.setItem('nascon_guest_expires_at', result.expires_at); } catch { /* private mode */ }
    return result.guest_token;
  }
  function link(label, href, cls = 'button-link') { const a = el('a', cls, label); a.href = href; return a; }
  function section(title) { const s = el('section', 'panel'); s.append(el('h2', '', title)); return s; }
  function date(value) { const d = new Date(value); return Number.isNaN(d.valueOf()) ? 'Schedule to be confirmed' : new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(d); }
  function empty(text) { main.replaceChildren(el('p', 'empty-state', text)); }
  async function renderMatch(type) {
    const match = boot.match_id ? boot : await api(`/api/v1/public/matches/${encodeURIComponent(id)}`);
    const home = match.home || {}, away = match.away || {};
    const title = `${safe(home.name, 'Home')} vs ${safe(away.name, 'Away')}`;
    $('#page-title').textContent = title;
    if (type === 'notice') {
      const state = new URLSearchParams(location.search).get('state') || match.status;
      const messages = { postponed: 'This match has been postponed. Please check back for an updated schedule.', cancelled: 'This match has been cancelled.', abandoned: 'This match was stopped before completion.' };
      const card = section('Match update'); card.append(el('p', 'lead', messages[state] || 'This match is not currently available.'));
      card.append(el('p', '', title)); card.append(link(`View ${safe(home.name)} club`, `/web/clubs/${encodeURIComponent(home.club_id || home.team_id || '')}`));
      main.replaceChildren(card); return;
    }
    if (type === 'preview') {
      const card = section('Coming up'); card.append(el('p', 'lead', title));
      card.append(el('p', 'kickoff', date(match.scheduled_at || match.kickoff_at)));
      card.append(el('p', '', `Pinned merchandise: ${safe(match.pinned_product?.name, 'None announced')}`));
      const countdown = el('p', 'countdown', 'Countdown unavailable until kickoff is confirmed.');
      const kickoff = Date.parse(match.scheduled_at || match.kickoff_at || '');
      if (Number.isFinite(kickoff)) { const tick = () => { const left = kickoff - Date.now(); countdown.textContent = left <= 0 ? 'Kickoff time reached' : `Starts in ${Math.floor(left / 3600000)}h ${Math.floor(left % 3600000 / 60000)}m`; }; tick(); window.setInterval(tick, 30000); }
      const remind = el('button', '', 'Remind me'); remind.type = 'button'; remind.addEventListener('click', () => openAuth(remind));
      card.append(countdown, remind); main.replaceChildren(card); return;
    }
    if (type === 'vod') {
      const card = section('Match replay'); card.append(el('p', 'lead', title));
      const vod = (match.vod || []).find(item => item.playback_url);
      if (vod) { const video = el('video', 'route-video'); video.controls = true; video.playsInline = true; video.setAttribute('aria-label', 'Match replay video'); video.src = vod.playback_url; card.append(video); }
      else card.append(el('p', 'empty-state', 'Replay processing — the recording is not ready yet.'));
      card.append(el('p', 'final-score', `Final score ${safe(match.score_text, 'Not available')}`)); main.replaceChildren(card);
    }
  }
  async function renderPlayer() {
    const p = await api(`/api/v1/public/players/${encodeURIComponent(id)}`);
    const card = section(safe(p.name, 'Athlete')); card.append(el('p', 'eyebrow', safe(p.position, 'Player')));
    if (p.club?.club_id) card.append(link(`Club: ${safe(p.club.name)}`, `/web/clubs/${encodeURIComponent(p.club.club_id)}`));
    card.append(el('p', 'lead', `${p.career?.matches ?? 0} matches · ${p.career?.wins ?? 0} wins · ${p.career?.draws ?? 0} draws · ${p.career?.losses ?? 0} losses`));
    card.append(el('p', '', `${p.follower_count ?? 0} followers`));
    const follow = el('button', '', 'Follow'); follow.type = 'button'; follow.addEventListener('click', async () => { follow.disabled = true; try { const token = await guest(); const result = await api(`/api/v1/athletes/${encodeURIComponent(id)}/follow`, { method: 'PUT', token }); follow.textContent = result.following ? 'Following' : 'Follow'; setStatus(`${result.follower_count} followers`); } catch (e) { if (e.code === 'GUEST_WRITE_FORBIDDEN') { pendingFollowId = id; setStatus('Sign in to follow this athlete.'); openAuth(follow); } else setStatus(e.message, true); } finally { follow.disabled = false; } });
    card.append(follow);
    const fixtures = section('Upcoming fixtures');
    (p.upcoming_fixtures || []).forEach(f => fixtures.append(el('p', '', `${safe(f.opponent)} · ${date(f.scheduled_at)}`)));
    if (!p.upcoming_fixtures?.length) fixtures.append(el('p', 'empty-state', 'No upcoming fixtures announced.'));
    const vods = section('Stream archive');
    (p.vods || []).forEach(v => { const row = el('article', 'list-row'); row.append(el('h3', '', safe(v.title, 'Match replay')), el('p', '', `${date(v.recorded_at)} · ${v.duration_s ?? 0}s`)); if (v.playback_url) { const video = el('video', 'route-video'); video.controls = true; video.playsInline = true; video.src = v.playback_url; video.setAttribute('aria-label', `Replay: ${safe(v.title)}`); row.append(video); } vods.append(row); });
    if (!p.vods?.length) vods.append(el('p', 'empty-state', 'No replays are available yet.'));
    main.replaceChildren(card, fixtures, vods);
  }
  async function renderClub() {
    const c = await api(`/api/v1/public/clubs/${encodeURIComponent(id)}`);
    const card = section(safe(c.name, 'Club')); if (c.badge_url) { const img = el('img', 'club-badge'); img.src = c.badge_url; img.alt = `${safe(c.name)} badge`; card.prepend(img); }
    const squad = section('Squad'); (c.players || []).forEach(p => squad.append(link(safe(p.name, p.player_id), `/web/players/${encodeURIComponent(p.player_id)}`, 'list-link'))); if (!c.players?.length) squad.append(el('p', 'empty-state', 'Squad information is not available.'));
    const fixtures = section('Upcoming'); (c.upcoming || []).forEach(m => fixtures.append(link(`${safe(m.home?.name)} vs ${safe(m.away?.name)} · ${date(m.scheduled_at)}`, `/web/matches/${encodeURIComponent(m.match_id)}/preview`, 'list-link'))); if (!c.upcoming?.length) fixtures.append(el('p', 'empty-state', 'No upcoming matches.'));
    const live = section('Live matches'); (c.live_matches || []).forEach(m => live.append(link(`${safe(m.home?.name)} ${safe(m.score_text)} ${safe(m.away?.name)}`, `/web/matches/${encodeURIComponent(m.match_id)}/live`, 'list-link'))); if (!c.live_matches?.length) live.append(el('p', 'empty-state', 'No live matches right now.'));
    main.replaceChildren(card, squad, fixtures, live);
  }
  async function renderCostream() {
    const data = boot.session_id ? boot : await api(`/api/v1/public/costreams/${encodeURIComponent(id)}`);
    const tiles = section('Co-stream');
    const layout = safe(data.layout, 'solo'); tiles.dataset.layout = layout;
    const composite = data.composite_playback_url;
    const playerFrame = el('div', 'video-frame'); const player = el('video', 'route-video'); player.dataset.testid = 'guest-video-player'; player.controls = true; player.muted = true; player.playsInline = true; player.autoplay = true; player.poster = '/web/assets/stream-poster.svg'; player.setAttribute('aria-label', 'Live match video'); if (composite) player.src = composite; playerFrame.append(player); tiles.prepend(playerFrame);
    const grid = el('div', 'participant-grid'); grid.dataset.layout = layout;
    (data.active_participants || []).slice(0, 4).forEach(p => { const tile = el('article', 'participant-tile'); tile.dataset.testid = `costream-tile-${p.player_id}`; tile.dataset.playerId = p.player_id; tile.append(el('h3', '', safe(p.name, p.player_id)), el('p', 'participant-role', p.player_id === data.active_host ? 'Active host' : 'Participant'), el('p', 'participant-state', p.muted ? 'Muted' : 'Connected')); if (p.hls_url) { const v = el('video', 'route-video'); v.controls = true; v.playsInline = true; v.src = p.hls_url; v.setAttribute('aria-label', `${safe(p.name)} stream`); tile.append(v); } grid.append(tile); }); tiles.append(grid);
    const chat = makeChat(data.chat_room_id || `chat-cs-${id}`);
    const score = section('Live score'); score.dataset.testid = 'live-score-banner'; score.setAttribute('role', 'status'); score.setAttribute('aria-live', 'polite'); score.textContent = data.score_text || '0 - 0';
    const merch = section('Featured merchandise'); merch.dataset.testid = 'pinned-merch-card';
    const product = data.pinned_product || { product_id: 'prod-jersey-001', name: 'Supporter jersey', variant_id: 'var-jersey-001-L', unit_price_minor: 450000 };
    const add = el('button', '', 'Add to cart'); add.type = 'button'; add.dataset.testid = 'add-to-guest-cart-btn'; const count = el('span', '', '0'); count.dataset.testid = 'guest-cart-count'; add.addEventListener('click', async () => { if (!product.variant_id) { setStatus('No merchandise is available for this stream.', true); return; } add.disabled = true; try { const token = await guest(); const cart = await api('/api/v1/guest/cart/items', { method: 'POST', token, body: { variant_id: product.variant_id, quantity: 1 } }); count.textContent = String(cart.total_items ?? 0); setStatus('Added to your guest cart.'); } catch (e) { setStatus(e.message, true); } finally { add.disabled = false; } }); merch.append(el('p', '', safe(product.name, 'Supporter jersey')), el('p', 'product-price', `PKR ${(product.unit_price_minor / 100).toLocaleString()}`), add, el('p', '', 'Guest cart '), count);
    main.replaceChildren(score, tiles, merch, chat);
    if (data.session_id && 'WebSocket' in window) connectSocket(`/ws/costream/${encodeURIComponent(id)}`, (msg) => {
      if (msg.type === 'chat.message') appendChat(msg.message);
      if (msg.type === 'hello' && msg.session) syncCostream(msg.session);
      if (msg.type === 'costream.host_changed') { data.active_host = msg.to || null; updateHostLabels(data.active_host); setStatus(msg.handoff_occurred ? 'Host handoff complete. The stream and chat continue.' : 'Host updated.'); }
      if (msg.type === 'costream.participant_changed') { const participant = msg.participant || msg; const tile = $(`[data-testid="costream-tile-${CSS.escape(participant.player_id || '')}"]`); if (tile && typeof participant.muted === 'boolean') tile.querySelector('.participant-state').textContent = participant.muted ? 'Muted' : 'Connected'; setStatus('Co-stream updated'); }
      if (msg.type === 'costream.terminated') setStatus('This co-stream has ended.');
    });
    void guest().then(token => api('/api/v1/guest/cart', { token })).then(cart => { const counter = $('[data-testid="guest-cart-count"]'); if (counter) counter.textContent = String(cart.total_items ?? 0); }).catch(e => setStatus(e.message, true));
  }
  function updateHostLabels(hostId) { document.querySelectorAll('.participant-tile').forEach(tile => { const role = tile.querySelector('.participant-role'); if (role) role.textContent = tile.dataset.playerId === hostId ? 'Active host' : 'Participant'; }); }
  function syncCostream(session) { if (session.active_host !== undefined) updateHostLabels(session.active_host); if (session.layout) { const grid = $('.participant-grid'); if (grid) grid.dataset.layout = session.layout; } }
  function makeChat(room) {
    const panel = section('Live chat'); const list = el('ul', 'message-list'); list.dataset.testid = 'chat-message-list'; list.setAttribute('role', 'log'); list.setAttribute('aria-live', 'polite'); list.setAttribute('aria-label', 'Live co-stream chat'); list.append(el('li', 'empty-chat', 'Loading chat…'));
    const form = el('form', 'chat-form'); const input = el('input'); input.dataset.testid = 'chat-input-field'; input.type = 'text'; input.maxLength = 2000; input.setAttribute('aria-label', 'Chat message'); const send = el('button', '', 'Send'); send.type = 'submit'; send.dataset.testid = 'chat-send-btn'; form.append(input, send);
    form.addEventListener('submit', async e => { e.preventDefault(); if (!input.value.trim()) return; send.disabled = true; try { const token = await guest(); await api('/api/v1/chat', { method: 'POST', token, body: { chat_room_id: room, text: input.value.trim(), client_message_id: `web-${globalThis.crypto?.randomUUID?.() || Date.now()}` } }); input.value = ''; } catch (error) { setStatus(error.code === 'GUEST_WRITE_FORBIDDEN' ? 'Sign in to chat. Your message has not been posted.' : error.message, true); if (error.code === 'GUEST_WRITE_FORBIDDEN') openAuth(send); } finally { send.disabled = false; } });
    panel.append(list, form); panel._list = list;
    void guest().then(token => api(`/api/v1/chat/${encodeURIComponent(room)}/messages?after_seq=0&limit=50`, { token })).then(res => { list.replaceChildren(); (res.messages || []).forEach(m => appendChat(m, list)); if (!list.children.length) list.append(el('li', 'empty-chat', 'No messages yet.')); }).catch(e => { list.replaceChildren(el('li', 'empty-chat', e.message)); });
    return panel;
  }
  function appendChat(message, list = $('.message-list')) { if (!message || !list || list.querySelector(`[data-message-id="${CSS.escape(message.message_id || '')}"]`)) return; list.querySelector('.empty-chat')?.remove(); const li = el('li', '', `${safe(message.sender, 'Viewer')}: ${safe(message.text, '')}`); li.dataset.messageId = message.message_id || ''; list.append(li); }
  function connectSocket(pathname, onMessage) { let attempts = 0, socket, timer, stopped = false; const open = () => { if (stopped) return; if (!navigator.onLine) { setStatus('Offline — reconnecting when online'); return; } const scheme = location.protocol === 'https:' ? 'wss:' : 'ws:'; socket = new WebSocket(`${scheme}//${location.host}${pathname}`); socket.onopen = () => { attempts = 0; setStatus('Connected'); }; socket.onmessage = e => { try { onMessage(JSON.parse(e.data)); } catch { /* ignore malformed frame */ } }; socket.onclose = () => { if (stopped) return; setStatus('Reconnecting…'); timer = setTimeout(open, [500,1000,2000,4000][Math.min(attempts++,3)]); }; socket.onerror = () => socket.close(); }; const online = () => { if (!socket || socket.readyState > WebSocket.OPEN) open(); }; open(); window.addEventListener('online', online); window.addEventListener('pagehide', () => { stopped = true; clearTimeout(timer); window.removeEventListener('online', online); socket?.close(); }, { once: true }); }
  function openAuth(trigger) { try { sessionStorage.setItem('nascon_resume', JSON.stringify({ return_to: `${location.pathname}${location.search}`, t: 0 })); } catch {} const modal = $('#progressive-auth-modal'); modal?.showModal(); $('#auth-email')?.focus(); }
  const modal = $('#progressive-auth-modal');
  let authMode = 'login';
  const loginTab = $('#page-login-tab'), registerTab = $('#page-register-tab'), nameInput = $('#page-name'), nameLabel = $('#page-name-label');
  function setAuthMode(mode) { authMode = mode; const isRegister = mode === 'register'; loginTab?.setAttribute('aria-selected', String(!isRegister)); registerTab?.setAttribute('aria-selected', String(isRegister)); if (nameInput) { nameInput.hidden = !isRegister; nameInput.required = isRegister; } if (nameLabel) nameLabel.hidden = !isRegister; $('#auth-password').autocomplete = isRegister ? 'new-password' : 'current-password'; $('#auth-password').minLength = isRegister ? 8 : 0; $('#auth-submit').textContent = isRegister ? 'Create account' : 'Log in'; }
  loginTab?.addEventListener('click', () => setAuthMode('login')); registerTab?.addEventListener('click', () => setAuthMode('register'));
  $('#auth-form')?.addEventListener('submit', async e => { e.preventDefault(); const data = new FormData(e.currentTarget); const error = $('#auth-error'); const payload = authMode === 'register' ? { email: data.get('email'), password: data.get('password'), display_name: data.get('display_name') } : { email: data.get('email'), password: data.get('password') }; try { const result = await api(`/api/v1/auth/${authMode === 'register' ? 'register' : 'login'}`, { method: 'POST', token: '', body: payload }); if (!result.token) throw new Error('The sign-in response did not include a session token.'); try { sessionStorage.setItem('nascon_jwt', result.token); } catch {} const guestToken = storage('nascon_guest_token'); let mergeNote = ''; if (guestToken) { try { const merged = await api('/api/v1/guest/cart/merge', { method: 'POST', token: result.token, body: { guest_token: guestToken, return_to: `${location.pathname}${location.search}` } }); const count = $('[data-testid="guest-cart-count"]'); if (count && Number.isSafeInteger(merged.active_cart?.total_items)) count.textContent = String(merged.active_cart.total_items); localStorage.removeItem('nascon_guest_token'); localStorage.removeItem('nascon_guest_expires_at'); } catch (mergeError) { if (mergeError.code === 'GUEST_TOKEN_ALREADY_MERGED') { const active = await api('/api/v1/cart', { token: result.token }); const count = $('[data-testid="guest-cart-count"]'); if (count) count.textContent = String(active.active_cart?.total_items ?? 0); mergeNote = 'Your cart was already moved to your account.'; } else throw mergeError; } }
      if (pendingFollowId) { const followed = await api(`/api/v1/athletes/${encodeURIComponent(pendingFollowId)}/follow`, { method: 'PUT', token: result.token }); const button = main.querySelector('button'); if (button) button.textContent = followed.following ? 'Following' : 'Follow'; pendingFollowId = ''; }
      const chatInput = $('[data-testid="chat-input-field"]'); const pendingText = chatInput?.value.trim(); if (pendingText) { const room = $('#boot'); let roomId = ''; try { roomId = JSON.parse(room?.textContent || '{}').chat_room_id || ''; } catch {} if (!roomId) roomId = `chat-cs-${id}`; const posted = await api('/api/v1/chat', { method: 'POST', token: result.token, body: { chat_room_id: roomId, text: pendingText, client_message_id: `web-${globalThis.crypto?.randomUUID?.() || Date.now()}` } }); appendChat(posted); chatInput.value = ''; }
      modal.close(); setStatus(mergeNote || 'Signed in. Your guest cart and this page have been preserved.'); } catch (err) { error.textContent = err.code === 'OUT_OF_STOCK' ? 'An item is out of stock. Your guest cart has been kept.' : err.code === 'VARIANT_NOT_FOUND' ? 'An item is no longer available. Your guest cart has been kept.' : err.message; } });
  try {
    if (kind === 'preview' || kind === 'vod' || kind === 'notice') void renderMatch(kind).catch(e => { empty(e.code === 'NETWORK_ERROR' ? "You're offline. Reconnect to load this page." : e.code === 'MATCH_NOT_FOUND' ? "We couldn't find that match." : e.message); setStatus(e.message, true); });
    else if (path.startsWith('/web/players/')) void renderPlayer().catch(e => { empty(e.code === 'NETWORK_ERROR' ? "You're offline. Reconnect to load this profile." : "We couldn't find that athlete."); setStatus(e.message, true); });
    else if (path.startsWith('/web/clubs/')) void renderClub().catch(e => { empty(e.code === 'NETWORK_ERROR' ? "You're offline. Reconnect to load this club." : "We couldn't find that club."); setStatus(e.message, true); });
    else if (path.startsWith('/web/costream/')) void renderCostream().catch(e => { empty(e.code === 'NETWORK_ERROR' ? "You're offline. Reconnect to load this co-stream." : 'This co-stream is not available.'); setStatus(e.message, true); });
  } catch (e) { setStatus(e.message, true); }
})();
