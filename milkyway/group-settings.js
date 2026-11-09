// MilkyWay group management: create groups with participants, group info/settings, admins, members, blocking and deletion.
(() => {
  const order = ['en', 'sw', 'fr', 'zh'];
  const words = {
    newGroup: ['New group', 'Group jipya', 'Nouveau groupe', '新建群组'],
    groupInfo: ['Group info', 'Taarifa za group', 'Infos du groupe', '群组信息'],
    groupSettings: ['Group settings', 'Mipangilio ya group', 'Paramètres du groupe', '群组设置'],
    name: ['Group name', 'Jina la group', 'Nom du groupe', '群组名称'],
    namePlaceholder: ['e.g. Family, Study crew', 'mf. Familia, Kikundi cha masomo', 'ex. Famille, Groupe d’étude', '例如：家人、学习小组'],
    caption: ['Caption', 'Maelezo mafupi', 'Légende', '简介'],
    captionPlaceholder: ['A short line shown under the group name', 'Mstari mfupi chini ya jina la group', 'Une courte ligne sous le nom du groupe', '显示在群名下方的一句话'],
    description: ['Description', 'Maelezo ya group', 'Description', '群组描述'],
    descriptionPlaceholder: ['What is this group for? Goals, purpose, rules…', 'Group hili ni la nini? Malengo, madhumuni, kanuni…', 'À quoi sert ce groupe ? Objectifs, règles…', '这个群组的目标、用途、规则…'],
    noDescription: ['No description yet.', 'Bado hakuna maelezo.', 'Pas encore de description.', '暂无描述。'],
    addDescription: ['Add a group description', 'Ongeza maelezo ya group', 'Ajouter une description', '添加群组描述'],
    participants: ['Participants', 'Washiriki', 'Participants', '成员'],
    addParticipants: ['Add participants', 'Ongeza washiriki', 'Ajouter des participants', '添加成员'],
    searchPeople: ['Search by name or @username', 'Tafuta kwa jina au @username', 'Rechercher par nom ou @nom', '按姓名或 @用户名 搜索'],
    selected: ['{n} selected', '{n} wamechaguliwa', '{n} sélectionné(s)', '已选 {n} 人'],
    nobody: ['No one to add.', 'Hakuna wa kuongeza.', 'Personne à ajouter.', '没有可添加的人。'],
    create: ['Create group', 'Unda group', 'Créer le groupe', '创建群组'],
    created: ['Group created.', 'Group limeundwa.', 'Groupe créé.', '群组已创建。'],
    save: ['Save', 'Hifadhi', 'Enregistrer', '保存'],
    saved: ['Group info saved.', 'Taarifa za group zimehifadhiwa.', 'Infos du groupe enregistrées.', '群组信息已保存。'],
    cancel: ['Cancel', 'Ghairi', 'Annuler', '取消'],
    edit: ['Edit group info', 'Hariri taarifa za group', 'Modifier les infos', '编辑群组信息'],
    admin: ['Group admin', 'Admin wa group', 'Admin du groupe', '群管理员'],
    you: ['You', 'Wewe', 'Vous', '您'],
    creator: ['Creator', 'Muanzilishi', 'Créateur', '创建者'],
    adminsNote: ['Admins can edit group info, add or remove participants, manage admins and delete the group.', 'Admin wanaweza kuhariri taarifa, kuongeza au kuondoa washiriki, kusimamia admin na kufuta group.', 'Les admins peuvent modifier les infos, ajouter ou retirer des participants, gérer les admins et supprimer le groupe.', '管理员可以编辑群信息、添加或移除成员、管理管理员并删除群组。'],
    memberNote: ['Only group admins can change group info and participants.', 'Admin wa group pekee ndio wanaweza kubadilisha taarifa na washiriki.', 'Seuls les admins peuvent modifier les infos et les participants.', '只有群管理员可以修改群信息和成员。'],
    makeAdmin: ['Make group admin', 'Mfanye admin wa group', 'Nommer admin', '设为管理员'],
    dismissAdmin: ['Dismiss as admin', 'Ondoa u-admin', 'Retirer le rôle d’admin', '取消管理员'],
    remove: ['Remove from group', 'Ondoa kwenye group', 'Retirer du groupe', '移出群组'],
    removeBlock: ['Remove and block', 'Ondoa na zuia', 'Retirer et bloquer', '移出并屏蔽'],
    viewProfile: ['View profile', 'Angalia wasifu', 'Voir le profil', '查看资料'],
    memberActions: ['Manage participant', 'Simamia mshiriki', 'Gérer le participant', '管理成员'],
    removeConfirm: ['Remove {name} from this group?', 'Ondoa {name} kwenye group hili?', 'Retirer {name} de ce groupe ?', '将 {name} 移出此群组？'],
    blockConfirm: ['Remove {name} and block them from being added again?', 'Ondoa {name} na umzuie asiongezwe tena?', 'Retirer {name} et l’empêcher d’être rajouté ?', '移出 {name} 并禁止再次加入？'],
    removed: ['Participant removed.', 'Mshiriki ameondolewa.', 'Participant retiré.', '成员已移除。'],
    blockedDone: ['Participant removed and blocked.', 'Mshiriki ameondolewa na kuzuiwa.', 'Participant retiré et bloqué.', '成员已移除并屏蔽。'],
    blocked: ['Blocked accounts', 'Akaunti zilizozuiwa', 'Comptes bloqués', '已屏蔽账户'],
    unblock: ['Unblock', 'Ondoa kizuizi', 'Débloquer', '解除屏蔽'],
    unblocked: ['Account unblocked.', 'Kizuizi kimeondolewa.', 'Compte débloqué.', '已解除屏蔽。'],
    added: ['{n} participant(s) added.', 'Washiriki {n} wameongezwa.', '{n} participant(s) ajouté(s).', '已添加 {n} 位成员。'],
    leave: ['Leave group', 'Toka kwenye group', 'Quitter le groupe', '退出群组'],
    leaveConfirm: ['Leave “{name}”? You will stop receiving its messages.', 'Toka kwenye “{name}”? Hutapokea tena ujumbe wake.', 'Quitter « {name} » ? Vous ne recevrez plus ses messages.', '退出“{name}”？你将不再收到其消息。'],
    leaveLastAdmin: ['You are the only admin. Another participant becomes admin when you leave.', 'Wewe ndiye admin pekee. Mshiriki mwingine atakuwa admin ukitoka.', 'Vous êtes le seul admin. Un autre participant deviendra admin.', '你是唯一的管理员，退出后将由其他成员担任管理员。'],
    left: ['You left the group.', 'Umetoka kwenye group.', 'Vous avez quitté le groupe.', '你已退出群组。'],
    deleteGroup: ['Delete group', 'Futa group', 'Supprimer le groupe', '删除群组'],
    deleteConfirm: ['Delete “{name}” for everyone? All messages and participants are removed. This cannot be undone.', 'Futa “{name}” kwa kila mtu? Ujumbe wote na washiriki wataondolewa. Haiwezi kurudishwa.', 'Supprimer « {name} » pour tous ? Tous les messages et participants seront supprimés. Action irréversible.', '为所有人删除“{name}”？所有消息和成员都将被移除，且无法恢复。'],
    deleted: ['Group deleted.', 'Group limefutwa.', 'Groupe supprimé.', '群组已删除。'],
    created_on: ['Created {date}', 'Liliundwa {date}', 'Créé le {date}', '创建于 {date}'],
    members: ['{n} participants', 'Washiriki {n}', '{n} participants', '{n} 位成员'],
    loading: ['Loading…', 'Inapakia…', 'Chargement…', '加载中…'],
    close: ['Close', 'Funga', 'Fermer', '关闭'],
    nameRequired: ['Give the group a name.', 'Weka jina la group.', 'Donnez un nom au groupe.', '请输入群组名称。'],
    user: ['User', 'Mtumiaji', 'Utilisateur', '用户'],
  };
  const lang = () => { try { return window.MilkyWayI18n?.language?.() || localStorage.getItem('mw_lang') || 'sw'; } catch { return 'sw'; } };
  const w = (key, values = {}) => Object.entries(values).reduce((out, [k, v]) => out.replaceAll(`{${k}}`, v), words[key][Math.max(0, order.indexOf(lang()))] || words[key][0]);
  const api = (action, body, query = '') => window.MilkyWayPremium.groupRequest(action, body, query);
  const svg = body => `<svg viewBox="0 0 24 24" aria-hidden="true">${body}</svg>`;
  const icons = {
    back: svg('<path d="M15 5 8 12l7 7"/>'),
    group: svg('<circle cx="9" cy="8.5" r="3.3"/><path d="M3 19.5c.6-3.4 3-5.3 6-5.3s5.4 1.9 6 5.3"/><path d="M15.5 5.6a3 3 0 0 1 0 5.8M17.6 14.6c1.8.7 3 2.3 3.4 4.9"/>'),
    edit: svg('<path d="M4 20h4L19 9l-4-4L4 16Z"/><path d="m13.5 6.5 4 4"/>'),
    add: svg('<circle cx="9" cy="8.5" r="3.3"/><path d="M3 19.5c.6-3.4 3-5.3 6-5.3 1.4 0 2.6.4 3.6 1.1"/><path d="M18 13v7M14.5 16.5h7"/>'),
    leave: svg('<path d="M14 4h4a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-4"/><path d="M10 16 6 12l4-4M6 12h10"/>'),
    trash: svg('<path d="M4 7h16M9 7V4.5h6V7M6.5 7l1 13h9l1-13"/>'),
    check: svg('<path d="m5 12.6 4 4L19 6.8"/>'),
    shield: svg('<path d="M12 3 5 6v5.5c0 4.4 3 7.7 7 9.5 4-1.8 7-5.1 7-9.5V6Z"/><path d="m9 12 2 2 4-4"/>'),
  };
  const initial = name => esc(Array.from(String(name || '?').trim())[0] || '?');
  const avatar = p => p?.avatar_url ? `<img src="${esc(window.MilkyWayMedia?.image(p.avatar_url, 160) || p.avatar_url)}" alt="" loading="lazy">` : initial(p?.display_name || p?.username);
  const display = p => p?.display_name || (p?.username ? '@' + p.username : w('user'));
  async function profiles(ids) {
    if (!ids.length) return {};
    const { data } = await sb.from('mw_profiles').select('id,display_name,username,avatar_url').in('id', ids);
    return Object.fromEntries((data || []).map(p => [p.id, p]));
  }

  // ---- Panel shell ---------------------------------------------------------
  const root = document.createElement('div');
  root.className = 'wa-chat mwgs-bg';root.id = 'groupSettingsSheet';root.hidden = true;
  root.innerHTML = '<div class="mwgs" role="dialog" aria-modal="true" aria-labelledby="mwgsTitle"><header class="mwgs-head"><button type="button" class="wa-ico" data-mwgs-close></button><h2 id="mwgsTitle"></h2></header><div class="mwgs-body" id="mwgsBody"></div></div>';
  document.body.append(root);
  const body = root.querySelector('#mwgsBody'), title = root.querySelector('#mwgsTitle'), closeButton = root.querySelector('[data-mwgs-close]');
  closeButton.innerHTML = icons.back;
  let view = null, state = null;
  function show(kind, heading) {
    view = kind;title.textContent = heading;closeButton.setAttribute('aria-label', w('close'));closeButton.title = w('close');
    root.hidden = false;document.documentElement.classList.add('mwgs-open');
  }
  function hide() { root.hidden = true;view = null;state = null;body.innerHTML = '';document.documentElement.classList.remove('mwgs-open'); }
  closeButton.onclick = () => { if (view === 'edit' && state?.group) return renderInfo(); hide(); };
  root.addEventListener('keydown', event => { if (event.key === 'Escape' && !document.querySelector('.mw-dialog-bg')) closeButton.click(); });

  // ---- Participant picker (used by create + add) ----------------------------
  async function picker(container, exclude = new Set()) {
    container.innerHTML = `<label class="mwgs-search"><input type="search" autocomplete="off" placeholder="${esc(w('searchPeople'))}" aria-label="${esc(w('searchPeople'))}"></label><p class="mwgs-count" aria-live="polite"></p><div class="mwgs-people"><p class="mwgs-muted">${esc(w('loading'))}</p></div>`;
    const field = container.querySelector('input'), list = container.querySelector('.mwgs-people'), counter = container.querySelector('.mwgs-count');
    const chosen = new Set();
    const { data, error } = await sb.from('mw_profiles').select('id,display_name,username,avatar_url').neq('id', user.id).order('display_name').limit(500);
    if (error) { list.innerHTML = `<p class="mwgs-muted">${esc(error.message)}</p>`;return chosen; }
    const people = (data || []).filter(p => !exclude.has(p.id));
    const sync = () => { counter.textContent = chosen.size ? w('selected', { n: chosen.size }) : ''; };
    list.innerHTML = people.map(p => `<button type="button" class="mwgs-person" role="checkbox" aria-checked="false" data-person="${esc(p.id)}" data-search="${esc(`${p.display_name || ''} ${p.username || ''}`.toLowerCase())}"><span class="wa-avatar">${avatar(p)}</span><span class="mwgs-person-text"><strong data-mw-user-content>${esc(display(p))}</strong>${p.username ? `<small>@${esc(p.username)}</small>` : ''}</span><span class="mwgs-tick">${icons.check}</span></button>`).join('') || `<p class="mwgs-muted">${esc(w('nobody'))}</p>`;
    list.addEventListener('click', event => {
      const row = event.target.closest('[data-person]');if (!row) return;
      const id = row.dataset.person, on = !chosen.has(id);
      on ? chosen.add(id) : chosen.delete(id);row.setAttribute('aria-checked', String(on));sync();
    });
    field.oninput = () => { const term = field.value.trim().toLowerCase().replace(/^@/, '');list.querySelectorAll('[data-person]').forEach(row => { row.hidden = !!term && !row.dataset.search.includes(term); }); };
    return chosen;
  }

  // ---- Create --------------------------------------------------------------
  async function create() {
    if (!logged()) return;
    show('create', w('newGroup'));
    body.innerHTML = `<form class="mwgs-form" novalidate>
      <label class="mwgs-field"><span>${esc(w('name'))}</span><input name="name" maxlength="70" required placeholder="${esc(w('namePlaceholder'))}"></label>
      <label class="mwgs-field"><span>${esc(w('caption'))}</span><input name="caption" maxlength="140" placeholder="${esc(w('captionPlaceholder'))}"></label>
      <label class="mwgs-field"><span>${esc(w('description'))}</span><textarea name="description" maxlength="500" rows="3" placeholder="${esc(w('descriptionPlaceholder'))}"></textarea></label>
      <h3 class="mwgs-section">${esc(w('addParticipants'))}</h3><div class="mwgs-picker"></div>
      <div class="mwgs-sticky"><button type="submit" class="mwgs-primary">${esc(w('create'))}</button></div></form>`;
    const form = body.querySelector('form');
    const chosen = await picker(form.querySelector('.mwgs-picker'));
    form.name.focus();
    form.onsubmit = async event => {
      event.preventDefault();
      const name = form.elements.name.value.trim();
      if (!name) { toast(w('nameRequired'));form.elements.name.focus();return; }
      const submit = form.querySelector('[type=submit]');submit.disabled = true;
      try {
        const { group } = await api('create', { name, caption: form.elements.caption.value, description: form.elements.description.value, members: [...chosen] });
        hide();toast(w('created'));await loadGroups();await openGroup(group.id);
      } catch (error) { toast(error.message);submit.disabled = false; }
    };
  }

  // ---- Info / settings -----------------------------------------------------
  async function load(groupId) {
    const info = await api('group', null, '&id=' + encodeURIComponent(groupId));
    const people = await profiles([...new Set([...(info.members || []), ...(info.blocked || [])].map(m => m.user_id))]);
    state = { ...info, people };
    return state;
  }
  async function open(groupId) {
    if (!logged() || !groupId) return;
    show('info', w('groupInfo'));
    body.innerHTML = `<p class="mwgs-muted mwgs-pad">${esc(w('loading'))}</p>`;
    try { await load(groupId); } catch (error) { body.innerHTML = `<p class="mwgs-muted mwgs-pad">${esc(error.message)}</p>`;return; }
    renderInfo();
  }
  async function refresh() {
    const id = state?.group?.id;if (!id) return;
    try { await load(id); } catch (error) { toast(error.message);hide();return; }
    if (view === 'info') renderInfo();
    if (activeGroupId === id) window.MilkyWayChat?.setPeer({ kind: 'group', id, name: state.group.name, members: state.members.length });
    loadGroups();
  }
  function renderInfo() {
    if (!state) return;
    show('info', w('groupInfo'));
    const { group, members, blocked = [], people } = state, isAdmin = group.role === 'admin';
    const memberRows = members.map(m => {
      const p = people[m.user_id], me = m.user_id === user.id;
      const badges = `${m.role === 'admin' ? `<span class="mwgs-badge">${esc(w('admin'))}</span>` : ''}${m.user_id === group.created_by ? `<span class="mwgs-badge mwgs-badge-soft">${esc(w('creator'))}</span>` : ''}`;
      return `<button type="button" class="mwgs-member" data-member="${esc(m.user_id)}"><span class="wa-avatar">${avatar(p)}</span><span class="mwgs-person-text"><strong data-mw-user-content>${esc(me ? w('you') : display(p))}</strong>${p?.username ? `<small>@${esc(p.username)}</small>` : ''}</span><span class="mwgs-badges">${badges}</span></button>`;
    }).join('');
    const blockedRows = blocked.map(b => { const p = people[b.user_id];return `<div class="mwgs-member"><span class="wa-avatar">${avatar(p)}</span><span class="mwgs-person-text"><strong data-mw-user-content>${esc(display(p))}</strong>${p?.username ? `<small>@${esc(p.username)}</small>` : ''}</span><button type="button" class="mwgs-chip" data-unblock="${esc(b.user_id)}">${esc(w('unblock'))}</button></div>`; }).join('');
    const created = new Date(group.created_at).toLocaleDateString(lang(), { day: 'numeric', month: 'long', year: 'numeric' });
    body.innerHTML = `
      <section class="mwgs-hero"><span class="wa-avatar mwgs-hero-avatar">${icons.group}</span><h3 data-mw-user-content>${esc(group.name)}</h3>${group.caption ? `<p class="mwgs-caption" data-mw-user-content>${esc(group.caption)}</p>` : ''}<p class="mwgs-muted">${esc(w('members', { n: members.length }))} · ${esc(w('created_on', { date: created }))}</p>${isAdmin ? `<button type="button" class="mwgs-chip" data-mwgs="edit">${icons.edit}<span>${esc(w('edit'))}</span></button>` : ''}</section>
      <section class="mwgs-card"><h3 class="mwgs-section">${esc(w('description'))}</h3>${group.description ? `<p class="mwgs-description" data-mw-user-content>${esc(group.description)}</p>` : isAdmin ? `<button type="button" class="mwgs-link" data-mwgs="edit">${esc(w('addDescription'))}</button>` : `<p class="mwgs-muted">${esc(w('noDescription'))}</p>`}</section>
      <section class="mwgs-card"><h3 class="mwgs-section">${esc(w('members', { n: members.length }))}</h3><p class="mwgs-note">${icons.shield}<span>${esc(isAdmin ? w('adminsNote') : w('memberNote'))}</span></p>${isAdmin ? `<button type="button" class="mwgs-row-action" data-mwgs="add"><span class="wa-avatar mwgs-accent">${icons.add}</span><span>${esc(w('addParticipants'))}</span></button>` : ''}<div class="mwgs-members">${memberRows}</div></section>
      ${isAdmin && blocked.length ? `<section class="mwgs-card"><h3 class="mwgs-section">${esc(w('blocked'))}</h3><div class="mwgs-members">${blockedRows}</div></section>` : ''}
      <section class="mwgs-card mwgs-danger"><button type="button" class="mwgs-row-action" data-mwgs="leave">${icons.leave}<span>${esc(w('leave'))}</span></button>${isAdmin ? `<button type="button" class="mwgs-row-action" data-mwgs="delete">${icons.trash}<span>${esc(w('deleteGroup'))}</span></button>` : ''}</section>`;
  }
  function renderEdit() {
    const { group } = state;
    show('edit', w('edit'));
    body.innerHTML = `<form class="mwgs-form" novalidate>
      <label class="mwgs-field"><span>${esc(w('name'))}</span><input name="name" maxlength="70" required value="${esc(group.name)}"></label>
      <label class="mwgs-field"><span>${esc(w('caption'))}</span><input name="caption" maxlength="140" value="${esc(group.caption || '')}" placeholder="${esc(w('captionPlaceholder'))}"></label>
      <label class="mwgs-field"><span>${esc(w('description'))}</span><textarea name="description" maxlength="500" rows="6" placeholder="${esc(w('descriptionPlaceholder'))}">${esc(group.description || '')}</textarea></label>
      <div class="mwgs-actions"><button type="button" class="mwgs-secondary" data-mwgs="cancel">${esc(w('cancel'))}</button><button type="submit" class="mwgs-primary">${esc(w('save'))}</button></div></form>`;
    const form = body.querySelector('form');form.elements.name.focus();
    form.onsubmit = async event => {
      event.preventDefault();
      const name = form.elements.name.value.trim();
      if (!name) { toast(w('nameRequired'));return; }
      const submit = form.querySelector('[type=submit]');submit.disabled = true;
      try { await api('update', { group: group.id, name, caption: form.elements.caption.value, description: form.elements.description.value });toast(w('saved'));view = 'info';await refresh(); }
      catch (error) { toast(error.message);submit.disabled = false; }
    };
  }
  async function renderAdd() {
    const { group, members, blocked = [] } = state;
    show('edit', w('addParticipants'));
    body.innerHTML = `<div class="mwgs-form"><div class="mwgs-picker"></div><div class="mwgs-sticky"><button type="button" class="mwgs-primary" data-mwgs="add-confirm">${esc(w('addParticipants'))}</button></div></div>`;
    const chosen = await picker(body.querySelector('.mwgs-picker'), new Set([...members, ...blocked].map(m => m.user_id)));
    const confirm = body.querySelector('[data-mwgs="add-confirm"]');
    confirm.onclick = async () => {
      if (!chosen.size) return;
      confirm.disabled = true;
      try { const result = await api('add-member', { group: group.id, userIds: [...chosen] });toast(w('added', { n: result.added }));view = 'info';await refresh(); }
      catch (error) { toast(error.message);confirm.disabled = false; }
    };
  }
  async function manageMember(id) {
    const { group, members, people } = state, member = members.find(m => m.user_id === id);
    if (!member) return;
    const p = people[id], name = display(p), isAdmin = group.role === 'admin', me = id === user.id;
    const options = [];
    if (!me) options.push({ value: 'profile', label: w('viewProfile') });
    if (isAdmin) {
      options.push(member.role === 'admin' ? { value: 'dismiss', label: w('dismissAdmin') } : { value: 'promote', label: w('makeAdmin') });
      if (!me && id !== group.created_by) options.push({ value: 'remove', label: w('remove') }, { value: 'block', label: w('removeBlock') });
    }
    if (me) options.push({ value: 'leave', label: w('leave') });
    if (!options.length) return;
    const choice = await window.MilkyWayDialog.choose({ title: name, message: w('memberActions'), options: options.map(o => ({ ...o, image: '' })) });
    if (!choice) return;
    if (choice === 'profile') { hide();window.MilkyWayChat?.closeThread();openPublicProfile(id);return; }
    if (choice === 'leave') return leave();
    try {
      if (choice === 'promote' || choice === 'dismiss') await api('set-role', { group: group.id, userId: id, role: choice === 'promote' ? 'admin' : 'member' });
      if (choice === 'remove' || choice === 'block') {
        const ok = await window.MilkyWayDialog.confirm({ title: choice === 'block' ? w('removeBlock') : w('remove'), message: w(choice === 'block' ? 'blockConfirm' : 'removeConfirm', { name }), confirmText: choice === 'block' ? w('removeBlock') : w('remove'), danger: true });
        if (!ok) return;
        await api('remove-member', { group: group.id, userId: id, block: choice === 'block' });
        toast(w(choice === 'block' ? 'blockedDone' : 'removed'));
      }
      await refresh();
    } catch (error) { toast(error.message); }
  }
  async function leave() {
    const { group, members } = state;
    const lastAdmin = group.role === 'admin' && members.filter(m => m.role === 'admin').length === 1 && members.length > 1;
    const ok = await window.MilkyWayDialog.confirm({ title: w('leave'), message: w('leaveConfirm', { name: group.name }) + (lastAdmin ? '\n\n' + w('leaveLastAdmin') : ''), confirmText: w('leave'), danger: true });
    if (!ok) return;
    try { await api('leave', { group: group.id }); } catch (error) { toast(error.message);return; }
    finish(group.id, w('left'));
  }
  async function remove() {
    const { group } = state;
    const ok = await window.MilkyWayDialog.confirm({ title: w('deleteGroup'), message: w('deleteConfirm', { name: group.name }), confirmText: w('deleteGroup'), danger: true });
    if (!ok) return;
    try { await api('delete', { group: group.id }); } catch (error) { toast(error.message);return; }
    finish(group.id, w('deleted'));
  }
  function finish(groupId, message) {
    hide();
    if (activeGroupId === groupId) window.MilkyWayChat?.closeThread();
    const list = document.getElementById('groupList');if (list) delete list.dataset.signature;
    toast(message);loadGroups();
  }
  body.addEventListener('click', async event => {
    const action = event.target.closest('[data-mwgs]')?.dataset.mwgs;
    const member = event.target.closest('[data-member]')?.dataset.member;
    const unblock = event.target.closest('[data-unblock]')?.dataset.unblock;
    if (action === 'edit') renderEdit();
    if (action === 'cancel') renderInfo();
    if (action === 'add') renderAdd();
    if (action === 'leave') leave();
    if (action === 'delete') remove();
    if (member) manageMember(member);
    if (unblock) { try { await api('unblock', { group: state.group.id, userId: unblock });toast(w('unblocked'));await refresh(); } catch (error) { toast(error.message); } }
  });

  async function addMembers(groupId) {
    if (state?.group?.id !== groupId || view !== 'info') { await open(groupId);if (!state) return; }
    if (state.group.role !== 'admin') { toast(w('memberNote'));return; }
    renderAdd();
  }

  window.MilkyWayGroups = { create, open, addMembers, close: hide };
})();
