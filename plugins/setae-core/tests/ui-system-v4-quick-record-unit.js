const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');

const primitives = read('assets/app/components/primitives.js');
const components = read('assets/app/styles/components.css');
const quickCss = read('assets/app/styles/screens/quick-record.css');
const launcher = read('assets/app/features/records/quick-record-view.js');
const form = read('assets/app/features/records/record-form-view.js');
const actions = read('assets/app/features/records/actions.js');
const shell = read('includes/frontend/class-setae-app-shell.php');
const docs = read('docs/design-system-v4.md');
const fixture = read('tests/fixtures/quick-record-v4.html');

assert.match(primitives, /export function actionRow/);
assert.match(primitives, /export function quantityStepper/);
assert.match(primitives, /label:\s*'数量を減らす'/);
assert.match(primitives, /label:\s*'数量を増やす'/);
assert.match(primitives, /inputmode="numeric"/);
assert.match(components, /\.action-row\s*\{[^}]*min-height:\s*var\(--touch-target\)[^}]*border-bottom:\s*1px solid var\(--border-default\)[^}]*border-radius:\s*0[^}]*background:\s*transparent/s);
assert.match(components, /\.quantity-stepper\s*\{/);

const rawControl = /<(?:button|input|select|textarea)\b/i;
assert.doesNotMatch(launcher, rawControl, 'Quick Record launcher must compose controls from primitives');
assert.doesNotMatch(form, rawControl, 'Quick Record form must compose controls from primitives');

['actionRow', 'iconButton', 'sheet'].forEach((name) => assert.match(launcher, new RegExp(`\\b${name}\\b`)));
[
  'button',
  'checkboxControl',
  'dateField',
  'fileField',
  'hiddenField',
  'iconButton',
  'quantityStepper',
  'selectField',
  'sheet',
  'textField',
  'textareaField'
].forEach((name) => assert.match(form, new RegExp(`\\b${name}\\b`)));

assert.ok(fs.existsSync(path.join(root, 'assets/app/styles/screens/quick-record.css')));
assert.match(quickCss, /^@layer screens\s*\{/);
assert.equal(fs.existsSync(path.join(root, 'assets/app/styles/layouts.css')), false);
assert.match(shell, /'setae-gui-quick-record-screen'[\s\S]*?styles\/screens\/quick-record\.css[\s\S]*?'setae-gui-specimen-intake-screen'/);
assert.match(shell, /'setae-gui-today-screen'[\s\S]*?'setae-gui-quick-record-screen'/);

assert.doesNotMatch(quickCss, /#[0-9a-f]{3,8}|rgba?\(|hsla?\(/i, 'Quick Record colors must use tokens');
assert.doesNotMatch(quickCss, /font-size:\s*[0-9.]+(?:px|rem|em)/i, 'Quick Record typography must use tokens');
assert.doesNotMatch(quickCss, /border-radius:\s*[1-9][0-9.]*(?:px|rem|em|%)/i, 'Quick Record radii must use tokens');
quickCss.split('\n').filter((line) => /(?:margin|padding|gap)(?:-[a-z]+)?:/.test(line)).forEach((line) => {
  assert.doesNotMatch(line, /[1-9][0-9.]*px/i, `Quick Record spacing must use tokens: ${line}`);
});
assert.doesNotMatch(quickCss, /box-shadow\s*:/i);
const breakpoints = [...quickCss.matchAll(/(?:min|max)-width:\s*([0-9]+)px/g)].map((match) => Number(match[1]));
assert.deepEqual([...new Set(breakpoints)].sort((a, b) => a - b), [767, 1199, 1200]);

['feed', 'molt', 'observation'].forEach((type) => assert.match(launcher, new RegExp(`type: '${type}'[\\s\\S]*?primaryRecordActions|primaryRecordActions[\\s\\S]*?type: '${type}'`)));
['growth', 'pairing'].forEach((type) => assert.match(launcher, new RegExp(`type: '${type}'[\\s\\S]*?secondaryRecordActions|secondaryRecordActions[\\s\\S]*?type: '${type}'`)));
['add-animal', 'open-qr-page', 'open-babies', 'open-husbandry'].forEach((action) => assert.match(launcher, new RegExp(`action: '${action}'`)));
assert.match(launcher, /contextAnimal \? '' : renderRecent/);
assert.match(launcher, /contextAnimal \? '' : renderRelatedActions/);
assert.match(launcher, /items\.slice\(0, 3\)/);
assert.doesNotMatch(quickCss, /\.quick-recent-list[^}]*overflow-x/s);
assert.doesNotMatch(launcher, /quick-record-types|quick-record-other/);

assert.match(form, /class="quick-record-form/);
assert.match(form, /class="quick-record-form-body"/);
assert.match(form, /<footer class="quick-record-footer">/);
assert.match(quickCss, /\.quick-record-form\s*\{[^}]*display:\s*flex[^}]*flex-direction:\s*column[^}]*overflow:\s*hidden/s);
assert.match(quickCss, /\.quick-record-form-body\s*\{[^}]*overflow-y:\s*auto/s);
assert.match(quickCss, /\.quick-record-footer\s*\{[^}]*flex:\s*0 0 auto/s);
assert.doesNotMatch(quickCss, /\.quick-record-footer\s*\{[^}]*position:\s*fixed/s);

[
  'animal_id',
  'date',
  'prey_type',
  'quantity',
  'refused',
  'label',
  'instar',
  'size',
  'partner_name',
  'result',
  'note',
  'image',
  'share_to_feed',
  'is_best_shot'
].forEach((name) => assert.match(form, new RegExp(`['\"]${name}['\"]`), `Missing record field ${name}`));
['feed', 'molt', 'observation', 'growth', 'pairing'].forEach((type) => assert.match(launcher + form, new RegExp(`['\"]${type}['\"]`)));
['attempted', 'successful', 'failed'].forEach((value) => assert.match(form, new RegExp(`value: '${value}'`)));

assert.match(form, /batchAnimals\.length \? renderBatchRestriction\(\) : renderMediaFields/);
assert.match(form, /cancel-bulk-record/);
assert.match(actions, /enqueue/);
assert.match(actions, /network_error/);
assert.match(form, /const busy = Boolean\(quickRecord\.submitting\)/);
assert.match(form, /disabled:\s*busy/);
assert.match(form, /busyLabel:\s*'記録を保存しています…'/);
assert.match(docs, /Transactional workflow reference/);
assert.match(docs, /must not emit raw `button`, `input`, `select`, or `textarea`/);
assert.match(fixture, /renderQuickRecordLauncher/);
assert.match(fixture, /renderRecordForm/);
assert.match(fixture, /\.date-field-frame/);
assert.match(fixture, /getBoundingClientRect\(\)/);
assert.match(fixture, /Date geometry:/);
assert.match(quickCss, /\.quick-record-field-grid \.date-field,[\s\S]*?\.quick-record-field-grid \.date-field-frame[\s\S]*?min-inline-size:\s*0/);

console.log('UI System v4 Quick Record tests passed');
