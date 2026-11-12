const CACHE='milkyway-v124-live-reconnect-safe-area-v1';
const ASSETS=[ './mw-bundle-core.css?v=1','./mw-bundle-live.css?v=8','./mw-bundle-overlays.css?v=1','./mw-bundle-theme-final.css?v=1','./','./index.html','./mobile-galaxy.css?v=1','./live-room.css?v=10','./live-room.js?v=13','./galaxy.css?v=2','./galaxy-live.css','./galaxy-nebula.svg','./galaxy-starfield.svg','./premium.css','./theme.css','./engage.css','./engage.js','./video-compress.js','./suggested.css','./suggested.js','./chat-settings.css','./chat-settings.js','./compact-buttons.css?v=2','./brand/milkyway-emblem-96.png','./brand/milkyway-watermark.png','./brand/milkyway-logo-web.png','./favicon.ico','./premium.js','./translations.js','./dm-files.js','./ui-language.js','./locale-loader.js?v=1','./manifest.json','./icon-192.png','./icon-512.png'];
ASSETS.push('./language-dropdown.js','./language-dropdown.css');
ASSETS.push('./mw-dialog.js','./mw-dialog.css','./studio.css');
ASSETS.push('./live-globe.css','./cosmos.css','./brand/earth-texture.jpg','./shared-theme.js?v=2','./release.css','./release-shell.js','./icon-maskable-192.png','./icon-maskable-512.png');
// The Live backdrop is saved the first time Live opens, so a first install on a slow network downloads less.
ASSETS.push('./media-images.js','./backgrounds/app-background.webp');
ASSETS.push('./live-notifications.js');
ASSETS.push('./account-hub.js','./account-hub.css','./media-playback.js?v=2');
ASSETS.push('./chat.js','./chat.css','./chat-doodle.svg','./group-settings.js','./group-settings.css');
ASSETS.push('./android-app.js','./android-app.css','./profile-galaxy-watermark.svg');
ASSETS.push('./settings-ui.js','./settings-ui.css','./account-header.css','./edge-layout.css');
ASSETS.push('./live-globe.js','./performance.css','./themes.css?v=2');

ASSETS.push('./live-in-feed.js','./live-in-feed.css');
ASSETS.push('./calls.css','./chat-search.js','./account-country.js','./account-details.js');


ASSETS.push('./gallery.js','./gallery.css','./live-broadcast.js');
ASSETS.push('./post-tools.js','./post-tools.css','./final-layout.js','./final-layout.css');
ASSETS.push('./native-push.js','./share-target.js','./app-update.js','./live-themes.css?v=2');
// Versioned to match the tags in index.html so phones never pair a new page with old gift code.
// Offline data layer: saved feed, profiles and counts on the device, quiet reconnecting.
ASSETS.push('./offline-data.js?v=2');
// Feed prefetching and optimistic actions (likes, saves, follows, comments queued while offline).
ASSETS.push('./media-prefetch.js?v=1','./offline-actions.js?v=1');
ASSETS.push('./gift-catalog.js?v=63','./qr-code.js?v=62','./gifts.js?v=66','./gifts.css?v=65');
// Shared caching (see /sw-cache.js): app shell and media load from the device, pages fall back to it when the network is slow.
// The test harness loads this file without importScripts, so caching is skipped there.
if (typeof importScripts === 'function') importScripts('/sw-cache.js');
if (self.MWCache) self.MWCache.install({ prefix: 'milkyway-', version: CACHE.replace(/^milkyway-/, ''), precache: ASSETS, offlinePage: './index.html' });
// Background Sync (where supported) wakes the worker once the network returns; open MilkyWay windows then refresh quietly.
self.addEventListener('sync', event => {
  if (event.tag !== 'mw-reconnect') return;
  event.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clients => clients.forEach(client => client.postMessage({ type: 'mw-reconnect' }))));
});
// Feed videos saved on the device (prefetched by media-prefetch.js, or kept under "Offline videos") play from there,
// online or not. Players ask for byte ranges, so each answer is cut from the saved file and seeking works offline too.
// Videos that are not saved go straight to the network as before.
const VIDEO_CACHES=['mw-feed-videos','mw-offline-videos'];
const VIDEO_STORAGE='https://wpclkhgizbvxuvbhbwzs.supabase.co/storage/v1/object/public/';
const VIDEO_FILE=/\.(?:mp4|m4v|mov|webm|ogv|3gp)$/i;
async function savedVideo(request){
  let saved;
  for(const name of VIDEO_CACHES){saved=await caches.open(name).then(cache=>cache.match(request.url,{ignoreVary:true})).catch(()=>undefined);if(saved)break}
  if(!saved)return fetch(request);
  return videoRange(await saved.arrayBuffer(),saved.headers.get('content-type')||'video/mp4',request.headers.get('range'));
}
function videoRange(buffer,type,range){
  const bytes=buffer instanceof Uint8Array?buffer:new Uint8Array(buffer),size=bytes.byteLength,base={'Content-Type':type,'Accept-Ranges':'bytes','x-mw-offline':'saved'};
  const match=/^bytes=(\d*)-(\d*)$/.exec(String(range||'').trim());
  if(!match||(match[1]===''&&match[2]===''))return new Response(bytes,{status:200,headers:{...base,'Content-Length':String(size)}});
  let start,end;
  if(match[1]===''){start=Math.max(0,size-Number(match[2]));end=size-1}
  else{start=Number(match[1]);end=match[2]===''?size-1:Math.min(Number(match[2]),size-1)}
  if(start>=size||start>end)return new Response(null,{status:416,headers:{...base,'Content-Range':`bytes */${size}`}});
  return new Response(bytes.slice(start,end+1),{status:206,statusText:'Partial Content',headers:{...base,'Content-Range':`bytes ${start}-${end}/${size}`,'Content-Length':String(end-start+1)}});
}
self.addEventListener('fetch',event=>{
  const request=event.request;
  if(request.method!=='GET'||!request.url.startsWith(VIDEO_STORAGE))return;
  let path='';try{path=new URL(request.url).pathname}catch{return}
  if(request.destination!=='video'&&!VIDEO_FILE.test(path))return;
  event.respondWith(savedVideo(request));
});
const CALL_HASH=/^#call=([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})$/i;
function showCall(data){
  const call=data.call||{};
  if(!CALL_HASH.test(new URL(data.url,self.location.origin).hash)||!['ring','missed'].includes(call.kind))return Promise.resolve();
  return self.clients.matchAll({type:'window',includeUncontrolled:true}).then(clients=>{
    const visible=clients.filter(client=>client.visibilityState==='visible'&&new URL(client.url).pathname.startsWith('/milkyway/'));
    // An open app rings by itself; the push only nudges it to check straight away.
    if(call.kind==='ring'&&visible.length){visible.forEach(client=>client.postMessage({type:'mw-call-push',id:call.id}));return}
    const ring=call.kind==='ring';
    return self.registration.showNotification(data.title.slice(0,160),{body:data.body.slice(0,200),icon:'./icon-192.png',badge:'./brand/milkyway-emblem-96.png',tag:String(data.tag||'').slice(0,180),renotify:true,requireInteraction:ring,silent:false,vibrate:ring?[700,350,700,350,700,350,700,350,700]:[200],timestamp:Date.now(),
      actions:ring?[{action:'answer',title:String(call.answer||'Answer').slice(0,40)},{action:'decline',title:String(call.decline||'Decline').slice(0,40)}]:[],
      data:{url:new URL(data.url,self.location.origin).href,call:{id:call.id,kind:call.kind}}});
  });
}
self.addEventListener('push', event => {
  let data;
  try { data = event.data?.json(); } catch { return; }
  if (!data || typeof data.title !== 'string' || typeof data.body !== 'string' || typeof data.url !== 'string') return;
  let address;
  try { address = new URL(data.url, self.location.origin); } catch { return; }
  if (address.origin !== self.location.origin || address.pathname !== '/milkyway/') return;
  if (data.call) { event.waitUntil(showCall(data)); return; }
  if (!/^#live=mw-conversation-(audio|video)-[a-f0-9-]{36}$/i.test(address.hash)) return;
  event.waitUntil(self.registration.showNotification(data.title.slice(0, 160), { body: data.body.slice(0, 200), icon: './icon-192.png', badge: './brand/milkyway-emblem-96.png', tag: String(data.tag || '').slice(0, 180), renotify: false, silent: data.silent === true, data: { url: address.href } }));
});
self.addEventListener('notificationclick', event => {
  event.notification.close();
  const address = new URL(event.notification.data?.url || '/milkyway/', self.location.origin);
  if (address.origin !== self.location.origin || address.pathname !== '/milkyway/') return;
  const call = event.notification.data?.call;
  if (call && CALL_HASH.test(address.hash)) {
    // Ringing: Answer / Decline / tap; missed: open the chats. "return" brings back an ongoing call.
    const action = call.kind === 'ring' ? (['answer', 'decline'].includes(event.action) ? event.action : 'open') : call.kind === 'active' ? 'return' : 'missed';
    event.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(async clients => {
      const client = clients.find(item => new URL(item.url).pathname.startsWith('/milkyway/'));
      if (client) { client.postMessage({ type: 'mw-call-action', id: call.id, action });await client.focus?.().catch(() => {}); }
      else await self.clients.openWindow(`${address.href}&do=${action}`);
    }));
    return;
  }
  event.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(async clients => {
    const client = clients.find(item => new URL(item.url).pathname.startsWith('/milkyway/'));
    if (client) { client.postMessage({ type: 'mw-open-live', url: address.href });await client.focus(); }
    else await self.clients.openWindow(address.href);
  }));
});

self.addEventListener('fetch', event => {
  const url = event.request.url;
  if (event.request.method !== 'GET') return;
  // The dedicated video handler above owns public Supabase video requests.
  // Do not call respondWith a second time for the same fetch event.
  if (url.startsWith(VIDEO_STORAGE)) return;
  // Locale catalogs are fetched only when needed and cached after first use for offline language support.
  if (/\/milkyway\/locales\/(?:ar|pt|hi|de)(?:-extra)?\.js(?:\?|$)/i.test(url)) {
    event.respondWith((async () => {
      const cache = await caches.open('mw-locale-catalogs-v1');
      try {
        const response = await fetch(event.request);
        if (response.ok) await cache.put(event.request, response.clone());
        return response;
      } catch {
        return (await cache.match(event.request)) || Response.error();
      }
    })());
    return;
  }
  if (!/\.(jpg|jpeg|png|webp|gif|mp4|webm)(\?|$)/i.test(url)) return;
  event.respondWith((async () => {
    const cache = await caches.open('mw-media-v1');
    const hit = await cache.match(event.request);
    if (hit) return hit;
    try {
      const res = await fetch(event.request);
      if (res.ok) cache.put(event.request, res.clone());
      return res;
    } catch (e) { return hit || Response.error(); }
  })());
});
