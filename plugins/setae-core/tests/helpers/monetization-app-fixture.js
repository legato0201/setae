/* Production app/controllers/DOM. Only the API is synthetic. This does not
 * authenticate a real user, persist WordPress data or start a real trial/charge. */
if (!['127.0.0.1', 'localhost', '[::1]'].includes(location.hostname)) throw new Error('Loopback fixture only.');
const origin = location.origin;
const nativeFetch = window.fetch.bind(window);
const params = new URLSearchParams(location.search);
const scenario = params.get('scenario') || 'empty';
const theme = params.get('theme') === 'dark' ? 'dark' : 'light';
const appUrl = new URL('../../assets/app/app.js', import.meta.url);
const apiPrefix = '/__setae_monetization_fixture_api__';
const userId = 9900251;
const now = Date.now();
const calls = [], unexpected = [];
const clone = value => structuredClone(value);
const memoryStorage = () => {
  const values = new Map();
  return { get length() { return values.size; }, key: index => [...values.keys()][index] ?? null,
    getItem: key => values.get(String(key)) ?? null, setItem: (key, value) => values.set(String(key), String(value)),
    removeItem: key => values.delete(String(key)), clear: () => values.clear() };
};
Object.defineProperty(window, 'localStorage', { configurable: true, value: memoryStorage() });
Object.defineProperty(window, 'sessionStorage', { configurable: true, value: memoryStorage() });
window.SETAE_CONFIG = { apiRoot: apiPrefix, followBootstrapApiRoot: false, credentials: 'omit', siteOrigin: origin,
  appUrl: location.href, embedded: true, enableMock: false, serviceWorkerUrl: '' };
document.documentElement.dataset.theme = theme;
const stylePaths = [
  'tokens.css', 'reset.css', 'foundation.css', 'components.css',
  'components/workbench.css', 'components/combobox.css', 'components/action-menu.css', 'components/property-list.css',
  'components/activity-list.css', 'components/identity-panel.css', 'components/data-visualization.css', 'components/media-grid.css',
  'components/media.css', 'components/specimen-card.css', 'components/update-notice.css', 'components/form-safety.css',
  'components/feedback.css', 'components/progressive-list.css', 'components/mobile-gestures.css',
  'app-frame.css', 'patterns/workspace.css', 'patterns/registry.css', 'patterns/ledger.css', 'patterns/care-plan.css',
  'patterns/specimen-workspace.css', 'patterns/discussion.css', 'patterns/task-workspace.css', 'patterns/onboarding.css',
  'screens/auth.css', 'screens/collection.css', 'screens/collection-editor.css', 'screens/specimen.css', 'screens/specimen-intake.css',
  'screens/quick-record.css', 'screens/today.css', 'screens/records.css', 'screens/nursery.css', 'screens/husbandry.css',
  'screens/qr.css', 'screens/community.css', 'screens/settings.css', 'screens/diagnostics.css'
];
const stylesReady = Promise.all(stylePaths.map(relative => new Promise((resolve, reject) => {
  const link = document.createElement('link'); link.rel = 'stylesheet';
  link.href = new URL('../../assets/app/styles/' + relative, import.meta.url).href;
  link.onload = resolve; link.onerror = () => reject(new Error('Stylesheet missing: ' + relative)); document.head.append(link);
})));
const species = [{ id: 501, ja_name: 'セラドニア', scientific_name: 'Typhochlaena seladonia', genus: 'Typhochlaena' }];
const animals = Array.from({ length: scenario === 'limit' ? 8 : scenario === 'arrival' ? 1 : 0 }, (_, index) => ({
  id: index + 1, title: `LOCAL-${String(index + 1).padStart(3, '0')}`, species_id: 501,
  species_name: 'Typhochlaena seladonia', classification: 'tarantula', gender: 'unknown', instar: 5,
  status: 'normal', origin: 'CB', acquired_date: '2026-08-20', notes: '', acquisition_source: 'manual'
}));
if (scenario === 'arrival') Object.assign(animals[0], { acquisition_source: 'transfer_received',
  received_at: new Date(now - 86400000).toISOString(), title: 'LOCAL-受領個体' });
const records = scenario === 'arrival' ? [{ target_type: 'animal', spider_id: 1, event: {
  id: 301, type: 'observation', date: '2026-08-20', created_at: new Date(now - 2 * 86400000).toISOString(),
  recorded_by_current_user: false, note: '引継ぎ前の合成履歴です。', data: {}
} }] : [];
let planId = params.get('plan') || 'keeper_free';
let trialUsed = planId !== 'keeper_free';
let firstRecordAt = null;
let preferences = { collection_view: 'table', personalization: { presetId: 'simple', customized: false, setupCompleted: false } };
const profile = () => ({
  id: userId, display_name: 'Local UI QA', theme_preference: theme,
  onboarding: { registered_at: new Date(now - 3600000).toISOString(), first_record_at: firstRecordAt },
  plan: { id: planId, status: planId === 'breeder_trial' ? 'trialing' : 'active', trial_available: !trialUsed,
    trial_ends_at: planId === 'breeder_trial' ? new Date(now + 30 * 86400000).toISOString() : null,
    billing_available: false, price_label: '月額1,480円' },
  inventory: { active_slot_bearing: animals.filter(animal => animal.acquisition_source !== 'transfer_received').length,
    received_exempt: animals.filter(animal => animal.acquisition_source === 'transfer_received').length,
    limit: planId === 'legacy_premium' ? -1 : planId === 'breeder_starter' ? 100 : planId === 'breeder_trial' ? 20 : 8,
    remaining: planId === 'legacy_premium' ? -1 : Math.max(0, (planId === 'breeder_starter' ? 100 : planId === 'breeder_trial' ? 20 : 8) - animals.length) },
  nursery: { active_groups: 0, limit: planId === 'legacy_premium' ? -1 : planId === 'breeder_starter' ? 10 : 1 },
  entitlements: { label_batch_limit: planId === 'legacy_premium' ? -1 : planId === 'breeder_starter' ? 100 : 20 },
  trial: { promoted_count: 0 },
});
const response = (value, status = 200) => new Response(JSON.stringify(value), { status,
  headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
const payloadOf = body => body instanceof FormData ? Object.fromEntries([...body].map(([key, value]) => [key,
  value instanceof File ? { name: value.name, type: value.type, size: value.size } : value])) : typeof body === 'string' ? JSON.parse(body) : {};
window.fetch = async (input, init = {}) => {
  const url = new URL(typeof input === 'string' || input instanceof URL ? input : input.url, location.href);
  const method = String(init.method || 'GET').toUpperCase();
  if (url.origin !== origin || !url.pathname.startsWith(apiPrefix + '/')) {
    unexpected.push({ method, url: url.href }); throw new Error('Unexpected fixture request blocked.');
  }
  const path = url.pathname.slice(apiPrefix.length), payload = payloadOf(init.body);
  calls.push({ method, path, payload: clone(payload) });
  if (path === '/metrics/events' && method === 'POST') return response({ event: payload.event, accepted: true, duplicate: false, count: null }, 202);
  if (path === '/app/bootstrap') return response({ authenticated: true, registration_enabled: false, user: profile(), links: {}, plugin_version: 'synthetic-local-fixture' });
  if (path === '/me' && method === 'GET') return response(profile());
  if (path === '/ui/preferences') { if (method === 'POST') preferences = { ...preferences, ...payload }; return response(preferences); }
  if (path === '/my-spiders') return response({ items: clone(animals), total_pages: 1, total: animals.length });
  if (path === '/care-summary') return response({ total_spiders: animals.length, observed_today: 0, pending_today: animals.length, streak: 0, best_streak: 0 });
  if (['/journal-events', '/care-events'].includes(path)) return response({ items: clone(records) });
  if (path === '/task-actions') return response({ items: [] });
  if (path === '/baby-groups') return response({ items: [], archived_items: [], summary: { currently_managed: 0, active_groups: 0 } });
  if (path === '/feeders') return response({ types: [], inventory: [], egg_batches: [], events: [], summary: {} });
  if (path === '/enclosures') return response({ items: [], summary: {} });
  if (path === '/species/suggest') return response(species);
  if (path === '/social/relationships') return response({ following: [], blocked: [] });
  if (path === '/qr/transfers') return response({ incoming: [], outgoing: [], pending_count: 0, notifications: [], unread_count: 0 });
  if (path === '/pwa/config') return response({ enabled: false });
  if (path === '/pwa/preferences') return response({ enabled: false, community_messages: true });
  if (path === '/care-feed') return response({ items: [], total_pages: 1 });
  if (path === '/topics') return response({ items: [], total_pages: 1 });
  const detail = path.match(/^\/spider\/(\d+)(\/events)?$/);
  if (detail && method === 'GET') return response(detail[2] ? { events: records.filter(record => Number(record.spider_id) === Number(detail[1])).map(record => record.event) }
    : clone(animals.find(animal => animal.id === Number(detail[1]))));
  if (path === '/spiders' && method === 'POST') {
    if (planId === 'keeper_free' && profile().inventory.active_slot_bearing >= 8) return response({ code: 'setae_manual_specimen_limit',
      message: '有効な個体の登録枠に達しています。', data: { status: 403, plan_id: planId, usage: 8, limit: 8, remaining: 0, trial_available: !trialUsed, upgrade_plan: 'breeder_starter' } }, 403);
    const animal = { id: 901 + animals.length, title: payload.name, species_name: species[0].scientific_name,
      acquisition_source: 'manual', ...payload }; animals.push(animal);
    return response({ success: true, id: animal.id, qr_code: '', qr_url: '' }, 201);
  }
  if (detail?.[2] && method === 'POST') {
    const event = { id: 401 + records.length, type: payload.type || 'observation', date: payload.date,
      created_at: new Date().toISOString(), recorded_by_current_user: true, data: payload, note: payload.note || '' };
    records.push({ target_type: 'animal', spider_id: Number(detail[1]), event }); firstRecordAt ||= event.created_at;
    return response({ success: true, id: event.id }, 201);
  }
  if (path === '/plans/trial' && method === 'POST') {
    if (trialUsed) return response({ code: 'setae_trial_used', message: '試用済みです。', data: { status: 403 } }, 403);
    trialUsed = true; planId = 'breeder_trial'; return response({ plan_id: planId, trial: { ends_at: profile().plan.trial_ends_at } });
  }
  if (path === '/stripe/create-checkout-session' || path === '/stripe/create-portal-session') {
    return response({ code: 'setae_billing_unavailable', message: 'ローカル試験では決済を開始しません。', data: { status: 503 } }, 503);
  }
  unexpected.push({ method, path }); return response({ code: 'fixture_unhandled', message: 'Unhandled fixture endpoint: ' + path }, 501);
};
window.__setaeMonetizationFixture = { kind: 'production-app-synthetic-api', scenario,
  calls: () => clone(calls), unexpected: () => clone(unexpected), profile: () => clone(profile()), animals: () => clone(animals),
  records: () => clone(records), remoteRequests: 0 };

try {
  const response = await nativeFetch(appUrl, { credentials: 'omit', cache: 'no-store' });
  if (!response.ok) throw new Error('Production app unavailable');
  const original = await response.text();
  const hash = [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(original)))].map(value => value.toString(16).padStart(2, '0')).join('');
  let source = original.replace(/(\bfrom\s*['"])(\.[^'"]+)(['"])/g, (_, before, specifier, after) => before + new URL(specifier, appUrl).href + after);
  if (!/\nboot\(\);\s*$/.test(source)) throw new Error('App boot boundary changed');
  source = source.replace(/\nboot\(\);\s*$/, '\nwindow.__setaeMonetizationBoot = boot();\n');
  source += `\nwindow.__setaeMonetizationApp = {
    snapshot: () => structuredClone({ page: state.page, settingsTab: state.settingsTab, recordsView: state.recordsView, modal: state.modal,
      setupOpen: state.setupOpen, onboarding: state.onboarding, profile: state.settings.profile, records: state.records,
      animals: state.animals, connectionError: state.connectionError }),
    navigate: (page, options) => navigateRoute(page, options)
  };\n`;
  const blob = URL.createObjectURL(new Blob([source], { type: 'text/javascript' }));
  await import(blob); URL.revokeObjectURL(blob); await window.__setaeMonetizationBoot; await stylesReady;
  if (window.__setaeMonetizationApp.snapshot().connectionError) throw new Error('Fixture bootstrap failed');
  window.__setaeMonetizationFixture.sourceSha256 = hash;
  document.body.dataset.fixtureReady = 'true';
} catch (error) {
  document.body.dataset.fixtureError = error?.message || 'Fixture failed';
  const output = document.createElement('pre'); output.textContent = document.body.dataset.fixtureError; document.body.append(output);
  throw error;
}
