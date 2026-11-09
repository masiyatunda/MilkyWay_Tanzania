(() => {
  // In-app replacement for window.prompt / confirm / alert: dark glass modals that return promises.
  const words = {
    cancel: ['Cancel', 'Ghairi', 'Annuler', '取消', 'إلغاء', 'Cancelar', 'रद्द करें', 'Abbrechen'],
    confirm: ['Confirm', 'Thibitisha', 'Confirmer', '确认', 'تأكيد', 'Confirmar', 'पुष्टि करें', 'Bestätigen'],
    ok: ['OK', 'Sawa', 'OK', '好的', 'حسنًا', 'OK', 'ठीक है', 'OK'],
    close: ['Close', 'Funga', 'Fermer', '关闭', 'إغلاق', 'Fechar', 'बंद करें', 'Schließen'],
    search: ['Search…', 'Tafuta…', 'Rechercher…', '搜索…', 'بحث…', 'Pesquisar…', 'खोजें…', 'Suchen…'],
    empty: ['No matches', 'Hakuna kinacholingana', 'Aucun résultat', '没有匹配项', 'لا نتائج', 'Sem resultados', 'कोई परिणाम नहीं', 'Keine Treffer'],
    required: ['Please fill this in.', 'Tafadhali jaza hapa.', 'Veuillez remplir ce champ.', '请填写此项。', 'يرجى ملء هذا الحقل.', 'Preencha este campo.', 'कृपया इसे भरें।', 'Bitte ausfüllen.'],
    notice: ['MilkyWay', 'MilkyWay', 'MilkyWay', 'MilkyWay', 'MilkyWay', 'MilkyWay', 'MilkyWay', 'MilkyWay'],
  };
  const order = ['en', 'sw', 'fr', 'zh', 'ar', 'pt', 'hi', 'de'];
  const language = () => { try { return window.MilkyWayI18n?.language?.() || localStorage.getItem('mw_lang') || 'sw'; } catch { return 'sw'; } };
  const word = key => words[key][Math.max(0, order.indexOf(language()))] || words[key][0];
  const queue = [];
  let active = null;

  function element(tag, className, text) { const node = document.createElement(tag);if (className) node.className = className;if (text != null) node.textContent = text;return node; }

  function show(kind, options) {
    return new Promise(resolve => { queue.push({ kind, options, resolve });if (!active) next(); });
  }

  function next() {
    const job = queue.shift();
    if (!job) { active = null;return; }
    const { kind, options, resolve } = job;
    const backdrop = element('div', 'mw-dialog-bg');backdrop.dataset.kind = kind;
    const box = element('div', 'mw-dialog');box.setAttribute('role', kind === 'alert' ? 'alertdialog' : 'dialog');box.setAttribute('aria-modal', 'true');
    const title = element('h3', 'mw-dialog-title', options.title || (kind === 'alert' ? word('notice') : ''));title.id = 'mwDialogTitle';box.setAttribute('aria-labelledby', title.id);
    box.append(title);
    if (options.message) { const text = element('p', 'mw-dialog-text', options.message);text.id = 'mwDialogText';box.setAttribute('aria-describedby', text.id);box.append(text); }
    let field = null, error = null, list = null, picked = null;
    if (kind === 'prompt') {
      field = element(options.multiline ? 'textarea' : 'input', 'mw-dialog-input');
      if (!options.multiline) field.type = options.type || 'text';else field.rows = 3;
      field.value = options.value || '';field.placeholder = options.placeholder || '';field.autocomplete = 'off';
      if (options.maxLength) field.maxLength = options.maxLength;
      field.setAttribute('aria-label', options.title || options.message || '');
      error = element('small', 'mw-dialog-error');error.hidden = true;error.setAttribute('role', 'alert');
      box.append(field, error);
    }
    if (kind === 'choose') {
      const items = options.options || [];
      if (items.length > 6) {
        field = element('input', 'mw-dialog-input mw-dialog-search');field.type = 'search';field.placeholder = word('search');field.setAttribute('aria-label', word('search'));box.append(field);
        field.oninput = () => { const term = field.value.trim().toLowerCase();let shown = 0;list.querySelectorAll('.mw-dialog-option').forEach(row => { const match = !term || row.dataset.search.includes(term);row.hidden = !match;shown += match; });empty.hidden = shown > 0; };
      }
      list = element('div', 'mw-dialog-list');list.setAttribute('role', 'listbox');
      for (const item of items) {
        const row = element('button', 'mw-dialog-option');row.type = 'button';row.setAttribute('role', 'option');row.dataset.search = `${item.label || ''} ${item.detail || ''}`.toLowerCase();
        const avatar = element('span', 'mw-dialog-avatar');
        if (item.image) { const image = element('img');image.src = item.image;image.alt = '';avatar.append(image); } else avatar.textContent = (item.label || '?').trim().charAt(0).toUpperCase();
        const label = element('span', 'mw-dialog-option-text');label.append(element('b', '', item.label || ''));if (item.detail) label.append(element('small', '', item.detail));
        row.append(avatar, label);row.onclick = () => { picked = item.value;finish(true); };
        list.append(row);
      }
      const empty = element('p', 'mw-dialog-empty', word('empty'));empty.hidden = items.length > 0;
      box.append(list, empty);
    }
    const actions = element('div', 'mw-dialog-actions');
    const cancel = element('button', 'mw-dialog-btn mw-dialog-cancel', options.cancelText || word(kind === 'choose' ? 'close' : 'cancel'));cancel.type = 'button';
    const accept = element('button', `mw-dialog-btn mw-dialog-accept${options.danger ? ' is-danger' : ''}`, options.confirmText || word(kind === 'alert' ? 'ok' : 'confirm'));accept.type = 'button';
    if (kind !== 'alert') actions.append(cancel);
    if (kind !== 'choose') actions.append(accept);
    box.append(actions);backdrop.append(box);
    const returnFocus = document.activeElement;
    document.body.append(backdrop);document.documentElement.classList.add('mw-dialog-open');
    requestAnimationFrame(() => backdrop.classList.add('is-open'));
    active = { finish };

    function finish(ok) {
      if (ok && kind === 'prompt') {
        const value = field.value;
        if (options.required && !value.trim()) { error.textContent = options.requiredText || word('required');error.hidden = false;field.focus();return; }
        const problem = options.validate?.(value);
        if (problem) { error.textContent = problem;error.hidden = false;field.focus();return; }
      }
      backdrop.classList.remove('is-open');backdrop.classList.add('is-closing');
      setTimeout(() => { backdrop.remove();if (!queue.length) document.documentElement.classList.remove('mw-dialog-open');try { returnFocus?.focus?.({ preventScroll: true }); } catch {}next(); }, 160);
      document.removeEventListener('keydown', keys, true);
      if (kind === 'prompt') resolve(ok ? field.value : null);
      else if (kind === 'confirm') resolve(!!ok);
      else if (kind === 'choose') resolve(ok ? picked : null);
      else resolve();
    }
    function keys(event) {
      if (event.key === 'Escape') { event.preventDefault();event.stopPropagation();finish(kind === 'alert'); }
      else if (event.key === 'Enter' && kind !== 'choose' && !(field && field.tagName === 'TEXTAREA' && !(event.ctrlKey || event.metaKey)) && document.activeElement !== cancel) { event.preventDefault();finish(true); }
      else if (event.key === 'Tab') {
        const focusable = [...box.querySelectorAll('input,textarea,button')].filter(node => !node.hidden && !node.closest('[hidden]'));
        const first = focusable[0], last = focusable.at(-1);
        if (event.shiftKey && document.activeElement === first) { event.preventDefault();last.focus(); } else if (!event.shiftKey && document.activeElement === last) { event.preventDefault();first.focus(); }
      }
    }
    document.addEventListener('keydown', keys, true);
    cancel.onclick = () => finish(false);accept.onclick = () => finish(true);
    backdrop.addEventListener('click', event => { if (event.target === backdrop) finish(kind === 'alert'); });
    if (field) field.addEventListener('input', () => { if (error) error.hidden = true; });
    setTimeout(() => { if (field) { field.focus();if (kind === 'prompt') field.select?.(); } else (kind === 'choose' ? list.querySelector('button') || cancel : accept).focus(); }, 30);
  }

  const normalise = (value, extra) => typeof value === 'string' ? { message: value, ...extra } : { ...(value || {}), ...extra };
  const api = {
    prompt: (options, value) => show('prompt', normalise(options, value === undefined ? {} : { value })),
    confirm: options => show('confirm', normalise(options)),
    alert: options => {
      const details = normalise(options), offline = window.MilkyWayOffline;
      // A dropped connection is not an error worth a modal: a short note appears and the app reconnects by itself.
      if (offline?.isNetworkError(details.message)) { if (typeof window.toast === 'function') { window.toast(offline.friendly(details.message));return Promise.resolve(); } details.message = offline.friendly(details.message); }
      return show('alert', details);
    },
    choose: options => show('choose', normalise(options)),
    get open() { return !!active; },
  };
  window.MilkyWayDialog = api;
  // Alerts never return a value, so any remaining caller can safely get the in-app version.
  window.alert = message => { api.alert(String(message ?? '')); };
})();
