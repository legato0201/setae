const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { pathToFileURL } = require('node:url');

const root = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const source = read('assets/app/components/progressive-list.js')
  .replace(/^import[\s\S]*?;\n/gm, '')
  .replace(/\bexport\s+/g, '')
  .concat('\nglobalThis.__api = { createListWindow, visibleListItems, extendListWindow, resetListWindow, clampListWindow, renderProgressiveListFooter };');
const context = {
  button: (label, options) => `<button data-action="${options.action}">${label}</button>`,
  escapeHtml: (value) => String(value),
  globalThis: null
};
context.globalThis = context;
vm.runInNewContext(source, context);
const api = context.__api;

const initial = api.createListWindow();
assert.equal(initial.limit, 100);
assert.equal(initial.step, 100);
assert.equal(api.visibleListItems(Array.from({ length: 1000 }), initial).length, 100);
const extended = api.extendListWindow(initial, 1000);
assert.equal(extended.limit, 200);
assert.equal(api.visibleListItems(Array.from({ length: 1000 }), extended).length, 200);
assert.equal(api.resetListWindow(extended).limit, 100);
assert.equal(api.clampListWindow({ ...extended, limit: 500 }, 121).limit, 121);
assert.match(api.renderProgressiveListFooter({ visible: 100, total: 1000, action: 'more' }), /100 \/ 1,000件を表示/);
assert.match(api.renderProgressiveListFooter({ visible: 1234, total: 1234567 }), /1,234 \/ 1,234,567件を表示/);
assert.doesNotMatch(read('assets/app/components/progressive-list.js'), /\.toLocaleString\(/,
  'Cold list rendering must not initialize a locale formatter merely to group integer counts.');
assert.match(api.renderProgressiveListFooter({ visible: 100, total: 1000, action: 'more' }), /aria-live="polite"/);

const records = read('assets/app/pages/records.js');
const nursery = read('assets/app/features/nursery/view.js');
const app = read('assets/app/app.js');
assert.match(records, /visibleListItems\(filtered, listWindow\)/);
assert.match(records, /show-more-records/);
assert.match(records, /appendRecordsWindow/);
assert.match(nursery, /visibleListItems\(items, registerWindow\)/);
assert.match(nursery, /show-more-nursery-items/);
assert.match(nursery, /appendNurseryRegisterWindow/);
assert.doesNotMatch(nursery, /renderDesktopRegister|renderMobileRegister/);
assert.match(app, /recordsWindow:\s*createListWindow\(\)/);
assert.match(app, /recordsWindow:\s*\{ \.\.\.state\.recordsWindow \}/);
assert.match(app, /nurseryRegisterWindow:\s*\{ \.\.\.state\.nurseryRegisterWindow \}/);

async function verifyIncrementalRendering() {
  const NativeDateTimeFormat = Intl.DateTimeFormat;
  const nativeGetFullYear = Date.prototype.getFullYear;
  const previousConfig = globalThis.SETAE_CONFIG;
  let constructors = 0;
  let formatCalls = 0;
  class ObservedDateTimeFormat extends NativeDateTimeFormat {
    constructor(...args) { super(...args); constructors += 1; }
    get format() {
      const nativeFormat = super.format;
      return (value) => { formatCalls += 1; return nativeFormat(value); };
    }
  }
  Intl.DateTimeFormat = ObservedDateTimeFormat;
  Date.prototype.getFullYear = function observedGetFullYear() {
    formatCalls += 1;
    return nativeGetFullYear.call(this);
  };
  const load = (file) => import(pathToFileURL(path.join(root, file)).href);
  try {
    const content = await load('assets/app/components/content.js');
    const recordView = await load('assets/app/pages/records.js');
    const nurseryView = await load('assets/app/features/nursery/view.js');
    const windowApi = await load('assets/app/components/progressive-list.js');
    assert.equal(content.formatDate(''), '—');
    assert.equal(content.formatDate(null), '—');
    assert.equal(content.formatDate('<invalid date>'), '&lt;invalid date&gt;');
    assert.equal(constructors, 0, 'Missing and invalid dates do not instantiate a formatter.');
    for (const includeTime of [false, true]) {
      const options = includeTime
        ? { year: 'numeric', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }
        : { year: 'numeric', month: 'numeric', day: 'numeric' };
      const expected = new NativeDateTimeFormat('ja-JP', options);
      for (const value of ['2026-08-29', '2026-08-29 12:34:56', '2026-08-28T23:50:00Z', '2026-08-29T08:50:00+09:00']) {
        assert.equal(content.formatDate(value, includeTime), expected.format(new Date(value.replace(' ', 'T'))));
        assert.equal(content.formatDate(value, includeTime), expected.format(new Date(value.replace(' ', 'T'))));
      }
    }
    assert.equal(constructors, 0, 'Modern API dates use the equivalent local-time Japanese format without invoking Intl per row.');

    await verifyRecordRows(recordView, windowApi, () => formatCalls);
    await verifyNurseryRows(nurseryView, windowApi, () => formatCalls);
    assert.equal(constructors, 0, 'Additional modern dates keep the fast local-time formatting path.');
  } finally {
    Intl.DateTimeFormat = NativeDateTimeFormat;
    Date.prototype.getFullYear = nativeGetFullYear;
    if (previousConfig === undefined) delete globalThis.SETAE_CONFIG;
    else globalThis.SETAE_CONFIG = previousConfig;
  }
}

// Only the DOM boundary is simulated. HTML and append behavior use production modules.
function listDom(html, { rowPattern, rowSelector, bodySelector, footerSelector }) {
  const parse = (markup) => [...markup.matchAll(rowPattern)].map((match) => ({ id: match[1], markup: match[0] }));
  const nodes = parse(html);
  const insertions = [];
  const body = {
    querySelectorAll(selector) { assert.equal(selector, rowSelector); return nodes; },
    insertAdjacentHTML(position, markup) {
      assert.equal(position, 'beforeend');
      insertions.push(markup);
      nodes.push(...parse(markup));
    }
  };
  const footer = { outerHTML: '' };
  return { nodes, insertions, footer,
    querySelector(selector) { return selector === bodySelector ? body : selector === footerSelector ? footer : null; }
  };
}

async function verifyRecordRows(view, windows, countFormats) {
  const items = Array.from({ length: 350 }, (_, index) => ({
    targetType: 'animal', targetId: index + 1,
    animal: { id: index + 1, individual_code: `C${index + 1}`, species_name: 'Typhochlaena seladonia' },
    event: { id: index + 1, type: index % 2 ? 'molt' : 'feed', date: '2026-08-29T09:00:00+09:00',
      data: { prey_type: 'roach', quantity: 1, instar: 4, note: `record ${index + 1}` } }
  }));
  const options = { records: items, animals: items.map((item) => item.animal), filter: 'all', view: 'history' };
  let listWindow = windows.createListWindow();
  const initialFormats = countFormats();
  const html = view.renderRecords({ ...options, listWindow });
  assert.equal(countFormats() - initialFormats, 100);
  const dom = listDom(html, {
    rowPattern: /<article\b[^>]*data-record-id="([^"]*)"/g, rowSelector: '[data-record-id]',
    bodySelector: '[data-role="records-ledger"]', footerSelector: '[data-role="records-progressive-footer"]'
  });
  const firstRow = dom.nodes[0];
  for (const total of [200, 300, 350]) {
    const previousCount = dom.nodes.length;
    listWindow = windows.extendListWindow(listWindow, items.length);
    const before = countFormats();
    assert.equal(view.appendRecordsWindow(dom, { ...options, listWindow }), true);
    assert.equal(countFormats() - before, total - previousCount, 'Only the appended records require new row formatting.');
    const afterAppend = countFormats();
    const refreshed = view.renderRecords({ ...options, listWindow });
    assert.equal(countFormats(), afterAppend, 'The page-cache render reuses existing and just-appended record rows.');
    assert.equal((refreshed.match(/data-record-id=/g) || []).length, total);
    assert.match(refreshed, /350件/);
    assert.equal(dom.nodes[0], firstRow, 'Appending must retain the existing DOM prefix.');
  }
  assert.deepEqual(dom.nodes.map((node) => node.id), items.map((item) => String(item.event.id)));
  assert.equal(new Set(dom.nodes.map((node) => node.id)).size, items.length);
  assert.doesNotMatch(dom.footer.outerHTML, /data-action="show-more-records"/);
  assert.equal(view.appendRecordsWindow(dom, { ...options, listWindow }), true);
  assert.equal(dom.insertions.length, 3, 'A repeated final append must not insert duplicates.');
  assert.equal(view.appendRecordsWindow(null, options), false);
  const filtered = view.renderRecords({ ...options, filter: 'molt', listWindow });
  assert.equal((filtered.match(/data-record-id=/g) || []).length, 175);

  const item = items[0];
  const edits = [
    () => { item.event.data.note = '<updated & escaped>'; },
    () => { item.event.data.quantity = 3; item.event.data.refused = true; },
    () => { item.event.id = 9001; },
    () => { item.event.date = '2026-08-30T09:00:00+09:00'; },
    () => { item.animal.individual_code = 'NEW-CODE'; item.animal.species_name = 'Caribena versicolor'; },
    () => { item.animal.id = 9002; },
    () => { delete item.animal.id; item.targetId = 9003; },
    () => { item.event.type = 'growth'; item.event.data.size = 4.5; },
    () => { item.event.data = JSON.stringify({ size: 5, note: 'parsed JSON' }); },
    () => { item.targetType = 'enclosure'; item.enclosure = { id: 8, code: 'E008', name: 'Rack A' }; },
    () => { item.targetType = 'nursery'; item.nursery = { id: 9, code_range: 'B001–B003', species_name: 'Haplocosmia sp.' }; }
  ];
  for (const edit of edits) {
    const oldHtml = view.renderRecord(item);
    edit();
    const before = countFormats();
    const current = view.renderRecord(item);
    assert.equal(countFormats() - before, 1, 'An in-place display or action change invalidates the row.');
    assert.notEqual(current, oldHtml);
    assert.equal(current, view.renderRecord(structuredClone(item)), 'A reused object renders exactly like fresh current data.');
  }
  assert.doesNotMatch(view.renderRecord(item), /data-action="delete-record"/, 'Nursery targets keep their different action policy.');

  const iconItem = items[2];
  globalThis.SETAE_CONFIG = { iconOverrides: {} };
  const defaultIcons = view.renderRecord(iconItem);
  globalThis.SETAE_CONFIG.iconOverrides['ui.more'] = '<svg viewBox="0 0 24 24"><path d="M1 2L3 4"/></svg>';
  const customMenu = view.renderRecord(iconItem);
  assert.equal(customMenu, defaultIcons, 'The CSS menu affordance does not depend on repeated inline SVG markup.');
  globalThis.SETAE_CONFIG.iconOverrides['action.feed'] = '<svg viewBox="0 0 24 24"><path d="M5 6L7 8"/></svg>';
  assert.match(view.renderRecord(iconItem), /M5 6L7 8/);
  assert.equal(view.renderRecord(iconItem), view.renderRecord(structuredClone(iconItem)));

  const hydrationItems = items.slice(0, 100);
  const initialWindow = windows.createListWindow({ initial: 5, limit: 5 });
  const targetWindow = windows.createListWindow({ limit: 100 });
  const deferredHtml = view.renderRecords({ ...options, records: hydrationItems, listWindow: initialWindow, deferRows: true });
  assert.match(deferredHtml, /aria-busy="true"/);
  assert.doesNotMatch(deferredHtml, /data-action="show-more-records"/);
  const hydrationDom = listDom(deferredHtml, {
    rowPattern: /<article\b[^>]*data-record-id="([^"]*)"/g, rowSelector: '[data-record-id]',
    bodySelector: '[data-role="records-ledger"]', footerSelector: '[data-role="records-progressive-footer"]'
  });
  let paintCount = 0;
  const hydrated = await view.hydrateRecordsWindow(hydrationDom, {
    records: hydrationItems, initialWindow, renderedLimit: 0, targetWindow, nextPaint: async () => { paintCount += 1; }
  });
  assert.equal(hydrated.limit, 100);
  assert.equal(paintCount, 5, 'The first five rows and every following batch use separate real paint opportunities.');
  assert.equal(hydrationDom.nodes.length, 100);
  assert.doesNotMatch(hydrationDom.footer.outerHTML, /件を追加しました/);
  assert.match(hydrationDom.footer.outerHTML, /記録の準備が完了しました/);
  const guardedDom = listDom(deferredHtml, {
    rowPattern: /<article\b[^>]*data-record-id="([^"]*)"/g, rowSelector: '[data-record-id]',
    bodySelector: '[data-role="records-ledger"]', footerSelector: '[data-role="records-progressive-footer"]'
  });
  assert.equal(await view.hydrateRecordsWindow(guardedDom, {
    records: hydrationItems, initialWindow, renderedLimit: 0, targetWindow, nextPaint: async () => {}, guard: () => false
  }), false, 'A route change cancels the stale progressive mount before appending.');
  assert.equal(guardedDom.nodes.length, 0);
}

function verifyNurseryRows(view, windows, countFormats) {
  const items = Array.from({ length: 250 }, (_, index) => ({
    code: `B${String(index + 1).padStart(3, '0')}`, status: 'alive',
    last_molt: '2026-08-29', note: `baby ${index + 1}`
  }));
  const group = { id: 3, species_name: 'Typhochlaena seladonia', items, events: [] };
  let registerWindow = windows.createListWindow();
  const initialFormats = countFormats();
  const html = view.renderNurseryWorkspace(group, { registerWindow });
  assert.equal(countFormats() - initialFormats, 100);
  const dom = listDom(html, {
    rowPattern: /<tr\b[^>]*data-nursery-item-code="([^"]*)"/g, rowSelector: '[data-nursery-item-code]',
    bodySelector: '.nursery-specimen-registry tbody', footerSelector: '[data-role="nursery-progressive-footer"]'
  });
  const firstRow = dom.nodes[0];
  for (const total of [200, 250]) {
    const previousCount = dom.nodes.length;
    registerWindow = windows.extendListWindow(registerWindow, items.length);
    const before = countFormats();
    assert.equal(view.appendNurseryRegisterWindow(dom, { items, registerWindow }), true);
    assert.equal(countFormats() - before, total - previousCount);
    const afterAppend = countFormats();
    const refreshed = view.renderNurseryWorkspace(group, { registerWindow });
    assert.equal(countFormats(), afterAppend, 'Nursery cache refresh does not regenerate unchanged register rows.');
    assert.equal((refreshed.match(/data-nursery-item-code=/g) || []).length, total);
    assert.match(refreshed, /data-action="baby-bulk"[^>]*data-group-id="3"/);
    assert.equal((refreshed.match(/<table\b/g) || []).length, 1);
    assert.equal(dom.nodes[0], firstRow);
  }
  assert.deepEqual(dom.nodes.map((node) => node.id), items.map((item) => item.code));
  assert.doesNotMatch(dom.footer.outerHTML, /data-action="show-more-nursery-items"/);
  assert.equal(view.appendNurseryRegisterWindow(dom, { items, registerWindow }), true);
  assert.equal(dom.insertions.length, 2);
  assert.equal(view.appendNurseryRegisterWindow(null, { items }), false);

  const item = items[0];
  for (const [field, value] of [['code', 'B999'], ['status', 'rehomed'], ['last_molt', '2026-08-30'], ['note', '<new & escaped>']]) {
    const oldHtml = view.renderNurseryRegisterRow(item);
    item[field] = value;
    const before = countFormats();
    const current = view.renderNurseryRegisterRow(item);
    assert.equal(countFormats() - before, 1, `Changed ${field} must invalidate the nursery row.`);
    assert.notEqual(current, oldHtml);
    assert.equal(current, view.renderNurseryRegisterRow({ ...item }));
  }
  assert.match(view.renderNurseryRegisterRow(item), /is-rehomed/);
  assert.match(view.renderNurseryRegisterRow(item), /&lt;new &amp; escaped&gt;/);
  item.last_molt = '';
  assert.equal(view.renderNurseryRegisterRow(item), view.renderNurseryRegisterRow({ ...item }));
  assert.match(view.renderNurseryRegisterRow(item), /<time datetime="">—<\/time>/);
  const small = windows.createListWindow();
  assert.equal((view.renderNurseryWorkspace(group, { registerWindow: small }).match(/data-nursery-item-code=/g) || []).length, 100,
    'Row reuse does not retain a previous larger visible window.');
}

verifyIncrementalRendering().then(() => {
  console.log('UI System v4 progressive list tests passed');
}).catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
