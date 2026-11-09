(() => {
  const names = { sw: 'Kiswahili', en: 'English', fr: 'Français', zh: '中文', ar: 'العربية', pt: 'Português', hi: 'हिन्दी', de: 'Deutsch' };
  const menus = [];
  const closeAll = () => menus.forEach(menu => menu.close());
  for (const identity of ['langSel', 'mwLiveLanguage', 'mwAuthLanguage', 'mwSettingsLanguage']) {
    const select = document.getElementById(identity);
    if (!select) continue;
    const wrapper = document.createElement('span');wrapper.className = 'mw-language-dropdown';
    const trigger = document.createElement('button');trigger.type = 'button';trigger.className = 'mw-language-trigger';trigger.id = `${identity}Trigger`;
    trigger.setAttribute('aria-haspopup', 'listbox');trigger.setAttribute('aria-expanded', 'false');trigger.setAttribute('aria-controls', `${identity}Options`);
    const list = document.createElement('span');list.className = 'mw-language-options';list.id = `${identity}Options`;list.role = 'listbox';list.hidden = true;
    select.before(wrapper);wrapper.append(trigger, list);select.hidden = true;select.classList.add('mw-language-native');select.tabIndex = -1;
    const choices = Object.entries(names).map(([value, name]) => {
      const option = document.createElement('button');option.type = 'button';option.role = 'option';option.tabIndex = -1;option.dataset.language = value;option.textContent = name;list.append(option);
      option.onclick = event => {
        event.preventDefault();select.value = value;select.dispatchEvent(new Event('change', { bubbles: true }));close();sync();trigger.focus({ preventScroll: true });
      };
      return option;
    });
    const close = () => { list.hidden = true;trigger.setAttribute('aria-expanded', 'false'); };
    const sync = () => {
      const selected = window.MilkyWayI18n?.language() || select.value || 'sw';
      trigger.textContent = `${selected.toUpperCase()} ▾`;
      const label = window.MilkyWayI18n?.t('language') || 'Language';
      trigger.setAttribute('aria-label', `${label}: ${names[selected]}`);list.setAttribute('aria-label', label);
      choices.forEach(option => option.setAttribute('aria-selected', String(option.dataset.language === selected)));
    };
    const open = (last = false) => {
      closeAll();sync();list.hidden = false;trigger.setAttribute('aria-expanded', 'true');
      const overflow = list.getBoundingClientRect().right > window.innerWidth - 8;list.classList.toggle('align-end', overflow);
      const selected = choices.find(option => option.getAttribute('aria-selected') === 'true');
      (last ? choices.at(-1) : selected || choices[0]).focus({ preventScroll: true });
    };
    trigger.onclick = event => { event.preventDefault();list.hidden ? open() : close(); };
    wrapper.onkeydown = event => {
      const index = choices.indexOf(document.activeElement);
      if (event.key === 'Escape' && !list.hidden) { event.preventDefault();event.stopPropagation();close();trigger.focus({ preventScroll: true }); }
      else if (event.key === 'Tab') close();
      else if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) {
        event.preventDefault();
        if (list.hidden) open(event.key === 'End');
        else choices[event.key === 'Home' ? 0 : event.key === 'End' ? choices.length - 1 : (index + (event.key === 'ArrowDown' ? 1 : -1) + choices.length) % choices.length].focus({ preventScroll: true });
      } else if (event.key.length === 1 && /^[a-z]$/i.test(event.key)) {
        const match = choices.find(option => option.textContent.toLowerCase().startsWith(event.key.toLowerCase()));
        if (match && !list.hidden) { event.preventDefault();match.focus({ preventScroll: true }); }
      }
    };
    wrapper.addEventListener('focusout', event => { if (!wrapper.contains(event.relatedTarget)) close(); });
    menus.push({ close, sync, wrapper });sync();
  }
  document.addEventListener('pointerdown', event => { menus.forEach(menu => { if (!menu.wrapper.contains(event.target)) menu.close(); }); });
  document.addEventListener('click', event => { if (event.target.closest('[data-tab],a[href]')) closeAll(); });
  window.addEventListener('mw-language-change', () => menus.forEach(menu => { menu.sync();menu.close(); }));
  for (const event of ['pagehide', 'hashchange', 'popstate', 'resize']) window.addEventListener(event, closeAll);
})();
