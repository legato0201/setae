const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');
const page = read('assets/app/pages/husbandry.js');
const collection = read('assets/app/pages/collection.js');
const feederView = read('assets/app/features/husbandry/feeder-view.js');
const enclosureView = read('assets/app/features/husbandry/enclosure-view.js');
const enclosureCareView = read('assets/app/features/husbandry/care-plan-view.js');
const animalCareView = read('assets/app/features/care/profile-view.js');
const nurseryCareView = read('assets/app/features/nursery/care-plan-view.js');
const patterns = read('assets/app/components/patterns.js');
const modals = read('assets/app/components/modals.js');
const app = read('assets/app/app.js');
const husbandryCss = read('assets/app/styles/screens/husbandry.css');
const carePlanCss = read('assets/app/styles/patterns/care-plan.css');
const shell = read('includes/frontend/class-setae-app-shell.php');
const fixture = read('tests/fixtures/husbandry-v4.html');
const plugin = read('setae-core.php');

const functionSource = (source, name) => {
  const start = source.indexOf(`function ${name}(`);
  assert.notEqual(start, -1, `${name} must exist`);
  const next = source.indexOf('\nfunction ', start + 10);
  return source.slice(start, next === -1 ? source.length : next);
};

assert.ok(fs.existsSync(path.join(root, 'assets/app/styles/screens/husbandry.css')));
assert.ok(fs.existsSync(path.join(root, 'assets/app/styles/patterns/care-plan.css')));
assert.match(husbandryCss, /^@layer screens\s*\{/);
assert.match(carePlanCss, /^@layer patterns\s*\{/);
assert.equal((husbandryCss.match(/\{/g) || []).length, (husbandryCss.match(/\}/g) || []).length, 'Husbandry CSS braces must be balanced');
assert.equal((carePlanCss.match(/\{/g) || []).length, (carePlanCss.match(/\}/g) || []).length, 'Care Plan CSS braces must be balanced');
assert.doesNotMatch(husbandryCss, /#[0-9a-f]{3,8}|rgba?\(|hsla?\(/i, 'Husbandry colors must use tokens');
assert.doesNotMatch(husbandryCss, /font-size:\s*[0-9.]+(?:px|rem|em)/i, 'Husbandry typography must use tokens');
assert.doesNotMatch(husbandryCss, /border-radius:\s*[1-9][0-9.]*(?:px|rem|em|%)/i, 'Husbandry must not add arbitrary radii');
assert.doesNotMatch(husbandryCss, /box-shadow\s*:/i, 'Husbandry must remain rule-based');
assert.doesNotMatch(husbandryCss, /overflow-x\s*:/i, 'Husbandry must not use horizontal scrolling as a mobile fix');
assert.doesNotMatch(husbandryCss, /420px/);
assert.match(husbandryCss, /@media \(max-width:\s*767px\)/);
assert.match(husbandryCss, /@media \(min-width:\s*768px\) and \(max-width:\s*1199px\)/);
assert.match(husbandryCss, /@media \(min-width:\s*1200px\)/);
assert.match(husbandryCss, /var\(--content-workspace-width\)/);

const rawControl = /<(?:button|input|select|textarea)\b/i;
assert.doesNotMatch(page, rawControl, 'Husbandry page must compose controls from primitives');
assert.doesNotMatch(enclosureView, rawControl, 'Enclosure view must compose controls from primitives/patterns');
assert.doesNotMatch(enclosureCareView, rawControl, 'Enclosure Care Plan must compose controls from primitives');
assert.doesNotMatch(animalCareView, rawControl, 'Animal Care Plan must compose controls from primitives');

assert.match(page, /features\/husbandry\/feeder-view\.js/);
assert.doesNotMatch(collection, /renderFeeders|feederAction|FEEDER STOCK/);
assert.match(feederView, /export function renderFeeders/);
assert.match(feederView, /function summaryItem/);
assert.match(feederView, /function feederAction/);
assert.match(feederView, /husbandry-operational-summary/);
assert.match(feederView, /workbench-ledger feeder-ledger/);
assert.match(feederView, /actionMenu\('卵セットの操作'/);

assert.match(page, /workspaceHeader\(enclosureDetail\.code/);
assert.match(page, /容器を記録/);
assert.match(page, /enclosure-qr/);
assert.match(page, /actionMenu\('容器の操作'/);
assert.match(page, /archive-enclosure/);
assert.doesNotMatch(enclosureView, /enclosure-workspace-header|<h2>\$\{escapeHtml\(enclosure\.code\)/);
assert.match(enclosureView, /close-enclosure/);
assert.doesNotMatch(enclosureView, /enclosure-danger-zone/);

assert.match(enclosureView, /husbandry-operational-summary enclosure-summary/);
assert.match(enclosureView, /registryActionRow\(content/);
assert.match(enclosureView, /enclosure-record-reading/);
assert.match(enclosureView, /確認済み/);
assert.match(husbandryCss, /\.enclosure-record-reading[\s\S]*?grid-column:\s*2/s);
assert.doesNotMatch(husbandryCss, /\.enclosure-record-reading[^}]*display:\s*none/s);
assert.doesNotMatch(husbandryCss, /\.enclosure-record-status[^}]*display:\s*none/s);

const sectionOrder = [
  'enclosure-environment-section',
  'enclosure-properties-section',
  'enclosure-occupants-section',
  'enclosure-care-plan-panel',
  'enclosure-history-section',
  'enclosure-occupancy-history'
].map((token) => enclosureView.indexOf(token));
sectionOrder.forEach((position) => assert.notEqual(position, -1));
assert.deepEqual([...sectionOrder].sort((a, b) => a - b), sectionOrder, 'Enclosure sections must follow the operational order');
assert.match(enclosureView, /export function environmentReadingTone/);
assert.match(enclosureView, /enclosure-property-list/);
assert.match(enclosureView, /enclosure-care-plan-list/);
assert.doesNotMatch(enclosureView, /enclosure-care-plan-grid/);
assert.match(enclosureView, /actionMenu\('入居個体の操作'/);
assert.match(enclosureView, /label:\s*'退居'/);
assert.doesNotMatch(enclosureView, /danger-text/);
assert.match(enclosureView, /workbench-ledger enclosure-ledger/);
assert.match(enclosureView, /recordIcon\(event\.event_type\)/);
assert.doesNotMatch(enclosureView, /enclosure-event-row|enclosure-event-mark/);
assert.match(enclosureView, /emptyState\('現在入居している個体はいません。'/);

const toneSource = functionSource(enclosureView, 'environmentReadingTone')
  .replace(/^function /, 'function ')
  .replace(/\bexport\s+/, '')
  .concat('\nglobalThis.__tone = environmentReadingTone;');
const sandbox = {};
vm.runInNewContext(toneSource, sandbox);
assert.equal(sandbox.__tone(22.8, 24, 27), 'low');
assert.equal(sandbox.__tone(28, 24, 27), 'high');
assert.equal(sandbox.__tone(26.2, 24, 27), 'within');
assert.equal(sandbox.__tone(null, 24, 27), 'unknown');

const retiredSelectors = [
  '.enclosure-summary', '.enclosure-registry', '.enclosure-record-row', '.enclosure-record-main',
  '.enclosure-record-code', '.enclosure-record-identity', '.enclosure-record-occupants',
  '.enclosure-record-reading', '.enclosure-record-status', '.enclosure-record-open',
  '.enclosure-workspace', '.enclosure-workspace-header', '.enclosure-workspace-identity',
  '.enclosure-detail-grid', '.enclosure-panel', '.enclosure-readings', '.enclosure-spec-list',
  '.enclosure-panel-meta', '.enclosure-due', '.enclosure-care-profile', '.enclosure-care-plan-panel',
  '.enclosure-care-plan-grid', '.enclosure-occupants-section', '.enclosure-occupant-list',
  '.enclosure-occupant-row', '.enclosure-occupant-main', '.enclosure-history-section',
  '.enclosure-event-list', '.enclosure-event-row', '.enclosure-event-mark',
  '.enclosure-occupancy-history', '.enclosure-danger-zone', '.enclosure-empty-inline'
];
assert.equal(fs.existsSync(path.join(root, 'assets/app/styles/layouts.css')), false);

assert.match(patterns, /export function registryActionRow/);
assert.match(shell, /'setae-gui-care-plan-pattern'[\s\S]*?styles\/patterns\/care-plan\.css/);
assert.match(shell, /'setae-gui-husbandry-screen'[\s\S]*?styles\/screens\/husbandry\.css[\s\S]*?array\('setae-gui-nursery-screen'\)/);
assert.match(shell, /'setae-gui-qr-screen'[\s\S]*?array\('setae-gui-husbandry-screen'\)/);
assert.match(shell, /'setae-gui-community-screen'[\s\S]*?array\('setae-gui-qr-screen'\)/);
assert.match(shell, /'setae-gui-settings-screen'[\s\S]*?array\('setae-gui-community-screen'\)/);

['enclosureForm', 'enclosureCareField', 'enclosureEventForm', 'enclosureOccupancyForm'].forEach((name) => {
  assert.doesNotMatch(functionSource(modals, name), rawControl, `${name} must use form primitives`);
});
const enclosureForm = functionSource(modals, 'enclosureForm');
[
  'code', 'name', 'enclosure_type', 'width_cm', 'depth_cm', 'height_cm', 'location', 'photo_url',
  'target_temp_min', 'target_temp_max', 'target_humidity_min', 'target_humidity_max', 'substrate',
  'substrate_depth_cm', 'care_environment', 'care_misting', 'care_watering', 'care_maintenance', 'care_substrate'
].forEach((field) => assert.match(enclosureForm + functionSource(modals, 'enclosureCareField'), new RegExp(`['"]${field}['"]|care_\\$\\{key\\}`), `Enclosure field ${field} must remain`));
assert.match(modals, /const enclosureTypeOptions = \[/);
assert.match(modals, /const enclosureEventOptions = \[/);

const eventForm = functionSource(modals, 'enclosureEventForm');
['event_type', 'event_date', 'temperature', 'humidity', 'note'].forEach((field) => assert.match(eventForm, new RegExp(`['"]${field}['"]`)));
assert.match(eventForm, /dateField\(\{ label: '日付'/);
['environment_check', 'maintenance', 'watering', 'misting', 'substrate_change', 'note'].forEach((value) => assert.match(modals, new RegExp(`value: '${value}'`)));

const occupancyForm = functionSource(modals, 'enclosureOccupancyForm');
['animal_ids', 'started_at', 'note'].forEach((field) => assert.match(occupancyForm, new RegExp(`['"]${field}['"]`)));
assert.match(occupancyForm, /multiple:\s*true/);
assert.match(occupancyForm, /size:\s*8/);
assert.match(occupancyForm, /dateField\(\{ label: '入居日'/);

['button', 'hiddenField', 'selectField', 'textButton', 'textField'].forEach((name) => assert.match(enclosureCareView, new RegExp(`\\b${name}\\b`)));
['button', 'checkboxControl', 'hiddenField', 'selectField', 'textButton', 'textField'].forEach((name) => assert.match(animalCareView, new RegExp(`\\b${name}\\b`)));
['feedIntervalDays', 'observationIntervalDays', 'preMoltObservationDays', 'postMoltFeedDelayDays', 'dueSoonDays', 'excludePreMoltFeed'].forEach((field) => assert.match(animalCareView, new RegExp(field)));
assert.match(animalCareView, /value:\s*'on'/);
assert.match(nurseryCareView, /care-plan-stack nursery-care-profile/);
assert.match(enclosureCareView, /care-plan-stack enclosure-care-profile/);
assert.match(animalCareView, /care-plan-stack care-profile-settings/);
assert.match(carePlanCss, /grid-template-columns:\s*repeat\(5, minmax\(0, 1fr\)\)/);
assert.match(carePlanCss, /@media \(max-width:\s*767px\)[\s\S]*?grid-template-columns:\s*minmax\(0, 1fr\)/);

[
  'add-enclosure', 'open-enclosure', 'close-enclosure', 'edit-enclosure', 'enclosure-qr',
  'record-enclosure', 'assign-enclosure', 'open-enclosure-animal', 'end-enclosure-occupancy',
  'archive-enclosure', 'remove-enclosure-care-override'
].forEach((action) => assert.match(`${page}${enclosureView}${enclosureCareView}`, new RegExp(action), `Action ${action} must remain`));
['feeders', 'enclosures', 'care'].forEach((tab) => assert.match(page, new RegExp(`id: '${tab}'`)));
assert.match(app, /setae\.gui\.v2\.enclosureCareProfile|enclosureCareProfile/);
['submitEnclosure', 'submitEnclosureEvent', 'submitEnclosureOccupancy'].forEach((name) => {
  const handler = functionSource(app, name);
  assert.match(handler, /submitting:\s*true/);
  assert.match(handler, /submitting:\s*false/);
});

assert.match(fixture, /renderHusbandry/);
assert.match(fixture, /renderModal/);
assert.match(fixture, /fixtureParams\.get\('mode'\) \|\| 'registry'/);
assert.match(fixture, /Array\.from\(\{ length: itemCount \}/);
assert.match(fixture, /dataset\.overflow/);
assert.match(fixture, /styles\/screens\/husbandry\.css/);
assert.match(fixture, /styles\/patterns\/care-plan\.css/);

assert.match(plugin, /Version:\s*1\.0\.251/);
assert.match(plugin, /define\('SETAE_VERSION', '1\.0\.251\.1'\)/);

console.log('UI System v4 Husbandry Workbench tests passed');
