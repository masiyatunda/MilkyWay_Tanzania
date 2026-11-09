(() => {
  const byId = identity => document.getElementById(identity);
  const translate = key => window.MilkyWayI18n.t(key);
  let cache = null;
  let loading = null;
  let cacheAccount = null;
  let loadedAt = 0;
  async function api(action, body, method = body ? 'POST' : 'GET', retry = true) {
    const accountId = user?.id;
    if (!accountId) throw new Error(translate('signInFirst'));
    const current = (await sb.auth.getSession()).data.session;
    if (!current || current.user.id !== accountId) throw new Error(translate('signInFirst'));
    const response = await fetch(`/api/milkyway-notifications?action=${action}`, { method, headers: { Authorization: `Bearer ${current.access_token}`, apikey: sb.supabaseKey || '', ...(body ? { 'Content-Type': 'application/json' } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}), cache: 'no-store', signal: AbortSignal.timeout(15000) });
    if (response.status === 401 && retry) {
      const refreshed = await sb.auth.refreshSession();
      if (!refreshed.error && refreshed.data.session?.user.id === accountId && user?.id === accountId) return api(action, body, method, false);
    }
    const result = await response.json().catch(() => { throw new Error(translate('liveInvalidResponse')); });
    // The recipient-RPC check failure is internal; it is never shown to people as a banner or status line.
    if (!response.ok && result.error === 'Live notification access could not be verified. Check the recipient RPC deployment.') throw Object.assign(new Error(''), { silent: true });
    if (!response.ok) throw new Error(window.MilkyWayI18n.text(result.error) || translate('liveAlertsUnavailable'));
    if (user?.id !== accountId) throw new Error(translate('signInFirst'));
    return result;
  }
  async function alerts(force = false) {
    const accountId = user?.id;
    if (!accountId) return { alerts: [], unread: 0 };
    if (cacheAccount !== accountId) { cache = null;loading = null;cacheAccount = accountId; }
    if (cache && !force && Date.now() - loadedAt < 10000) return cache;
    if (loading) return loading;
    const request = api('alerts').then(result => {
      if (!Array.isArray(result.alerts) || !Number.isInteger(result.unread)) throw new Error(translate('liveInvalidResponse'));
      if (user?.id === accountId) { cache = result;loadedAt = Date.now(); }
      return result;
    });
    loading = request;
    try { return await request; } finally { if (loading === request) loading = null; }
  }
  async function markRead(rooms) {
    if (!rooms.length) return;
    await api('read', { rooms });cache = null;
  }
  async function savePreferences(liveEnabled) {
    await api('preferences', { liveEnabled, soundEnabled: localStorage.getItem('mw_notify_sound') !== 'off', language: window.MilkyWayI18n.language() });
  }
  function subscriptionKey(value) {
    const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
    return Uint8Array.from(atob(normalized + '='.repeat((4 - normalized.length % 4) % 4)), character => character.charCodeAt(0));
  }
  // Registers this device for background push (Live alerts and ringing calls). Without `prompt` it never asks for permission.
  async function subscribe({ prompt = true } = {}) {
    if (!window.isSecureContext || !('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) throw new Error(translate('pushUnsupported'));
    if (!logged()) throw new Error(translate('signInFirst'));
    if (!prompt && Notification.permission !== 'granted') return false;
    const settings = await api('settings');
    if (!settings.pushAvailable || !settings.publicKey) throw new Error(translate('pushNotConfigured'));
    const permission = Notification.permission === 'default' ? await Notification.requestPermission() : Notification.permission;
    if (permission !== 'granted') throw new Error(translate('pushPermissionDenied'));
    const registration = await navigator.serviceWorker.ready;
    let subscription = await registration.pushManager.getSubscription();
    if (subscription && new Uint8Array(subscription.options.applicationServerKey || []).join(',') !== subscriptionKey(settings.publicKey).join(',')) { await subscription.unsubscribe();subscription = null; }
    subscription ||= await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: subscriptionKey(settings.publicKey) });
    await api('subscription', { subscription: subscription.toJSON() });
    return true;
  }
  async function subscribed() {
    if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window) || Notification.permission !== 'granted') return false;
    const registration = await navigator.serviceWorker.getRegistration('/milkyway/');
    return !!await registration?.pushManager?.getSubscription();
  }
  async function enablePush() {
    const status = byId('notifySoundStatus');
    const button = byId('enableBrowserNotify');button.disabled = true;
    try {
      await subscribe();
      await savePreferences(byId('mwLiveAlertPreference').checked);
      status.textContent = translate('pushEnabled');
    } catch (error) { status.textContent = error.message; }
    finally { button.disabled = false; }
  }
  async function detach() {
    if (!('serviceWorker' in navigator)) return;
    const registration = await navigator.serviceWorker.getRegistration('/milkyway/');
    const subscription = await registration?.pushManager?.getSubscription();
    if (!subscription) return;
    await api('subscription', { subscription: subscription.toJSON() }, 'DELETE');
    if (!await subscription.unsubscribe()) throw new Error(translate('pushDisableFailed'));
  }
  const preference = document.createElement('label');preference.className = 'mw-notification-preference';
  preference.innerHTML = '<input type="checkbox" id="mwLiveAlertPreference" checked><span data-mw-i18n="liveFollowerAlerts"></span>';
  byId('enableBrowserNotify').parentElement.after(preference);
  byId('enableBrowserNotify').dataset.mwI18n = 'enableBackgroundPush';
  byId('enableBrowserNotify').onclick = enablePush;
  byId('mwLiveAlertPreference').onchange = async event => {
    const control = event.target;control.disabled = true;
    try { await savePreferences(control.checked);byId('notifySoundStatus').textContent = translate('saved'); }
    catch (error) { control.checked = !control.checked;byId('notifySoundStatus').textContent = error.message; }
    finally { control.disabled = false; }
  };
  async function settings() {
    if (!logged()) return;
    const result = await api('settings');byId('mwLiveAlertPreference').checked = result.preferences.liveEnabled;
  }
  window.MilkyWayLiveNotifications = { api, alerts, markRead, detach, settings, subscribe, subscribed };
  navigator.serviceWorker?.addEventListener('message', event => {
    if (event.data?.type !== 'mw-open-live' || typeof event.data.url !== 'string') return;
    let address;
    try { address = new URL(event.data.url); } catch { return; }
    if (address.origin !== location.origin || address.pathname !== '/milkyway/' || !/^#live=mw-conversation-(audio|video)-[a-f0-9-]{36}$/i.test(address.hash)) return;
    if (window.MilkyWayLive.isActive()) { window.MilkyWayLive.open();toast(window.MilkyWayI18n.text('Leave your current Live before joining another session.'));return; }
    location.hash = address.hash;window.MilkyWayLive.open();window.MilkyWayLive.refresh();
  });
  window.addEventListener('mw-language-change', () => { if (logged()) api('settings').then(result => savePreferences(result.preferences.liveEnabled)).catch(() => {}); });
  sb.auth.onAuthStateChange(event => {
    if (event === 'SIGNED_OUT') {
      cache = null;loading = null;cacheAccount = null;
      navigator.serviceWorker?.getRegistration('/milkyway/').then(registration => registration?.pushManager?.getSubscription()).then(subscription => subscription?.unsubscribe()).catch(() => {});
    }
  });
})();
