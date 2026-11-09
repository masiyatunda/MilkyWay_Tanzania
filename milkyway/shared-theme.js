
(() => {
  // App-wide themes: Galaxy 3D Dynamic, Clean MilkyWay Galaxy, Clear Glass (light) and Sunlight (high-contrast for outdoor use).
  // Clear Glass is the startup default because it is the fastest to paint; a theme picked in Appearance always wins.
  const themes = ['galaxy', 'milkyway', 'nebula', 'ocean', 'emerald', 'rose', 'light', 'sunlight'];
  const tones = { galaxy: 'dark', milkyway: 'dark', nebula: 'dark', ocean: 'dark', emerald: 'dark', rose: 'dark', light: 'light', sunlight: 'light' };
  const apply = () => {
    let saved = localStorage.getItem('mw_appearance');
    // Aurora, Obsidian and Andromeda were removed; anyone who had picked one moves to Clean MilkyWay Galaxy.
    if (['aurora', 'obsidian', 'andromeda'].includes(saved)) { saved = 'milkyway';localStorage.setItem('mw_appearance', saved); }
    const theme = themes.includes(saved) ? saved : 'light';
    // The selected MilkyWay theme owns the app palette. Light Glass stays light and airy
    // regardless of Android/iOS Dark Mode; other themes use their own fixed palette.
    const tone = tones[theme];
    const root = document.documentElement, previous = root.dataset.mwAppearance;
    if (previous === theme && root.dataset.mwTone === tone) { syncControls(theme, tone);return; }
    // Phones keep fixed, blurred and GPU-promoted layers (top bar, bottom nav, Live stage) painted from the old theme
    // until something forces a repaint, and half-finished colour transitions mix the two themes. Switch with
    // transitions off, recalculate styles straight away, then let the next frames repaint every layer.
    if (previous) root.dataset.mwThemeSwitching = 'true';
    root.dataset.mwAppearance = theme;
    // One light/dark switch every stylesheet can key off, so Live, calls, dialogs and Studio follow the theme too.
    root.dataset.mwTone = tone;
    root.dataset.mwSystemTone = tone;
    root.style.colorScheme = tone;
    syncControls(theme, tone);
    if (previous) {
      void root.offsetHeight;
      requestAnimationFrame(() => requestAnimationFrame(() => { delete root.dataset.mwThemeSwitching; }));
    }
    if (previous && previous !== theme) document.dispatchEvent(new CustomEvent('mw:themechange', { detail: { theme, tone } }));
  };
  const syncControls = (theme, tone) => {
    document.querySelectorAll('[data-mw-theme-selector],#mwAppearance').forEach(select => { select.value = theme; });
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.content = theme === 'light' ? (tone === 'dark' ? '#0b1525' : '#f3f9ff') : ({ galaxy: '#0F172A', milkyway: '#120a2e', nebula: '#170b2e', ocean: '#041b2d', emerald: '#041f1a', rose: '#260b20', sunlight: '#ffffff' }[theme]);
  };
  // Low-end phones, Data Saver and reduced-motion users keep the chosen theme but skip the drifting star layers and glass blur.
  try {
    const lite = matchMedia('(prefers-reduced-motion: reduce)').matches || navigator.connection?.saveData || (navigator.deviceMemory && navigator.deviceMemory <= 2) || (navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 4) || /(^|-)2g$/.test(navigator.connection?.effectiveType || '');
    if (lite) document.documentElement.dataset.mwLite = 'true';
  } catch {}
  const options = '<option value="galaxy" data-mw-i18n="galaxy3dTheme"></option><option value="milkyway" data-mw-i18n="cleanMilkyWayTheme"></option><option value="nebula" data-mw-i18n="nebulaTheme"></option><option value="ocean" data-mw-i18n="oceanTheme"></option><option value="emerald" data-mw-i18n="emeraldTheme"></option><option value="rose" data-mw-i18n="roseGalaxyTheme"></option><option value="light" data-mw-i18n="clearGlass"></option><option value="sunlight" data-mw-i18n="sunlightTheme"></option>';
  window.MilkyWayTheme = { themes, options, apply, select(value) { if (!themes.includes(value)) return;localStorage.setItem('mw_appearance', value);apply(); } };
  apply();
  document.addEventListener('change', event => { if (event.target.matches('[data-mw-theme-selector],#mwAppearance')) window.MilkyWayTheme.select(event.target.value); });
  window.addEventListener('storage', event => { if (event.key === 'mw_appearance') apply(); });
  // Mobile browsers restore pages from the back/forward cache and the Android app resumes a frozen WebView
  // without firing storage events, so a theme picked on another page would otherwise stay stale until reload.
  window.addEventListener('pageshow', apply);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') apply(); });
})();
