const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');
const helper = read('assets/app/components/date-field.js');
const primitives = read('assets/app/components/primitives.js');
const icons = read('assets/app/components/icons.js');
const components = read('assets/app/styles/components.css');
const app = read('assets/app/app.js');
const quickFixture = read('tests/fixtures/quick-record-v4.html');
const mobileFixture = read('tests/fixtures/mobile-form-integrity.html');

assert.ok(fs.existsSync(path.join(root, 'assets/app/components/date-field.js')));
assert.match(primitives, /class="date-field-display" data-date-field-display aria-hidden="true"/);
assert.match(primitives, /class="date-field-display-icon" aria-hidden="true">\$\{icon\('calendar'\)\}/);
assert.match(primitives, /class="text-field date-field-control" type="\$\{safeType\}" name="\$\{escapeHtml\(name\)\}" value="\$\{escapeHtml\(value\)\}"/);
assert.match(primitives, /formControlAttributes\(\{ \.\.\.attributes, id: identity\.id \}\)/);
assert.match(primitives, /\$\{required \? 'required' : ''\}/);
assert.match(icons, /calendar:\s*'<path/);
assert.match(icons, /calendar:\s*'public\.calendar'/);

assert.doesNotMatch(helper, /new Date\s*\(/, 'Date-only values must not pass through timezone conversion');
assert.match(helper, /^(?:const|export function)[\s\S]*formatDateFieldValue/);
assert.match(helper, /export function syncDateFieldDisplay/);

const runnable = helper.replace(/export function /g, 'function ');
const sandbox = {};
vm.runInNewContext(`${runnable}\nthis.formatDateFieldValue = formatDateFieldValue; this.syncDateFieldDisplay = syncDateFieldDisplay;`, sandbox);
assert.equal(sandbox.formatDateFieldValue('2026-08-25', 'date'), '2026/08/25');
assert.equal(sandbox.formatDateFieldValue('2026-08', 'month'), '2026/08');
assert.equal(sandbox.formatDateFieldValue('18:42', 'time'), '18:42');
assert.equal(sandbox.formatDateFieldValue('2026-08-25T18:42', 'datetime-local'), '2026/08/25 18:42');
assert.equal(sandbox.formatDateFieldValue('', 'date'), '日付を選択');
assert.equal(sandbox.formatDateFieldValue('', 'month'), '月を選択');
assert.equal(sandbox.formatDateFieldValue('', 'time'), '時刻を選択');
assert.equal(sandbox.formatDateFieldValue('', 'datetime-local'), '日時を選択');

const display = { textContent: '' };
const input = {
  type: 'date',
  value: '2026-09-03',
  closest: () => ({ querySelector: () => display })
};
assert.equal(sandbox.syncDateFieldDisplay(input), true);
assert.equal(display.textContent, '2026/09/03');

assert.match(components, /\.date-field-display,\s*\n\s*\.date-field-display-icon\s*\{\s*display:\s*none/);
const iosStart = components.indexOf('@supports (-webkit-touch-callout: none)');
const iosEnd = components.indexOf('\n  .field > span', iosStart);
assert.ok(iosStart >= 0 && iosEnd > iosStart, 'iOS date presentation block must exist');
const iosBlock = components.slice(iosStart, iosEnd);
assert.match(iosBlock, /@media \(hover:\s*none\) and \(pointer:\s*coarse\)/);
assert.match(iosBlock, /\.date-field-frame\s*\{[^}]*position:\s*relative[^}]*grid-template-columns:\s*minmax\(0, 1fr\) var\(--touch-target\)[^}]*overflow:\s*hidden/s);
assert.match(iosBlock, /\.date-field-frame:focus-within\s*\{[^}]*outline:\s*2px solid var\(--focus-ring\)/s);
assert.match(iosBlock, /\.date-field-display\s*\{[^}]*display:\s*block[^}]*font-size:\s*var\(--type-mobile-input\)/s);
assert.match(iosBlock, /\.date-field-display-icon\s*\{[^}]*display:\s*grid/s);
assert.match(iosBlock, /\.date-field-control\s*\{[^}]*position:\s*absolute[^}]*inset:\s*0[^}]*width:\s*100%[^}]*height:\s*100%[^}]*opacity:\s*\.001/s);
assert.doesNotMatch(iosBlock, /\.date-field-control\s*\{[^}]*(?:display:\s*none|visibility:\s*hidden|pointer-events:\s*none)/s);
assert.doesNotMatch(iosBlock, /\.date-field-control\s*\{[^}]*(?:-webkit-)?appearance:\s*none/s);
assert.doesNotMatch(components, /\.date-field-control\s*\{[^}]*(?:-webkit-)?appearance:\s*none/s);

const delegatedSync = app.match(/event\.target\.matches\('\.date-field-control'\)[\s\S]{0,120}?syncDateFieldDisplay\(event\.target\)/g) || [];
assert.equal(delegatedSync.length, 2, 'Both input and change delegation must synchronize the visible date');
assert.match(app, /import \{ syncDateFieldDisplay \} from '\.\/components\/date-field\.js'/);

for (const fixture of [quickFixture, mobileFixture]) {
  assert.match(fixture, /syncDateFieldDisplay/);
  assert.match(fixture, /\['input', 'change'\]/);
}
assert.match(quickFixture, /new FormData\(form\)\.get\(input\.name\)/);
assert.match(quickFixture, /documentElement\.scrollWidth <= window\.innerWidth \+ 1/);
assert.match(quickFixture, /shell\.scrollWidth <= shell\.clientWidth \+ 1/);
assert.match(quickFixture, /frame\.scrollWidth <= frame\.clientWidth \+ 1/);
assert.match(quickFixture, /dataset\.dateInputLeft/);
assert.match(quickFixture, /dataset\.dateInputRight/);

console.log('iOS controlled date field tests passed');
