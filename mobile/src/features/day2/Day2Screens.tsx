import { RouteProp, useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, TextInput, View } from 'react-native';
import Video from 'react-native-video';
import { mediaDevices, RTCPeerConnection, RTCSessionDescription, RTCView } from 'react-native-webrtc';
import { useApp } from '../../app/AppContext';
import { Button, Empty, Message, Row, Screen, Section, Select, T } from '../../components/ui';
import type { AppNavigation, StackParams } from '../../navigation/routes';
import { colors as c } from '../../theme/tokens';
import { guestToken } from '../../services/auth/guest';

type AnyObject = Record<string, any>;
function useDay2Api() {
  const { serverUrl, session } = useApp();
  const request = useCallback(async <T,>(path: string, method = 'GET', body?: unknown): Promise<T> => {
    const token = session?.token || await guestToken(serverUrl);
    const controller = new AbortController(); const timer = setTimeout(() => controller.abort(), 10000);
    try {
      const response = await fetch(`${serverUrl}/api/v1${path}`, {
        method, signal: controller.signal,
        headers: { Accept: 'application/json', ...(body === undefined ? {} : { 'Content-Type': 'application/json' }), ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data?.error?.code || `HTTP_${response.status}`);
      return data as T;
    } finally { clearTimeout(timer); }
  }, [serverUrl, session?.token]);
  return { request, serverUrl, session };
}

function useLoad<T>(load: () => Promise<T>, deps: unknown[]) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(true);
  const refresh = useCallback(async () => {
    setBusy(true); setError('');
    try { setData(await load()); } catch { setError('Could not load this information. Check your connection and retry.'); }
    finally { setBusy(false); }
  // deps are explicit route/client identity keys supplied by the caller.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  useEffect(() => { void refresh(); }, [refresh]);
  return { data, error, busy, refresh, setData };
}

function PublicVideo({ url, label }: { url?: string | null; label: string }) {
  const [failed, setFailed] = useState(false);
  return <View accessibilityLabel={label} style={{ aspectRatio: 16 / 9, width: '100%', borderRadius: 16, overflow: 'hidden', backgroundColor: '#0b0d0b', justifyContent: 'center' }}>
    {url && !failed ? <Video source={{ uri: url }} style={{ width: '100%', height: '100%' }} controls resizeMode="contain" paused={false} onError={() => setFailed(true)} /> : <View style={{ alignItems: 'center', padding: 18 }}><T color="#e6e9e2">{failed ? 'Video is unavailable. Check your connection and retry.' : 'Stream starting soon'}</T></View>}
  </View>;
}

function WhipPublisher({ url }: { url?: string }) {
  const [stream, setStream] = useState<any>(null); const [peer, setPeer] = useState<any>(null); const [resource, setResource] = useState(''); const [busy, setBusy] = useState(false); const [status, setStatus] = useState('Camera is off.');
  const stop = async () => { try { if (resource) await fetch(resource, { method: 'DELETE' }); } catch { /* Closing the peer remains the local cleanup path. */ } peer?.close(); stream?.getTracks().forEach((track: any) => track.stop()); setPeer(null); setStream(null); setResource(''); setStatus('Broadcast ended.'); };
  const start = async () => {
    if (!url) { setStatus('No active publishing URL is available. Create a stream key first.'); return; }
    setBusy(true); setStatus('Preparing camera and microphone…'); let local: any; let connection: any;
    try {
      local = await mediaDevices.getUserMedia({ audio: true, video: { facingMode: 'user', width: 1280, height: 720, frameRate: 30 } });
      connection = new RTCPeerConnection({}); local.getTracks().forEach((track: any) => connection.addTrack(track, local));
      await connection.setLocalDescription(await connection.createOffer({}));
      if (connection.iceGatheringState !== 'complete') await new Promise<void>((resolve, reject) => { const timer = setTimeout(() => reject(new Error('Video network setup timed out.')), 8000); const check = () => { if (connection.iceGatheringState === 'complete') { clearTimeout(timer); connection.removeEventListener('icegatheringstatechange', check); resolve(); } }; connection.addEventListener('icegatheringstatechange', check); });
      const response = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/sdp', Accept: 'application/sdp' }, body: connection.localDescription?.sdp });
      if (!response.ok) throw new Error(`The media service rejected the broadcast (${response.status}).`);
      await connection.setRemoteDescription(new RTCSessionDescription({ type: 'answer', sdp: await response.text() }));
      connection.addEventListener('connectionstatechange', () => { if (connection.connectionState === 'connected') setStatus('Live'); else if (connection.connectionState === 'disconnected') setStatus('Connection interrupted — reconnecting…'); else if (connection.connectionState === 'failed') setStatus('Connection failed. Retry when the network is stable.'); });
      setStream(local); setPeer(connection); setResource(response.headers.get('Location') || url); setStatus('Connecting to the live room…');
    } catch (error) { local?.getTracks().forEach((track: any) => track.stop()); connection?.close(); setStatus(error instanceof Error ? error.message : 'Could not start camera broadcast.'); }
    finally { setBusy(false); }
  };
  useEffect(() => () => { peer?.close(); stream?.getTracks().forEach((track: any) => track.stop()); }, [peer, stream]);
  return <Section title="Your camera"><T>{status}</T>{stream && <RTCView streamURL={stream.toURL()} mirror style={{ width: '100%', aspectRatio: 16 / 9, borderRadius: 12, backgroundColor: '#101310' }} accessibilityLabel="Your co-stream camera preview" />}{peer ? <Button label="Stop camera broadcast" kind="danger" onPress={() => void stop()} /> : <Button label="Go live in this room" disabled={!url || busy} busy={busy} onPress={() => void start()} />}</Section>;
}

export function EntityRouteScreen() {
  const route = useRoute<RouteProp<StackParams, 'EntityRoute'>>();
  const id = route.params.entityId;
  if (id.startsWith('match-')) return <MatchLiveScreen matchId={id} />;
  if (id.startsWith('player-')) return <AthleteProfileScreen playerId={id} />;
  if (id.startsWith('club-')) return <ClubPublicScreen clubId={id} />;
  if (id.startsWith('cs-session-')) return <CoStreamScreen sessionId={id} />;
  return <Screen title="Link unavailable" back><Empty title="We couldn’t open this link" body="The link may be expired or unsupported." /></Screen>;
}

export function MatchLiveScreen({ matchId: override }: { matchId?: string }) {
  const route = useRoute<RouteProp<StackParams, 'MatchLive'>>();
  const id = override || route.params?.matchId || '';
  const { request, serverUrl } = useDay2Api();
  const { data, busy, error, refresh } = useLoad<AnyObject>(() => request(`/public/matches/${encodeURIComponent(id)}`), [request, id]);
  const [score, setScore] = useState('');
  const [chat, setChat] = useState<AnyObject[]>([]);
  const [text, setText] = useState('');
  const [notice, setNotice] = useState('');
  const p = useApp();
  const nav = useNavigation<AppNavigation>();
  useEffect(() => {
    if (!data?.chat_room_id) return;
    let alive = true;
    void request<AnyObject>(`/chat/${encodeURIComponent(data.chat_room_id)}/messages?after_seq=0&limit=50`).then(v => { if (alive) setChat(v.messages || []); }).catch(() => undefined);
    const wsUrl = `${serverUrl.replace(/^http/, 'ws')}/ws/matches/${encodeURIComponent(id)}`;
    let socket: WebSocket | undefined;
    try { socket = new WebSocket(wsUrl); socket.onmessage = event => { try { const frame = JSON.parse(event.data); if (frame.score_text) setScore(frame.score_text); if (frame.type === 'chat.message' && frame.message) setChat(old => [...old.filter(x => x.message_id !== frame.message.message_id), frame.message].slice(-50)); if (frame.type === 'overlay.updated') void refresh(); } catch { /* Ignore malformed frames. */ } }; } catch { /* HTTP remains available. */ }
    const poll = setInterval(() => { void refresh(); }, 20000);
    return () => { alive = false; clearInterval(poll); socket?.close(); };
  }, [data?.chat_room_id, id, request, refresh, serverUrl]);
  useEffect(() => { if (data?.score_text && !score) setScore(data.score_text); }, [data?.score_text, score]);
  const sendChat = async () => {
    if (!text.trim()) return;
    if (!p.session) { setNotice('Sign in to join the live chat. Your message is still here.'); nav.navigate('Login'); return; }
    try { const result = await request<AnyObject>('/chat', 'POST', { chat_room_id: data?.chat_room_id, text: text.trim(), client_message_id: `mobile-${Date.now()}` }); setChat(old => [...old, result]); setText(''); setNotice(''); }
    catch { setNotice('Message was not sent. Please wait a moment and retry.'); }
  };
  return <Screen title="Live match" back>
    {busy && !data ? <ActivityIndicator accessibilityLabel="Loading match" color={c.accent} /> : error ? <View style={{ gap: 8 }}><Message title="Match unavailable" description={error} tone="error" /><Button label="Retry" onPress={() => void refresh()} /></View> : data ? <>
      <View testID="match-live-screen" style={{ gap: 14 }}>
        <View testID="live-score-banner" accessibilityRole="summary" style={{ borderRadius: 16, padding: 18, backgroundColor: c.olive, gap: 4 }}>
          <T variant="strong">{data.home?.name || 'Home'}  ·  {data.away?.name || 'Away'}</T><T variant="heading">{score || data.score_text || '—'}</T><T>{data.status === 'in_progress' ? 'LIVE' : String(data.status || 'Match')}</T>
        </View>
        <PublicVideo url={data.stream?.hls_url || data.vod?.[0]?.playback_url} label="Live match video" />
        {p.connection === 'offline' && <Message title="Offline" description="Live score and video will reconnect when your network returns." tone="warning" />}
        {data.pinned_product && <Section title="Featured merchandise"><Row title={data.pinned_product.name} detail={`${data.pinned_product.stock_available ?? 0} available`} /><Button label="Add to guest cart" onPress={() => p.session ? setNotice('Cart is available from Store.') : setNotice('Sign in or continue on the guest web player to stage a cart.')} /></Section>}
        <Section title="Live chat"><View testID="chat-message-list" accessibilityLabel="Chat messages" style={{ gap: 8 }}>{chat.map((m, i) => <T key={m.message_id || `${m.seq}-${i}`}>{`${m.sender?.display_name || m.sender || 'Viewer'}: ${m.text}`}</T>)}</View>
          <TextInput testID="chat-input-field" accessibilityLabel="Chat message" value={text} onChangeText={setText} placeholder="Write a message" placeholderTextColor={c.muted} style={{ minHeight: 48, borderWidth: 1, borderColor: c.divider, borderRadius: 12, padding: 12, color: c.text }} />
          <Button testID="chat-send-btn" label="Send message" onPress={() => void sendChat()} />
        </Section>
        <Button label="Open guest web player" kind="secondary" onPress={() => setNotice(`Open ${serverUrl}/web/matches/${id}/live in your browser.`)} />
        {notice ? <Message title="Notice" description={notice} /> : null}
      </View>
    </> : null}
  </Screen>;
}

export function CoStreamScreen({ sessionId: override }: { sessionId?: string }) {
  const route = useRoute<RouteProp<StackParams, 'CoStreamView'>>();
  const id = override || route.params?.sessionId || '';
  const { request, serverUrl, session } = useDay2Api();
  const { data, busy, error, refresh } = useLoad<AnyObject>(() => request(`/public/costreams/${encodeURIComponent(id)}`), [request, id]);
  const [publisherUrl, setPublisherUrl] = useState(route.params?.publishUrl);
  const [chat, setChat] = useState<AnyObject[]>([]); const [text, setText] = useState(''); const [toast, setToast] = useState('');
  useFocusEffect(useCallback(() => {
    if (route.params?.publishUrl) { setPublisherUrl(route.params.publishUrl); return; }
    if (!session) return;
    let active = true;
    void request<AnyObject>('/streams/me').then(key => { if (active) setPublisherUrl(key.ingest_endpoints?.webrtc); }).catch(() => { if (active) setPublisherUrl(undefined); });
    return () => { active = false; };
  }, [request, route.params?.publishUrl, session?.token]));
  useEffect(() => {
    if (!data?.chat_room_id) return;
    let alive = true; void request<AnyObject>(`/chat/${encodeURIComponent(data.chat_room_id)}/messages?after_seq=0&limit=50`).then(v => { if (alive) setChat(v.messages || []); }).catch(() => undefined);
    let ws: WebSocket | undefined; try { const auth = session?.token ? `?token=${encodeURIComponent(session.token)}` : ''; ws = new WebSocket(`${serverUrl.replace(/^http/, 'ws')}/ws/costream/${encodeURIComponent(id)}${auth}`); ws.onmessage = e => { try { const f = JSON.parse(e.data); if (f.type === 'chat.message' && f.message) setChat(old => [...old.filter(x => x.message_id !== f.message.message_id), f.message].slice(-50)); if (f.type?.startsWith('costream.')) void refresh(); } catch { /* Ignore malformed frames. */ } }; } catch { /* Retry through refresh. */ }
    return () => { alive = false; ws?.close(); };
  }, [data?.chat_room_id, id, request, refresh, serverUrl, session?.token]);
  const send = async () => { if (!text.trim()) return; if (!session) { setToast('Sign in before sending co-stream chat.'); return; } try { const m = await request<AnyObject>('/chat', 'POST', { chat_room_id: data?.chat_room_id, text: text.trim(), client_message_id: `mobile-${Date.now()}` }); setChat(old => [...old, m]); setText(''); } catch { setToast('Message could not be sent.'); } };
  const nav = useNavigation<AppNavigation>();
  return <Screen title="Co-stream" back>
    {busy && !data ? <ActivityIndicator accessibilityLabel="Loading co-stream" color={c.accent} /> : error ? <View style={{ gap: 8 }}><Message title="Co-stream unavailable" description={error} tone="error" /><Button label="Retry" onPress={() => void refresh()} /></View> : data ? <View testID="costream-screen" style={{ gap: 14 }}>
      {data.composite_playback_url ? <PublicVideo url={data.composite_playback_url} label="Co-stream composite video" /> : <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>{(data.active_participants || []).map((person: AnyObject) => <View key={person.player_id} testID={`costream-tile-${person.player_id}`} style={{ minWidth: '46%', flexGrow: 1, padding: 10, borderRadius: 12, backgroundColor: c.surface, gap: 6 }}>{person.hls_url ? <PublicVideo url={person.hls_url} label={`${person.name} co-stream video`} /> : <View style={{ aspectRatio: 16 / 9, alignItems: 'center', justifyContent: 'center', backgroundColor: '#0b0d0b', borderRadius: 12 }}><T color="#e6e9e2">Participant video unavailable</T></View>}<T variant="strong">{person.name}</T><T>{person.player_id === data.active_host ? 'Host' : 'Participant'}{person.muted ? ' · muted' : ''}{person.spotlight ? ' · spotlight' : ''}</T></View>)}</View>}
      {session ? <>{publisherUrl ? <WhipPublisher url={publisherUrl} /> : <View style={{ gap: 8 }}><Message title="Set up your stream key" description="Create an active key before publishing your camera to this co-stream." /><Button label="Open Creator Studio" kind="secondary" onPress={() => nav.navigate('GoLive')} /></View>}<Button label="Open host / join controls" kind="secondary" onPress={() => nav.navigate('CoStreamControl', { sessionId: id })} /></> : <Button label="Sign in to join" onPress={() => nav.navigate('Login')} />}
      <Section title="Unified chat"><View testID="chat-message-list" style={{ gap: 6 }}>{chat.map((m, i) => <T key={m.message_id || `${m.seq}-${i}`}>{`${m.sender?.display_name || m.sender || 'Viewer'}: ${m.text}`}</T>)}</View><TextInput testID="chat-input-field" accessibilityLabel="Chat message" value={text} onChangeText={setText} placeholder="Write a message" placeholderTextColor={c.muted} style={{ minHeight: 48, borderWidth: 1, borderColor: c.divider, borderRadius: 12, padding: 12, color: c.text }} /><Button testID="chat-send-btn" label="Send message" onPress={() => void send()} /></Section>
      {toast ? <Message title="Notice" description={toast} /> : null}
    </View> : null}
  </Screen>;
}

export function AthleteProfileScreen({ playerId: override }: { playerId?: string }) {
  const route = useRoute<RouteProp<StackParams, 'PlayerProfile'>>(); const id = override || route.params?.playerId || '';
  const { request, session } = useDay2Api(); const { data, busy, error, refresh, setData } = useLoad<AnyObject>(() => request(`${session ? '/athletes' : '/public/players'}/${encodeURIComponent(id)}`), [request, id, session?.token]); const [notice, setNotice] = useState(''); const nav = useNavigation<AppNavigation>();
  const follow = async () => { if (!session) { setNotice('Sign in to follow this athlete.'); nav.navigate('Login'); return; } try { const r = await request<AnyObject>(`/athletes/${encodeURIComponent(id)}/follow`, data?.is_following ? 'DELETE' : 'PUT'); setData(old => old ? { ...old, is_following: r.following, follower_count: r.follower_count } : old); } catch { setNotice('Follow status could not be updated. Please retry.'); } };
  return <Screen title="Athlete" back>{busy && !data ? <ActivityIndicator color={c.accent} /> : error ? <View style={{ gap: 8 }}><Message title="Athlete unavailable" description={error} tone="error" /><Button label="Retry" onPress={() => void refresh()} /></View> : data ? <View style={{ gap: 14 }}><Section title={data.name}><T>{data.position || 'Athlete'}{data.club?.name ? ` · ${data.club.name}` : ''}</T><T>{`${data.follower_count ?? 0} followers`}</T><Button label={data.is_following ? 'Unfollow' : 'Follow athlete'} onPress={() => void follow()} /></Section><Section title="Career"><Row title="Matches" detail={String(data.career?.matches ?? 0)} /><Row title="Wins / draws / losses" detail={`${data.career?.wins ?? 0} / ${data.career?.draws ?? 0} / ${data.career?.losses ?? 0}`} /><Row title="Score events" detail={String(data.career?.score_events ?? 0)} /></Section><Section title="Upcoming fixtures">{(data.upcoming_fixtures || []).length ? data.upcoming_fixtures.map((f: AnyObject) => <Row key={f.match_id} title={f.opponent || f.match_id} detail={f.scheduled_at} />) : <T>No upcoming fixtures.</T>}</Section><Section title="Video archive">{(data.vods || []).length ? data.vods.map((v: AnyObject) => <View key={v.vod_id} style={{ gap: 8 }}><T variant="strong">{v.title || 'Match replay'}</T><PublicVideo url={v.playback_url} label={`${v.title || 'Athlete'} replay`} /></View>) : <T>No replays are available yet.</T>}</Section>{notice ? <Message title="Sign in required" description={notice} /> : null}</View> : null}</Screen>;
}

function ClubPublicScreen({ clubId }: { clubId: string }) {
  const { request } = useDay2Api(); const { data, busy, error, refresh } = useLoad<AnyObject>(() => request(`/public/clubs/${encodeURIComponent(clubId)}`), [request, clubId]);
  return <Screen title="Club" back>{busy && !data ? <ActivityIndicator color={c.accent} /> : error ? <View style={{ gap: 8 }}><Message title="Club unavailable" description={error} tone="error" /><Button label="Retry" onPress={() => void refresh()} /></View> : data ? <View style={{ gap: 12 }}><Section title={data.name}><T>{`${(data.players || []).length} athletes`}</T></Section><Section title="Squad">{(data.players || []).map((x: AnyObject) => <Row key={x.player_id} title={x.name} detail={x.position} />)}</Section><Section title="Upcoming">{(data.upcoming || []).length ? data.upcoming.map((m: AnyObject) => <Row key={m.match_id} title={m.opponent || m.match_id} detail={m.scheduled_at} />) : <T>No upcoming fixtures.</T>}</Section><Section title="Live matches">{(data.live_matches || []).length ? data.live_matches.map((m: AnyObject) => <Row key={m.match_id} title={m.match_id} detail="Live now" />) : <T>No live matches.</T>}</Section></View> : null}</Screen>;
}

export function QRScannerScreen() {
  const nav = useNavigation<AppNavigation>(); const { serverUrl } = useDay2Api(); const [permission, ask] = useCameraPermissions(); const [manual, setManual] = useState(''); const [error, setError] = useState(''); const [scanned, setScanned] = useState(false); const [resolving, setResolving] = useState(false);
  const routeTarget = (path: string) => { const url = new URL(path, serverUrl); const match = url.pathname.match(/\/web\/matches\/([^/]+)\/(?:live|preview|vod)/); if (match) { nav.navigate('MatchLive', { matchId: decodeURIComponent(match[1]) }); return true; } const player = url.pathname.match(/\/web\/players\/([^/]+)/); if (player) { nav.navigate('EntityRoute', { entityId: decodeURIComponent(player[1]) }); return true; } const club = url.pathname.match(/\/web\/clubs\/([^/]+)/); if (club) { nav.navigate('EntityRoute', { entityId: decodeURIComponent(club[1]) }); return true; } const stream = url.pathname.match(/\/web\/costream\/([^/]+)/); if (stream) { nav.navigate('CoStreamView', { sessionId: decodeURIComponent(stream[1]) }); return true; } return false; };
  const open = async (raw: string) => { setError(''); try { const url = new URL(raw); if (url.protocol === 'nascon:') { const kind = url.hostname; const id = url.pathname.replace(/^\//, ''); if (kind === 'stream') nav.navigate('CoStreamView', { sessionId: id }); else nav.navigate('EntityRoute', { entityId: id }); return; } const match = url.pathname.match(/\/q\/([^/]+)/); if (match) { setResolving(true); try { const response = await fetch(`${serverUrl}/q/${encodeURIComponent(match[1])}`, { method: 'GET', redirect: 'manual' }); const location = response.headers.get('Location'); if (location && routeTarget(location)) return; let body: AnyObject = {}; try { body = await response.json(); } catch { /* redirect body may be empty */ } if (body.target_route && routeTarget(body.target_route)) return; setError('The QR link could not be resolved to a supported screen.'); } finally { setResolving(false); } return; } if (routeTarget(url.pathname + url.search)) return; } catch { if (/^(match-|player-|club-|cs-session-)/.test(raw)) { nav.navigate('EntityRoute', { entityId: raw }); return; } } setError('This QR code is not a supported NaSCon link.'); };
  return <Screen title="Scan a QR code" back><View style={{ gap: 14 }}><T>Scan a match, athlete, club, or co-stream QR link.</T>{permission?.granted ? <CameraView style={{ height: 320, borderRadius: 18, overflow: 'hidden' }} barcodeScannerSettings={{ barcodeTypes: ['qr'] }} onBarcodeScanned={scanned ? undefined : ({ data }) => { setScanned(true); open(data); }} /> : <View style={{ gap: 8 }}><Message title="Camera access needed" description="Allow camera access to scan QR codes. You can also enter a NaSCon link below." /><Button label="Allow camera" onPress={() => void ask()} /></View>}
    {(!permission?.granted || !permission.canAskAgain) && <View style={{ gap: 8 }}><TextInput accessibilityLabel="Enter a NaSCon link" value={manual} onChangeText={setManual} autoCapitalize="none" placeholder="nascon://entity/match-m1" placeholderTextColor={c.muted} style={{ minHeight: 48, borderWidth: 1, borderColor: c.divider, borderRadius: 12, padding: 12, color: c.text }} /><Button label={resolving ? 'Resolving QR link…' : 'Open link'} disabled={resolving} onPress={() => void open(manual.trim())} /></View>}{permission?.granted && <TextInput accessibilityLabel="Enter a link manually" value={manual} onChangeText={setManual} autoCapitalize="none" placeholder="Or paste a NaSCon link" placeholderTextColor={c.muted} style={{ minHeight: 48, borderWidth: 1, borderColor: c.divider, borderRadius: 12, padding: 12, color: c.text }} />}{permission?.granted && <Button label="Open entered link" disabled={resolving || !manual.trim()} onPress={() => void open(manual.trim())} />}{scanned && <Button label="Scan another" kind="secondary" onPress={() => setScanned(false)} />}{error ? <Message title="Could not open QR" description={error} tone="error" /> : null}</View></Screen>;
}

export function GoLiveScreen() {
  const { request, session } = useDay2Api(); const app = useApp(); const [status, setStatus] = useState<AnyObject | null>(null); const [error, setError] = useState(''); const [busy, setBusy] = useState(false); const [publishing, setPublishing] = useState(false); const [localStream, setLocalStream] = useState<any>(null); const [peer, setPeer] = useState<any>(null); const [whipResource, setWhipResource] = useState(''); const [publishStatus, setPublishStatus] = useState<'idle' | 'preparing' | 'live' | 'reconnecting' | 'ended' | 'revoked' | 'failed'>('idle'); const [matchId, setMatchId] = useState<string>();
  const load = async () => { setBusy(true); try { setStatus(await request('/streams/me')); setError(''); } catch { setError('Sign in with an athlete account to manage your stream.'); } finally { setBusy(false); } };
  useEffect(() => { void load(); }, []);
  const start = async () => { setBusy(true); try { const r = await request<AnyObject>('/streams/key', 'POST', { action: 'generate' }); setStatus(r); setPublishStatus('idle'); setError(''); } catch { setError('A stream key could not be created. Verify your athlete account and retry.'); } finally { setBusy(false); } };
  const revoke = async () => { setBusy(true); try { if (peer) await stopPublish(); const r = await request<AnyObject>('/streams/key', 'POST', { action: 'revoke' }); setStatus(r); setPublishStatus('revoked'); setError(''); } catch { setError('The stream key could not be revoked. Retry or ask an administrator for help.'); } finally { setBusy(false); } };
  const startPublish = async () => {
    const whip = status?.ingest_endpoints?.webrtc || status?.endpoints?.webrtc;
    if (!whip) { setError('Create an active stream key before starting video.'); return; }
    setPublishing(true); setPublishStatus('preparing'); setError('');
    let stream: any; let connection: any;
    try {
      stream = await mediaDevices.getUserMedia({ audio: true, video: { facingMode: 'user', width: 1280, height: 720, frameRate: 30 } });
      connection = new RTCPeerConnection({});
      stream.getTracks().forEach((track: any) => connection.addTrack(track, stream));
      const offer = await connection.createOffer({}); await connection.setLocalDescription(offer);
      if (connection.iceGatheringState !== 'complete') await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error('The video network did not become ready.')), 8000);
        const check = () => { if (connection.iceGatheringState === 'complete') { clearTimeout(timeout); connection.removeEventListener('icegatheringstatechange', check); resolve(); } };
        connection.addEventListener('icegatheringstatechange', check);
      });
      const response = await fetch(whip, { method: 'POST', headers: { 'Content-Type': 'application/sdp', Accept: 'application/sdp' }, body: connection.localDescription?.sdp });
      if (!response.ok) throw new Error(`The media server rejected publishing (${response.status}).`);
      const answer = await response.text();
      await connection.setRemoteDescription(new RTCSessionDescription({ type: 'answer', sdp: answer }));
      connection.addEventListener('connectionstatechange', () => {
        if (connection.connectionState === 'connected') { setPublishStatus('live'); setError(''); }
        else if (connection.connectionState === 'disconnected') setPublishStatus('reconnecting');
        else if (connection.connectionState === 'failed') { setPublishStatus('failed'); setError('The live connection was interrupted. Retry when your network is stable.'); }
      });
      setLocalStream(stream); setPeer(connection); setWhipResource(response.headers.get('Location') || whip); setError('');
      setPublishStatus(connection.connectionState === 'connected' ? 'live' : 'preparing');
    } catch (e) {
      stream?.getTracks().forEach((track: any) => track.stop()); connection?.close();
      setError(e instanceof Error ? e.message : 'Could not start video. Check camera, microphone, and network permissions.');
      setPublishStatus('failed');
    } finally { setPublishing(false); }
  };
  const stopPublish = async () => { try { if (whipResource) await fetch(whipResource, { method: 'DELETE' }); } catch { /* Closing the peer also tears down the client session. */ } peer?.close(); localStream?.getTracks().forEach((track: any) => track.stop()); setPeer(null); setLocalStream(null); setWhipResource(''); setPublishStatus('ended'); };
  useEffect(() => () => { peer?.close(); localStream?.getTracks().forEach((track: any) => track.stop()); }, [peer, localStream]);
  const endpoints = status?.ingest_endpoints || status?.endpoints || {};
  const stateLabel = publishStatus === 'idle' ? status?.status || status?.stream?.status || 'idle' : publishStatus;
  return <Screen title="Creator studio" back><View style={{ gap: 14 }}>{!session && <Message title="Sign in required" description="Sign in with your athlete account to broadcast." />}{busy && <ActivityIndicator color={c.accent} />}{error ? <View style={{ gap: 8 }}><Message title="Stream status" description={error} tone="error" /><Button label="Retry status" onPress={() => void load()} /></View> : null}{status && <Section title="Stream status"><Row title="State" detail={stateLabel} /><Row title="Stream key" detail={status.stream_key || status.key || status.key_prefix || 'Protected'} /><Row title="RTMP ingest" detail={endpoints.rtmp || 'Use the server-provided RTMP endpoint'} /><Row title="WHIP ingest" detail={endpoints.webrtc || 'Available on the server network'} /><Row title="HLS playback" detail={status.playback_url || endpoints.hls || 'Available when live'} /></Section>}{session && <Section title="Match overlay"><Select label="Bind stream to match" value={matchId || status?.match_id || undefined} options={app.data.fixtures.map(match => ({ value: match.match_id, label: `${match.home_name || match.home_team_id} vs ${match.away_name || match.away_team_id}` }))} onChange={setMatchId} placeholder="Choose a match" /><Button label="Apply match overlay" kind="secondary" disabled={!matchId || busy} onPress={() => void request('/streams/me/match', 'PUT', { match_id: matchId }).then(load).catch(() => setError('Match overlay could not be updated.'))} />{(app.data.fixtures.find(match => match.match_id === (matchId || status?.match_id))) && <T>{`Current score: ${app.data.fixtures.find(match => match.match_id === (matchId || status?.match_id))?.score?.home ?? 0} - ${app.data.fixtures.find(match => match.match_id === (matchId || status?.match_id))?.score?.away ?? 0}`}</T>}</Section>}{localStream && <RTCView streamURL={localStream.toURL()} mirror style={{ width: '100%', aspectRatio: 16 / 9, backgroundColor: '#101310', borderRadius: 14 }} accessibilityLabel="Your live camera preview" />}{!peer ? <Button label={publishStatus === 'failed' || publishStatus === 'reconnecting' ? 'Retry broadcast' : 'Start broadcast from this phone'} disabled={!session || busy || publishing || !endpoints.webrtc || publishStatus === 'revoked'} busy={publishing} onPress={() => void startPublish()} /> : <Button label="End broadcast" kind="danger" onPress={() => void stopPublish()} />}{status?.stream_key && <Button label="Revoke stream key" kind="danger" disabled={!session || busy} onPress={() => void revoke()} />}<Button label="Create or rotate stream key" disabled={!session || busy || !!peer} onPress={() => void start()} /><T color={c.secondary}>Camera and microphone are sent to the configured WHIP endpoint. OBS can use the RTMP endpoint and key instead.</T></View></Screen>;
}

export function CoStreamControlScreen() {
  const route = useRoute<RouteProp<StackParams, 'CoStreamControl'>>(); const id = route.params.sessionId; const { request } = useDay2Api(); const [playerId, setPlayerId] = useState(''); const [message, setMessage] = useState(''); const [busy, setBusy] = useState(false);
  const act = async (path: string, body?: unknown) => { setBusy(true); try { const result = await request<AnyObject>(path, 'POST', body); setMessage(result.invite_token ? `Invite token: ${result.invite_token}` : 'Control accepted.'); } catch { setMessage('That action could not be completed. Check your role, participant, and connection.'); } finally { setBusy(false); } };
  return <Screen title="Co-stream controls" back><View style={{ gap: 12 }}><Section title="Invite a squad member"><TextInput accessibilityLabel="Player ID to invite" value={playerId} onChangeText={setPlayerId} placeholder="player-id" placeholderTextColor={c.muted} style={{ minHeight: 48, borderWidth: 1, borderColor: c.divider, borderRadius: 12, padding: 12, color: c.text }} /><Button label="Create invite" disabled={!playerId || busy} onPress={() => void act(`/costreams/${encodeURIComponent(id)}/invites`, { player_id: playerId })} /></Section><Section title="Participant controls"><T>Enter the participant ID to mute, spotlight, or remove.</T>{['mute', 'unmute', 'spotlight', 'kick'].map(action => <Button key={action} kind="secondary" label={`${action} participant`} disabled={!playerId || busy} onPress={() => void act(`/costreams/${encodeURIComponent(id)}/participants/${encodeURIComponent(playerId)}/${action}`)} />)}</Section><Button label="Leave co-stream" disabled={busy} onPress={() => void act(`/costreams/${encodeURIComponent(id)}/leave`)} />{message ? <Message title="Control status" description={message} /> : null}</View></Screen>;
}

export function CoStreamEntryScreen() {
  const route = useRoute<RouteProp<StackParams, 'CoStreamEntry'>>(); const { request, session } = useDay2Api(); const nav = useNavigation<AppNavigation>(); const [token, setToken] = useState(route.params?.inviteToken || ''); const [layout, setLayout] = useState('grid_4'); const [busy, setBusy] = useState(false); const [error, setError] = useState('');
  const create = async () => { setBusy(true); setError(''); try { let publishUrl: string | undefined; try { const key = await request<AnyObject>('/streams/me'); publishUrl = key.ingest_endpoints?.webrtc; } catch { /* A room can still be created; setup guidance appears in the room. */ } const result = await request<AnyObject>('/costreams', 'POST', { layout }); const id = result.session_id || result.id; if (!id) throw new Error('No session id'); nav.navigate('CoStreamView', { sessionId: id, publishUrl }); } catch { setError('Could not create a co-stream. Sign in as a player and check your connection.'); } finally { setBusy(false); } };
  const join = async () => { const parts = token.trim().split('.'); if (parts.length < 2) { setError('Enter the invite token from the host.'); return; } setBusy(true); setError(''); try { const encoded = parts[0].replace(/-/g, '+').replace(/_/g, '/'); const padded = encoded + '='.repeat((4 - encoded.length % 4) % 4); const raw = JSON.parse(globalThis.atob(padded)); const id = raw.s; if (!id) throw new Error('Invalid token'); const result = await request<AnyObject>(`/costreams/${encodeURIComponent(id)}/join`, 'POST', { invite_token: token.trim() }); nav.navigate('CoStreamView', { sessionId: id, publishUrl: result.publish?.whip_url || undefined }); } catch { setError('Invite could not be accepted. It may be expired or invalid.'); } finally { setBusy(false); } };
  return <Screen title="Co-stream" back><View style={{ gap: 14 }}>{!session && <Message title="Sign in required" description="Sign in with a player account to create or join a co-stream." />}<Section title="Create a room"><T>Start a shared live room and invite up to three teammates.</T><Select label="Room layout" value={layout} options={[{ value: 'grid_4', label: 'Four-way grid' }, { value: 'grid_2', label: 'Two-person split' }, { value: 'spotlight', label: 'Spotlight' }, { value: 'solo', label: 'Solo' }]} onChange={setLayout} /><Button label="Create co-stream" disabled={!session || busy} onPress={() => void create()} /></Section><Section title="Join with invite"><TextInput accessibilityLabel="Co-stream invite token" value={token} onChangeText={setToken} autoCapitalize="none" placeholder="Paste invite token" placeholderTextColor={c.muted} style={{ minHeight: 48, borderWidth: 1, borderColor: c.divider, borderRadius: 12, padding: 12, color: c.text }} /><Button label="Accept invite" disabled={!session || busy} onPress={() => void join()} /></Section>{busy && <ActivityIndicator color={c.accent} />}{error ? <Message title="Co-stream action failed" description={error} tone="error" /> : null}</View></Screen>;
}

export function NotificationsScreen() {
  const p = useApp(); const nav = useNavigation<AppNavigation>();
  return <Screen title="Notifications" back>{p.notifications.length ? <View style={{ gap: 8 }}>{p.notifications.map(item => <View key={item.id} style={{ padding: 14, borderRadius: 12, backgroundColor: c.surface, gap: 4 }}><T variant="strong">{item.title}</T><T>{item.message}</T><Button kind="quiet" label="Open update" onPress={() => { if (item.type === 'costream.invite' && item.invite_token) nav.navigate('CoStreamEntry', { inviteToken: item.invite_token }); else if (item.session_id) nav.navigate('CoStreamView', { sessionId: item.session_id }); else if (item.match_id) nav.navigate('MatchLive', { matchId: item.match_id }); else if (item.order_id) nav.navigate('OrderDetail', { orderId: item.order_id }); }} /></View>)}</View> : <Empty title="You’re all caught up" body="Co-stream invites, live scores, and order changes will appear here while connected." />}</Screen>;
}

