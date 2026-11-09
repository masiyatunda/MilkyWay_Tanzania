(() => {
  // "Suggested for you": a swipeable row of accounts the signed-in user does not follow yet, shown inside the home feed.
  // Cards can be dismissed with ✕ (remembered on this device); Follow uses the same follow flow as posts.
  const DISMISSED_KEY = 'mw_suggested_dismissed';
  const LIMIT = 12;
  const FRESH_MS = 5 * 60 * 1000;
  let cache = { account: null, at: 0, people: [] };
  let loading = null;
  // The feed re-renders on refresh; keep the row where the user had swiped it.
  let scrollLeft = 0;

  const dismissed = () => { try { return new Set(JSON.parse(localStorage.getItem(DISMISSED_KEY) || '[]')); } catch { return new Set(); } };
  const dismiss = id => { const set = dismissed(); set.add(id); localStorage.setItem(DISMISSED_KEY, JSON.stringify([...set].slice(-200))); };

  async function fetchPeople() {
    const accountId = user.id;
    const [{ data: follows }, { data: profiles, error }] = await Promise.all([
      window.MilkyWayFollows.query(q => q.select('following_id').eq('follower_id', accountId)),
      sb.from('mw_profiles').select('id,display_name,username,avatar_url').neq('id', accountId).limit(60)
    ]);
    if (error) throw error;
    const followed = new Set((follows || []).map(row => row.following_id));
    const people = (profiles || []).filter(person => !followed.has(person.id));
    for (let i = people.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [people[i], people[j]] = [people[j], people[i]]; }
    cache = { account: accountId, at: Date.now(), people };
  }

  function card(person) {
    const name = esc(person.display_name || 'Msafiri');
    return `<div class="suggested-card" data-suggested="${person.id}">
      <button type="button" class="close-btn" data-suggested-close="${person.id}" data-mw-i18n-aria="dismissSuggestion" aria-label="Dismiss suggestion">✕</button>
      <button type="button" class="suggested-who" data-author="${person.id}">${avatarHTML(person, 'avatar suggested-avatar')}<strong>${name}</strong><span>@${esc(person.username || 'msafiri')}</span></button>
      <button type="button" class="follow-btn" data-suggested-follow="${person.id}" data-follow="${person.id}" data-mw-i18n="follow">${esc(window.MilkyWayI18n?.t('follow') || 'Follow')}</button>
    </div>`;
  }

  function paint(feed) {
    feed.querySelector('.suggested-strip')?.remove();
    const hidden = dismissed();
    const people = cache.people.filter(person => !hidden.has(person.id)).slice(0, LIMIT);
    if (!people.length) return;
    const strip = document.createElement('section');
    strip.className = 'suggested-strip';
    strip.innerHTML = `<h3 data-mw-i18n="suggestedForYou">${esc(window.MilkyWayI18n?.t('suggestedForYou') || 'Suggested for you')}</h3><div class="suggested-row">${people.map(card).join('')}</div>`;
    const posts = feed.querySelectorAll('.post');
    const after = posts[Math.min(2, posts.length - 1)];
    if (after) after.after(strip); else feed.prepend(strip);
    const row = strip.querySelector('.suggested-row');
    row.scrollLeft = scrollLeft;
    row.addEventListener('scroll', () => { scrollLeft = row.scrollLeft; }, { passive: true });
    bind(strip);
  }

  function bind(strip) {
    strip.querySelectorAll('[data-author]').forEach(button => button.onclick = () => openPublicProfile(button.dataset.author));
    strip.querySelectorAll('[data-suggested-close]').forEach(button => button.onclick = () => {
      const id = button.dataset.suggestedClose;
      dismiss(id);
      button.closest('.suggested-card')?.remove();
      if (!strip.querySelector('.suggested-card')) strip.remove();
    });
    strip.querySelectorAll('[data-suggested-follow]').forEach(button => {
      const id = button.dataset.suggestedFollow;
      // Taps go through the shared follow handler (data-follow). Followed accounts stay on the card (so the choice
      // can be undone) until the next refresh of suggestions.
      const person = cache.people.find(p => p.id === id);
      if (person?.followed) paintFollowButton(button, true);
    });
  }

  window.addEventListener('mw-follow-change', event => { const person = cache.people.find(p => p.id === event.detail?.id); if (person) person.followed = !!event.detail.on; });

  async function render(feed) {
    if (!logged() || !feed) { feed?.querySelector('.suggested-strip')?.remove(); return; }
    const stale = cache.account !== user.id || Date.now() - cache.at > FRESH_MS;
    if (!stale) { paint(feed); return; }
    try {
      loading ||= fetchPeople().finally(() => { loading = null; });
      await loading;
      if (feed.isConnected && mode === 'feed') paint(feed);
    } catch (error) { console.warn('suggested', error); }
  }

  window.MilkyWaySuggested = { render };
})();
