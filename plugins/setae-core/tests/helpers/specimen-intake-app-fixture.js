/* Full production app, real services/handlers/controllers, synthetic API only.
 * No WordPress, authentication, SMTP, or remote persistence is represented here.
 * The application source is only instrumented to expose a state observation and
 * its existing setup actions. No event handler or saving logic is substituted.
 */
const origin = location.origin;
if (!['127.0.0.1', 'localhost', '[::1]'].includes(location.hostname)) {
  throw new Error('This fixture only runs on a loopback origin.');
}
const params = new URLSearchParams(location.search);
const nativeFetch = window.fetch.bind(window);
const appUrl = new URL('../../assets/app/app.js', import.meta.url);
const apiPrefix = '/__setae_intake_fixture_api__';
const fixtureUserId = 9900249;
const theme = params.get('theme') === 'dark' ? 'dark' : 'light';
const memoryStorage = () => {
  const values = new Map();
  return { get length() { return values.size; }, key: (index) => [...values.keys()][index] ?? null,
    getItem: (key) => values.get(String(key)) ?? null,
    setItem: (key, value) => values.set(String(key), String(value)),
    removeItem: (key) => values.delete(String(key)), clear: () => values.clear() };
};
// Never read, modify, or reuse the browser's real application storage/session.
Object.defineProperty(window, 'localStorage', { configurable: true, value: memoryStorage() });
Object.defineProperty(window, 'sessionStorage', { configurable: true, value: memoryStorage() });
window.SETAE_CONFIG = { apiRoot: apiPrefix, followBootstrapApiRoot: false, credentials: 'omit',
  siteOrigin: origin, appUrl: location.href, embedded: true, enableMock: false, serviceWorkerUrl: '' };
document.documentElement.dataset.theme = theme;

const stylesheetPaths = [
  'tokens.css', 'reset.css', 'foundation.css', 'components.css',
  'components/workbench.css', 'components/combobox.css', 'components/action-menu.css',
  'components/property-list.css', 'components/activity-list.css', 'components/identity-panel.css',
  'components/data-visualization.css', 'components/media-grid.css', 'components/media.css',
  'components/specimen-card.css', 'components/update-notice.css', 'components/form-safety.css',
  'components/feedback.css', 'components/progressive-list.css', 'components/mobile-gestures.css',
  'app-frame.css', 'patterns/workspace.css', 'patterns/registry.css', 'patterns/ledger.css',
  'patterns/care-plan.css', 'patterns/specimen-workspace.css', 'patterns/discussion.css',
  'patterns/task-workspace.css', 'patterns/onboarding.css', 'screens/auth.css',
  'screens/collection.css', 'screens/collection-editor.css', 'screens/specimen.css',
  'screens/specimen-intake.css', 'screens/quick-record.css', 'screens/today.css',
  'screens/records.css', 'screens/nursery.css', 'screens/husbandry.css', 'screens/qr.css',
  'screens/community.css', 'screens/settings.css', 'screens/diagnostics.css'
];
const stylesLoaded = Promise.all(stylesheetPaths.map((relative) => new Promise((resolve, reject) => {
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = new URL('../../assets/app/styles/' + relative, import.meta.url).href;
  link.onload = resolve;
  link.onerror = () => reject(new Error('Fixture stylesheet unavailable: ' + relative));
  document.head.append(link);
})));

const suggestions = [
  { id: 501, ja_name: 'セラドニア', scientific_name: 'Typhochlaena seladonia', genus: 'Typhochlaena' },
  { id: 502, ja_name: 'アンティルピンクトゥー', scientific_name: 'Caribena versicolor', genus: 'Caribena' }
];
const publicModes = ['private', 'basic', 'life_history'];
const publicDefaults = { qr_visibility: 'private', qr_public: false, transfer_enabled: false,
  transfer_receipt: false, archived: false };
const normalizeBoolean = (value) => [true, 1, '1', 'true', 'on', 'yes'].includes(value);
const animals = [
  { id: 1, title: 'LOCAL-001', species_id: 501, species_name: 'Typhochlaena seladonia', classification: 'tarantula',
    gender: 'female', instar: 8, status: 'normal', origin: 'CB', acquired_date: '2025-12-25', notes: 'ローカル試験用データです。', ...publicDefaults },
  { id: 2, title: 'LOCAL-002', species_id: 502, species_name: 'Caribena versicolor', classification: 'tarantula',
    gender: 'unknown', instar: 5, status: 'normal', origin: 'CB', acquired_date: '2026-01-10', notes: '', ...publicDefaults }
];
// Opt-in synthetic catalogue for progressive collection tests. The default two
// intake records, IDs and save envelopes stay unchanged.
const requestedCount = params.has('count') ? Number(params.get('count')) : animals.length;
if (!Number.isInteger(requestedCount) || requestedCount < 2 || requestedCount > 500) {
  throw new Error('Local fixture count must be an integer between 2 and 500.');
}
for (let id = 3; id <= requestedCount; id += 1) {
  const species = suggestions[(id + 1) % 2];
  animals.push({ id, title: 'LOCAL-' + String(id).padStart(3, '0'), species_id: species.id,
    species_name: species.scientific_name, classification: 'tarantula',
    gender: id % 2 ? 'female' : 'unknown', instar: 5,
    status: id % 5 === 0 ? 'pre_molt' : 'normal', origin: 'CB',
    acquired_date: '2026-01-10', notes: '段階表示のローカル合成データです。', ...publicDefaults });
}
const requestedRecordCount = params.has('records') ? Number(params.get('records')) : 0;
if (!Number.isInteger(requestedRecordCount) || requestedRecordCount < 0 || requestedRecordCount > 100) {
  throw new Error('Local fixture records must be an integer between 0 and 100.');
}
const journalRecords = Array.from({ length: requestedRecordCount }, (_, index) => ({
  id: 7000 + index, spider_id: animals[index % animals.length].id, type: index % 2 ? 'observation' : 'feed',
  date: new Date(Date.UTC(2026, 7, 29 - index, 9, 0, 0)).toISOString(),
  data: index % 2 ? { note: `ローカル観察 ${index + 1}` } : { prey_type: 'レッドローチ', quantity: 1 }
}));
if (params.get('variant') === 'zero-photo') Object.assign(animals[0], {
  gender: 'unknown', instar: 0, status: 'normal', origin: '', acquired_date: '', notes: '',
  temperature: 0, humidity: 0,
  // A bundled app icon is a synthetic existing-photo fixture, not a specimen photo.
  image_url: new URL('../../assets/app/icons/setae-icon-512.png', import.meta.url).href
});
// Only record 1 changes with these opt-in settings. The remaining catalogue
// retains explicit private/off values; unknown models a missing API projection.
if (params.has('public')) {
  const visibility = params.get('public') === 'history' ? 'life_history' : params.get('public');
  if (!publicModes.includes(visibility)) throw new Error('Invalid local fixture public mode');
  Object.assign(animals[0], { qr_visibility: visibility, qr_public: visibility !== 'private' });
}
if (params.has('transfer')) animals[0].transfer_enabled = normalizeBoolean(params.get('transfer'));
if (params.has('archived')) animals[0].archived = normalizeBoolean(params.get('archived'));
if (params.has('receipt')) {
  animals[0].transfer_receipt = normalizeBoolean(params.get('receipt'));
  if (animals[0].transfer_receipt) animals[0].archived = true;
}
if (animals[0].archived) animals[0].transfer_enabled = false;
if (params.get('unknown') === '1') {
  for (const key of ['qr_visibility', 'qr_public', 'transfer_enabled']) delete animals[0][key];
}
const calls = [];
const unexpected = [];
const waitingReads = new Map();
const heldReadIds = new Set();
const waitingSaves = [];
let nextId = 901;
const saveModes = ['pending', 'success', 'api-error', 'field-error', 'network-error'];
let saveMode = saveModes.includes(params.get('save')) ? params.get('save') : 'api-error';
let fieldErrors = { instar: '齢期を確認してください。ローカル試験の項目エラーです。' };
let preferences = { collection_view: params.get('view') === 'gallery' ? 'gallery' : 'table',
  animal_saved_views: [{ id: 'qa-preserved', title: 'Local saved view', query: { filters: [], sort: { field: 'code', direction: 'asc' } } }],
  personalization: { presetId: 'simple', customized: true, setupCompleted: true } };
if (requestedCount > 2) preferences.animal_saved_views.push({ id: 'qa-female', title: 'Local female view',
  query: { filters: [{ field: 'gender', operator: '=', value: 'female' }], sort: { field: 'code', direction: 'asc' } } });
const jsonResponse = (value, status = 200) => new Response(JSON.stringify(value), {
  status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }
});
const clone = (value) => structuredClone(value);
const seedDraft = (draft, entity = 'new') => {
  const key = `setae.gui.v2.formDraft.${fixtureUserId}.animal.${entity}`;
  const value = { version: 1, updatedAt: new Date().toISOString(), values: {}, checks: {}, selections: {}, ...clone(draft) };
  localStorage.setItem(key, JSON.stringify(value));
  return key;
};
const draftCases = {
  catalog: { values: { name: 'LOCAL-CATALOG-DRAFT', classification: 'tarantula', species_id: '501', gender: 'female',
    instar: '0', status: 'normal', enclosure_id: '4', acquired_date: '2026-08-28', temperature: '0', humidity: '0',
    substrate: '復元した床材', origin: 'CB', notes: '図鑑種と一緒に復元するメモ。' }, hadFiles: true },
  manual: { values: { name: 'LOCAL-MANUAL-DRAFT', classification: 'true_spider', species_id: '',
    custom_species: '未同定クモ ローカル試験', instar: '0', temperature: '0', notes: '手入力種の復元メモ。' } },
  'species-only': { values: { classification: 'tarantula', species_id: '501' } },
  'legacy-public': { values: { name: 'LOCAL-OLD-PUBLIC-DRAFT' }, checks: {} },
  'public-off': { values: { name: 'LOCAL-PUBLIC-OFF-DRAFT' },
    checks: { qr_visibility: ['private'], transfer_enabled: [] } }
};
const initialDraft = draftCases[params.get('draft')];
if (initialDraft) seedDraft(initialDraft, params.get('edit') || 'new');
const decodeBody = (body) => body instanceof FormData ? Object.fromEntries([...body].map(([key, value]) => [key,
  value instanceof File ? { name: value.name, size: value.size, type: value.type } : value]))
  : typeof body === 'string' ? JSON.parse(body) : {};
const summary = () => ({ total_spiders: animals.length, observed_today: 0, pending_today: animals.length, streak: 0, best_streak: 0 });
function saveFailure(mode) {
  if (mode === 'network-error') throw new TypeError('Local fixture network failure');
  if (mode === 'api-error') return jsonResponse({ code: 'fixture_save_error', message: '保存できませんでした。ローカル試験の応答です。' }, 500);
  if (mode === 'field-error') return jsonResponse({ code: 'fixture_field_error', message: '入力内容を確認してください。',
    data: { field_errors: clone(fieldErrors) } }, 422);
  return null;
}
function saveResult(id, payload, mode) {
  const failure = saveFailure(mode);
  if (failure) return failure;
  const existing = id ? animals.find((item) => String(item.id) === String(id)) : null;
  if (id && !existing) return jsonResponse({ code: 'not_found', message: 'Local specimen not found' }, 404);
  const hasPublicChange = Object.hasOwn(payload, 'qr_visibility') || Object.hasOwn(payload, 'transfer_enabled');
  if (hasPublicChange && existing?.transfer_receipt) {
    return jsonResponse({ code: 'qr_transfer_receipt', message: '譲渡済みの記録の公開設定は変更できません。' }, 400);
  }
  if (Object.hasOwn(payload, 'qr_visibility') && !publicModes.includes(payload.qr_visibility)) {
    return jsonResponse({ code: 'invalid_public_mode', message: '公開範囲を確認してください。' }, 400);
  }
  const archived = Object.hasOwn(payload, 'archived') ? normalizeBoolean(payload.archived) : existing?.archived || false;
  if (existing?.transfer_receipt && !archived) {
    return jsonResponse({ code: 'transfer_receipt_locked', message: '譲渡済みの記録は飼育一覧へ戻せません。' }, 400);
  }
  if (archived && normalizeBoolean(payload.transfer_enabled)) {
    return jsonResponse({ code: 'qr_archived_transfer', message: 'アーカイブ中は引き継ぎ受付を開始できません。' }, 400);
  }
  const species = suggestions.find((item) => item.id === Number(payload.species_id));
  const record = { ...(existing || publicDefaults), ...payload, id: existing?.id || nextId++,
    title: payload.name || existing?.title || 'LOCAL-NEW',
    species_name: species?.scientific_name || payload.custom_species || existing?.species_name || '' };
  for (const key of ['archived', 'transfer_enabled', 'qr_public', 'transfer_receipt']) {
    if (Object.hasOwn(payload, key)) record[key] = normalizeBoolean(payload[key]);
  }
  if (Object.hasOwn(payload, 'qr_visibility')) record.qr_public = payload.qr_visibility !== 'private';
  if (record.archived) record.transfer_enabled = false;
  delete record.name;
  if (existing) Object.assign(existing, record);
  else animals.push(record);
  // Exact endpoint envelopes: create_spider returns 201 + id; update_spider
  // returns 200 + data (class-setae-api-spiders.php). WordPress is NOT executed.
  return id ? jsonResponse({ success: true, data: clone(record) })
    : jsonResponse({ success: true, id: record.id, qr_code: '', qr_url: '' }, 201);
}
function qrTarget(animal) {
  const alphabet = '23456789abcdefghjkmnpqrstuvwxyz';
  let value = animal.id;
  let encoded = '';
  while (value > 0) {
    encoded = alphabet[value % alphabet.length] + encoded;
    value = Math.floor(value / alphabet.length);
  }
  const code = `qa${encoded.padStart(4, '2')}`;
  return { target_id: animal.id + 10000, target_type: 'spider', object_id: animal.id, baby_code: '', code,
    url: `${origin}/${code}/`, title: animal.title, manage_code: animal.title,
    species_name: animal.species_name, short_name: animal.species_name, classification: animal.classification,
    archived: animal.archived, transfer_receipt: animal.transfer_receipt,
    visibility: animal.qr_visibility, public: animal.qr_public, transfer_enabled: animal.transfer_enabled };
}
function saveQrResult(id, payload, mode) {
  const failure = saveFailure(mode);
  if (failure) return failure;
  const animal = animals.find((item) => String(item.id) === String(id));
  if (!animal) return jsonResponse({ code: 'qr_spider_not_found', message: 'Local specimen not found' }, 404);
  if (animal.transfer_receipt) return jsonResponse({ code: 'qr_transfer_receipt', message: '譲渡済みの記録の公開設定は変更できません。' }, 400);
  const enabled = normalizeBoolean(payload.transfer_enabled);
  if (animal.archived && enabled) return jsonResponse({ code: 'qr_archived_transfer', message: 'アーカイブ中は引き継ぎ受付を開始できません。' }, 400);
  const visibility = publicModes.includes(payload.visibility) ? payload.visibility
    : normalizeBoolean(payload.public) ? 'life_history' : 'private';
  Object.assign(animal, { qr_visibility: visibility, qr_public: visibility !== 'private', transfer_enabled: enabled });
  return jsonResponse({ success: true, target: qrTarget(animal) });
}
function respondToSave(callback) {
  if (saveMode !== 'pending') return callback(saveMode);
  return new Promise((resolve, reject) => waitingSaves.push((mode) => {
    try { resolve(callback(mode)); } catch (error) { reject(error); }
  }));
}

window.fetch = async (input, init = {}) => {
  const url = new URL(typeof input === 'string' || input instanceof URL ? input : input.url, location.href);
  const method = String(init.method || 'GET').toUpperCase();
  if (url.origin !== origin || !url.pathname.startsWith(apiPrefix + '/')) {
    unexpected.push({ method, url: url.href });
    throw new Error('Fixture blocked an unexpected fetch.');
  }
  const path = url.pathname.slice(apiPrefix.length);
  const payload = decodeBody(init.body);
  const bodyKind = init.body instanceof FormData ? 'multipart' : typeof init.body === 'string' ? 'json' : 'none';
  calls.push({ method, path, query: url.search, bodyKind, payload: clone(payload) });
  if (path === '/metrics/events' && method === 'POST' && payload.event === 'app_session_started') {
    return jsonResponse({ event: payload.event, accepted: true, duplicate: false, count: null }, 202);
  }
  if (path === '/app/bootstrap') return jsonResponse({ authenticated: true, registration_enabled: false,
    user: { id: fixtureUserId, display_name: 'Local QA', theme_preference: theme }, links: {}, plugin_version: 'local-fixture' });
  if (path === '/ui/preferences') {
    if (method === 'POST') preferences = { ...preferences, ...payload };
    return jsonResponse(preferences);
  }
  if (path === '/my-spiders') return jsonResponse({ items: clone(animals), total_pages: 1, total: animals.length });
  if (path === '/care-summary') return jsonResponse(summary());
  if (path === '/journal-events') return jsonResponse({ items: clone(journalRecords) });
  if (['/care-events', '/task-actions'].includes(path)) return jsonResponse({ items: [] });
  if (path === '/baby-groups') return jsonResponse({ items: [], archived_items: [], summary: { currently_managed: 0, active_groups: 0 } });
  if (path === '/feeders') return jsonResponse({ types: [], inventory: [], egg_batches: [], events: [], summary: {} });
  if (path === '/enclosures') return jsonResponse({ items: [{ id: 4, code: 'E004', name: 'Local fixture enclosure', occupants: [] }], summary: {} });
  if (path === '/species/suggest') {
    const q = (url.searchParams.get('q') || '').toLocaleLowerCase('ja');
    return jsonResponse(suggestions.filter((item) => `${item.ja_name} ${item.scientific_name}`.toLocaleLowerCase('ja').includes(q)));
  }
  if (path === '/qr/targets' && method === 'GET' && url.searchParams.get('source') === 'spider') {
    const ids = [...new Set(url.searchParams.getAll('ids[]').map(Number))];
    const items = ids.map((id) => animals.find((animal) => animal.id === id)).filter(Boolean).map(qrTarget);
    return jsonResponse({ items, count: items.length });
  }
  // The real QR workspace always reads its transfer overview during navigation.
  if (path === '/qr/transfers' && method === 'GET') return jsonResponse({ incoming: [], outgoing: [] });
  const qrSettings = path.match(/^\/qr\/spiders\/(\d+)\/settings$/);
  if (qrSettings && method === 'POST') return respondToSave((mode) => saveQrResult(qrSettings[1], payload, mode));
  const animalRead = path.match(/^\/spider\/(\d+)(\/events)?$/);
  if (animalRead && method === 'GET') {
    const id = Number(animalRead[1]);
    const animal = animals.find((item) => item.id === id);
    const value = animalRead[2] ? { events: [] } : animal ? clone(animal) : null;
    const respond = (fail = false) => fail || !value
      ? jsonResponse({ code: 'fixture_detail_error', message: 'Local delayed detail failure' }, 500)
      : jsonResponse(value);
    if (heldReadIds.has(id)) return new Promise((resolve) => {
      const pending = waitingReads.get(id) || [];
      pending.push((fail) => resolve(respond(fail)));
      waitingReads.set(id, pending);
    });
    return respond();
  }
  const save = path.match(/^\/spiders(?:\/(\d+))?$/);
  if (save && method === 'POST') {
    return respondToSave((mode) => saveResult(save[1] || '', payload, mode));
  }
  // Unknown endpoints fail visibly, instead of silently approving invented APIs.
  unexpected.push({ method, path });
  return jsonResponse({ code: 'fixture_unhandled', message: 'Unhandled local fixture endpoint: ' + path }, 501);
};

window.__setaeIntakeFixture = {
  kind: 'production-app-with-local-fixture-api', remoteRequests: 0, requestedCount,
  calls: () => clone(calls), unexpected: () => clone(unexpected), animals: () => clone(animals),
  setSaveMode(mode) { if (!saveModes.includes(mode)) throw new Error('Invalid fixture mode'); saveMode = mode; },
  setFieldErrors(values) { fieldErrors = Object.fromEntries(Object.entries(values).map(([key, value]) => [key, String(value)])); },
  seedDraft,
  readDraft(entity = 'new') { return JSON.parse(localStorage.getItem(`setae.gui.v2.formDraft.${fixtureUserId}.animal.${entity}`) || 'null'); },
  releaseSave(mode = 'success') { waitingSaves.splice(0).forEach((release) => release(mode)); },
  pendingSaves: () => waitingSaves.length,
  holdAnimal(id) { heldReadIds.add(Number(id)); },
  pendingAnimalReads: (id) => (waitingReads.get(Number(id)) || []).length,
  releaseAnimal(id, fail = false) {
    heldReadIds.delete(Number(id));
    (waitingReads.get(Number(id)) || []).forEach((release) => release(fail));
    waitingReads.delete(Number(id));
  }
};

try {
  const response = await nativeFetch(appUrl, { credentials: 'omit', cache: 'no-store' });
  if (!response.ok) throw new Error('Production app source unavailable');
  const original = await response.text();
  const sourceHash = [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(original)))].map((v) => v.toString(16).padStart(2, '0')).join('');
  // Blob modules need absolute static import URLs. All imports still resolve to
  // the production modules at assets/app; only this top-level module is a blob.
  let source = original.replace(/(\bfrom\s*['"])(\.[^'"]+)(['"])/g,
    (_, before, specifier, after) => before + new URL(specifier, appUrl).href + after);
  if (!/\nboot\(\);\s*$/.test(source)) throw new Error('App boot instrumentation boundary changed');
  source = source.replace(/\nboot\(\);\s*$/, '\nwindow.__setaeIntakeAppBoot = boot();\n');
  source += `\nwindow.__setaeIntakeApp = {
    snapshot: () => structuredClone({ page: state.page, collectionTab: state.collectionTab, selectedAnimalId: state.selectedAnimalId,
      selectedAnimal: state.selectedAnimal, selectedEvents: state.selectedEvents, loadingEvents: state.loadingEvents,
      collectionSelection: state.collectionSelection, activeAnimalViewId: state.activeAnimalViewId,
      animalView: state.animalView, collectionWindow: state.collectionWindow,
      animalSearch: state.animalSearch, modal: state.modal, error: state.error, connectionError: state.connectionError,
      loading: state.loading, animalIds: state.animals.map((animal) => animal.id), historyState: history.state }),
    navigate: (page, options) => navigateRoute(page, options),
    syncDrafts: () => formSafety.sync(),
    draftState: () => ({ dirty: formSafety.hasDirty(), count: formSafety.dirtyCount() }),
    openIntake: (animal = {}) => openSpecimenIntake(animal),
    openAnimal: (id, options) => openAnimal(id, options),
    openQrForAnimal: (id) => openCollectionQr([id])
  };\n`;
  const moduleUrl = URL.createObjectURL(new Blob([source], { type: 'text/javascript' }));
  await import(moduleUrl);
  URL.revokeObjectURL(moduleUrl);
  await window.__setaeIntakeAppBoot;
  await stylesLoaded;
  if (window.__setaeIntakeApp.snapshot().connectionError) throw new Error('Fixture bootstrap failed');
  await window.__setaeIntakeApp.navigate('animals');
  if (params.get('open') !== 'false') {
    const editId = Number(params.get('edit') || 0);
    const animal = editId ? animals.find((item) => item.id === editId) : {};
    if (!animal) throw new Error('Unknown fixture edit ID');
    window.__setaeIntakeApp.openIntake(clone(animal));
  }
  window.__setaeIntakeFixture.sourceSha256 = sourceHash;
  document.body.dataset.fixtureReady = 'true';
} catch (error) {
  document.body.dataset.fixtureError = error?.message || 'Fixture failed';
  const output = document.createElement('pre');
  output.textContent = document.body.dataset.fixtureError;
  document.body.append(output);
  throw error;
}
