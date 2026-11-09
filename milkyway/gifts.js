// MilkyWay Coins and gifts: gift buttons on posts, gallery photos/videos, stories and LIVEs, the gift picker,
// the coin wallet (top-ups by mobile money, creator earnings and payouts) and the earnings card on creator dashboards.
// 1 coin = 1,000 TZS and gifts start at 0.1 coin (TZS 100). Every gift shows its price in money. Creators only ever see
// their own net earnings in coins, never how a gift is split. Prices and earnings are shown in the
// currency of the country detected when the account joined (TZS, USD, GBP…); mobile money itself is always paid in TZS.
(() => {
  const endpoint = '/api/milkyway-wallet';
  const byId = id => document.getElementById(id);
  const esc = value => String(value ?? '').replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);
  const words = {
    gift: ['Gift', 'Zawadi'],
    sendGift: ['Send a gift', 'Tuma zawadi'],
    sendGiftHint: ['Gifts support creators directly. Pick one and tap Send.', 'Zawadi zinamsaidia msanii moja kwa moja. Chagua moja kisha bonyeza Tuma.'],
    yourCoins: ['Your coins', 'Sarafu zako'],
    topUp: ['Top up', 'Ongeza'],
    basic: ['Basic', 'Kawaida'],
    medium: ['Medium', 'Kati'],
    premium: ['Premium', 'Hadhi ya juu'],
    coin: ['coin', 'sarafu'],
    coins: ['coins', 'sarafu'],
    coinsTitle: ['Coins', 'Sarafu'],
    send: ['Send', 'Tuma'],
    sending: ['Sending…', 'Inatuma…'],
    giftSent: ['Gift sent!', 'Zawadi imetumwa!'],
    chooseGift: ['Choose a gift first.', 'Chagua zawadi kwanza.'],
    notEnough: ['Not enough coins. Top up to send this gift.', 'Sarafu hazitoshi. Ongeza sarafu ili kutuma zawadi hii.'],
    ownPost: ['You cannot send a gift to yourself.', 'Huwezi kujitumia zawadi.'],
    liveEnded: ['This LIVE has ended.', 'LIVE hii imeisha.'],
    wallet: ['Coin wallet', 'Pochi ya sarafu'],
    earned: ['Earned coins', 'Sarafu ulizopata'],
    earnedHint: ['From gifts on your posts, photos, videos and LIVEs', 'Kutoka zawadi kwenye posts, picha, video na LIVE zako'],
    lifetime: ['All-time earnings', 'Mapato ya jumla'],
    spendable: ['Coins to give', 'Sarafu za kutoa zawadi'],
    spendableHint: ['Buy coins with mobile money to send gifts', 'Nunua sarafu kwa pesa ya simu ili kutuma zawadi'],
    withdraw: ['Withdraw', 'Toa pesa'],
    withdrawLocked: ['Withdraw unlocks at {n} coins ({tzs})', 'Kutoa kunafunguka ukifikia sarafu {n} ({tzs})'],
    withdrawReady: ['Ready to withdraw', 'Tayari kutoa'],
    withdrawPending: ['Withdrawal in progress', 'Malipo yanashughulikiwa'],
    progress: ['{x} of {n} coins', 'Sarafu {x} kati ya {n}'],
    received: ['Recent gifts', 'Zawadi za karibuni'],
    noGifts: ['No gifts yet. Share posts and go LIVE to receive gifts.', 'Bado hakuna zawadi. Posti na ingia LIVE upokee zawadi.'],
    from: ['from {name}', 'kutoka kwa {name}'],
    onPost: ['post', 'post'],
    onLive: ['LIVE', 'LIVE'],
    onStory: ['story', 'story'],
    topupTitle: ['Buy coins', 'Nunua sarafu'],
    topupHelp: ['Pay the amount by mobile money, then enter the transaction reference from your payment message. Coins are added once the payment is confirmed.', 'Lipa kiasi kwa pesa ya simu, kisha weka namba ya muamala kutoka kwenye ujumbe wa malipo. Sarafu zinaongezwa baada ya malipo kuthibitishwa.'],
    howToPay: ['How to pay', 'Jinsi ya kulipa'],
    defaultPay: ['Pay Masiyatunda Co. Ltd by mobile money. Contact info@masiyatunda.com for the payment number.', 'Lipa Masiyatunda Co. Ltd kwa pesa ya simu. Wasiliana na info@masiyatunda.com upate namba ya malipo.'],
    network: ['Mobile money network', 'Mtandao wa pesa ya simu'],
    chooseNetwork: ['Choose your mobile money provider', 'Chagua mtandao wako wa pesa ya simu'],
    paidFrom: ['Number you paid from', 'Namba uliyolipia'],
    reference: ['Transaction reference', 'Namba ya muamala'],
    referenceHint: ['For example 9JK3LM2PQ1', 'Mfano 9JK3LM2PQ1'],
    toPay: ['To pay', 'Kiasi cha kulipa'],
    lipaTitle: ['Pay with Lipa Namba', 'Lipa kwa Lipa Namba'],
    lipaNumber: ['Lipa Namba', 'Lipa Namba'],
    lipaName: ['Merchant name', 'Jina la mpokeaji'],
    lipaScan: ['This QR contains the Lipa Namba only. If your payment app does not recognize it as a merchant QR, enter the Lipa Namba manually.', 'QR hii ina Lipa Namba pekee. Ikiwa app ya malipo haitambui kama QR ya mfanyabiashara, ingiza Lipa Namba mwenyewe.'],
    lipaSteps: ['Open your mobile money menu → Lipa kwa Simu / Pay by phone → enter the Lipa Namba → enter {amount} → confirm with your PIN.', 'Fungua menyu ya pesa ya simu → Lipa kwa Simu → weka Lipa Namba → weka {amount} → thibitisha kwa PIN yako.'],
    lipaAmount: ['Amount', 'Kiasi'],
    lipaPending: ['The Lipa Namba and QR code appear here as soon as they are set up. Until then, follow the payment instructions.', 'Lipa Namba na QR code zitaonekana hapa zikishawekwa. Kwa sasa, fuata maelekezo ya malipo.'],
    lipaWallet: ['Buy coins by scanning this QR code or paying the Lipa Namba, then tap Top up to confirm your payment.', 'Nunua sarafu kwa kuscan QR code hii au kulipa Lipa Namba, kisha bonyeza Ongeza kuthibitisha malipo yako.'],
    copy: ['Copy', 'Nakili'],
    copied: ['Copied', 'Imenakiliwa'],
    lipaAfter: ['Pay the exact TZS amount shown, then submit your transaction reference. Coins are credited only after the merchant verifies receipt.', 'Lipa kiasi halisi cha TZS kinachoonyeshwa, kisha tuma namba ya muamala. Sarafu zitaongezwa baada ya mfanyabiashara kuthibitisha kupokea malipo.'],
    submitTopup: ['Submit payment', 'Wasilisha malipo'],
    topupSent: ['Payment submitted. Your coins arrive once it is confirmed.', 'Malipo yamewasilishwa. Sarafu zitaingia baada ya kuthibitishwa.'],
    withdrawTitle: ['Withdraw to mobile money', 'Toa kwenda pesa ya simu'],
    withdrawCoins: ['Coins to withdraw', 'Sarafu za kutoa'],
    youReceive: ['You receive', 'Utapokea'],
    receiveNumber: ['Mobile money number', 'Namba ya pesa ya simu'],
    accountName: ['Name registered on the number', 'Jina lililosajiliwa kwenye namba'],
    submitWithdraw: ['Request payout', 'Omba malipo'],
    withdrawSent: ['Payout requested. It is sent to your mobile money after processing.', 'Ombi la malipo limetumwa. Pesa itatumwa kwenye simu yako baada ya kushughulikiwa.'],
    minWithdraw: ['Minimum {n} coins ({tzs})', 'Kiwango cha chini sarafu {n} ({tzs})'],
    history: ['Payments', 'Malipo'],
    noHistory: ['No payments yet.', 'Bado hakuna malipo.'],
    topupRow: ['Bought {n} coins', 'Umenunua sarafu {n}'],
    withdrawRow: ['Withdrew {n} coins', 'Umetoa sarafu {n}'],
    pending: ['Waiting', 'Inasubiri'],
    approved: ['Added', 'Imeongezwa'],
    rejected: ['Declined', 'Imekataliwa'],
    paid: ['Paid', 'Imelipwa'],
    openWallet: ['Open wallet', 'Fungua pochi'],
    close: ['Close', 'Funga'],
    back: ['Back', 'Rudi'],
    retry: ['Could not load. Retry.', 'Imeshindikana kupakia. Jaribu tena.'],
    sentGift: ['sent {gift}', 'ametuma {gift}'],
    dashTitle: ['Coin dashboard', 'Dashibodi ya sarafu'],
    balanceTop: ['Your coin balance', 'Salio lako la sarafu'],
    worth: ['Worth about {tzs}', 'Thamani takriban {tzs}'],
    withdrawSection: ['Withdraw earnings', 'Toa mapato'],
    withdrawRule: ['Minimum withdrawal {n} coins ({min}) · 1 coin = {tzs}', 'Kiwango cha chini cha kutoa sarafu {n} ({min}) · sarafu 1 = {tzs}'],
    toGo: ['{n} more coins to unlock withdrawal', 'Sarafu {n} zaidi kufungua kutoa'],
    loadFailed: ['Coins could not load. Tap to retry.', 'Sarafu hazikupakia. Bonyeza kujaribu tena.'],
    paidAs: ['Paid as {tzs} by mobile money', 'Unalipa {tzs} kwa pesa ya simu'],
    payoutAs: ['Sent as {tzs} by mobile money', 'Inatumwa {tzs} kwa pesa ya simu'],
  };
  const languages = ['en', 'sw'];
  const CATALOG = window.MilkyWayGiftCatalog;
  const language = () => window.MilkyWayI18n?.language?.() || 'sw';
  const T = (key, values = {}) => {
    const row = words[key], shared = CATALOG.ui[key];if (!row && !shared) return key;
    const lang = language();
    let text = shared?.[CATALOG.languages.indexOf(lang)] || row?.[languages.indexOf(lang)] || window.MilkyWayLocales?.[lang]?.[(row || shared)[0]] || (row || shared)[0];
    for (const [name, value] of Object.entries(values)) text = text.replaceAll(`{${name}}`, value);
    return text;
  };
  const fmt = value => Number(value || 0).toLocaleString(undefined, { maximumFractionDigits: 1 });
  const tzs = value => `${Number(value || 0).toLocaleString()} TZS`;

  // ---------- Local currency ----------
  // The server detects the country (network location, then the device region below) and saves it when the account
  // joins. Guests see the currency of where they are browsing from.
  const ZONES = { 'Africa/Dar_es_Salaam': 'TZ', 'Africa/Nairobi': 'KE', 'Africa/Kampala': 'UG', 'Africa/Kigali': 'RW', 'Africa/Bujumbura': 'BI', 'Africa/Kinshasa': 'CD', 'Africa/Lubumbashi': 'CD', 'Africa/Lusaka': 'ZM', 'Africa/Blantyre': 'MW', 'Africa/Maputo': 'MZ', 'Africa/Johannesburg': 'ZA', 'Africa/Lagos': 'NG', 'Africa/Accra': 'GH', 'Africa/Addis_Ababa': 'ET', 'Africa/Mogadishu': 'SO', 'Africa/Juba': 'SS', 'Africa/Khartoum': 'SD', 'Africa/Cairo': 'EG', 'Africa/Casablanca': 'MA', 'Africa/Harare': 'ZW', 'Africa/Gaborone': 'BW', 'Africa/Windhoek': 'NA', 'Africa/Luanda': 'AO', 'Indian/Comoro': 'KM', 'Indian/Antananarivo': 'MG', 'Indian/Mauritius': 'MU',
    'Europe/London': 'GB', 'Europe/Dublin': 'IE', 'Europe/Berlin': 'DE', 'Europe/Paris': 'FR', 'Europe/Madrid': 'ES', 'Europe/Rome': 'IT', 'Europe/Amsterdam': 'NL', 'Europe/Brussels': 'BE', 'Europe/Stockholm': 'SE', 'Europe/Oslo': 'NO', 'Europe/Zurich': 'CH', 'Europe/Istanbul': 'TR',
    'America/New_York': 'US', 'America/Chicago': 'US', 'America/Denver': 'US', 'America/Phoenix': 'US', 'America/Los_Angeles': 'US', 'America/Anchorage': 'US', 'Pacific/Honolulu': 'US', 'America/Toronto': 'CA', 'America/Vancouver': 'CA', 'America/Mexico_City': 'MX', 'America/Sao_Paulo': 'BR',
    'Asia/Dubai': 'AE', 'Asia/Riyadh': 'SA', 'Asia/Muscat': 'OM', 'Asia/Qatar': 'QA', 'Asia/Kolkata': 'IN', 'Asia/Karachi': 'PK', 'Asia/Shanghai': 'CN', 'Asia/Hong_Kong': 'HK', 'Asia/Tokyo': 'JP', 'Asia/Seoul': 'KR', 'Asia/Singapore': 'SG', 'Australia/Sydney': 'AU', 'Australia/Melbourne': 'AU', 'Pacific/Auckland': 'NZ' };
  function deviceRegion() {
    try { const zone = ZONES[Intl.DateTimeFormat().resolvedOptions().timeZone];if (zone) return zone; } catch {}
    for (const tag of navigator.languages || [navigator.language]) { try { const region = new Intl.Locale(tag).region;if (/^[A-Z]{2}$/.test(region || '')) return region; } catch {} }
    return '';
  }
  let accountPricing = null, guestPricing = null;
  const pricing = () => accountPricing || guestPricing || { country: 'TZ', currency: 'TZS', tzsPerUnit: 1, digits: 0 };
  const formatMinor = (minor, currency, digits) => {
    try { return new Intl.NumberFormat(undefined, { style: 'currency', currency, currencyDisplay: 'narrowSymbol', minimumFractionDigits: digits, maximumFractionDigits: digits }).format(minor / 10 ** digits); }
    catch { return `${(minor / 10 ** digits).toLocaleString()} ${currency}`; }
  };
  // A TZS amount in the account's local currency, e.g. "TSh 5,000", "$1.96" or "£1.47".
  const money = value => { const local = pricing();return formatMinor(Math.round(Number(value || 0) / local.tzsPerUnit * 10 ** local.digits), local.currency, local.digits); };
  const local = () => pricing().currency !== 'TZS';
  // What a number of coins is worth in the account's currency, e.g. 0.1 coin → "TSh 100" or "$0.04".
  const COIN_TZS = 1000;
  const worthOf = coins => money(Math.round(Number(coins || 0) * COIN_TZS));
  function setPricing(next, account) {
    if (!next?.currency) return;
    if (account) accountPricing = next;else guestPricing = next;
    paintCards();window.dispatchEvent(new CustomEvent('mw-currency-change', { detail: pricing() }));
  }

  // ---------- Gift catalog and artwork ----------
  // 100 gifts from 0.1 to 100 coins (see gift-catalog.js). Name and description follow the app language.
  const pick = list => list[CATALOG.languages.indexOf(language())] || list[0];
  const GIFTS = CATALOG.gifts.map(gift => ({ ...gift, get name() { return pick(gift.names); }, get meaning() { return pick(gift.about); } }));
  // Luxury cars share one drawing: body, windows and two wheels with rims in the trim colour.
  function car(id, top, bottom, trim, body, windows, wheels) {
    return `<defs><linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${top}"/><stop offset="1" stop-color="${bottom}"/></linearGradient></defs><ellipse cx="32" cy="52" rx="30" ry="3" fill="#000" opacity=".2"/>`
      + `<g fill="url(#${id})" stroke="${trim}" stroke-width="1">${body}</g><g fill="#9fd8ff" opacity=".85">${windows}</g><path d="M7 39.5h52" stroke="${trim}" stroke-width="1.4" opacity=".9"/>`
      + '<rect x="57" y="36" width="5" height="2.6" rx="1.2" fill="#fff6c8"/><rect x="3" y="36.5" width="3" height="2.4" rx="1" fill="#e5452f"/>'
      + wheels.map(x => `<circle cx="${x}" cy="45" r="6.5" fill="#15151c"/><circle cx="${x}" cy="45" r="3.2" fill="${trim}"/><circle cx="${x}" cy="45" r="1.1" fill="#15151c"/>`).join('');
  }
  const ART = {
    tausi: '<defs><linearGradient id="mwgTausiF" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2fd4a8"/><stop offset="1" stop-color="#0b6f8f"/></linearGradient><linearGradient id="mwgTausiB" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#3a7bff"/><stop offset="1" stop-color="#1636a8"/></linearGradient></defs>'
      + [-60, -38, -18, 0, 18, 38, 60].map(angle => `<g transform="rotate(${angle} 32 46)"><path d="M32 46 C27 32 27 16 32 8 C37 16 37 32 32 46Z" fill="url(#mwgTausiF)"/><circle cx="32" cy="15" r="4" fill="#ffd34d"/><circle cx="32" cy="15" r="2.2" fill="#1636a8"/></g>`).join('')
      + '<path d="M32 58c-6 0-8-6-6-13 1-4 2-8 1-12-1-3 1-6 4-6s5 3 4 6c-1 4 0 8 2 12 3 7 1 13-5 13Z" fill="url(#mwgTausiB)"/><circle cx="31.5" cy="27" r="1.3" fill="#fff"/><path d="m35 28 4 1-4 1z" fill="#ffb02e"/><path d="M30 22l-1-4M32 21.5V17M34 22l1-4" stroke="#2fd4a8" stroke-width="1.2" stroke-linecap="round"/><circle cx="29" cy="17.6" r="1" fill="#ffd34d"/><circle cx="32" cy="16.6" r="1" fill="#ffd34d"/><circle cx="35" cy="17.6" r="1" fill="#ffd34d"/>',
    maua: '<defs><radialGradient id="mwgMauaP" cx=".5" cy=".7" r=".8"><stop offset="0" stop-color="#ffe0f0"/><stop offset=".55" stop-color="#ff5fa2"/><stop offset="1" stop-color="#c2185b"/></radialGradient></defs><path d="M32 40c0 8 0 14-1 20" stroke="#2e9e5b" stroke-width="3" fill="none" stroke-linecap="round"/><path d="M31 52c-8-1-13-6-14-11 6 0 12 3 14 11Z" fill="#43c172"/><path d="M32 49c6-2 11-7 11-12-5 1-10 5-11 12Z" fill="#2e9e5b"/>'
      + [0, 60, 120, 180, 240, 300].map(angle => `<ellipse cx="32" cy="15" rx="7" ry="11" transform="rotate(${angle} 32 26)" fill="url(#mwgMauaP)"/>`).join('')
      + '<circle cx="32" cy="26" r="6.5" fill="#ffc83d"/><circle cx="32" cy="26" r="3.6" fill="#ff8f1f"/>',
    ngoma: '<defs><linearGradient id="mwgNgomaB" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#6d3311"/><stop offset=".5" stop-color="#b8682c"/><stop offset="1" stop-color="#5a280c"/></linearGradient></defs><path d="M14 18h36l-5 38H19Z" fill="url(#mwgNgomaB)"/><ellipse cx="32" cy="56" rx="13" ry="3.5" fill="#4a2008"/><ellipse cx="32" cy="18" rx="18" ry="6" fill="#f3dcb0" stroke="#7a3a12" stroke-width="2"/><ellipse cx="32" cy="17.5" rx="11" ry="3" fill="none" stroke="#d9b87f" stroke-width="1"/><path d="M15 24l6 10 6-10 5 10 5-10 6 10 6-10" stroke="#ffd34d" stroke-width="1.8" fill="none" stroke-linejoin="round"/><path d="M17 40h30M18 46h28" stroke="#e5452f" stroke-width="2.4"/><path d="M19.5 43h25" stroke="#111" stroke-width="1.4" stroke-dasharray="3 2"/>',
    kahawa: '<defs><linearGradient id="mwgKahawaC" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff"/><stop offset="1" stop-color="#d9e2ee"/></linearGradient></defs><path d="M22 12c-3 3 3 5 0 8M32 9c-3 3 3 6 0 9M42 12c-3 3 3 5 0 8" stroke="#a7b4c8" stroke-width="2" fill="none" stroke-linecap="round" opacity=".85"/><ellipse cx="32" cy="54" rx="22" ry="5" fill="#c9a24a"/><ellipse cx="32" cy="53" rx="18" ry="3.5" fill="#e8c768"/><path d="M14 25h36v9c0 10-8 18-18 18s-18-8-18-18Z" fill="url(#mwgKahawaC)"/><path d="M50 29h3a6 6 0 0 1 0 12h-4" stroke="#d9e2ee" stroke-width="3.2" fill="none"/><ellipse cx="32" cy="25" rx="18" ry="4" fill="#6b3a1e"/><ellipse cx="29" cy="24.4" rx="6" ry="1.4" fill="#a0612f"/><path d="M18 37h28" stroke="#0b7a4b" stroke-width="2.4"/><path d="M19.5 41h25" stroke="#ffd34d" stroke-width="1.6"/>',
    'ngao-ya-galaxy': '<defs><radialGradient id="mwgNgaoG" cx=".45" cy=".4" r=".7"><stop offset="0" stop-color="#e9ddff"/><stop offset=".3" stop-color="#8a6bff"/><stop offset=".7" stop-color="#2c1a7a"/><stop offset="1" stop-color="#0b0624"/></radialGradient></defs><ellipse cx="32" cy="32" rx="17" ry="27" fill="url(#mwgNgaoG)" stroke="#ffd778" stroke-width="2.5"/><path d="M32 6v52" stroke="#ffd778" stroke-width="1.6"/><path d="M22 20c6 4 14 4 20 0M20 32h24M22 44c6-4 14-4 20 0" stroke="#e5452f" stroke-width="2" fill="none"/><path d="M24 31c3-6 13-6 16 0-3 5-13 5-16 0Z" fill="none" stroke="#7fd6ff" stroke-width="1.4"/><circle cx="32" cy="31.5" r="3" fill="#fff6c8"/><circle cx="24" cy="14" r=".9" fill="#fff"/><circle cx="40" cy="22" r="1.1" fill="#fff"/><circle cx="25" cy="48" r="1" fill="#fff"/><circle cx="41" cy="45" r=".8" fill="#fff"/><path d="M8 32h7M49 32h7" stroke="#ffd778" stroke-width="2" stroke-linecap="round"/>',
    kilimanjaro: '<defs><linearGradient id="mwgKiliS" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffb35c"/><stop offset="1" stop-color="#ff6f61"/></linearGradient><linearGradient id="mwgKiliM" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#4b5ea8"/><stop offset="1" stop-color="#1d2a5c"/></linearGradient></defs><circle cx="46" cy="18" r="9" fill="url(#mwgKiliS)"/><path d="M2 56 24 22c2-3 5-4 8-4s6 1 8 4l22 34Z" fill="url(#mwgKiliM)"/><path d="M24 22c2-3 5-4 8-4s6 1 8 4l4 6-5-2-3 4-4-3-4 4-3-4-5 2Z" fill="#fff"/><path d="M2 56c10-6 18-8 30-6s20 0 30 6Z" fill="#2e9e5b"/><path d="M10 54l2-6 2 6M50 54l2-7 2 7" stroke="#145a33" stroke-width="2" stroke-linecap="round"/>',
    'taji-ya-milkyway': '<defs><linearGradient id="mwgTajiG" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff1a8"/><stop offset=".5" stop-color="#f4c430"/><stop offset="1" stop-color="#b8860b"/></linearGradient><radialGradient id="mwgTajiM" cx=".45" cy=".4" r=".7"><stop offset="0" stop-color="#e9ddff"/><stop offset=".45" stop-color="#8a6bff"/><stop offset="1" stop-color="#1a0f4a"/></radialGradient></defs><path d="M8 24l10 9 6-17 8 13 8-13 6 17 10-9-4 26H12Z" fill="url(#mwgTajiG)" stroke="#8a5a00" stroke-width="1.5" stroke-linejoin="round"/><rect x="11" y="48" width="42" height="8" rx="2" fill="#b8860b"/><circle cx="8" cy="23" r="3" fill="#ffd34d"/><circle cx="24" cy="15" r="3" fill="#ffd34d"/><circle cx="32" cy="27" r="3" fill="#ffd34d"/><circle cx="40" cy="15" r="3" fill="#ffd34d"/><circle cx="56" cy="23" r="3" fill="#ffd34d"/><circle cx="32" cy="39" r="5.5" fill="url(#mwgTajiM)" stroke="#fff1a8" stroke-width="1.2"/><path d="M27.5 40c2-3.5 7-3.5 9 0M29 37.5c1.5 1.5 4.5 1.5 6 0" stroke="#fff6c8" stroke-width=".9" fill="none"/><path d="M32 3l1.3 3.2 3.4.2-2.6 2.2.9 3.3L32 10l-3 1.9.9-3.3-2.6-2.2 3.4-.2Z" fill="#fff6c8"/><circle cx="14" cy="10" r="1" fill="#fff"/><circle cx="50" cy="9" r="1.2" fill="#fff"/><circle cx="44" cy="4" r=".7" fill="#fff"/><circle cx="21" cy="41" r="2.6" fill="#e5452f"/><circle cx="43" cy="41" r="2.6" fill="#2e9e5b"/><path d="M15 52h34" stroke="#fff1a8" stroke-width="1.4" stroke-dasharray="2 3"/>',
    tembo: '<defs><linearGradient id="mwgTemboG" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#b4bfd2"/><stop offset="1" stop-color="#5d6880"/></linearGradient></defs><ellipse cx="34" cy="57" rx="26" ry="3" fill="#000" opacity=".18"/>'
      + '<path d="M55 30c3 2 4 6 3 10" stroke="#5d6880" stroke-width="2" fill="none" stroke-linecap="round"/><ellipse cx="38" cy="35" rx="19" ry="14" fill="url(#mwgTemboG)"/>'
      + '<rect x="23" y="40" width="7" height="16" rx="2.5" fill="#6b7690"/><rect x="32" y="42" width="7" height="14" rx="2.5" fill="#56607a"/><rect x="42" y="42" width="7" height="14" rx="2.5" fill="#6b7690"/><rect x="50" y="40" width="6" height="16" rx="2.5" fill="#56607a"/>'
      + '<path d="M14 28c-6 4-8 12-7 20 .4 3 4.6 3.5 5 .5.6-6 2-10 7-13Z" fill="#7d889f"/><circle cx="20" cy="27" r="11" fill="url(#mwgTemboG)"/>'
      + '<ellipse cx="27" cy="28" rx="8" ry="11" fill="#8f9ab0" stroke="#5d6880" stroke-width="1.2"/><path d="M14 35c0 5 3 8 8 8" stroke="#fffbe8" stroke-width="2.6" fill="none" stroke-linecap="round"/>'
      + '<circle cx="16.5" cy="24" r="1.6" fill="#1b2033"/><path d="M12 17c4-5 12-6 17-2" stroke="#f4c430" stroke-width="2.4" fill="none" stroke-linecap="round"/><circle cx="20" cy="14.5" r="1.8" fill="#e5452f"/>',
    chui: '<defs><radialGradient id="mwgChuiF" cx=".5" cy=".4" r=".7"><stop offset="0" stop-color="#ffd884"/><stop offset="1" stop-color="#d98b1f"/></radialGradient></defs>'
      + '<circle cx="15" cy="15" r="7" fill="#d98b1f"/><circle cx="49" cy="15" r="7" fill="#d98b1f"/><circle cx="15" cy="15" r="3.5" fill="#5a3208"/><circle cx="49" cy="15" r="3.5" fill="#5a3208"/>'
      + '<ellipse cx="32" cy="35" rx="22" ry="21" fill="url(#mwgChuiF)"/>'
      + [[18, 24], [46, 24], [13, 36], [51, 36], [24, 15], [40, 15], [32, 13], [18, 48], [46, 48]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="2.6" fill="none" stroke="#4a2a05" stroke-width="1.6" stroke-dasharray="3 1.6"/><circle cx="${x}" cy="${y}" r=".9" fill="#a35f12"/>`).join('')
      + '<ellipse cx="32" cy="44" rx="11" ry="8.5" fill="#fff4dc"/><ellipse cx="23" cy="31" rx="4" ry="3.2" fill="#3fbf6a"/><ellipse cx="41" cy="31" rx="4" ry="3.2" fill="#3fbf6a"/><ellipse cx="23" cy="31" rx="1.2" ry="2.8" fill="#10200f"/><ellipse cx="41" cy="31" rx="1.2" ry="2.8" fill="#10200f"/>'
      + '<path d="M28 38h8l-4 4Z" fill="#5a2a1a"/><path d="M32 42v3M32 45c-2 2-5 2-6 0M32 45c2 2 5 2 6 0" stroke="#5a2a1a" stroke-width="1.4" fill="none" stroke-linecap="round"/><path d="M20 45l-10-1M20 48l-9 2M44 45l10-1M44 48l9 2" stroke="#fff" stroke-width=".9" opacity=".8"/>',
    dainaso: '<defs><linearGradient id="mwgDinoG" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#7fe08a"/><stop offset="1" stop-color="#2a8f4f"/></linearGradient></defs><ellipse cx="36" cy="58" rx="24" ry="3" fill="#000" opacity=".18"/>'
      + '<path d="M48 38c7 1 12 5 15 12-6-3-11-5-17-5Z" fill="#2f9a55"/><path d="M27 37C23 27 19 19 17 12" stroke="url(#mwgDinoG)" stroke-width="8" fill="none" stroke-linecap="round"/>'
      + '<ellipse cx="14" cy="11" rx="7.5" ry="5" fill="#6fd57d"/><circle cx="12" cy="9.5" r="1.3" fill="#10200f"/><path d="M8 13c2 1 4 1 6 0" stroke="#1f6e3c" stroke-width="1" fill="none"/>'
      + '<path d="M22 22l-3-4 5 1ZM25 30l-4-3 5 0ZM31 25l1-6 3 5ZM38 23l2-6 2 6ZM45 26l3-5 1 6Z" fill="#ff9a3c"/>'
      + '<ellipse cx="38" cy="38" rx="17" ry="12" fill="url(#mwgDinoG)"/><path d="M26 41c8 4 18 4 26 0" stroke="#bff2c4" stroke-width="2" fill="none" opacity=".7"/>'
      + '<rect x="25" y="43" width="7" height="13" rx="3" fill="#2a8f4f"/><rect x="34" y="45" width="6" height="11" rx="3" fill="#247d45"/><rect x="42" y="45" width="6" height="11" rx="3" fill="#2a8f4f"/><rect x="48" y="42" width="6" height="14" rx="3" fill="#247d45"/>'
      + '<circle cx="36" cy="34" r="2" fill="#ffd34d" opacity=".8"/><circle cx="43" cy="31" r="1.5" fill="#ffd34d" opacity=".8"/><circle cx="30" cy="31" r="1.4" fill="#ffd34d" opacity=".8"/>',
    'gari-la-kifahari': car('mwgCarLux', '#3a3a4c', '#0c0c14', '#f4c430', '<path d="M4 44v-5c0-3 2-5 5-5.5l9-1.5 7-7c1.5-1.5 3.5-2 5.5-2h9c2.5 0 4.5 1 6 2.5l6 6.5 6 1c3 .5 5 2.5 5 5.5V44Z"/>', '<path d="M20.5 32l6-6c1-1 2.5-1.5 4-1.5H34V32Z"/><path d="M36 24.5h3.5c2 0 3.5.8 4.8 2l5 5.5H36Z"/>', [17, 50]),
    'gari-la-mashindano': car('mwgCarSport', '#ff5a4a', '#a30d12', '#fff1a8', '<path d="M3 45v-4c0-2 1.5-3.5 3.5-4l10-2.5 9-6c2-1.3 4-2 6.5-2h6c3 0 5.5.8 7.5 2.3l6 4.7 7 1.5c2 .5 3.5 2.2 3.5 4.3V45Z"/><path d="M2 30h9l1 5H5Z"/>', '<path d="M27.5 33.5l5-4.2c1-.8 2-1.3 3.5-1.3H39v5.5Z"/><path d="M41 28h1c2 0 3.5.6 5 1.8l4.5 3.7H41Z"/>', [15, 50]),
    limozini: car('mwgCarLimo', '#ffffff', '#c9ced9', '#b8860b', '<path d="M2 44v-5c0-2.5 2-4.5 4.5-4.5h6l5-6c1-1.2 2.5-1.8 4-1.8h24c2 0 3.5.6 4.7 1.8l5.3 6h4c3 0 5.5 2 5.5 5V44Z"/>', '<path d="M18.5 34l4-4.5c.6-.7 1.3-1 2.2-1H29V34Z"/><rect x="31" y="28.5" width="7" height="5.5" rx="1"/><path d="M40 28.5h4.5c1 0 2 .4 2.7 1.2L51 34H40Z"/>', [13, 52]),
    'gari-la-umeme': car('mwgCarEv', '#7ff0e0', '#0f8f86', '#e9fbff', '<path d="M4 44v-5c0-3 2-5 5-5.5l9-1.5 7-7c1.5-1.5 3.5-2 5.5-2h9c2.5 0 4.5 1 6 2.5l6 6.5 6 1c3 .5 5 2.5 5 5.5V44Z"/>', '<path d="M20.5 32l6-6c1-1 2.5-1.5 4-1.5H34V32Z"/><path d="M36 24.5h3.5c2 0 3.5.8 4.8 2l5 5.5H36Z"/>', [17, 50]),
    'gari-la-dhahabu': car('mwgCarGold', '#fff1a8', '#b8860b', '#3a2a05', '<path d="M3 45v-4c0-2 1.5-3.5 3.5-4l10-2.5 9-6c2-1.3 4-2 6.5-2h6c3 0 5.5.8 7.5 2.3l6 4.7 7 1.5c2 .5 3.5 2.2 3.5 4.3V45Z"/><path d="M2 30h9l1 5H5Z"/>', '<path d="M27.5 33.5l5-4.2c1-.8 2-1.3 3.5-1.3H39v5.5Z"/><path d="M41 28h1c2 0 3.5.6 5 1.8l4.5 3.7H41Z"/>', [15, 50]),
    'simu-ya-dhahabu': '<defs><linearGradient id="mwgSimuG" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff1a8"/><stop offset=".5" stop-color="#f4c430"/><stop offset="1" stop-color="#b8860b"/></linearGradient><linearGradient id="mwgSimuS" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#3b2a8f"/><stop offset="1" stop-color="#0d1330"/></linearGradient></defs>'
      + '<rect x="18" y="5" width="28" height="54" rx="7" fill="url(#mwgSimuG)" stroke="#8a6406" stroke-width="1.2"/><rect x="21.5" y="10" width="21" height="43" rx="3" fill="url(#mwgSimuS)"/><rect x="28" y="7" width="8" height="1.8" rx=".9" fill="#8a6406"/>'
      + '<path d="M32 22l2.4 5 5.4.6-4 3.7 1.1 5.4L32 34l-4.9 2.7 1.1-5.4-4-3.7 5.4-.6Z" fill="#f4c430"/><rect x="25" y="42" width="14" height="2.4" rx="1.2" fill="#a48cff" opacity=".8"/><path d="M50 12l1.2 2.8 2.8 1.2-2.8 1.2L50 20l-1.2-2.8-2.8-1.2 2.8-1.2ZM12 40l.9 2.1 2.1.9-2.1.9-.9 2.1-.9-2.1-2.1-.9 2.1-.9Z" fill="#fff6c8"/>',
  };
  // Gifts without hand-drawn artwork show their emoji on a badge in their category's colours.
  const BADGES = { everyday: ['#ffe0ee', '#ff6f9f', '#ffd0e2'], culture: ['#ffe2a8', '#d9621f', '#ffc46b'], wildlife: ['#e2f5b0', '#3f8f3a', '#c7e58a'], tech: ['#d6f0ff', '#1f6fb8', '#8fd0ff'], luxury: ['#fff3b8', '#a8780a', '#ffe27a'], galaxy: ['#d9ccff', '#2c1a7a', '#a48cff'] };
  const badge = gift => { const [light, dark, ring] = BADGES[gift.category];
    return `<defs><radialGradient id="mwgBadge-${gift.category}" cx=".35" cy=".3" r=".85"><stop offset="0" stop-color="${light}"/><stop offset="1" stop-color="${dark}"/></radialGradient></defs><circle cx="32" cy="32" r="28" fill="url(#mwgBadge-${gift.category})" stroke="${ring}" stroke-width="2.5"/><circle cx="32" cy="32" r="22.5" fill="none" stroke="#fff" stroke-opacity=".35"/>`
      + (gift.category === 'galaxy' ? '<circle cx="15" cy="20" r="1" fill="#fff"/><circle cx="49" cy="17" r="1.3" fill="#fff"/><circle cx="47" cy="47" r=".9" fill="#fff"/>' : '')
      + `<text x="32" y="34" text-anchor="middle" dominant-baseline="central" font-size="30" font-family="'Apple Color Emoji','Segoe UI Emoji','Noto Color Emoji',sans-serif">${gift.emoji}</text>`; };
  const art = (key, size = 56) => { const gift = giftOf(key);return `<svg class="mwg-art" viewBox="0 0 64 64" width="${size}" height="${size}" aria-hidden="true">${gift ? ART[gift.key] || badge(gift) : ''}</svg>`; };
  const coinIcon = (size = 22) => `<svg class="mwg-coin" viewBox="0 0 32 32" width="${size}" height="${size}" aria-hidden="true"><defs><linearGradient id="mwgCoin" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff2a8"/><stop offset=".5" stop-color="#f4c430"/><stop offset="1" stop-color="#b8860b"/></linearGradient></defs><circle cx="16" cy="16" r="14" fill="url(#mwgCoin)" stroke="#9a6b00" stroke-width="1.5"/><circle cx="16" cy="16" r="10.5" fill="none" stroke="#fff6c8" stroke-width="1" opacity=".8"/><path d="M16 7.5l2.2 6.3 6.3 2.2-6.3 2.2L16 24.5l-2.2-6.3L7.5 16l6.3-2.2Z" fill="#7a4f00"/></svg>`;
  const giftGlyph = '<svg class="mwg-glyph" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 11h16v9a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1Z"/><path d="M3 7h18v4H3zM12 7v14"/><path d="M12 7c-1.5-3.5-6-4-6-1.2C6 7 9 7 12 7c3 0 6 0 6-1.2C18 3 13.5 3.5 12 7Z"/></svg>';
  const giftOf = key => GIFTS.find(gift => gift.key === (CATALOG.aliases[key] || key));
  const giftName = key => giftOf(key)?.name || key;
  const giftMeaning = gift => gift.meaning;
  const coinsLabel = count => `${fmt(count)} ${T(Number(count) === 1 ? 'coin' : 'coins')}`;
  // A category's cheapest to dearest gift in money, e.g. "TSh 100 – TSh 1,000".
  const priceRange = category => { const prices = GIFTS.filter(gift => gift.category === category).map(gift => gift.coins);return `${worthOf(Math.min(...prices))} – ${worthOf(Math.max(...prices))}`; };

  // ---------- Service ----------
  async function api(action, body) {
    const session = (await sb.auth.getSession()).data.session;
    if (!session) throw Object.assign(new Error(window.MilkyWayI18n?.t('signInFirst') || 'Sign in first.'), { status: 401 });
    const response = await fetch(`${endpoint}?action=${action}`, {
      method: body ? 'POST' : 'GET', cache: 'no-store', signal: AbortSignal.timeout(20000), body: body ? JSON.stringify(body) : undefined,
      headers: { Authorization: `Bearer ${session.access_token}`, apikey: sb.supabaseKey || '', 'X-MW-Region': deviceRegion(), ...(body ? { 'Content-Type': 'application/json' } : {}) },
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw Object.assign(new Error(window.MilkyWayI18n?.text(result.error || '') || result.error || T('retry')), { status: response.status });
    return result;
  }
  let catalog = null;
  const loadCatalog = () => catalog || (catalog = fetch(`${endpoint}?action=catalog`, { signal: AbortSignal.timeout(15000), headers: { 'X-MW-Region': deviceRegion() } }).then(response => response.ok ? response.json() : Promise.reject()).then(info => { setPricing(info.pricing, false);return info; }).catch(() => { catalog = null;return { paymentInstructions: '', minWithdrawCoins: 50, coinTzs: 1000, topupPackages: [5, 10, 20, 50, 100], networks: ['mpesa', 'mixx', 'airtel', 'halopesa'] }; }));
  const NETWORKS = { mpesa: 'M-Pesa', mixx: 'Mixx by Yas (Tigo Pesa)', airtel: 'Airtel Money', halopesa: 'HaloPesa' };
  let wallet = null;
  let walletFailed = false;
  // The last wallet totals are kept on this device per account so the balance shows instantly (even offline or on
  // a slow connection). They are only for display: withdrawals and gift checks always wait for the live wallet.
  const savedKey = () => `mw_wallet_${user?.id}`;
  const savedWallet = () => {
    if (!signedIn()) return null;
    try { const saved = JSON.parse(localStorage.getItem(savedKey()) || 'null');return saved && typeof saved.coins === 'number' ? { ...saved, saved: true } : null; } catch { return null; }
  };
  const saveWallet = data => {
    try { localStorage.setItem(savedKey(), JSON.stringify({ coins: Number(data.coins || 0), earned: Number(data.earned || 0), lifetimeEarned: Number(data.lifetimeEarned || 0), minWithdrawCoins: data.minWithdrawCoins, coinTzs: data.coinTzs })); } catch {}
  };
  const shownWallet = () => wallet || savedWallet();
  async function loadWallet() {
    try { wallet = await api('wallet');walletFailed = false;setPricing(wallet.pricing, true);saveWallet(wallet); }
    catch (error) { walletFailed = !wallet;paintCards();throw error; }
    paintCards();window.dispatchEvent(new CustomEvent('mw-wallet-change', { detail: wallet }));return wallet; }

  // ---------- Layer (bottom drawer above every screen, including LIVE) ----------
  const layer = document.createElement('div');layer.className = 'mwg-layer mwx-no-translate';layer.hidden = true;
  layer.innerHTML = '<div class="mwg-drawer" role="dialog" aria-modal="true" aria-labelledby="mwgTitle"><header class="mwg-head"><button type="button" class="mwg-back" hidden aria-label="Back">‹</button><h2 id="mwgTitle"></h2><button type="button" class="mwg-close" aria-label="Close">×</button></header><div class="mwg-body"></div><p class="mwg-note" role="status" aria-live="polite"></p></div>';
  document.body.append(layer);
  const drawer = layer.querySelector('.mwg-drawer'), panel = layer.querySelector('.mwg-body'), note = layer.querySelector('.mwg-note'), back = layer.querySelector('.mwg-back');
  let opener = null, backTo = null;
  function show(title, html, previous = null) {
    if (layer.hidden) opener = document.activeElement;
    closeNetworks(false);
    byId('mwgTitle').textContent = title;
    panel.innerHTML = html;note.textContent = '';note.className = 'mwg-note';
    backTo = previous;back.hidden = !previous;back.setAttribute('aria-label', T('back'));
    layer.querySelector('.mwg-close').setAttribute('aria-label', T('close'));
    layer.hidden = false;requestAnimationFrame(() => layer.classList.add('open'));
    drawer.scrollTop = 0;
  }
  let repaintPicker = null;
  function hide() { closeNetworks(false);repaintPicker = null;layer.classList.remove('open');layer.hidden = true;backTo = null;opener?.focus?.();opener = null; }
  const say = (message, bad = false) => { note.textContent = message;note.className = `mwg-note${bad ? ' bad' : ' good'}`; };
  layer.querySelector('.mwg-close').onclick = hide;
  back.onclick = () => backTo?.();
  layer.addEventListener('click', event => { if (event.target === layer) hide(); });
  document.addEventListener('keydown', event => { if (event.key === 'Escape' && !layer.hidden) hide(); });

  // ---------- Mobile money provider picker (bottom sheet instead of the native select popup) ----------
  const NETWORK_TINT = { mpesa: '#e60000', mixx: '#0a4ea2', airtel: '#ed1c24', halopesa: '#f58220' };
  const networkField = (keys, selected = keys[0]) => `<div class="mwg-net-field"><span class="mwg-net-label" id="mwgNetLabel">${esc(T('network'))}</span><input type="hidden" name="network" value="${esc(selected || '')}">`
    + `<button type="button" class="mwg-net-trigger" aria-haspopup="dialog" aria-expanded="false" aria-labelledby="mwgNetLabel mwgNetValue" data-keys="${esc(keys.join(','))}"><span class="mwg-net-dot" aria-hidden="true"></span><span class="mwg-net-value" id="mwgNetValue"></span><span class="mwg-net-chev" aria-hidden="true"></span></button></div>`;
  const netSheet = document.createElement('div');netSheet.className = 'mwg-net-layer';netSheet.hidden = true;
  netSheet.innerHTML = '<div class="mwg-net-sheet" role="dialog" aria-modal="true" aria-labelledby="mwgNetTitle"><span class="mwg-net-grab" aria-hidden="true"></span><h3 id="mwgNetTitle"></h3><div class="mwg-net-options" role="radiogroup" aria-labelledby="mwgNetTitle"></div></div>';
  layer.append(netSheet);
  let netTarget = null, netCloseTimer = 0;
  function paintNetwork(form) {
    const input = form.querySelector('input[name="network"]'), trigger = form.querySelector('.mwg-net-trigger');if (!input || !trigger) return;
    trigger.querySelector('.mwg-net-value').textContent = NETWORKS[input.value] || input.value || '—';
    trigger.style.setProperty('--mwg-net-tint', NETWORK_TINT[input.value] || 'var(--accent,#7c5cff)');
  }
  function closeNetworks(focusTrigger = true) {
    if (netSheet.hidden) return;
    const trigger = netTarget?.querySelector('.mwg-net-trigger');trigger?.setAttribute('aria-expanded', 'false');
    netSheet.classList.remove('open');clearTimeout(netCloseTimer);
    const done = () => { netSheet.hidden = true; };
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) done();else netCloseTimer = setTimeout(done, 240);
    if (focusTrigger) trigger?.focus();
    netTarget = null;
  }
  function openNetworks(form) {
    const input = form.querySelector('input[name="network"]'), trigger = form.querySelector('.mwg-net-trigger');
    const keys = trigger.dataset.keys.split(',').filter(Boolean);
    netTarget = form;clearTimeout(netCloseTimer);
    byId('mwgNetTitle').textContent = T('chooseNetwork');
    const list = netSheet.querySelector('.mwg-net-options');
    list.innerHTML = keys.map(key => { const on = key === input.value;return `<button type="button" class="mwg-net-option${on ? ' on' : ''}" role="radio" aria-checked="${on}" tabindex="${on ? 0 : -1}" data-net="${esc(key)}" style="--mwg-net-tint:${NETWORK_TINT[key] || 'var(--accent,#7c5cff)'}"><span class="mwg-net-badge" aria-hidden="true">${esc((NETWORKS[key] || key).charAt(0))}</span><span class="mwg-net-name">${esc(NETWORKS[key] || key)}</span><span class="mwg-net-radio" aria-hidden="true"></span></button>`; }).join('');
    if (!list.querySelector('[tabindex="0"]')) list.firstElementChild?.setAttribute('tabindex', '0');
    netSheet.hidden = false;trigger.setAttribute('aria-expanded', 'true');
    requestAnimationFrame(() => { netSheet.classList.add('open');(list.querySelector('[tabindex="0"]'))?.focus({ preventScroll: true }); });
  }
  function pickNetwork(key) {
    const form = netTarget;if (!form) return;
    const input = form.querySelector('input[name="network"]');input.value = key;
    netSheet.querySelectorAll('[data-net]').forEach(option => { const on = option.dataset.net === key;option.classList.toggle('on', on);option.setAttribute('aria-checked', String(on)); });
    paintNetwork(form);navigator.vibrate?.(8);
    closeNetworks();
  }
  function bindNetwork(form) {
    if (!form?.querySelector('.mwg-net-trigger')) return;
    paintNetwork(form);
    form.querySelector('.mwg-net-trigger').onclick = () => openNetworks(form);
    // form.reset() restores the hidden input's default; repaint the trigger to match.
    form.addEventListener('reset', () => setTimeout(() => paintNetwork(form)));
  }
  const setNetwork = (form, key) => { const input = form?.querySelector('input[name="network"]');if (input && key && (NETWORKS[key] || key)) { input.value = key;input.defaultValue = key;paintNetwork(form); } };
  netSheet.addEventListener('click', event => {
    const option = event.target.closest('[data-net]');
    if (option) pickNetwork(option.dataset.net);else if (event.target === netSheet) closeNetworks();
  });
  netSheet.addEventListener('keydown', event => {
    const options = [...netSheet.querySelectorAll('[data-net]')], index = options.indexOf(document.activeElement);
    if (event.key === 'Escape') { event.preventDefault();event.stopPropagation();closeNetworks();return; }
    if (index < 0) return;
    const step = { ArrowDown: 1, ArrowRight: 1, ArrowUp: -1, ArrowLeft: -1 }[event.key];
    if (step) { event.preventDefault();const next = options[(index + step + options.length) % options.length];options.forEach(option => option.tabIndex = -1);next.tabIndex = 0;next.focus(); }
    else if (event.key === 'Tab') event.preventDefault();
  });

  // ---------- Gift picker ----------
  async function openPicker(target) {
    if (typeof requireLogin === 'function' && !requireLogin('kutuma zawadi')) return;
    if (target.to && target.to === user?.id) { toastAll(T('ownPost'));return; }
    let selected = null;
    const render = () => {
      show(T('sendGift'), `<div class="mwg-wallet-strip">${coinIcon(26)}<div><small>${esc(T('yourCoins'))}</small><strong id="mwgPickerCoins">${shownWallet() ? fmt(shownWallet().coins) : '…'}</strong></div><button type="button" class="mwg-pill" data-mwg="topup">＋ ${esc(T('topUp'))}</button></div>`
        + `<p class="mwg-muted">${esc(T('sendGiftHint'))}</p>`
        + `<p class="mwg-every">${esc(T('everyValue', { a: worthOf(GIFTS[0].coins), b: worthOf(GIFTS.at(-1).coins), c: worthOf(1) }))}</p><nav class="mwg-cat-nav" aria-label="${esc(T('gift'))}">${CATALOG.categories.map(category => `<button type="button" class="mwg-cat-chip" data-mwg-cat="${category.key}"><span aria-hidden="true">${category.icon}</span>${esc(pick(category.name))}<small>${esc(priceRange(category.key))}</small></button>`).join('')}</nav>`
        + CATALOG.categories.map(category => `<section class="mwg-tier mwg-cat mwg-cat-${category.key}${category.from > 55 ? ' mwg-tier-premium' : ''}" id="mwgCat-${category.key}"><h3>${esc(pick(category.name))}<span>${esc(priceRange(category.key))}</span></h3><p class="mwg-cat-about">${esc(pick(category.about))}</p><div class="mwg-grid">${GIFTS.filter(gift => gift.category === category.key).map(gift => `<button type="button" class="mwg-gift${selected?.key === gift.key ? ' on' : ''}" data-gift="${gift.key}" aria-pressed="${selected?.key === gift.key}" title="${esc(`${gift.name} · ${gift.meaning}`)}">${art(gift.key)}<b>${esc(gift.name)}</b><small>${esc(gift.meaning)}</small><span class="mwg-worth">${esc(worthOf(gift.coins))}</span><span class="mwg-price">${coinIcon(14)}${coinsLabel(gift.coins)}</span></button>`).join('')}</div></section>`).join('')
        + `<div class="mwg-send-bar"><button type="button" class="mwg-primary" data-mwg="send" disabled>${esc(T('send'))}</button></div>`);
      panel.querySelectorAll('[data-mwg-cat]').forEach(chip => chip.onclick = () => byId(`mwgCat-${chip.dataset.mwgCat}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
      const sendButton = panel.querySelector('[data-mwg="send"]');
      if (selected) { sendButton.disabled = false;sendButton.innerHTML = `${esc(T('send'))} ${esc(selected.name)} · ${esc(worthOf(selected.coins))} (${coinIcon(16)} ${fmt(selected.coins)})`; }
      panel.querySelectorAll('[data-gift]').forEach(button => button.onclick = () => {
        selected = giftOf(button.dataset.gift);
        panel.querySelectorAll('[data-gift]').forEach(other => { const on = other === button;other.classList.toggle('on', on);other.setAttribute('aria-pressed', String(on)); });
        const send = panel.querySelector('[data-mwg="send"]');send.disabled = false;
        send.innerHTML = `${esc(T('send'))} ${esc(selected.name)} · ${esc(worthOf(selected.coins))} (${coinIcon(16)} ${fmt(selected.coins)})`;
        if (wallet && wallet.coins < selected.coins) say(T('notEnough'), true);else say('');
      });
      panel.querySelector('[data-mwg="topup"]').onclick = () => openTopup(render);
      panel.querySelector('[data-mwg="send"]').onclick = async event => {
        if (!selected) { say(T('chooseGift'), true);return; }
        if (wallet && wallet.coins < selected.coins) { openTopup(render, Math.ceil(selected.coins - wallet.coins));return; }
        const button = event.currentTarget;button.disabled = true;button.textContent = T('sending');
        try {
          const result = await api('gift', target.room ? { gift: selected.key, room: target.room } : target.storyId ? { gift: selected.key, storyId: target.storyId } : { gift: selected.key, postId: target.postId });
          if (wallet) wallet.coins = result.coins;
          hide();celebrate(selected.key, '', true);
          toastAll(`${T('giftSent')} ${selected.name}`);
          loadWallet().catch(() => {});
        } catch (error) {
          if (error.status === 402) { say(T('notEnough'), true); }
          else say(error.message, true);
          button.disabled = false;button.innerHTML = `${esc(T('send'))} ${esc(selected.name)} · ${esc(worthOf(selected.coins))} (${coinIcon(16)} ${fmt(selected.coins)})`;
        }
      };
    };
    render();repaintPicker = render;
    loadWallet().then(() => { const value = byId('mwgPickerCoins');if (value) value.textContent = fmt(wallet.coins); }).catch(() => {});
  }
  // The app toast sits under the LIVE screen, so gift messages use their own when LIVE is open.
  function toastAll(message) {
    const live = byId('mwLivePage');
    if (!live || live.hidden) { if (typeof toast === 'function') toast(message);return; }
    const bubble = document.createElement('div');bubble.className = 'mwg-toast';bubble.textContent = message;
    document.body.append(bubble);setTimeout(() => bubble.remove(), 2600);
  }

  // ---------- Celebration ----------
  function celebrate(key, sender = '', mine = false) {
    const gift = giftOf(key);if (!gift) return;
    const burst = document.createElement('div');burst.className = `mwg-burst mwg-burst-${gift.tier}`;burst.setAttribute('aria-hidden', 'true');
    const sparks = Array.from({ length: gift.tier === 'premium' ? 14 : 8 }, (_, index) => `<i style="--a:${Math.round(index * 360 / (gift.tier === 'premium' ? 14 : 8))}deg"></i>`).join('');
    burst.innerHTML = `<div class="mwg-burst-ring">${sparks}</div>${art(key, gift.tier === 'premium' ? 150 : 110)}<p><b>${esc(sender || (mine ? '' : 'MilkyWay'))}</b> ${esc(mine ? `${T('giftSent')}` : T('sentGift', { gift: gift.name }))}${mine ? ` ${esc(gift.name)}` : ''}</p>`;
    document.body.append(burst);
    setTimeout(() => burst.remove(), gift.tier === 'premium' ? 3200 : 2300);
  }

  // ---------- Wallet ----------
  const statusPill = status => `<span class="mwg-status mwg-status-${esc(status)}">${esc(T(status))}</span>`;
  const when = value => { try { return new Date(value).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }); } catch { return ''; } };
  function earningsHtml(data, compact = false) {
    const min = data?.minWithdrawCoins || 50, earned = data?.earned || 0;
    const pending = data?.withdrawals?.some(item => item.status === 'pending');
    const ready = earned >= min;
    const percent = Math.min(100, Math.round(earned / min * 100));
    const state = pending ? T('withdrawPending') : ready ? T('withdrawReady') : T('withdrawLocked', { n: fmt(min), tzs: money(min * (data?.coinTzs || COIN_TZS)) });
    return `<div class="mwg-earn-top">${coinIcon(compact ? 34 : 42)}<div class="mwg-earn-value"><small>${esc(T('earned'))}</small><strong>${data ? fmt(earned) : '…'} <em>${esc(T('coinsTitle'))}</em></strong></div>`
      + `<button type="button" class="mwg-withdraw" data-mwg-withdraw ${data && !data.saved && ready && !pending ? '' : 'disabled'} aria-disabled="${data && !data.saved && ready && !pending ? 'false' : 'true'}">${ready && !pending ? '' : '🔒 '}${esc(T('withdraw'))}</button></div>`
      + `<div class="mwg-progress" role="progressbar" aria-valuemin="0" aria-valuemax="${min}" aria-valuenow="${Math.min(earned, min)}" aria-label="${esc(T('progress', { x: fmt(Math.min(earned, min)), n: fmt(min) }))}"><i style="width:${percent}%"></i></div>`
      + `<p class="mwg-earn-state"><span>${esc(state)}</span><span>${esc(T('progress', { x: fmt(Math.min(earned, min)), n: fmt(min) }))}</span></p>`;
  }
  // Coin dashboard at the top of the creator's own profile and Studio: the coin balance first, then the
  // withdrawal section, which unlocks once earnings reach the minimum (50 coins).
  function dashboardHtml(data) {
    const min = data?.minWithdrawCoins || 50, rate = data?.coinTzs || 1000, earned = data?.earned || 0;
    const pending = data?.withdrawals?.some(item => item.status === 'pending');
    const ready = Boolean(data) && !data.saved && earned >= min && !pending;
    const percent = Math.min(100, Math.round(earned / min * 100));
    const progress = T('progress', { x: fmt(Math.min(earned, min)), n: fmt(min) });
    const state = !data ? walletFailed ? T('loadFailed') : '' : pending ? T('withdrawPending') : earned >= min ? T('withdrawReady') : T('toGo', { n: fmt(Math.round((min - earned) * 10) / 10) });
    return `<header class="mwg-dash-head"><h3>${coinIcon(20)}<span>${esc(T('dashTitle'))}</span></h3><button type="button" class="mwg-link" data-mwg-open>${esc(T('openWallet'))} ›</button></header>`
      + `<div class="mwg-dash-balance"><small>${esc(T('balanceTop'))}</small><strong>${coinIcon(42)}<span>${data ? fmt(earned) : walletFailed ? '—' : '…'}</span><em>${esc(T('coinsTitle'))}</em></strong>`
      + `<span class="mwg-dash-share">${esc(T('earnedHint'))}</span>`
      + `<p>${data ? esc(T('worth', { tzs: money(earned * rate) })) : ''}${data?.lifetimeEarned ? ` · ${esc(T('lifetime'))}: ${fmt(data.lifetimeEarned)}` : ''}</p></div>`
      + `<div class="mwg-dash-spend"><span>${esc(T('spendable'))}: <b>${data ? fmt(data.coins) : '…'}</b></span><button type="button" class="mwg-pill" data-mwg="topup">＋ ${esc(T('topUp'))}</button></div>`
      + `<section class="mwg-dash-withdraw"><h4>${esc(T('withdrawSection'))}</h4>`
      + `<div class="mwg-progress" role="progressbar" aria-valuemin="0" aria-valuemax="${min}" aria-valuenow="${Math.min(earned, min)}" aria-label="${esc(progress)}"><i style="width:${percent}%"></i></div>`
      + `<p class="mwg-earn-state"><span${walletFailed && !data ? ' class="bad"' : ''}>${esc(state)}</span><span>${esc(progress)}</span></p>`
      + `<button type="button" class="mwg-withdraw mwg-dash-cta" data-mwg-withdraw ${ready ? '' : 'disabled'} aria-disabled="${ready ? 'false' : 'true'}">${ready ? '' : '🔒 '}${esc(T('withdraw'))}${ready ? ` · ${esc(money(earned * rate))}` : ''}</button>`
      + `<p class="mwg-muted">${esc(T('withdrawRule', { n: fmt(min), min: money(min * rate), tzs: money(rate) }))}</p></section>`;
  }
  function mountCard(container) {
    if (!container || !signedIn()) return;
    let card = container.querySelector(':scope > .mwg-earn-card');
    if (!card) {
      card = document.createElement('section');card.className = 'mwg-earn-card mwg-dash mwx-no-translate';card.setAttribute('aria-label', T('dashTitle'));
      card.addEventListener('click', event => {
        const withdraw = event.target.closest('[data-mwg-withdraw]');
        if (withdraw) { if (!withdraw.disabled) openWithdraw();return; }
        if (event.target.closest('[data-mwg="topup"]')) { openTopup();return; }
        if (event.target.closest('[data-mwg-open]')) { openWallet();return; }
        if (walletFailed && !wallet) loadWallet().catch(() => {});
      });
      const title = container.querySelector(':scope > h2');
      if (title) title.after(card);else container.prepend(card);
    }
    card.innerHTML = dashboardHtml(shownWallet());
    loadWallet().catch(() => {});
  }
  function paintCards() { document.querySelectorAll('.mwg-earn-card').forEach(card => { card.innerHTML = dashboardHtml(shownWallet());card.setAttribute('aria-label', T('dashTitle')); }); }
  const signedIn = () => typeof logged === 'function' && logged() && user?.id;

  async function openWallet() {
    if (typeof requireLogin === 'function' && !requireLogin('kuona pochi')) return;
    const render = () => {
      const data = shownWallet();
      const history = [...(data?.topups || []).map(item => ({ ...item, kind: 'topup' })), ...(data?.withdrawals || []).map(item => ({ ...item, kind: 'withdraw' }))].sort((a, b) => new Date(b.at) - new Date(a.at)).slice(0, 12);
      show(T('wallet'), `<section class="mwg-card mwg-earn-main">${earningsHtml(data)}<p class="mwg-muted">${esc(T('earnedHint'))}${data?.lifetimeEarned ? ` · ${esc(T('lifetime'))}: ${fmt(data.lifetimeEarned)} ${esc(T('coins'))}` : ''}</p></section>`
        + `<section class="mwg-card mwg-spend"><div class="mwg-wallet-strip">${coinIcon(26)}<div><small>${esc(T('spendable'))}</small><strong>${data ? fmt(data.coins) : '…'}</strong></div><button type="button" class="mwg-pill" data-mwg="topup">＋ ${esc(T('topUp'))}</button></div><p class="mwg-muted">${esc(T('spendableHint'))}</p></section>`
        + (payInfo ? lipaHtml(payInfo.lipa, { wallet: true }) : '')
        + `<section class="mwg-card"><h3 class="mwg-section">Thibitisha ununuzi / Redeem purchase</h3><p class="mwg-muted">Baada ya msimamizi kuthibitisha malipo yako, ingiza code ya mara moja ili sarafu ulizonunua ziingie.</p><form data-mwg-redeem-code><label for="mwgRedeemCode">Namba ya uthibitisho / Verification code</label><input id="mwgRedeemCode" name="code" minlength="8" maxlength="8" pattern="[A-Za-z0-9]{8}" autocomplete="one-time-code" required style="text-transform:uppercase"><button class="mwg-pill" type="submit">Thibitisha na upokee / Redeem</button><p class="mwg-muted" data-mwg-redeem-message aria-live="polite"></p></form></section>`
        + `<h3 class="mwg-section">${esc(T('received'))}</h3><div class="mwg-list">${(data?.received || []).map(item => `<div class="mwg-row">${art(item.gift, 40)}<div><b>${esc(giftName(item.gift))}</b><small>${esc(item.from ? T('from', { name: item.from }) : '')} · ${esc(T(item.target === 'live' ? 'onLive' : item.target === 'story' ? 'onStory' : 'onPost'))} · ${esc(when(item.at))}</small></div><strong class="mwg-plus">+${fmt(item.earned)}</strong></div>`).join('') || `<p class="mwg-muted">${esc(data ? T('noGifts') : '…')}</p>`}</div>`
        + `<h3 class="mwg-section">${esc(T('history'))}</h3><div class="mwg-list">${history.map(item => `<div class="mwg-row"><span class="mwg-row-icon">${item.kind === 'topup' ? '＋' : '↗'}</span><div><b>${esc(T(item.kind === 'topup' ? 'topupRow' : 'withdrawRow', { n: fmt(item.coins) }))}</b><small>${esc(when(item.at))}${item.kind === 'withdraw' ? ` · ${esc(NETWORKS[item.network] || '')} · ${esc(item.payoutLocalMinor && item.currency === pricing().currency ? formatMinor(item.payoutLocalMinor, item.currency, pricing().digits) : money(item.payoutTzs))}` : ''}${item.note ? ` · ${esc(item.note)}` : ''}</small></div>${statusPill(item.status)}</div>`).join('') || `<p class="mwg-muted">${esc(data ? T('noHistory') : '…')}</p>`}</div>`);
      panel.querySelectorAll('[data-mwg="topup"]').forEach(button => button.onclick = () => openTopup(render));
      const redeemForm = panel.querySelector('[data-mwg-redeem-code]');
      redeemForm?.addEventListener('submit', async event => {
        event.preventDefault();
        const button = redeemForm.querySelector('button[type="submit"]'), message = redeemForm.querySelector('[data-mwg-redeem-message]');
        button.disabled = true; message.textContent = 'Inathibitisha… / Checking…';
        try { const result = await api('redeem-topup-code', { code: redeemForm.elements.code.value.trim().toUpperCase() }); message.textContent = result.message || 'Imekubaliwa. / Accepted.'; await loadWallet();render(); }
        catch (error) { message.textContent = error.message || 'Imeshindikana. / Failed.'; }
        finally { button.disabled = false; }
      });
      bindCopy();
      panel.querySelector('[data-mwg-withdraw]').onclick = event => { if (!event.currentTarget.disabled) openWithdraw(render); };
    };
    // The Lipa Namba card joins the wallet screen as soon as the payment details arrive.
    let payInfo = null;
    const showing = () => !layer.hidden && byId('mwgTitle').textContent === T('wallet');
    render();
    loadCatalog().then(info => { payInfo = info;if (showing()) render(); }).catch(() => {});
    try { await loadWallet();if (showing()) render(); }
    catch (error) { say(error.message || T('retry'), true); }
  }

  // Lipa Namba card: the merchant number in large type with a QR code users scan from their mobile money app.
  // The QR carries the official merchant QR text when the owner saved one, otherwise the number itself.
  const spaced = number => String(number).replace(/(\d{3})(?=\d)/g, '$1 ');
  // Without a saved number the card still shows, explaining that the number is coming, so the section never vanishes.
  function lipaHtml(lipa, { wallet = false } = {}) {
    const id = wallet ? 'mwgLipaWalletTitle' : 'mwgLipaTitle';
    const head = `<section class="mwg-card mwg-lipa" aria-labelledby="${id}"><h3 class="mwg-section" id="${id}">${esc(T('lipaTitle'))}</h3>`;
    if (!lipa?.number) return `${head}<p class="mwg-muted">${esc(T('lipaPending'))}</p>${wallet ? `<button type="button" class="mwg-pill" data-mwg="topup">＋ ${esc(T('topUp'))}</button>` : ''}</section>`;
    let qr = '';
    try { qr = window.MilkyWayQR?.svg(lipa.qr || lipa.number, { label: `${T('lipaNumber')} ${lipa.number}` }) || ''; } catch { qr = ''; }
    return head
      + `<div class="mwg-lipa-body">${qr ? `<div class="mwg-lipa-qr">${qr}</div>` : ''}<div class="mwg-lipa-info">`
      + `${lipa.network ? `<span class="mwg-lipa-network">${esc(NETWORKS[lipa.network] || lipa.network)}</span>` : ''}`
      + `<small>${esc(T('lipaNumber'))}</small><strong class="mwg-lipa-number">${esc(spaced(lipa.number))}</strong>`
      + `<button type="button" class="mwg-pill mwg-lipa-copy" data-mwg-copy="${esc(lipa.number)}">⧉ ${esc(T('copy'))}</button>`
      + `${lipa.name ? `<small>${esc(T('lipaName'))}</small><b>${esc(lipa.name)}</b>` : ''}`
      + `${wallet ? '' : `<small>${esc(T('lipaAmount'))}</small><b id="mwgLipaAmount" class="mwg-lipa-amount"></b>`}</div></div>`
      + (wallet ? `<p class="mwg-muted">${esc(T('lipaWallet'))}</p><button type="button" class="mwg-pill" data-mwg="topup">＋ ${esc(T('topUp'))}</button></section>`
        : `<p class="mwg-muted">${esc(T('lipaScan'))}</p><p class="mwg-lipa-steps" id="mwgLipaSteps"></p></section>`);
  }
  function bindCopy() {
    const copyButton = panel.querySelector('[data-mwg-copy]');
    if (copyButton) copyButton.onclick = async () => {
      try { await navigator.clipboard.writeText(copyButton.dataset.mwgCopy);copyButton.textContent = `✓ ${T('copied')}`; }
      catch { say(copyButton.dataset.mwgCopy); }
    };
  }

  async function openTopup(previous = null, suggested = 0) {
    const info = await loadCatalog();
    const packages = [100, 500, 1000, 5000, 10000];
    let amountTzs = Math.max(100, Math.round((Number(suggested || 1) * (info.coinTzs || 1000)) / 100) * 100);
    amountTzs = Math.min(1000000, amountTzs);
    show(T('topupTitle'), `<p class="mwg-muted">${esc('Enter an amount from TZS 100. 1 coin = TZS 1,000; TZS 100 = 0.1 coin.')}</p><div class="mwg-packages" role="group" aria-label="${esc(T('topupTitle'))}">${packages.map(value => `<button type="button" class="mwg-package" data-amount="${value}">${coinIcon(18)}<b>${esc(tzs(value))}</b><small>${fmt(value / (info.coinTzs || 1000))} ${esc(T('coins'))}</small></button>`).join('')}</div>`
      + `<form class="mwg-form" id="mwgAmountForm"><label>Amount to pay (TZS)<input id="mwgAmountInput" name="amountTzs" type="number" inputmode="numeric" min="100" max="1000000" step="100" value="${amountTzs}" required></label></form>`
      + `<p class="mwg-total">${esc(T('toPay'))}: <strong id="mwgTopupTotal"></strong></p><p class="mwg-muted" id="mwgTopupTzs"${local() ? '' : ' hidden'}></p>`
      + lipaHtml(info.lipa)
      + `<section class="mwg-card"><h3 class="mwg-section">${esc(T('howToPay'))}</h3>${info.paymentInstructions || !info.lipa?.number ? `<p>${esc(info.paymentInstructions || T('defaultPay'))}</p>` : ''}<p class="mwg-muted">${esc(T(info.lipa?.number ? 'lipaAfter' : 'topupHelp'))}</p></section>`
      + `<form class="mwg-form" id="mwgTopupForm">${networkField(info.networks || Object.keys(NETWORKS))}`
      + `<label>${esc(T('paidFrom'))}<input name="phone" type="tel" inputmode="tel" autocomplete="tel" required placeholder="07XX XXX XXX" maxlength="20"></label>`
      + `<label>${esc(T('reference'))}<input name="reference" required maxlength="40" autocapitalize="characters" placeholder="${esc(T('referenceHint'))}"></label>`
      + `<button type="submit" class="mwg-primary">${esc(T('submitTopup'))}</button></form>`, previous);
    const paint = () => {
      const input = byId('mwgAmountInput');
      const raw = Number(input?.value);
      if (Number.isSafeInteger(raw) && raw >= 100 && raw <= 1000000 && raw % 100 === 0) amountTzs = raw;
      panel.querySelectorAll('[data-amount]').forEach(button => { const on = Number(button.dataset.amount) === amountTzs;button.classList.toggle('on', on);button.setAttribute('aria-pressed', String(on)); });
      const coins = Math.round((amountTzs / (info.coinTzs || 1000)) * 10) / 10;
      byId('mwgTopupTotal').textContent = `${tzs(amountTzs)} · ${coinsLabel(coins)}`;
      byId('mwgTopupTzs').textContent = T('paidAs', { tzs: tzs(amountTzs) });
      const lipaAmount = byId('mwgLipaAmount'), lipaSteps = byId('mwgLipaSteps');
      if (lipaAmount) lipaAmount.textContent = tzs(amountTzs);
      if (lipaSteps) lipaSteps.textContent = T('lipaSteps', { amount: tzs(amountTzs) });
    };
    bindCopy();
    bindNetwork(byId('mwgTopupForm'));
    if (info.lipa?.number && info.lipa.network) setNetwork(byId('mwgTopupForm'), info.lipa.network);
    panel.querySelectorAll('[data-amount]').forEach(button => button.onclick = () => { amountTzs = Number(button.dataset.amount);byId('mwgAmountInput').value = String(amountTzs);paint(); });
    byId('mwgAmountInput').addEventListener('input', paint);
    paint();
    byId('mwgTopupForm').onsubmit = async event => {
      event.preventDefault();
      const form = event.currentTarget, button = form.querySelector('button[type="submit"]');
      const amountInput = byId('mwgAmountInput'), amount = Number(amountInput?.value);
      if (!Number.isSafeInteger(amount) || amount < 100 || amount > 1000000 || amount % 100 !== 0) { say('Enter a TZS amount from 100 to 1,000,000 in steps of 100.', true);amountInput?.focus();return; }
      button.disabled = true;
      try {
        await api('topup', { amountTzs: amount, network: form.network.value, phone: form.phone.value, reference: form.reference.value });
        form.reset();say(T('topupSent'));
        loadWallet().catch(() => {});
      } catch (error) { say(error.message, true); }
      finally { button.disabled = false; }
    };
  }

  async function openWithdraw(previous = null) {
    const data = wallet || await loadWallet().catch(() => null);
    if (!data) { toastAll(T('retry'));return; }
    const min = data.minWithdrawCoins || 50, rate = data.coinTzs || 1000;
    if (data.earned < min) { toastAll(T('withdrawLocked', { n: fmt(min), tzs: money(min * rate) }));return; }
    // Prefill the phone number already linked to the account, if any.
    const savedPhone = await sb.auth.getSession().then(({ data }) => data.session ? fetch('/api/milkyway-account?action=phone', { cache: 'no-store', signal: AbortSignal.timeout(8000), headers: { Authorization: `Bearer ${data.session.access_token}`, apikey: sb.supabaseKey || '' } }) : null)
      .then(response => response?.ok ? response.json() : {}).then(result => result.phone || '').catch(() => '');
    show(T('withdrawTitle'), `<section class="mwg-card mwg-earn-main">${earningsHtml(data)}</section>`
      + `<form class="mwg-form" id="mwgWithdrawForm"><label>${esc(T('withdrawCoins'))}<input name="coins" type="number" inputmode="decimal" min="${min}" max="${data.earned}" step="0.1" value="${data.earned}" required><small class="mwg-muted">${esc(T('minWithdraw', { n: fmt(min), tzs: money(min * rate) }))}</small></label>`
      + `<p class="mwg-total">${esc(T('youReceive'))}: <strong id="mwgPayout"></strong></p><p class="mwg-muted" id="mwgPayoutTzs"${local() ? '' : ' hidden'}></p>`
      + `${networkField(Object.keys(NETWORKS))}`
      + `<label>${esc(T('receiveNumber'))}<input name="phone" type="tel" inputmode="tel" autocomplete="tel" required placeholder="07XX XXX XXX" maxlength="20" value="${esc(savedPhone)}"></label>`
      + `<label>${esc(T('accountName'))}<input name="name" required maxlength="80" autocomplete="name"></label>`
      + `<button type="submit" class="mwg-primary">${esc(T('submitWithdraw'))}</button></form>`, previous || openWallet);
    const form = byId('mwgWithdrawForm');
    bindNetwork(form);
    const paint = () => { const value = Math.max(0, Math.min(Number(form.coins.value) || 0, data.earned));byId('mwgPayout').textContent = money(value * rate);byId('mwgPayoutTzs').textContent = T('payoutAs', { tzs: tzs(Math.round(value * rate)) }); };
    form.coins.oninput = paint;paint();
    panel.querySelector('[data-mwg-withdraw]')?.remove();
    form.onsubmit = async event => {
      event.preventDefault();
      const button = form.querySelector('button[type="submit"]');
      const coins = Number(form.coins.value);
      if (!(coins >= min) || coins > data.earned) { say(T('minWithdraw', { n: fmt(min), tzs: money(min * rate) }), true);return; }
      button.disabled = true;
      try {
        await api('withdraw', { coins, network: form.network.value, phone: form.phone.value, name: form.name.value });
        await loadWallet().catch(() => {});
        openWallet();say(T('withdrawSent'));
      } catch (error) { say(error.message, true);button.disabled = false; }
    };
  }

  // ---------- Gift buttons ----------
  // Feed posts, profile posts and gallery tiles carry data-mw-gift with the post and its author.
  const giftButtonHtml = (postId, authorId) => `<button type="button" class="act mwg-gift-act" data-mw-gift data-post="${esc(postId)}" data-to="${esc(authorId)}" aria-label="${esc(T('sendGift'))}" title="${esc(T('sendGift'))}"><span class="mwg-gift-label">${esc(T('gift'))}</span></button>`;
  // Photos and videos inside posts get their own gift icon right on the media, top corner.
  function paintMediaGift(post) {
    const gift = post.querySelector(':scope>.actions>[data-mw-gift]');
    const media = post.querySelector(':scope>.post-media,:scope>.mw-media-frame>.post-media');
    if (!gift || !media) return;
    let frame = media.parentElement.classList.contains('mw-media-frame') ? media.parentElement : null;
    if (!frame) { frame = document.createElement('div');frame.className = 'mw-media-frame';frame.dataset.kind = media.tagName === 'VIDEO' ? 'video' : 'image';media.before(frame);frame.append(media); }
    let overlay = frame.querySelector(':scope>.mwg-media-gift');
    if (!overlay) { overlay = document.createElement('button');overlay.type = 'button';overlay.className = 'mwg-media-gift mwx-no-translate';overlay.dataset.mwGift = '';overlay.innerHTML = giftGlyph;frame.append(overlay); }
    overlay.dataset.post = gift.dataset.post;overlay.dataset.to = gift.dataset.to;
  }
  function paintButtons(root = document) {
    root.querySelectorAll('#feed .post,#profilePosts .post,#publicProfile .post').forEach(paintMediaGift);
    // Feed posts: the gift button sits right after the reactions, where it is easy to spot and tap.
    root.querySelectorAll('#feed .post>.actions>[data-mw-gift]').forEach(button => {
      const actions = button.parentElement, signals = actions.querySelector(':scope>.signals');
      if ((signals ? signals.nextElementSibling : actions.firstElementChild) !== button) { if (signals) signals.after(button);else actions.prepend(button); }
    });
    root.querySelectorAll('[data-mw-gift]').forEach(button => {
      // Keep the affordance visible on every item; the picker explains self-gifting.
      button.hidden = false;
      const label = button.querySelector('.mwg-gift-label');if (label && label.textContent !== T('gift')) label.textContent = T('gift');
      if (button.title !== T('sendGift')) { button.title = T('sendGift');button.setAttribute('aria-label', T('sendGift')); }
    });
  }
  document.addEventListener('click', event => {
    const button = event.target.closest('[data-mw-gift]');
    if (!button) return;
    event.preventDefault();event.stopPropagation();
    if (button.dataset.live !== undefined) {
      const session = window.MilkyWayLive?.current?.();
      if (!session?.room_name) { toastAll(T('liveEnded'));return; }
      if (session.host_id === user?.id) { toastAll(T('ownPost'));return; }
      openPicker({ room: session.room_name, to: session.host_id });
      return;
    }
    openPicker({ postId: button.dataset.post, to: button.dataset.to });
  }, true);

  // LIVE: a gift button next to the heart, shown to viewers only.
  function mountLiveButton() {
    const actions = document.querySelector('#mwLivePage .mw-live-actions');
    if (!actions || actions.querySelector('[data-mw-gift]')) return;
    const button = document.createElement('button');button.type = 'button';button.className = 'mwg-live-gift';button.dataset.mwGift = '';button.dataset.live = '';
    button.innerHTML = giftGlyph;button.setAttribute('aria-label', T('sendGift'));button.title = T('sendGift');
    const heart = actions.querySelector('[data-action="reaction"]');
    if (heart) heart.before(button);else actions.append(button);
  }

  // Photo and video viewers: a gift button for the post or gallery item being viewed.
  let viewing = null;
  const rememberMedia = event => {
    const target = event.target instanceof Element ? event.target : null;
    const source = target?.closest('.post,.mw-gallery-tile');
    if (!source) return;
    // A photo in a comment belongs to the commenter, not the post author.
    const gift = target.closest('.mw-comment-media') ? null : source.querySelector('[data-mw-gift]');
    viewing = gift ? { postId: gift.dataset.post, to: gift.dataset.to } : null;
  };
  document.addEventListener('pointerdown', rememberMedia, true);
  document.addEventListener('click', rememberMedia, true);
  const viewerGift = document.createElement('button');viewerGift.type = 'button';viewerGift.className = 'mwg-viewer-gift mwx-no-translate';viewerGift.hidden = true;
  document.body.append(viewerGift);
  const viewers = [...document.querySelectorAll('.mw-zoom,.mw-gallery-viewer')];
  function syncViewerGift() {
    const open = viewers.some(viewer => !viewer.hidden);
    viewerGift.hidden = !(open && viewing?.postId);
    if (viewerGift.hidden) return;
    viewerGift.innerHTML = `${giftGlyph}<span>${esc(T('gift'))}</span>`;viewerGift.title = T('sendGift');viewerGift.setAttribute('aria-label', T('sendGift'));
  }
  viewers.forEach(viewer => new MutationObserver(syncViewerGift).observe(viewer, { attributes: true, attributeFilter: ['hidden'] }));
  viewerGift.onclick = () => {
    if (!viewing) return;
    // Sign-in opens under the full-screen viewers, so close them first for visitors.
    if (typeof logged === 'function' && !logged()) document.querySelectorAll('.mw-zoom:not([hidden]) .mw-zoom-close,.mw-gallery-viewer:not([hidden]) .mw-gallery-viewer-close').forEach(close => close.click());
    openPicker(viewing);
  };

  // Story viewer: a gift button on every story photo and video, sent to the story's creator.
  const storyView = byId('storyView'), storyMedia = byId('storyViewerMedia');
  const storyGift = document.createElement('button');storyGift.type = 'button';storyGift.className = 'mwg-story-gift mwx-no-translate';storyGift.hidden = true;
  const currentStory = () => (typeof stories !== 'undefined' && typeof storyIndex !== 'undefined' ? stories[storyIndex] : null);
  function syncStoryGift() {
    const story = currentStory();
    storyGift.hidden = !(storyView?.classList.contains('open') && story?.id && story.media_url);
    if (storyGift.hidden) return;
    storyGift.innerHTML = `${giftGlyph}<span>${esc(T('gift'))}</span>`;storyGift.title = T('sendGift');storyGift.setAttribute('aria-label', T('sendGift'));
  }
  if (storyView && storyMedia) {
    storyView.append(storyGift);
    new MutationObserver(syncStoryGift).observe(storyView, { attributes: true, attributeFilter: ['class'] });
    new MutationObserver(syncStoryGift).observe(storyMedia, { childList: true });
    storyGift.onclick = event => {
      event.stopPropagation();
      const story = currentStory();if (!story?.id) return;
      storyMedia.querySelector('video')?.pause();
      // The gift picker opens over the story, but sign-in opens below it, so close the story for visitors.
      if (typeof logged === 'function' && !logged() && typeof closeStory === 'function') closeStory();
      openPicker({ storyId: story.id, to: story.user_id });
    };
  }

  // Repaint translated labels after posts and galleries rerender.
  let scheduled = false;
  const schedule = () => { if (scheduled) return;scheduled = true;requestAnimationFrame(() => { scheduled = false;paintButtons(); }); };
  ['feed', 'publicProfile', 'profilePosts', 'mwProfileGallery', 'mwPublicGallery'].forEach(id => { const element = byId(id);if (element) new MutationObserver(schedule).observe(element, { childList: true, subtree: true }); });
  window.addEventListener('mw-language-change', () => { if (repaintPicker && !layer.hidden && byId('mwgPickerCoins')) repaintPicker();paintButtons();paintCards();syncViewerGift();syncStoryGift();const live = document.querySelector('.mwg-live-gift');if (live) { live.title = T('sendGift');live.setAttribute('aria-label', T('sendGift')); } });
  // Signing in (including right after sign-up) saves the account's country if it has none yet and switches prices
  // to its currency. The last known currency is reused straight away so screens never flash the wrong one.
  async function syncCountry() {
    if (!signedIn()) return;
    const id = user.id, key = `mw_pricing_${id}`;
    try { const cached = JSON.parse(localStorage.getItem(key) || 'null');if (cached?.currency && !accountPricing) setPricing(cached, true); } catch {}
    try { const result = await api('country', {});if (user?.id === id && result.pricing) { setPricing(result.pricing, true);localStorage.setItem(key, JSON.stringify(result.pricing)); } } catch {}
  }
  sb.auth.onAuthStateChange(event => {
    if (event === 'SIGNED_OUT') { wallet = null;accountPricing = null;document.querySelectorAll('.mwg-earn-card').forEach(card => card.remove());window.dispatchEvent(new CustomEvent('mw-currency-change', { detail: pricing() })); }
    if (['INITIAL_SESSION', 'SIGNED_IN'].includes(event)) setTimeout(syncCountry, 0);
    setTimeout(paintButtons, 0);
  });
  // Guests (and the sign-up form) get the currency of where they are browsing from.
  (window.requestIdleCallback || (run => setTimeout(run, 1500)))(() => loadCatalog());
  // The own-profile sheet is a creator dashboard too: show earnings at its top whenever it opens.
  const profileSheet = byId('profileSheet');
  if (profileSheet) new MutationObserver(() => { if (profileSheet.classList.contains('open')) mountCard(profileSheet.querySelector('.sheet') || profileSheet); }).observe(profileSheet, { attributes: true, attributeFilter: ['class'] });
  mountLiveButton();paintButtons();

  window.MilkyWayGifts = {
    open: openPicker, openWallet, openTopup, openWithdraw, celebrate, mountCard, buttonHtml: giftButtonHtml, catalog: GIFTS, art, refresh: loadWallet,
    // Country detected for this visitor, recorded with a new account at sign-up; and coin prices in local currency.
    country: () => (guestPricing?.detected && guestPricing.country) || deviceRegion() || '', region: deviceRegion, pricing, money,
    chatText: key => { const gift = giftOf(key);return gift ? `${T('sentGift', { gift: gift.name })} 🎁` : ''; },
  };
})();
