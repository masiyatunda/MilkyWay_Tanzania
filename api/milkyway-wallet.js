// MilkyWay Coins wallet API. Every action calls a SECURITY DEFINER function from
// supabase/migrations/20261105_milkyway_api_wallet.sql as the signed-in user; the database enforces all money rules.
import { ApiError, route, requireUuid } from './_lib/supa.js';

const NETWORKS = ['mpesa', 'mixx', 'airtel', 'halopesa'];
const TOPUP_PACKAGES = [100, 500, 1000, 5000, 10000];

// [currency, approximate TZS per 1 unit, minor-unit digits]. Display only: mobile money is always paid in TZS.
const CURRENCIES = {
  TZ: ['TZS', 1, 0], KE: ['KES', 19.7, 2], UG: ['UGX', 0.7, 0], RW: ['RWF', 1.75, 0], BI: ['BIF', 0.87, 0], CD: ['CDF', 0.89, 2],
  ZM: ['ZMW', 96, 2], MW: ['MWK', 1.47, 2], MZ: ['MZN', 40, 2], ZA: ['ZAR', 143, 2], NG: ['NGN', 1.65, 2], GH: ['GHS', 165, 2],
  ET: ['ETB', 18.5, 2], SO: ['SOS', 4.45, 2], SS: ['SSP', 0.55, 2], SD: ['SDG', 4.2, 2], EG: ['EGP', 51, 2], MA: ['MAD', 270, 2],
  ZW: ['USD', 2550, 2], BW: ['BWP', 190, 2], NA: ['NAD', 143, 2], AO: ['AOA', 2.8, 2], KM: ['KMF', 6, 0], MG: ['MGA', 0.56, 2], MU: ['MUR', 56, 2],
  GB: ['GBP', 3400, 2], US: ['USD', 2550, 2], CA: ['CAD', 1850, 2], AU: ['AUD', 1670, 2], NZ: ['NZD', 1500, 2], CH: ['CHF', 3150, 2],
  SE: ['SEK', 270, 2], NO: ['NOK', 255, 2], TR: ['TRY', 60, 2], BR: ['BRL', 460, 2], MX: ['MXN', 130, 2],
  AE: ['AED', 694, 2], SA: ['SAR', 680, 2], OM: ['OMR', 6600, 3], QA: ['QAR', 700, 2], IN: ['INR', 30, 2], PK: ['PKR', 9, 2],
  CN: ['CNY', 355, 2], HK: ['HKD', 327, 2], JP: ['JPY', 17, 0], KR: ['KRW', 1.85, 0], SG: ['SGD', 1960, 2],
};
['DE', 'FR', 'ES', 'IT', 'NL', 'BE', 'IE', 'PT', 'AT', 'FI', 'GR'].forEach(code => { CURRENCIES[code] = ['EUR', 2950, 2]; });

const pricingFor = (country, detected) => {
  const code = CURRENCIES[country] ? country : 'TZ';
  const [currency, tzsPerUnit, digits] = CURRENCIES[code];
  return { country: code, currency, tzsPerUnit, digits, detected: Boolean(detected && CURRENCIES[country]) };
};

const header = (request, name) => String(request.headers?.[name] || '').trim().toUpperCase();
const detectCountry = request => {
  const value = header(request, 'cf-ipcountry') || header(request, 'x-mw-region');
  return /^[A-Z]{2}$/.test(value) ? value : '';
};

const text = (value, max) => String(value ?? '').trim().slice(0, max);
const number = (value, label) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) throw new ApiError(400, `Invalid ${label}.`);
  return parsed;
};

// Saves the member's country the first time it is seen and returns the pricing for the saved country.
async function accountPricing(ctx, request) {
  const detected = detectCountry(request);
  let saved = null;
  try { saved = await ctx.rpc('mw_wallet_set_country', { p_country: detected || null }); } catch { /* pricing is cosmetic */ }
  return pricingFor(saved || detected, Boolean(saved || detected));
}

async function rpc(ctx, name, args) {
  try { return await ctx.rpc(name, args); }
  catch (error) {
    // The wallet UI treats 402 as "top up first".
    if (error instanceof ApiError && /not enough coins/i.test(error.message)) throw new ApiError(402, 'Not enough coins.');
    throw error;
  }
}

const adminList = (name, key) => async ({ ctx, query }) => {
  const status = text(query.status, 20);
  const result = await rpc(ctx, name, { p_status: status || null });
  return { [key]: Array.isArray(result?.[key]) ? result[key] : [] };
};

const adminWithdrawal = async ({ ctx, body }) => {
  const decision = text(body.decision, 10).toLowerCase();
  if (!['paid', 'reject'].includes(decision)) throw new ApiError(400, 'Unknown decision.');
  return rpc(ctx, 'mw_wallet_admin_withdrawal', {
    p_id: requireUuid(body.id), p_decision: decision,
    p_payout_ref: decision === 'paid' ? text(body.payoutRef, 120) || null : null, p_note: text(body.note, 300) || null,
  });
};

const adminTopup = async ({ ctx, body }) => {
  const decision = text(body.decision, 10).toLowerCase();
  if (!['approve', 'reject'].includes(decision)) throw new ApiError(400, 'Unknown decision.');
  return rpc(ctx, 'mw_wallet_admin_topup', { p_id: requireUuid(body.id), p_decision: decision, p_note: text(body.note, 300) || null });
};

export default route({
  // Public: payment instructions, rates and packages shown before sign-in.
  catalog: {
    auth: false,
    run: async ({ ctx, request }) => {
      const info = await rpc(ctx, 'mw_wallet_catalog', {});
      const detected = detectCountry(request);
      return { ...info, topupPackages: TOPUP_PACKAGES, networks: NETWORKS, pricing: pricingFor(detected, Boolean(detected)) };
    },
  },

  wallet: async ({ ctx, request }) => {
    const overview = await rpc(ctx, 'mw_wallet_overview', {});
    const detected = detectCountry(request);
    const country = overview?.country || detected;
    const { country: _saved, ...rest } = overview || {};
    return { ...rest, topupPackages: TOPUP_PACKAGES, networks: NETWORKS, pricing: pricingFor(country, Boolean(country)) };
  },

  country: async ({ ctx, request }) => ({ pricing: await accountPricing(ctx, request) }),

  gift: async ({ ctx, body }) => {
    const gift = text(body.gift, 80);
    if (!/^[a-z0-9-]+$/.test(gift)) throw new ApiError(400, 'Unknown gift.');
    const room = text(body.room, 200), postId = body.postId, storyId = body.storyId;
    const targets = [room, postId, storyId].filter(Boolean).length;
    if (targets !== 1) throw new ApiError(400, 'Choose one place to send the gift.');
    const result = await rpc(ctx, 'mw_wallet_send_gift', {
      p_gift: gift, p_room: room || null,
      p_post: postId ? requireUuid(postId, 'post id') : null,
      p_story: storyId ? requireUuid(storyId, 'story id') : null,
    });
    return { ok: true, coins: Number(result?.coins ?? 0), earned: Number(result?.earned ?? 0) };
  },

  'redeem-topup-code': async ({ ctx, body }) => {
    const code = text(body.code, 40);
    if (!code) throw new ApiError(400, 'Enter your code.');
    const result = await rpc(ctx, 'mw_wallet_redeem_code', { p_code: code });
    return { ok: true, coins: Number(result?.coins ?? 0), added: Number(result?.added ?? 0), message: result?.message };
  },

  topup: async ({ ctx, request, body }) => {
    const amount = number(body.amountTzs, 'amount');
    if (!Number.isSafeInteger(amount) || amount < 100 || amount > 1000000 || amount % 100 !== 0) {
      throw new ApiError(400, 'Enter a TZS amount from 100 to 1,000,000 in steps of 100.');
    }
    const network = text(body.network, 20).toLowerCase();
    if (!NETWORKS.includes(network)) throw new ApiError(400, 'Choose a mobile money network.');
    const pricing = await accountPricing(ctx, request);
    return rpc(ctx, 'mw_wallet_request_topup', {
      p_amount_tzs: amount, p_network: network, p_phone: text(body.phone, 30), p_reference: text(body.reference, 40),
      p_currency: pricing.currency, p_tzs_per_unit: pricing.tzsPerUnit, p_digits: pricing.digits,
    });
  },

  withdraw: async ({ ctx, request, body }) => {
    const coins = Math.round(number(body.coins, 'coins') * 100) / 100;
    if (!(coins > 0)) throw new ApiError(400, 'Enter a valid number of coins.');
    const network = text(body.network, 20).toLowerCase();
    if (!NETWORKS.includes(network)) throw new ApiError(400, 'Choose a mobile money network.');
    const pricing = await accountPricing(ctx, request);
    return rpc(ctx, 'mw_wallet_request_withdrawal', {
      p_coins: coins, p_network: network, p_phone: text(body.phone, 30), p_name: text(body.name, 80),
      p_currency: pricing.currency, p_tzs_per_unit: pricing.tzsPerUnit, p_digits: pricing.digits,
    });
  },

  'admin-summary': async ({ ctx }) => rpc(ctx, 'mw_wallet_admin_summary', {}),
  'admin-withdrawals': adminList('mw_wallet_admin_withdrawals', 'withdrawals'),
  'admin-topups': adminList('mw_wallet_admin_topups', 'topups'),

  'admin-settings': async ({ ctx, body }) => {
    const lipa = body.lipa && typeof body.lipa === 'object' ? body.lipa : {};
    const optional = (value, label, min, max) => {
      if (value === undefined || value === null || value === '') return null;
      const parsed = number(value, label);
      if (parsed < min || parsed > max) throw new ApiError(400, `Invalid ${label}.`);
      return parsed;
    };
    const str = (value, max) => (value === undefined || value === null ? null : text(value, max));
    return rpc(ctx, 'mw_wallet_admin_settings', {
      p_instructions: str(body.paymentInstructions, 1000),
      p_lipa_number: str(lipa.number, 40), p_lipa_name: str(lipa.name, 120),
      p_lipa_network: str(lipa.network, 40), p_lipa_qr: str(lipa.qr, 2000),
      p_coin_tzs: optional(body.coinTzs, 'coin price', 1, 1000000),
      p_min_withdraw: optional(body.minWithdrawCoins, 'minimum withdrawal', 0.1, 1000000),
      p_cut_pct: optional(body.platformCutPct, 'platform cut', 0, 90),
    });
  },

  'admin-withdrawal': adminWithdrawal,
  'admin-topup': adminTopup,
});
