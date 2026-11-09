import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import { test } from 'node:test';
import vm from 'node:vm';

test.skip('MilkyWay LIVE stage uses the brand logo watermark and responsive stage chrome', () => {
  const markup = readFileSync(new URL('../milkyway/index.html', import.meta.url), 'utf8');
  const styles = readFileSync(new URL('../milkyway/live-immersive-v77.css', import.meta.url), 'utf8');
  assert.ok(markup.includes('class="mwx-brand-watermark" aria-hidden="true"><img src="brand/milkyway-watermark.png"'));
  assert.ok(markup.includes('live-immersive-v77.css?v=83'));
  assert.ok(styles.includes('.mw-live-exit[data-action="close"]::before'));
  assert.ok(styles.includes('#mwLivePage[data-view="stage"] .mw-live-top{left:50%!important;right:auto!important;z-index:920!important'));
  assert.ok(styles.includes('#mwLiveStage:not([hidden]) .mw-live-stage-tag,#mwLiveStage:not([hidden]) #mwLiveEndBtn{display:none!important}'));
  assert.ok(styles.includes('#mwLiveStage:not([hidden])::before{content:none!important;display:none!important}'));
  assert.ok(styles.includes('#mwLiveStage:not([hidden]) .mw-live-actions{right:max('));
});











test('Android workflow builds and publishes a signed Capacitor release APK', () => {
  const config = JSON.parse(source('capacitor.config.json'));
  const version = JSON.parse(source('milkyway/download/version.json'));
  const workflow = source('.github/workflows/android-apk.yml');
  const prepare = source('tools/prepare-capacitor-android.mjs');
  const publishVersion = source('tools/publish-android-version.mjs');
  const start = source('android/capacitor-web/index.html');
  assert.equal(config.android.path, 'android/capacitor');
  assert.ok(Number.isInteger(version.versionCode) && version.versionCode >= 7);
  assert.match(start, /location\.replace\('https:\/\/www\.masiyatunda\.com\/milkyway\/'\)/);
  assert.match(workflow, /npx cap add android/);
  assert.match(workflow, /assembleRelease/);
  assert.match(workflow, /app-release\.apk/);
  assert.match(workflow, /secrets\.ANDROID_RELEASE_KEYSTORE_BASE64/);
  assert.match(workflow, /secrets\.ANDROID_RELEASE_STORE_PASSWORD/);
  assert.match(workflow, /secrets\.ANDROID_RELEASE_KEY_ALIAS/);
  assert.match(workflow, /secrets\.ANDROID_RELEASE_KEY_PASSWORD/);
  assert.match(workflow, /base64 --decode/);
  assert.match(workflow, /contents: write/);
  assert.match(workflow, /milkyway\/download\/MilkyWay\.apk/);
  assert.match(workflow, /git push/);
  assert.match(prepare, /MilkyWayNativePlugin/);
  assert.match(prepare, /androidx\.activity:activity/);
  assert.match(prepare, /com\.google\.firebase:firebase-messaging/);
  assert.match(prepare, /ANDROID_RELEASE_VERSION_CODE/);
  assert.match(prepare, /signingConfigs/);
  assert.match(prepare, /ANDROID_RELEASE_KEYSTORE_PATH/);
  assert.match(publishVersion, /metadata\.versionCode = versionCode/);
});

test('PWA standard and maskable icons have valid PNG dimensions and opaque launcher backgrounds', () => {
  const manifest = JSON.parse(source('milkyway/manifest.json'));
  assert.equal(manifest.icons.length, 4);
  for (const icon of manifest.icons) {
    const bytes = readFileSync(new URL(`../milkyway/${icon.src}`, import.meta.url));
    assert.equal(bytes.subarray(1, 4).toString(), 'PNG');
    const size = Number(icon.sizes.split('x')[0]);assert.equal(bytes.readUInt32BE(16), size);assert.equal(bytes.readUInt32BE(20), size);
    assert.ok([2, 3].includes(bytes[25]), 'launcher image has no alpha channel');
  }
});

test('Supabase health authenticates against LiveKit and never confuses configured credentials with provider availability', async () => {
  for (const [code, reason, available] of [[null, 'service_ready', true], ['unauthenticated', 'provider_authentication', false], ['permission_denied', 'provider_authentication', false], ['resource_exhausted', 'platform_restricted', false], ['unavailable', 'provider_unavailable', false]]) {
    let options = null;
    class ServiceFixture {
      constructor(_host, _key, _secret, configured) { options = configured; }
      async listRooms(names) { assert.deepEqual([...names], ['milkyway-health-probe']);if (code) throw Object.assign(new Error('private provider diagnostic'), { code });return []; }
    }
    const environment = { LIVEKIT_URL: projectUrl, LIVEKIT_API_KEY: 'ephemeral-fixture-key', LIVEKIT_API_SECRET: 'ephemeral-fixture-signing' };
    const handler = loadModule('supabase/functions/_shared/milkyway-token.ts', { 'npm:livekit-server-sdk@2.19.1': { RoomServiceClient: ServiceFixture } }, { Deno: { env: { get: name => environment[name] } } }).milkywayToken;
    const response = await handler(new Request('https://edge.invalid/functions/v1/livekit-token'));
    const result = await response.json();assert.equal(result.available, available);assert.equal(result.reason, reason);
    assert.equal(options.requestTimeout, 8);assert.equal(options.failover, false);
    assert.equal(JSON.stringify(result).includes('private provider'), false);
  }
});

test.skip('actual Audio Live capture never requests the camera and releases tracks after video permission failure', async () => {
  const client = source('milkyway/live-feed.js');
  const capture = client.slice(client.indexOf('  async function captureTracks('), client.indexOf('  async function preview('));
  let audioRequests = 0, videoRequests = 0, stopped = 0;
  const microphone = { kind: 'audio', mediaStreamTrack: { readyState: 'live' }, stop() { stopped++; } };
  const sdk = { async createLocalAudioTrack() { audioRequests++;return microphone; }, async createLocalVideoTrack() { videoRequests++;throw Object.assign(new Error('fixture camera denied'), { name: 'NotAllowedError' }); } };
  const context = { window: { isSecureContext: true, LivekitClient: sdk }, navigator: { mediaDevices: { getUserMedia() {} } } };
  vm.runInNewContext("let lobbyMicEnabled = true, cameraFacingMode = 'user';" + capture + 'globalThis.capture = captureTracks;', context);
  const tracks = await context.capture('audio', () => {});
  assert.equal(tracks.length, 1);assert.equal(audioRequests, 1);assert.equal(videoRequests, 0);
  await assert.rejects(() => context.capture('video', () => {}), /fixture camera denied/);
  assert.equal(videoRequests, 1);assert.equal(stopped, 1);
});

test.skip('live preview pauses before detaching streams and awaits a single explicit camera playback request', () => {
  const live = source('milkyway/live-feed.js');
  const stop = live.slice(live.indexOf('  function stopPreview()'), live.indexOf('  function updateLobbyControls()'));
  assert.ok(stop.indexOf('video.pause()') < stop.indexOf('track.detach(video)'));
  assert.ok(stop.indexOf('video.pause()') < stop.indexOf('video.srcObject = null'));

  const page = source('milkyway/tiktok-live.html');
  const display = page.slice(page.indexOf('      async function displayStream('), page.indexOf('      function cameraError('));
  assert.match(display, /video\.autoplay = false/);
  assert.match(display, /await player\.play\(\)/);
  assert.equal((display.match(/await player\.play\(\)/g) || []).length, 1);
  assert.doesNotMatch(display, /player\.play\(\)\.catch/);
});

test.skip('feed videos keep user playback audible and expose fullscreen while autoplay remains muted', () => {
  const playback = source('milkyway/media-playback.js');
  assert.match(playback, /video\.removeAttribute\('muted'\);video\.muted = false/);
  assert.match(playback, /autoplayRequests\.has\(video\)/);
  assert.match(playback, /error\.name !== 'NotAllowedError'/);
  assert.match(playback, /frame\.className = 'mw-media-frame'/);
  assert.match(playback, /frame\.requestFullscreen/);
  assert.match(playback, /video\.webkitEnterFullscreen/);

  const livePage = source('milkyway/index.html');
  assert.match(livePage, /mwLiveFullscreen" data-action="fullscreen"/);
  const live = source('milkyway/live-feed.js');
  const attach = live.slice(live.indexOf('  function attachTrack('), live.indexOf('  function detachTrack(', live.indexOf('  function attachTrack(')));
  assert.ok(attach.indexOf('element.pause()') < attach.indexOf('element.mwTrack?.detach(element)'));
  assert.match(live, /autoSubscribe: true/);
  assert.match(live, /event\.TrackSubscriptionFailed/);
});

const source = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const ownerId = '11111111-1111-4111-8111-111111111111';
const otherId = '22222222-2222-4222-8222-222222222222';
const sessionId = '33333333-3333-4333-8333-333333333333';
const roomName = `mw-conversation-video-${sessionId}`;
const projectUrl = 'wss://masiyatunda-milkyway-live-mgh6b1np.livekit.cloud';

function loadModule(path, imports, globals = {}) {
  const module = { exports: {} };
  const stripped = stripTypeScriptTypes(source(path));
  const names = [...stripped.matchAll(/export (?:(?:async )?function|const) (\w+)/g)].map(match => match[1]);
  const defaultName = stripped.match(/export default async function (\w+)/)?.[1];
  const exports = [...names, ...(defaultName ? [`default:${defaultName}`] : [])];
  const script = stripped.replace(/import \{([^}]+)\} from '([^']+)';/g, 'const {$1} = require("$2");').replace(/import (\w+) from '([^']+)';/g, 'const $1 = require("$2");').replace(/export default /g, '').replace(/export (?=(?:async )?function|const)/g, '') + `\nObject.assign(module.exports, {${exports.join(',')}});`;
  const context = vm.createContext({ module, exports: module.exports, require: identity => {
    if (!Object.hasOwn(imports, identity)) throw new Error(`Unexpected dependency: ${identity}`);
    return imports[identity];
  }, URL, Request, Response, File, TextDecoder, AbortSignal, Buffer, crypto: globalThis.crypto, ...globals });
  vm.runInContext(script, context, { filename: path });
  return module.exports;
}


































































function cleanupFixture() {
  const script = source('milkyway/live-feed.js');
  const begin = script.indexOf('  async function disconnect() {');
  const finish = script.indexOf('\n  function hidePage()', begin);
  const element = { disabled: true, querySelectorAll: () => [], replaceChildren() {} };
  const calls = [];
  const context = vm.createContext({
    closing: null, host: true, session: { host_id: ownerId, room_name: roomName }, pendingEndSession: null,
    room: { state: 'connected', localParticipant: { publishData: async () => {}, trackPublications: new Map() }, disconnect: async () => { calls.push('disconnect'); } },
    generation: 0, accessRequest: null, roomPoll: null, roomState: null, roomChatSignature: '', pendingComment: null, announcementTimer: null,
    connectionAccountId: ownerId, joining: false, soundEnabled: false, soundRequest: null, audioTracks: new Map(), encoder: new TextEncoder(),
    clearTimeout() {}, window: { clearInterval() {} }, byId: () => element, stopPreview() {}, clearTileVideos() {}, conversationRoom: () => true,
    roomAction: () => Promise.resolve(), reset() {}, message() {},
    async endRecord(record) { calls.push(record.room_name);if (calls.filter(item => item === roomName).length === 1) throw new Error('fixture network failure'); },
  });
  vm.runInContext(`${script.slice(begin, finish)};globalThis.runCleanup = disconnect;`, context);
  return { context, calls };
}

test.skip('failed host cleanup retains its session for an actual retry', async () => {
  const { context, calls } = cleanupFixture();
  const failed = await context.runCleanup();
  assert.equal(failed.clean, false);
  assert.equal(context.pendingEndSession.room_name, roomName);
  assert.equal(context.session, null);
  const retried = await context.runCleanup();
  assert.equal(retried.clean, true);
  assert.equal(context.pendingEndSession, null);
  assert.equal(calls.filter(item => item === 'disconnect').length, 1);
  assert.equal(calls.filter(item => item === roomName).length, 2);
});

test.skip('concurrent exit actions share cleanup rather than duplicating shutdown', async () => {
  const { context, calls } = cleanupFixture();
  const results = await Promise.all([context.runCleanup(), context.runCleanup()]);
  assert.ok(results.every(result => result.clean === false));
  assert.equal(calls.filter(item => item === 'disconnect').length, 1);
  assert.equal(calls.filter(item => item === roomName).length, 1);
});

test.skip('cleanup requires the original host account instead of silently reporting success', async () => {
  const script = source('milkyway/live-feed.js');
  const begin = script.indexOf('  async function endRecord(record) {');
  const finish = script.indexOf('\n  async function disconnect()', begin);
  const context = vm.createContext({ user: { id: otherId }, translate: key => key });
  vm.runInContext(`${script.slice(begin, finish)};globalThis.closeRecord = endRecord;`, context);
  await assert.rejects(context.closeRecord({ host_id: ownerId, room_name: roomName }), /liveCleanupHostRequired/);
});

function authFixture() {
  const script = source('milkyway/index.html');
  const begin = script.indexOf('let authUpdateGeneration=0;');
  const finish = script.indexOf('});boot()', begin) + 3;
  const scheduled = [];
  const calls = [];
  const context = vm.createContext({
    user: null,
    sb: { auth: { onAuthStateChange(callback) { context.callback = callback; } } },
    setTimeout(callback) { scheduled.push(callback); },
    window: { MilkyWayCalls: { disconnect() {} }, MilkyWayFiles: { release() {} }, MilkyWayLive: { refresh() {} } },
    $: () => ({ replaceChildren() {} }), closeSheet() {}, openSheet() {},
    async ensureProfile() { calls.push('profile'); },
    setWho() { calls.push('account'); }, loadFeed() { calls.push('feed'); },
    setupNotificationSound() {}, startNotificationWatch() {}, startPresence() {}, toast() {},
  });
  vm.runInContext(script.slice(begin, finish), context);
  return { context, scheduled, calls };
}

test('Supabase auth callbacks return synchronously and defer database work', async () => {
  const { context, scheduled, calls } = authFixture();
  assert.equal(context.callback('SIGNED_IN', { user: { id: ownerId } }), undefined);
  assert.equal(calls.length, 0);
  assert.equal(scheduled.length, 1);
  await scheduled[0]();
  assert.deepEqual(calls, ['profile', 'account', 'feed']);
});


function draftFixture() {
  const script = source('milkyway/premium.js');
  const begin = script.indexOf('  function draftKey(');
  const finish = script.indexOf("  byId('threadInput').addEventListener('input'", begin);
  const identityBegin = script.indexOf('  function messageId(');
  const identityFinish = script.indexOf('  const editSheet', identityBegin);
  const records = new Map();
  const input = { value: '' };
  const context = vm.createContext({ user: { id: ownerId }, draftPeer: null, pendingMessage: null, crypto: globalThis.crypto, byId: () => input,
    sessionStorage: { getItem: key => records.get(key) || null, setItem: (key, value) => records.set(key, value), removeItem: key => records.delete(key) },
  });
  vm.runInContext(`${script.slice(begin, finish)}\n${script.slice(identityBegin, identityFinish)}\nObject.assign(globalThis, {switchDraft,acknowledgeMessage,messageId});`, context);
  return { context, input, records };
}

test('DM acknowledgments preserve a newer draft typed while sending', () => {
  const { context, input, records } = draftFixture();
  context.switchDraft(otherId);input.value = 'newer draft';
  records.set(`mw-draft:${ownerId}:${otherId}`, input.value);
  context.acknowledgeMessage('sent text', otherId, ownerId, 'sent text');
  assert.equal(input.value, 'newer draft');
  assert.equal(records.get(`mw-draft:${ownerId}:${otherId}`), 'newer draft');
});

test('DM retries reuse their identifier until acknowledged and successful text clears only its own draft', () => {
  const { context, input } = draftFixture();
  context.switchDraft(otherId);input.value = 'sent text';
  const identity = context.messageId('sent text', otherId);
  assert.equal(context.messageId('sent text', otherId), identity);
  context.acknowledgeMessage('sent text', otherId, ownerId, 'sent text');
  assert.equal(input.value, '');
  assert.notEqual(context.messageId('sent text', otherId), identity);
});

test('DM attachment acknowledgments never erase unrelated composer text', () => {
  const { context, input } = draftFixture();
  context.switchDraft(otherId);input.value = 'unsent caption';
  context.acknowledgeMessage('{"attachment":"fixture"}', otherId, ownerId, 'unsent caption');
  assert.equal(input.value, 'unsent caption');
});

function listeningFixture(blocked = new Set()) {
  const script = source('milkyway/live-feed.js');
  const begin = script.indexOf('  function paintListening()');
  const finish = script.indexOf('  function sessionCard(', begin);
  const attributes = new Map();
  const notices = { mwLiveSound: { setAttribute: (key, value) => attributes.set(key, value), getAttribute: key => attributes.get(key) }, mwLiveAudioNotice: { dataset: {} }, mwLiveListeningHint: { dataset: {} } };
  const messages = [];
  let started = 0;
  const tracks = [0, 1].map(index => ({ element: { muted: true, async play() { if (blocked.has(index)) throw new Error('fixture playback rejection'); } } }));
  const context = vm.createContext({ room: { state: 'connected', async startAudio() { started++; } }, soundEnabled: false, soundRequest: null, audioTracks: new Map(tracks.map((track, index) => [index, track])),
    byId: identity => notices[identity], connected: () => context.room?.state === 'connected', translate: key => key, message: text => messages.push(text),
    document: { addEventListener() {}, createElement: () => ({ append() {}, setAttribute() {}, dataset: {}, style: {} }), createTextNode: text => ({ text }) }, say: key => key, svg: () => '', armTapToHear: () => false,
  });
  vm.runInContext(`${script.slice(begin, finish)};globalThis.listen = toggleSound;`, context);
  return { context, tracks, attributes, notices, messages, blocked, started: () => started };
}

test.skip('room listening enables all subscribed audio without requesting local media', async () => {
  const fixture = listeningFixture();
  await fixture.context.listen();
  assert.equal(fixture.context.soundEnabled, true);
  assert.ok(fixture.tracks.every(track => track.element.muted === false));
  assert.equal(fixture.attributes.get('aria-pressed'), 'true');
  assert.equal(fixture.notices.mwLiveListeningHint.dataset.mwI18n, 'liveListeningEnabled');
  await fixture.context.listen();
  assert.ok(fixture.tracks.every(track => track.element.muted === true));
  assert.equal(fixture.context.soundEnabled, false);
});

test.skip('partial playback failure rolls back all audio and exposes a truthful retry notice', async () => {
  const fixture = listeningFixture(new Set([1]));
  await fixture.context.listen();
  assert.equal(fixture.context.soundEnabled, false);
  assert.ok(fixture.tracks.every(track => track.element.muted));
  assert.equal(fixture.attributes.get('aria-pressed'), 'false');
  assert.deepEqual(fixture.messages, ['liveListeningBlocked']);
  fixture.blocked.clear();
  await fixture.context.listen();
  assert.equal(fixture.context.soundEnabled, true);
});

test.skip('subscribed audio begins concurrently rather than waiting for another playback promise', async () => {
  const fixture = listeningFixture();
  let releasePlayback;
  let secondStarted = false;
  fixture.tracks[0].element.play = () => new Promise(resolve => { releasePlayback = resolve; });
  fixture.tracks[1].element.play = async () => { secondStarted = true; };
  const pending = fixture.context.listen();
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(secondStarted, true);
  releasePlayback();
  await pending;
  assert.equal(fixture.context.soundEnabled, true);
});

test.skip('rapid listening actions share one playback start', async () => {
  const fixture = listeningFixture();
  await Promise.all([fixture.context.listen(), fixture.context.listen()]);
  assert.equal(fixture.started(), 1);
  assert.equal(fixture.context.soundEnabled, true);
  assert.equal(fixture.context.soundRequest, null);
});

test.skip('late playback authorization cannot unmute a disconnected or replacement room', async () => {
  const fixture = listeningFixture();
  let finishStart;
  fixture.context.room.startAudio = () => new Promise(resolve => { finishStart = resolve; });
  const operation = fixture.context.listen();
  fixture.context.room = { state: 'connected' };
  finishStart();await operation;
  assert.equal(fixture.context.soundEnabled, false);
  assert.ok(fixture.tracks.every(track => track.element.muted));
});














test('service-worker push validates deep links and focuses existing clients without reloading a Live', async () => {
  const events = {};const shown = [];const messages = [];let focused = false;
  const context = { URL, self: { location: { origin: 'https://application.invalid' }, registration: { scope: 'https://application.invalid/milkyway/', showNotification: async (title, options) => shown.push({ title, options }) }, addEventListener(name, listener) { events[name] = listener; }, clients: { matchAll: async () => [{ url: 'https://application.invalid/milkyway/', postMessage: message => messages.push(message), focus: async () => { focused = true; } }] } } };
  vm.runInNewContext(source('milkyway/sw.js'), context);
  const invoke = async payload => { let pending;events.push({ data: { json: () => payload }, waitUntil: task => { pending = task; } });await pending; };
  await invoke({ title: 'Fixture Live', body: 'Fixture', url: 'https://evil.invalid/milkyway/' });assert.equal(shown.length, 0);
  await invoke({ title: 'Fixture Live', body: 'Fixture', url: `/milkyway/#live=${roomName}`, silent: true });assert.equal(shown.length, 1);assert.equal(shown[0].options.silent, true);
  let pending;events.notificationclick({ notification: { data: shown[0].options.data, close() {} }, waitUntil: task => { pending = task; } });await pending;
  assert.equal(focused, true);assert.equal(messages[0].type, 'mw-open-live');assert.ok(messages[0].url.endsWith(roomName));
});














// Minimal in-memory IndexedDB with the calls the offline data layer uses.
function memoryIndexedDB() {
  const rows = new Map();
  const later = (request, value) => { setTimeout(() => { request.result = value;request.onsuccess?.(); }, 0);return request; };
  const store = transaction => {
    const done = request => { transaction.pending++;const success = request.onsuccess;request.onsuccess = () => { success?.();if (--transaction.pending === 0) setTimeout(() => transaction.oncomplete?.(), 0); }; };
    const call = value => { const request = {};done(request);return later(request, value); };
    return {
      get: key => call(rows.get(key)), put: value => { rows.set(value.key, value);return call(undefined); }, count: () => call(rows.size), clear: () => { rows.clear();return call(undefined); },
      index: () => ({ openCursor() { const request = {};done(request);const sorted = [...rows.values()].sort((a, b) => a.savedAt - b.savedAt);let at = 0;const step = () => later(request, at < sorted.length ? { value: sorted[at], delete: () => rows.delete(sorted[at].key), continue: () => { at++;done(request);step(); } } : null);step();return request; } }),
    };
  };
  return { rows, open() { const request = {};setTimeout(() => { request.result = { createObjectStore: () => ({ createIndex() {} }), transaction() { const transaction = { pending: 0 };transaction.objectStore = () => store(transaction);return transaction; } };request.onupgradeneeded?.();request.onsuccess(); }, 0);return request; } };
}

test('offline data layer replays saved reads, answers empty lists offline and fires one reconnect refresh', async () => {
  const supabase = 'https://wpclkhgizbvxuvbhbwzs.supabase.co';
  let online = true;const calls = [];const events = [];const listeners = {};
  const network = async (input, init) => {
    const address = String(input);calls.push(address);
    if (!online) throw new TypeError('Failed to fetch');
    if (address.includes('mw-probe')) return new Response('{}', { status: 200 });
    return new Response(JSON.stringify([{ id: 'post-1', account: init?.headers?.Authorization || '' }]), { status: 200, headers: { 'content-type': 'application/json', 'content-range': '0-0/1' } });
  };
  const idb = memoryIndexedDB();
  const window = { fetch: network, addEventListener: (name, listener) => { (listeners[name] ||= []).push(listener); }, dispatchEvent: event => events.push(event.type) };
  const context = vm.createContext({ window, indexedDB: idb, navigator: { get onLine() { return online; } }, document: { documentElement: { dataset: {} }, addEventListener() {}, visibilityState: 'visible' }, location: { href: 'https://application.invalid/milkyway/', origin: 'https://application.invalid' }, localStorage: { getItem: () => 'en' }, Headers, Request, Response, URL, CustomEvent: class { constructor(type) { this.type = type; } }, setTimeout, clearTimeout, atob, JSON, Promise, Date, Map, String, Math });
  vm.runInContext(source('milkyway/offline-data.js'), context);
  const token = payload => `Bearer x.${Buffer.from(JSON.stringify(payload)).toString('base64url')}.y`;
  const feed = `${supabase}/rest/v1/mw_posts?select=*&order=created_at.desc&limit=40`;
  const first = await window.fetch(feed, { headers: { Authorization: token({ sub: ownerId }) } });
  assert.equal((await first.json())[0].id, 'post-1');
  await new Promise(resolve => setTimeout(resolve, 20));
  assert.equal(idb.rows.size, 1);

  online = false;
  const saved = await window.fetch(feed, { headers: { Authorization: token({ sub: ownerId }) } });
  assert.equal(saved.headers.get('x-mw-offline'), 'saved');assert.equal((await saved.json())[0].id, 'post-1');
  // Another account never sees the first account's saved copy; it gets a calm empty list instead of an error.
  const other = await window.fetch(feed, { headers: { Authorization: token({ sub: otherId }) } });
  assert.equal(other.headers.get('x-mw-offline'), 'empty');assert.deepEqual(await other.json(), []);
  const count = await window.fetch(`${supabase}/rest/v1/mw_follows?select=*`, { method: 'HEAD', headers: { Prefer: 'count=exact' } });
  assert.equal(count.headers.get('content-range'), '*/0');
  // Writes are not replayed: they fail, and the failure reads as a friendly offline line.
  await assert.rejects(() => window.fetch(`${supabase}/rest/v1/mw_signals`, { method: 'POST', body: '{}' }), /Failed to fetch/);
  assert.equal(context.window.MilkyWayOffline.offline, true);
  assert.match(context.window.MilkyWayOffline.friendly('TypeError: Failed to fetch'), /No connection right now/);
  assert.equal(context.window.MilkyWayOffline.friendly('Wrong password'), 'Wrong password');

  online = true;
  listeners.online.forEach(listener => listener());
  await new Promise(resolve => setTimeout(resolve, 500));
  assert.equal(context.window.MilkyWayOffline.offline, false);
  assert.deepEqual(events.filter(type => type === 'mw-reconnected'), ['mw-reconnected']);
  assert.ok(calls.some(address => address.includes('mw-probe')));
  await context.window.MilkyWayOffline.clear();
  assert.equal(idb.rows.size, 0);
});

test('prefetched feed videos play from the device with byte ranges, and unsaved videos go to the network', async () => {
  const listeners = {};const network = [];
  const video = 'https://wpclkhgizbvxuvbhbwzs.supabase.co/storage/v1/object/public/portfolio/milkyway/fixture/clip.mp4';
  const stored = new Map([['mw-feed-videos', new Map([[video, new Response(new Uint8Array(100).map((_, index) => index), { headers: { 'content-type': 'video/mp4' } })]])]]);
  const caches = { open: async name => ({ match: async url => { const saved = stored.get(name)?.get(String(url));return saved?.clone(); } }) };
  const context = { URL, Response, caches, fetch: async request => { network.push(request.url);return new Response('network', { status: 206 }); }, self: { location: { origin: 'https://application.invalid' }, registration: { scope: 'https://application.invalid/milkyway/' }, addEventListener(name, listener) { (listeners[name] ||= []).push(listener); }, clients: { matchAll: async () => [] } } };
  vm.runInNewContext(source('milkyway/sw.js'), context);
  const play = async (url, range, destination = 'video') => {
    let answer;
    const event = { request: { url, method: 'GET', destination, headers: new Headers(range ? { range } : {}) }, respondWith: response => { if (answer !== undefined) throw new Error('respondWith called more than once'); answer = response; } };
    for (const listener of listeners.fetch || []) listener(event);
    return answer && await answer;
  };
  const part = await play(video, 'bytes=10-19');
  assert.equal(part.status, 206);assert.equal(part.headers.get('content-range'), 'bytes 10-19/100');
  assert.deepEqual([...new Uint8Array(await part.arrayBuffer())], [10, 11, 12, 13, 14, 15, 16, 17, 18, 19]);
  const open = await play(video, 'bytes=90-');
  assert.equal(open.headers.get('content-range'), 'bytes 90-99/100');assert.equal(open.headers.get('content-length'), '10');
  assert.equal((await play(video, 'bytes=500-')).status, 416);
  const whole = await play(video, null, '');
  assert.equal(whole.status, 200);assert.equal((await whole.arrayBuffer()).byteLength, 100);
  assert.equal(network.length, 0);
  // Not saved yet: the request goes to the network untouched; other files are left to the normal caching.
  await play(video.replace('clip', 'other'), 'bytes=0-');
  assert.equal(network.length, 1);
  assert.equal(await play('https://wpclkhgizbvxuvbhbwzs.supabase.co/rest/v1/mw_posts', null, ''), undefined);
});

test('offline likes, saves, follows and comments are queued once, keep only the last choice and sync without duplicates', async () => {
  const postId = '33333333-3333-4333-8333-333333333333';
  const items = new Map();const events = [];const listeners = {};const writes = [];
  let online = false;let failNetwork = false;
  const result = error => Promise.resolve({ error });
  const sb = { supabaseKey: 'fixture', auth: { getSession: async () => ({ data: { session: { access_token: 'token', user: { id: ownerId } } } }) }, from: table => ({
    insert: row => { if (failNetwork) return result({ message: 'TypeError: Failed to fetch' });writes.push(['insert', table, row]);return result(table === 'mw_saves' ? { code: '23505', message: 'duplicate' } : null); },
    delete: () => ({ match: row => { writes.push(['delete', table, row]);return result(null); } }),
  }) };
  const window = { addEventListener: (name, listener) => { (listeners[name] ||= []).push(listener); }, dispatchEvent: event => events.push(event.type), MilkyWayOffline: { get offline() { return !online; }, isNetworkError: error => /failed to fetch/i.test(String(error?.message ?? error)) } };
  const context = vm.createContext({ window, user: { id: ownerId }, sb, navigator: { get onLine() { return online; } }, localStorage: { getItem: key => items.get(key) ?? null, setItem: (key, value) => items.set(key, value) }, document: { readyState: 'complete', getElementById: () => null, querySelectorAll: () => [], addEventListener() {}, visibilityState: 'visible' }, CSS: { escape: value => value }, CustomEvent: class { constructor(type, init) { this.type = type;this.detail = init?.detail; } }, setTimeout: () => 0, fetch: async () => { writes.push(['details']);return new Response('{}'); }, console, TypeError, Response, Date, JSON });
  vm.runInContext(source('milkyway/offline-actions.js'), context);
  const outbox = window.MilkyWayOutbox;
  assert.equal(outbox.offline(), true);
  // Tapping a reaction on, off and on again while offline leaves one queued "on".
  outbox.queue({ type: 'signal', target: postId, kind: 'light', on: true });
  outbox.queue({ type: 'signal', target: postId, kind: 'light', on: false });
  outbox.queue({ type: 'signal', target: postId, kind: 'light', on: true });
  outbox.queue({ type: 'save', target: postId, on: true });
  outbox.queue({ type: 'follow', target: otherId, on: false });
  outbox.queue({ type: 'comment', id: '00000000-0000-4000-8000-000000000001', target: postId, author: 'Fixture', body: 'Hello offline', details: { parentId: null, tags: [{ id: otherId }] } });
  assert.equal(outbox.size, 4);
  assert.equal(outbox.state('signal', postId, 'light'), true);assert.equal(outbox.state('follow', otherId), false);
  assert.equal(outbox.comments(postId)[0].body, 'Hello offline');assert.equal(outbox.comments(postId)[0].mwPending, true);
  // Still offline: nothing is sent.
  assert.equal((await outbox.flush()).synced, 0);assert.equal(writes.length, 0);
  // Online, but the connection drops on the first write: everything stays queued.
  online = true;failNetwork = true;
  await outbox.flush();
  assert.equal(outbox.size, 4);
  failNetwork = false;
  const synced = await outbox.flush();
  assert.equal(synced.synced, 4);assert.equal(outbox.size, 0);
  assert.deepEqual(writes.map(([kind, table]) => `${kind} ${table || ''}`.trim()), ['insert mw_signals', 'insert mw_saves', 'delete mw_follows', 'insert mw_echoes', 'details']);
  assert.equal(JSON.stringify(writes[0][2]), JSON.stringify({ post_id: postId, user_id: ownerId, kind: 'light' }));
  assert.equal(writes[3][2].id, '00000000-0000-4000-8000-000000000001');
  assert.ok(events.includes('mw-outbox-synced'));
  // Another account never sends (or sees) the first account's queue.
  online = false;outbox.queue({ type: 'save', target: postId, on: true });
  context.user = { id: otherId };
  assert.equal(outbox.size, 0);assert.equal(outbox.state('save', postId), undefined);
});

test('starting offline never blocks: saved sessions read as valid offline, boot draws the feed at once, no native error screen', async () => {
  let online = false;const store = new Map();
  const listeners = {};
  const window = { fetch: async () => { if (!online) throw new TypeError('Failed to fetch');return new Response('{}', { status: 200 }); }, addEventListener: (name, listener) => { (listeners[name] ||= []).push(listener); }, dispatchEvent() {} };
  const context = vm.createContext({ window, indexedDB: memoryIndexedDB(), navigator: { get onLine() { return online; } }, document: { documentElement: { dataset: {} }, addEventListener() {}, visibilityState: 'visible' }, location: { href: 'https://application.invalid/milkyway/', origin: 'https://application.invalid' }, localStorage: { getItem: key => store.get(key) ?? null, setItem: (key, value) => store.set(key, String(value)), removeItem: key => store.delete(key) }, Headers, Request, Response, URL, CustomEvent: class { constructor(type) { this.type = type; } }, setTimeout, clearTimeout, atob, JSON, Promise, Date, Map, String, Math });
  vm.runInContext(source('milkyway/offline-data.js'), context);
  const storage = context.window.MilkyWayOffline.authStorage;
  const key = 'sb-wpclkhgizbvxuvbhbwzs-auth-token';
  const expired = Math.floor(Date.now() / 1000) - 3600;
  storage.setItem(key, JSON.stringify({ access_token: 'a', refresh_token: 'r', expires_at: expired, user: { id: ownerId } }));
  // Offline, an expired session reads as valid for a few minutes, so the auth client does not wait ~30 s on a refresh.
  const held = JSON.parse(storage.getItem(key));
  assert.ok(held.expires_at > Date.now() / 1000);assert.equal(held.user.id, ownerId);
  // Writing that copy back keeps the real expiry on the device.
  storage.setItem(key, JSON.stringify(held));
  assert.equal(JSON.parse(store.get(key)).expires_at, expired);assert.equal('mw_real_expires_at' in JSON.parse(store.get(key)), false);
  online = true;
  listeners.online.forEach(listener => listener());
  await new Promise(resolve => setTimeout(resolve, 500));
  assert.equal(context.window.MilkyWayOffline.offline, false);
  assert.equal(JSON.parse(storage.getItem(key)).expires_at, expired);

  const page = source('milkyway/index.html');
  assert.match(page, /createClient\(SUPABASE_URL,SUPABASE_ANON_KEY,window\.MilkyWayOffline\?\.authStorage/);
  const boot = page.match(/async function boot\(\)\{[\s\S]*?\n\}/)?.[0];
  assert.ok(boot, 'boot function exists and can be inspected');
  assert.ok(boot.indexOf('loadFeed()') < boot.indexOf('ensureProfile'), 'the feed loads before the profile check');
  assert.doesNotMatch(boot, /await ensureProfile/);
  const config = JSON.parse(source('capacitor.config.json'));
  assert.equal(config.server.url, 'https://www.masiyatunda.com/milkyway/');
  assert.ok(config.server.allowNavigation.includes('www.masiyatunda.com'));
  assert.equal(config.server.errorPath, undefined);
  const nativeActivity = source('android/native-src/com/masiyatunda/milkyway/MainActivity.java');
  assert.match(nativeActivity, /registerPlugin\(MilkyWayNativePlugin\.class\)/);
  assert.match(nativeActivity, /webView\.canGoBack\(\)/);
  assert.match(nativeActivity, /finish\(\)/);
  assert.match(nativeActivity, /OnBackPressedCallback/);
  assert.match(source('android/native-src/com/masiyatunda/milkyway/MilkyWayNativePlugin.java'), /void exitApp\(PluginCall call\)/);
  assert.match(source('milkyway/android-app.js'), /mwNativeBackButton/);
  assert.match(source('sw-cache.js'), /saved && self\.navigator\.onLine === false/);
  // A page that was never saved falls back to the saved app shell, never to a "No connection" screen.
  const worker = source('sw-cache.js');
  assert.doesNotMatch(worker, /Hakuna mtandao|You are offline|status: 503/);
  assert.match(worker, /return \(await shell\(cache\)\) \|\|/);
});
