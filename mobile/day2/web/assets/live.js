(() => {
  'use strict';

  const bootNode = document.getElementById('boot');
  let boot;
  try { boot = JSON.parse(bootNode?.textContent || '{}'); }
  catch { boot = {}; }

  const byTestId = (id) => document.querySelector(`[data-testid="${id}"]`);
  const score = byTestId('live-score-banner');
  const video = byTestId('guest-video-player');
  const streamStatus = byTestId('stream-status');
  const connection = byTestId('connection-state');
  const messageList = byTestId('chat-message-list');
  const chatInput = byTestId('chat-input-field');
  const chatForm = document.getElementById('chat-form');
  const chatFeedback = document.getElementById('chat-feedback');
  const cartCount = byTestId('guest-cart-count');
  const cartFeedback = document.getElementById('cart-feedback');
  const addCartButton = byTestId('add-to-guest-cart-btn');
  const modal = byTestId('progressive-auth-modal');
  const authForm = document.getElementById('auth-form');
  const authError = document.getElementById('auth-error');
  const authSubmit = document.getElementById('auth-submit');
  const loginTab = document.getElementById('login-tab');
  const registerTab = document.getElementById('register-tab');
  const displayName = document.getElementById('display-name');
  const displayNameLabel = document.getElementById('display-name-label');
  const merchCard = byTestId('pinned-merch-card');
  const merchTitle = document.getElementById('merch-title');
  const productName = merchTitle?.querySelector('h2');
  const productPrice = merchTitle?.querySelector('.product-price');
  const livePill = document.querySelector('.live-pill');
  const storageRead = (kind, key) => { try { return window[kind].getItem(key); } catch { return null; } };
  const storageWrite = (kind, key, value) => { try { window[kind].setItem(key, value); } catch { /* storage can be unavailable in private browsing */ } };
  const storageRemove = (kind, key) => { try { window[kind].removeItem(key); } catch { /* storage can be unavailable in private browsing */ } };
  const errorText = {
    GUEST_WRITE_FORBIDDEN: 'Sign in or create an account to do that. Your guest cart will be kept.',
    OUT_OF_STOCK: 'That quantity is no longer available. Your cart has been refreshed.',
    VARIANT_NOT_FOUND: 'This item is no longer available.',
    GUEST_TOKEN_ALREADY_MERGED: 'Your cart was already moved to your account.',
    INVALID_CREDENTIALS: "That email and password don't match.",
    RATE_LIMITED: 'Please wait a moment before trying again.',
  };
  function friendlyError(error) {
    if (error.code === 'OUT_OF_STOCK' && Number.isSafeInteger(error.details?.available)) {
      return `Only ${error.details.available} left — we kept the rest in your cart.`;
    }
    if (error.code === 'NETWORK_ERROR') return "You're offline — we'll retry.";
    return errorText[error.code] || error.message || 'We could not complete that request. Please try again.';
  }
  const state = {
    guestToken: '', memberToken: storageRead('sessionStorage', 'nascon_jwt') || '',
    socket: null, retryTimer: 0, stableTimer: 0, retryIndex: 0, pollTimer: 0,
    lastSeq: 0, seenMessages: new Set(), pendingMessage: '', authMode: 'login',
    whep: null, mediaRetryTimer: 0, mediaRetryIndex: 0, mediaGeneration: 0,
    closing: false, intentionalSocketClose: false,
  };

  function setFeedback(node, message, isError = false) {
    if (!node) return;
    node.textContent = message || '';
    node.classList.toggle('is-error', Boolean(isError));
  }

  async function api(path, { method = 'GET', body, token = '', accept = 'application/json' } = {}) {
    const headers = { Accept: accept };
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    if (token) headers.Authorization = `Bearer ${token}`;
    let response;
    try {
      response = await fetch(path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body), credentials: 'omit', cache: 'no-store' });
    } catch {
      const error = new Error('Network unavailable');
      error.code = 'NETWORK_ERROR';
      throw error;
    }
    const contentType = response.headers.get('content-type') || '';
    const payload = contentType.includes('application/json') ? await response.json().catch(() => ({})) : await response.text().catch(() => '');
    if (!response.ok) {
      const error = new Error(payload?.error?.message || errorText[payload?.error?.code] || 'We could not complete that request. Please try again.');
      error.status = response.status;
      error.code = payload?.error?.code || 'REQUEST_FAILED';
      error.details = payload?.error?.details || {};
      throw error;
    }
    return payload;
  }

  async function ensureGuestToken() {
    if (state.guestToken) return state.guestToken;
    const saved = storageRead('localStorage', 'nascon_guest_token');
    const expires = Date.parse(storageRead('localStorage', 'nascon_guest_expires_at') || '');
    if (saved && saved.startsWith('guest_') && (!Number.isFinite(expires) || expires > Date.now() + 30000)) {
      state.guestToken = saved;
      return saved;
    }
    storageRemove('localStorage', 'nascon_guest_token');
    storageRemove('localStorage', 'nascon_guest_expires_at');
    const session = await api('/api/v1/guest/session', { method: 'POST', body: {} });
    if (typeof session.guest_token !== 'string' || !session.guest_token.startsWith('guest_')) throw new Error('The guest session response was invalid.');
    state.guestToken = session.guest_token;
    storageWrite('localStorage', 'nascon_guest_token', state.guestToken);
    if (typeof session.expires_at === 'string') storageWrite('localStorage', 'nascon_guest_expires_at', session.expires_at);
    return state.guestToken;
  }

  async function guestApi(path, options = {}) {
    const token = await ensureGuestToken();
    try { return await api(path, { ...options, token }); }
    catch (error) {
      if (error.status !== 401 && error.code !== 'UNAUTHENTICATED') throw error;
      state.guestToken = '';
      storageRemove('localStorage', 'nascon_guest_token');
      storageRemove('localStorage', 'nascon_guest_expires_at');
      return api(path, { ...options, token: await ensureGuestToken() });
    }
  }

  function setCartCount(value) {
    if (!cartCount) return;
    const count = Number.isSafeInteger(value) && value >= 0 ? value : 0;
    cartCount.textContent = String(count);
  }

  async function refreshCart() {
    if (state.memberToken) {
      const cart = await api('/api/v1/cart', { token: state.memberToken });
      setCartCount(cart.active_cart?.total_items ?? cart.total_items);
      return;
    }
    const cart = await guestApi('/api/v1/guest/cart');
    setCartCount(cart.total_items);
  }

  function openAuth(trigger, pendingMessage = '') {
    state.pendingMessage = pendingMessage;
    const pending = pendingMessage ? {
      type: 'chat',
      text: pendingMessage,
      client_message_id: `web-${globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`}`,
    } : undefined;
    const resume = {
      return_to: `${location.pathname}${location.search}`,
      t: Number(video?.currentTime) || 0,
      ...(pending ? { pending } : {}),
    };
    storageWrite('sessionStorage', 'nascon_resume', JSON.stringify(resume));
    if (!modal?.open) modal?.showModal();
    if (authError) authError.textContent = '';
    document.getElementById('auth-email')?.focus();
  }

  function renderMessage(message) {
    if (!message || typeof message.message_id !== 'string' || typeof message.text !== 'string') return;
    if (state.seenMessages.has(message.message_id)) return;
    state.seenMessages.add(message.message_id);
    if (Number.isSafeInteger(message.seq)) state.lastSeq = Math.max(state.lastSeq, message.seq);
    messageList?.querySelector('.empty-chat')?.remove();
    const item = document.createElement('li');
    const sender = document.createElement('strong');
    sender.textContent = message.sender || 'Viewer';
    const body = document.createElement('span');
    body.textContent = ` ${message.text}`;
    item.append(sender, body);
    if (message.flagged === true) {
      item.classList.add('message-flagged');
      const moderation = document.createElement('span');
      moderation.className = 'message-moderation';
      moderation.textContent = ' Held for moderation';
      moderation.setAttribute('aria-label', 'Message held for moderation');
      item.append(moderation);
    }
    if (Number.isSafeInteger(message.seq)) item.dataset.seq = String(message.seq);
    messageList?.append(item);
    if (messageList) {
      const items = [...messageList.querySelectorAll('li:not(.empty-chat)')];
      items.sort((a, b) => Number(a.dataset.seq || Number.MAX_SAFE_INTEGER) - Number(b.dataset.seq || Number.MAX_SAFE_INTEGER));
      for (const entry of items) messageList.append(entry);
    }
    if (messageList) messageList.scrollTop = messageList.scrollHeight;
  }

  function applyMatch(match) {
    if (match.match_id && match.match_id !== boot.match_id) return;
    if (typeof match.score_text === 'string' && score) score.textContent = match.score_text;
    if (Object.hasOwn(match, 'stream')) {
      const previousStatus = boot.stream?.status;
      boot.stream = match.stream;
      updateStreamStatus();
      if (match.stream?.status === 'live' && previousStatus !== 'live') schedulePlayback(0);
      if (match.stream?.status !== 'live' && previousStatus === 'live') stopPlayback('The stream is offline. We’ll reconnect when it returns.');
    }
    if (Object.hasOwn(match, 'pinned_product')) applyOverlay(match.pinned_product);
    if (typeof match.status === 'string') updateMatchStatus(match.status);
  }

  function applyOverlay(product) {
    boot.pinned_product = product;
    if (!merchCard) return;
    merchCard.hidden = !product;
    if (!product) return;
    if (productName) productName.textContent = product.name || 'Featured merchandise';
    if (productPrice && Number.isSafeInteger(product.unit_price_minor)) {
      productPrice.textContent = new Intl.NumberFormat(undefined, { style: 'currency', currency: 'PKR', maximumFractionDigits: 0 }).format(product.unit_price_minor / 100);
    }
    if (addCartButton) {
      addCartButton.dataset.variantId = product.variant_id || '';
      addCartButton.disabled = !product.variant_id || product.stock_available === 0;
      addCartButton.textContent = product.stock_available === 0 ? 'Sold out' : 'Add to cart';
    }
  }

  function updateMatchStatus(status) {
    const isLive = status === 'in_progress';
    if (livePill) {
      livePill.classList.toggle('is-live', isLive);
      livePill.hidden = !isLive;
      livePill.setAttribute('aria-label', isLive ? 'Match live' : `Match ${status.replaceAll('_', ' ')}`);
      if (livePill.lastChild?.nodeType === Node.TEXT_NODE) livePill.lastChild.textContent = ` ${isLive ? 'LIVE' : status.replaceAll('_', ' ').toUpperCase()}`;
    }
    document.documentElement.dataset.matchStatus = status;
  }

  function updateStreamStatus() {
    if (!streamStatus) return;
    if (!boot.stream) streamStatus.textContent = 'Stream unavailable';
    else if (boot.stream.status !== 'live') streamStatus.textContent = 'The stream is offline. Check back soon.';
  }

  async function refreshMatch() {
    if (!boot.match_id) return;
    try {
      applyMatch(await api(`/api/v1/public/matches/${encodeURIComponent(boot.match_id)}`));
    }
    catch (error) { if (error.code !== 'MATCH_NOT_FOUND') setFeedback(chatFeedback, 'Live updates are temporarily unavailable.', true); }
  }

  function startPolling() {
    if (state.pollTimer) return;
    state.pollTimer = window.setInterval(() => { void refreshMatch(); }, 2000);
  }

  function stopPolling() {
    if (!state.pollTimer) return;
    window.clearInterval(state.pollTimer);
    state.pollTimer = 0;
  }

  function connectRealtime() {
    if (!boot.match_id || state.closing) return;
    const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
    let socket;
    try { socket = new WebSocket(`${protocol}//${location.host}/ws/matches/${encodeURIComponent(boot.match_id)}`); }
    catch { scheduleSocketReconnect(); return; }
    state.socket = socket;
    socket.addEventListener('open', () => {
      if (connection) connection.textContent = 'Live updates connected';
      if (state.retryTimer) window.clearTimeout(state.retryTimer);
      state.retryTimer = 0;
      stopPolling();
      if (state.stableTimer) window.clearTimeout(state.stableTimer);
      state.stableTimer = window.setTimeout(() => { state.retryIndex = 0; }, 10000);
      void loadChatHistory();
    });
    socket.addEventListener('message', (event) => {
      let frame;
      try { frame = JSON.parse(event.data); } catch { return; }
      if (frame.match_id && frame.match_id !== boot.match_id) return;
      if (frame.type === 'hello') {
        if (typeof frame.score_text === 'string' && score) score.textContent = frame.score_text;
        if (typeof frame.status === 'string') updateMatchStatus(frame.status);
      }
      if (frame.type === 'score.updated' && frame.match_id === boot.match_id && typeof frame.score_text === 'string' && score) score.textContent = frame.score_text;
      if (frame.type === 'chat.message' && frame.chat_room_id === boot.chat_room_id) renderMessage(frame.message);
      if (frame.type === 'overlay.updated') applyOverlay(frame.pinned_product ?? null);
      if (frame.type === 'match.status_changed') {
        if (typeof frame.to === 'string') updateMatchStatus(frame.to);
        void refreshMatch();
      }
    });
    socket.addEventListener('close', () => {
      if (state.socket !== socket || state.closing || state.intentionalSocketClose) return;
      state.socket = null;
      if (state.stableTimer) window.clearTimeout(state.stableTimer);
      state.stableTimer = 0;
      scheduleSocketReconnect();
    });
    socket.addEventListener('error', () => socket.close());
  }

  function scheduleSocketReconnect() {
    if (state.closing || state.retryTimer) return;
    if (connection) connection.textContent = navigator.onLine ? 'Reconnecting…' : 'Offline — reconnecting when online';
    startPolling();
    const delay = [500, 1000, 2000, 4000][Math.min(state.retryIndex, 3)];
    state.retryIndex += 1;
    state.retryTimer = window.setTimeout(() => { state.retryTimer = 0; connectRealtime(); }, delay);
  }

  async function loadChatHistory() {
    if (!boot.chat_room_id) return;
    try {
      const result = await api(`/api/v1/chat/${encodeURIComponent(boot.chat_room_id)}/messages?after_seq=${state.lastSeq}&limit=50`);
      for (const message of result.messages || []) renderMessage(message);
      if (result.last_seq > state.lastSeq) state.lastSeq = result.last_seq;
    } catch { setFeedback(chatFeedback, 'Chat history could not be loaded. Live messages may still arrive.', true); }
  }

  async function postChat(text, clientMessageId) {
    const makeId = () => (globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`);
    const options = { method: 'POST', body: { chat_room_id: boot.chat_room_id, text, client_message_id: clientMessageId || `web-${makeId()}` } };
    return state.memberToken ? api('/api/v1/chat', { ...options, token: state.memberToken }) : guestApi('/api/v1/chat', options);
  }

  async function addCartItem() {
    const variantId = addCartButton?.dataset.variantId || '';
    if (!variantId) return;
    const current = Number(cartCount?.textContent || 0);
    setCartCount(current + 1);
    addCartButton.disabled = true;
    setFeedback(cartFeedback, 'Adding item…');
    try {
      const cart = await guestApi('/api/v1/guest/cart/items', { method: 'POST', body: { variant_id: variantId, quantity: 1 } });
      setCartCount(cart.total_items);
      setFeedback(cartFeedback, 'Added to your guest cart.');
    } catch (error) {
      setCartCount(current);
      if (error.code === 'GUEST_WRITE_FORBIDDEN') openAuth(addCartButton);
      setFeedback(cartFeedback, friendlyError(error), true);
    } finally { addCartButton.disabled = false; }
  }

  async function resumeAfterAuth() {
    const token = storageRead('localStorage', 'nascon_guest_token') || state.guestToken;
    const resume = (() => { try { return JSON.parse(storageRead('sessionStorage', 'nascon_resume') || '{}'); } catch { return {}; } })();
    let mergeWasAlreadyComplete = false;
    if (token) {
      let totalItems;
      try {
        const merged = await api('/api/v1/guest/cart/merge', { method: 'POST', token: state.memberToken, body: { guest_token: token, return_to: resume.return_to || `${location.pathname}${location.search}` } });
        totalItems = merged.active_cart?.total_items;
      } catch (error) {
        // A successful merge whose response was lost is safely recoverable: the
        // contract makes the merge idempotent and exposes the account cart.
        if (error.code !== 'GUEST_TOKEN_ALREADY_MERGED') throw error;
        const cart = await api('/api/v1/cart', { token: state.memberToken });
        totalItems = cart.active_cart?.total_items;
        mergeWasAlreadyComplete = true;
      }
      if (Number.isFinite(totalItems)) setCartCount(totalItems);
      storageRemove('localStorage', 'nascon_guest_token');
      storageRemove('localStorage', 'nascon_guest_expires_at');
      state.guestToken = '';
    }
    if (Number.isFinite(resume.t) && video) video.currentTime = Math.max(0, resume.t);
    const pending = state.pendingMessage || (resume.pending?.type === 'chat' ? resume.pending.text : '');
    if (pending) {
      const posted = await postChat(pending, resume.pending?.client_message_id);
      renderMessage(posted);
      if (chatInput) chatInput.value = '';
    }
    state.pendingMessage = '';
    storageRemove('sessionStorage', 'nascon_resume');
    return mergeWasAlreadyComplete;
  }

  async function submitAuth(event) {
    event.preventDefault();
    const form = new FormData(authForm);
    const email = String(form.get('email') || '').trim();
    const password = String(form.get('password') || '');
    const display_name = String(form.get('display_name') || '').trim();
    authSubmit.disabled = true;
    authError.textContent = '';
    try {
      if (!state.memberToken) {
        const path = state.authMode === 'register' ? '/api/v1/auth/register' : '/api/v1/auth/login';
        const payload = state.authMode === 'register' ? { email, password, display_name } : { email, password };
        const session = await api(path, { method: 'POST', body: payload });
        if (typeof session.token !== 'string' || !session.token) throw new Error('The sign-in response did not include a session token.');
        state.memberToken = session.token;
        storageWrite('sessionStorage', 'nascon_jwt', session.token);
      }
      const mergeWasAlreadyComplete = await resumeAfterAuth();
      modal.close();
      setFeedback(chatFeedback, mergeWasAlreadyComplete
        ? errorText.GUEST_TOKEN_ALREADY_MERGED
        : 'You are signed in. Your cart and stream have been restored.');
    } catch (error) {
      authError.textContent = friendlyError(error);
    } finally { authSubmit.disabled = false; }
  }

  function setAuthMode(mode) {
    state.authMode = mode;
    const registering = mode === 'register';
    loginTab.setAttribute('aria-selected', String(!registering));
    registerTab.setAttribute('aria-selected', String(registering));
    displayName.hidden = !registering;
    displayNameLabel.hidden = !registering;
    displayName.required = registering;
    document.getElementById('auth-password').autocomplete = registering ? 'new-password' : 'current-password';
    document.getElementById('auth-password').minLength = registering ? 8 : 0;
    authSubmit.textContent = registering ? 'Create account' : 'Log in';
  }

  async function waitForIceGathering(peer) {
    if (peer.iceGatheringState === 'complete') return;
    await new Promise((resolve) => {
      const finish = () => { window.clearTimeout(timeout); peer.removeEventListener('icegatheringstatechange', onState); resolve(); };
      const timeout = window.setTimeout(finish, 2500);
      const onState = () => {
        if (peer.iceGatheringState === 'complete') finish();
      };
      peer.addEventListener('icegatheringstatechange', onState);
    });
  }

  async function startWhep(url, generation) {
    if (!url || !window.RTCPeerConnection) throw new Error('WebRTC playback is unavailable.');
    const peer = new RTCPeerConnection();
    state.whep = peer;
    peer.addTransceiver('audio', { direction: 'recvonly' });
    peer.addTransceiver('video', { direction: 'recvonly' });
    const connected = new Promise((resolve, reject) => {
      const timeout = window.setTimeout(() => reject(new Error('WebRTC connection timed out.')), 12000);
      const finish = (error) => { window.clearTimeout(timeout); peer.removeEventListener('track', onTrack); peer.removeEventListener('connectionstatechange', onState); error ? reject(error) : resolve(); };
      const onTrack = (event) => {
        if (generation !== state.mediaGeneration) return finish(new Error('Playback was superseded.'));
        video.srcObject = event.streams[0] || new MediaStream([event.track]);
        void video.play().then(() => finish()).catch((error) => finish(error));
      };
      const onState = () => {
        if (peer.connectionState === 'failed' || peer.connectionState === 'closed') finish(new Error('WebRTC connection failed.'));
      };
      peer.addEventListener('track', onTrack);
      peer.addEventListener('connectionstatechange', onState);
    });
    // Negotiation can fail before the media-ready promise is awaited; attach a
    // rejection handler immediately so a later timeout/close is never unhandled.
    void connected.catch(() => {});
    peer.addEventListener('connectionstatechange', () => {
      if ((peer.connectionState === 'failed' || peer.connectionState === 'disconnected') && state.whep === peer && !state.closing) {
        if (streamStatus) streamStatus.textContent = 'Live video interrupted — reconnecting…';
        schedulePlaybackRetry(generation);
      }
    });
    await peer.setLocalDescription(await peer.createOffer());
    await waitForIceGathering(peer);
    const response = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/sdp', Accept: 'application/sdp' }, body: peer.localDescription.sdp, cache: 'no-store' });
    if (!response.ok) throw new Error('The WebRTC stream could not be opened.');
    await peer.setRemoteDescription({ type: 'answer', sdp: await response.text() });
    await connected;
  }

  async function startPlayback() {
    const generation = ++state.mediaGeneration;
    if (state.mediaRetryTimer) window.clearTimeout(state.mediaRetryTimer);
    state.mediaRetryTimer = 0;
    state.whep?.close();
    state.whep = null;
    video.pause();
    video.srcObject = null;
    video.removeAttribute('src');
    video.load();
    const stream = boot.stream;
    if (!stream || stream.status !== 'live') { updateStreamStatus(); return; }
    streamStatus.textContent = 'Connecting to the live stream…';
    try {
      if (stream.whep_url) await startWhep(stream.whep_url, generation);
      else throw new Error('WebRTC URL not available.');
      if (generation !== state.mediaGeneration) return;
      state.mediaRetryIndex = 0;
      streamStatus.textContent = 'Live stream';
    } catch {
      if (generation !== state.mediaGeneration) return;
      if (state.whep) { state.whep.close(); state.whep = null; }
      video.srcObject = null;
      if (stream.hls_url && video.canPlayType('application/vnd.apple.mpegurl')) {
        try {
          await startHls(stream.hls_url, generation);
          if (generation !== state.mediaGeneration) return;
          if (state.mediaRetryTimer) window.clearTimeout(state.mediaRetryTimer);
          state.mediaRetryTimer = 0;
          state.mediaRetryIndex = 0;
          streamStatus.textContent = 'Live stream';
        }
        catch { schedulePlaybackRetry(generation); }
      } else {
        streamStatus.textContent = 'Live video is unavailable. Reconnecting…';
        schedulePlaybackRetry(generation);
      }
    }
  }

  async function startHls(url, generation) {
    video.src = url;
    video.load();
    await new Promise((resolve, reject) => {
      const timeout = window.setTimeout(() => reject(new Error('HLS playback timed out.')), 12000);
      const cleanup = () => {
        window.clearTimeout(timeout);
        video.removeEventListener('playing', onPlaying);
        video.removeEventListener('error', onError);
      };
      const onPlaying = () => { cleanup(); resolve(); };
      const onError = () => { cleanup(); reject(new Error('HLS playback failed.')); };
      video.addEventListener('playing', onPlaying, { once: true });
      video.addEventListener('error', onError, { once: true });
      if (generation !== state.mediaGeneration) { cleanup(); reject(new Error('Playback was superseded.')); return; }
      void video.play().catch((error) => { cleanup(); reject(error); });
    });
  }

  function schedulePlaybackRetry(generation) {
    if (state.closing || !navigator.onLine || state.mediaRetryTimer || generation !== state.mediaGeneration) return;
    const delay = [1000, 2000, 4000, 8000][Math.min(state.mediaRetryIndex, 3)];
    state.mediaRetryIndex += 1;
    state.mediaRetryTimer = window.setTimeout(() => {
      state.mediaRetryTimer = 0;
      if (boot.stream?.status === 'live') void startPlayback();
      else updateStreamStatus();
    }, delay);
  }

  function schedulePlayback(delay = 0) {
    if (!navigator.onLine) return;
    if (state.mediaRetryTimer) window.clearTimeout(state.mediaRetryTimer);
    state.mediaRetryTimer = window.setTimeout(() => { state.mediaRetryTimer = 0; void startPlayback(); }, delay);
  }

  function stopPlayback(message) {
    state.mediaGeneration += 1;
    if (state.mediaRetryTimer) window.clearTimeout(state.mediaRetryTimer);
    state.mediaRetryTimer = 0;
    state.whep?.close();
    state.whep = null;
    video.pause();
    video.srcObject = null;
    video.removeAttribute('src');
    video.load();
    if (streamStatus) streamStatus.textContent = message;
  }

  chatForm?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const text = chatInput.value.trim();
    if (!text) { chatInput.focus(); return; }
    const button = byTestId('chat-send-btn');
    button.disabled = true;
    try {
      const posted = await postChat(text);
      renderMessage(posted);
      chatInput.value = '';
      setFeedback(chatFeedback, '');
    } catch (error) {
      if (error.code === 'GUEST_WRITE_FORBIDDEN') openAuth(button, text);
      setFeedback(chatFeedback, error.code === 'GUEST_WRITE_FORBIDDEN' ? 'Sign in to send your message. Your text is ready to send after sign in.' : friendlyError(error), true);
      chatInput.focus();
    } finally { button.disabled = false; }
  });

  addCartButton?.addEventListener('click', () => { void addCartItem(); });
  authForm?.addEventListener('submit', (event) => { void submitAuth(event); });
  loginTab?.addEventListener('click', () => setAuthMode('login'));
  registerTab?.addEventListener('click', () => setAuthMode('register'));
  modal?.addEventListener('click', (event) => { if (event.target === modal) modal.close(); });
  window.addEventListener('pagehide', () => {
    state.closing = true;
    if (state.retryTimer) window.clearTimeout(state.retryTimer);
    if (state.stableTimer) window.clearTimeout(state.stableTimer);
    if (state.mediaRetryTimer) window.clearTimeout(state.mediaRetryTimer);
    stopPolling();
    state.intentionalSocketClose = true;
    state.socket?.close();
    stopPlayback('Playback stopped.');
  }, { once: true });

  window.addEventListener('online', () => {
    if (connection) connection.textContent = 'Reconnecting…';
    if (!state.socket && !state.retryTimer) scheduleSocketReconnect();
    if (boot.stream?.status === 'live') schedulePlayback(0);
  });
  window.addEventListener('offline', () => {
    if (connection) connection.textContent = 'Offline — reconnecting when online';
    if (streamStatus) streamStatus.textContent = 'Network offline — live video may pause.';
  });

  void refreshCart().catch((error) => setFeedback(cartFeedback, error.code === 'NETWORK_ERROR' ? "You're offline — we'll retry." : error.message, true));
  applyOverlay(boot.pinned_product ?? null);
  updateStreamStatus();
  void loadChatHistory();
  void startPlayback();
  connectRealtime();
})();
