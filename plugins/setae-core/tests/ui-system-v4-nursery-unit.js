const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');
const model = read('assets/app/features/nursery/model.js');
const view = read('assets/app/features/nursery/view.js');
const carePlanView = read('assets/app/features/nursery/care-plan-view.js');
const collection = read('assets/app/pages/collection.js');
const records = read('assets/app/pages/records.js');
const primitives = read('assets/app/components/primitives.js');
const modals = read('assets/app/components/modals.js');
const app = read('assets/app/app.js');
const nurseryCss = read('assets/app/styles/screens/nursery.css');
const shell = read('includes/frontend/class-setae-app-shell.php');
const fixture = read('tests/fixtures/nursery-v4.html');
const plugin = read('setae-core.php');

const functionSource = (source, name) => {
  const start = source.indexOf(`function ${name}`);
  assert.notEqual(start, -1, `${name} must exist`);
  const next = source.indexOf('\nfunction ', start + 10);
  return source.slice(start, next === -1 ? source.length : next);
};

assert.ok(fs.existsSync(path.join(root, 'assets/app/styles/screens/nursery.css')));
assert.match(nurseryCss, /^@layer screens\s*\{/);
assert.equal((nurseryCss.match(/\{/g) || []).length, (nurseryCss.match(/\}/g) || []).length, 'Nursery CSS braces must be balanced');
assert.doesNotMatch(nurseryCss, /#[0-9a-f]{3,8}|rgba?\(|hsla?\(/i, 'Nursery colors must use tokens');
assert.doesNotMatch(nurseryCss, /font-size:\s*[0-9.]+(?:px|rem|em)/i, 'Nursery typography must use tokens');
assert.doesNotMatch(nurseryCss, /border-radius:\s*[1-9][0-9.]*(?:px|rem|em|%)/i, 'Nursery must not add arbitrary radii');
assert.doesNotMatch(nurseryCss, /box-shadow\s*:/i, 'Nursery must remain rule-based');
assert.doesNotMatch(nurseryCss, /overflow-x\s*:/i, 'Nursery must not introduce horizontal toolbars or tables');
assert.match(nurseryCss, /@media \(max-width:\s*767px\)/);
assert.match(nurseryCss, /@media \(min-width:\s*768px\) and \(max-width:\s*1199px\)/);
assert.match(nurseryCss, /var\(--content-workspace-width\)/);

const rawControl = /<(?:button|input|select|textarea)\b/i;
assert.doesNotMatch(view, rawControl, 'Nursery view must compose controls from primitives');
assert.doesNotMatch(carePlanView, rawControl, 'Nursery Care Plan must compose controls from primitives');
['actionMenu', 'actionRow', 'button', 'emptyState', 'textIconButton'].forEach((name) => {
  assert.match(view, new RegExp(`\\b${name}\\b`), `Nursery view must use ${name}`);
});
['button', 'hiddenField', 'selectField', 'textButton', 'textField'].forEach((name) => {
  assert.match(carePlanView, new RegExp(`\\b${name}\\b`), `Nursery Care Plan must use ${name}`);
});

assert.match(primitives, /export function choiceControl/);
assert.match(primitives, /type === 'checkbox' \? 'checkbox' : 'radio'/);
assert.match(primitives, /role \? `data-role=/);
assert.match(primitives, /size !== '' \? `size=/);
assert.match(primitives, /Array\.isArray\(value\) \? value : \[value\]/);
assert.match(primitives, /field-control-with-suffix/);

assert.match(model, /export function nurseryCodeRange/);
assert.match(view, /actionRow\(\{/);
assert.match(view, /className:\s*'nursery-registry-row'/);
assert.match(view, /nursery-operational-summary/);
assert.match(view, /<details class="nursery-archive"/);
assert.doesNotMatch(view, /nursery-entry|summary-strip|summaryItem/);
assert.match(view, /group\.species_name \|\| '種未設定'/);
assert.match(view, /最終記録/);

assert.match(collection, /if \(babyDetail\)/);
assert.match(collection, /workspaceHeader\(babyDetail\.name \|\| codeRange/);
assert.match(collection, /nurseryCodeRange\(babyDetail\)/);
assert.match(collection, /QRラベル/);
assert.match(collection, /群の設定/);
assert.match(collection, /通常個体へ移動/);
assert.doesNotMatch(view, /nursery-workspace-header/);

['feed', 'observation', 'count_check'].forEach((type) => assert.match(view, new RegExp(`'event-type': '${type}'`)));
['molt', 'dead', 'alive', 'rehomed'].forEach((type) => assert.match(view, new RegExp(`'event-type': '${type}'`)));
assert.match(view, /actionMenu\('一括記録'/);
assert.match(view, /死亡を記録/);
assert.doesNotMatch(view, /button\('死亡'/);

assert.match(view, /workbench-ledger nursery-ledger/);
assert.match(view, /workbench-ledger-row nursery-ledger-row/);
assert.match(view, /recordIcon\(event\.type\)/);
assert.doesNotMatch(view, /nursery-history-row/);
assert.match(records, /nurseryCodeRange\(nursery\)/);

assert.match(view, /registry-frame nursery-specimen-registry/);
assert.match(view, /<table class="registry-table"/);
assert.match(view, /renderResponsiveRegister\(visible\)/);
assert.match(view, /data-nursery-item-code/);
assert.match(view, /data-label="番号"/);
assert.match(view, /show-more-nursery-items/);
assert.doesNotMatch(view, /renderDesktopRegister|renderMobileRegister|registry-mobile-list nursery-specimen-mobile/);
assert.doesNotMatch(view, /data-table|baby-table/);
assert.match(nurseryCss, /\.nursery-specimen-registry \.registry-table td::before[\s\S]*?content:\s*attr\(data-label\)/s);

const retiredSelectors = [
  '.nursery-summary', '.nursery-registry', '.nursery-entry', '.nursery-entry-heading',
  '.nursery-entry-taxon', '.nursery-entry-count', '.nursery-entry-stats', '.nursery-entry-open',
  '.nursery-workspace', '.nursery-workspace-header', '.nursery-living', '.nursery-record-toolbar',
  '.nursery-workspace-grid', '.nursery-ledger-section', '.nursery-care-status', '.nursery-development',
  '.nursery-history', '.nursery-history-row', '.nursery-count-check', '.nursery-count-warning',
  '.nursery-care-profile', '.nursery-care-rule-grid', '.baby-table-wrap', '.baby-grid', '.baby-card',
  '.baby-card-head', '.baby-count', '.baby-card-meta', '.baby-detail-header', '.baby-tools'
];
assert.equal(fs.existsSync(path.join(root, 'assets/app/styles/layouts.css')), false);

assert.match(shell, /'setae-gui-records-screen'[\s\S]*?styles\/screens\/records\.css/);
assert.match(shell, /'setae-gui-nursery-screen'[\s\S]*?styles\/screens\/nursery\.css[\s\S]*?array\('setae-gui-records-screen'\)/);
assert.match(shell, /'setae-gui-husbandry-screen'[\s\S]*?array\('setae-gui-nursery-screen'\)/);
assert.match(shell, /'setae-gui-qr-screen'[\s\S]*?array\('setae-gui-husbandry-screen'\)/);
assert.match(shell, /'setae-gui-community-screen'[\s\S]*?array\('setae-gui-qr-screen'\)/);
assert.match(shell, /'setae-gui-settings-screen'[\s\S]*?array\('setae-gui-community-screen'\)/);

const modalFunctions = ['babyGroupForm', 'babyBulkForm', 'nurseryEventForm', 'babyPromoteForm', 'babyQrForm'];
modalFunctions.forEach((name) => assert.doesNotMatch(functionSource(modals, name), rawControl, `${name} must use form primitives`));
const babyGroup = functionSource(modals, 'babyGroupForm');
['name', 'prefix', 'count', 'birth_date', 'species_id', 'parent_spider_ids', 'parent_note', 'archived'].forEach((field) => {
  assert.match(babyGroup, new RegExp(`['"]${field}['"]`), `Baby Group field ${field} must remain`);
});
assert.match(babyGroup, /dateField\(\{ label: '誕生日'/);
assert.match(babyGroup, /multiple:\s*true/);
assert.match(babyGroup, /size:\s*4/);

const babyBulk = functionSource(modals, 'babyBulkForm');
['event', 'date', 'codes', 'note'].forEach((field) => assert.match(babyBulk, new RegExp(`name:\\s*'${field}'`)));
assert.match(babyBulk, /dateField\(\{ label: '日付'/);
const nurseryEvent = functionSource(modals, 'nurseryEventForm');
['type', 'date', 'note', 'prey_type', 'quantity', 'label', 'current_count', 'temperature', 'humidity'].forEach((field) => {
  assert.match(nurseryEvent, new RegExp(`['"]${field}['"]`), `Nursery event field ${field} must remain`);
});
assert.match(nurseryEvent, /dateField\(\{ label: '日付'/);
assert.match(functionSource(modals, 'babyPromoteForm'), /name:\s*'codes'/);
const babyQr = functionSource(modals, 'babyQrForm');
['selection_mode', 'baby-qr-mode', 'baby-qr-range', 'baby-qr-item', 'baby-qr-select-all', 'baby-qr-clear'].forEach((contract) => {
  assert.match(babyQr, new RegExp(contract));
});
assert.match(babyQr, /choiceControl\(\{/);

['submitBabyGroup', 'submitBabyBulk', 'submitBabyPromote', 'submitBabyQr', 'submitNurseryEvent'].forEach((name) => {
  const handler = functionSource(app, name);
  assert.match(handler, /submitting:\s*true/, `${name} must lock the dialog`);
  assert.match(handler, /submitting:\s*false/, `${name} must unlock after error`);
});
assert.match(app, /const snapshot = captureFormState\(form\)/);
assert.match(app, /const replacement = role \? app\.querySelector/);
assert.match(app, /restoreFormState\(replacement, snapshot\)/);
assert.match(modals, /'baby-qr': '識別票を準備しています…'/);

const executableModel = model
  .replace(/^import[^;]+;\s*/gm, '')
  .replace(/^/, "const resolveNurseryCarePlan = () => ({}); const nurseryCareDefinitions = {}; const nurseryEventLabel = (type) => type;\n")
  .replace(/\bexport\s+/g, '')
  .concat('\nglobalThis.__nurseryCodeRange = nurseryCodeRange;');
const sandbox = {};
vm.runInNewContext(executableModel, sandbox);
const nurseryCodeRange = sandbox.__nurseryCodeRange;
assert.equal(nurseryCodeRange({ prefix: 'B', items: [{ code: 'B001', number: 1 }] }), 'B001');
assert.equal(nurseryCodeRange({ prefix: 'B', items: [{ code: 'B010' }, { code: 'B001' }, { code: 'B002' }] }), 'B001–B010');
assert.equal(nurseryCodeRange({ prefix: 'B', items: [] }), 'B');
assert.equal(nurseryCodeRange({ name: 'Seladonia 2026-08', prefix: '', items: [] }), 'Seladonia 2026-08');

assert.match(fixture, /renderCollection/);
assert.match(fixture, /renderModal/);
assert.match(fixture, /renderNurseryCarePlanSettings/);
assert.match(fixture, /fixtureParams\.get\('mode'\) \|\| 'registry'/);
assert.match(fixture, /Array\.from\(\{ length: itemCount \}/);
assert.match(fixture, /dataset\.overflow/);
assert.match(fixture, /dataset\.renderMs/);
assert.match(fixture, /styles\/screens\/nursery\.css/);

assert.match(plugin, /Version:\s*1\.0\.251/);
assert.match(plugin, /define\('SETAE_VERSION', '1\.0\.251\.1'\)/);

console.log('UI System v4 Nursery Workbench tests passed');
