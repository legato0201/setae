const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const components = read('assets/app/styles/components.css');
const workbench = read('assets/app/styles/components/workbench.css');
const combobox = read('assets/app/styles/components/combobox.css');
const collection = read('assets/app/styles/screens/collection.css');
const registryPattern = read('assets/app/styles/patterns/registry.css');
const qr = read('assets/app/styles/screens/qr.css');
const intake = read('assets/app/styles/screens/specimen-intake.css');
const specimen = read('assets/app/styles/screens/specimen.css');
const specimenPattern = read('assets/app/styles/patterns/specimen-workspace.css');
const nursery = read('assets/app/styles/screens/nursery.css');
const tokens = read('assets/app/styles/tokens.css');
const primitives = read('assets/app/components/primitives.js');
const dateFieldHelper = read('assets/app/components/date-field.js');
const fixture = read('tests/fixtures/mobile-form-integrity.html');

function productionJavaScript(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) return productionJavaScript(absolute);
    return entry.name.endsWith('.js') ? [fs.readFileSync(absolute, 'utf8')] : [];
  }).join('\n');
}

function assertBalancedCss(source, label) {
  const clean = source.replace(/\/\*[\s\S]*?\*\//g, '');
  assert.equal((clean.match(/\{/g) || []).length, (clean.match(/\}/g) || []).length, `${label} must have balanced braces`);
}

[components, collection, registryPattern, qr, intake, specimen, specimenPattern, nursery].forEach((source, index) => assertBalancedCss(source, `stylesheet ${index + 1}`));

assert.match(components, /input:not\(\[type="checkbox"\]\):not\(\[type="radio"\]\):not\(\[type="hidden"\]\)[\s\S]*?inline-size:\s*100%[\s\S]*?min-inline-size:\s*0[\s\S]*?max-inline-size:\s*100%/);
assert.match(components, /input:is\([\s\S]*?\[type="date"\][\s\S]*?\[type="time"\][\s\S]*?\[type="datetime-local"\][\s\S]*?\[type="month"\][\s\S]*?display:\s*block[\s\S]*?inline-size:\s*100%[\s\S]*?min-inline-size:\s*0/);
assert.match(components, /::-webkit-date-and-time-value\s*\{[^}]*min-inline-size:\s*0[^}]*text-align:\s*start/s);
assert.match(components, /::-webkit-datetime-edit\s*\{[^}]*min-inline-size:\s*0[^}]*padding:\s*0/s);
assert.doesNotMatch(components, /input:is\([\s\S]{0,240}\[type="date"\][\s\S]{0,400}appearance:\s*none/);
assert.match(primitives, /class="date-field-frame"/);
assert.match(primitives, /data-date-field-display/);
assert.match(primitives, /date-field-display-icon/);
assert.match(components, /\.date-field-frame\s*\{[^}]*display:\s*grid[^}]*grid-template-columns:\s*minmax\(0, 1fr\)/s);
assert.match(components, /\.date-field-control\s*\{[^}]*-webkit-min-logical-width:\s*0/s);
assert.match(components, /@supports \(-webkit-touch-callout:\s*none\)[\s\S]*?@media \(hover:\s*none\) and \(pointer:\s*coarse\)[\s\S]*?\.date-field-control[\s\S]*?position:\s*absolute[\s\S]*?opacity:\s*\.001/);
assert.match(components, /@supports \(-webkit-touch-callout:\s*none\)[\s\S]*?\.date-field-frame:focus-within/);
assert.doesNotMatch(components, /\.date-field-control\s*\{[^}]*appearance:\s*none/s);
assert.doesNotMatch(components, /\.date-field\s*\{[^}]*overflow:\s*hidden/s);
assert.doesNotMatch(dateFieldHelper, /new Date\s*\(/);

['.field', '.modal', '.modal-body', '.sheet', '.form-grid', '.form-row', '.input-suffix', '.input-with-unit', '.file-picker', 'fieldset'].forEach((selector) => {
  assert.match(components, new RegExp(selector.replace('.', '\\.') + '[\\s\\S]{0,520}min-inline-size:\\s*0'));
});
assert.match(workbench, /\.select-control\s*\{[^}]*min-inline-size:\s*0/s);
assert.match(combobox, /\.combobox-field\s*\{[^}]*min-inline-size:\s*0/s);
assert.match(combobox, /\.combobox-control\s*\{[^}]*min-inline-size:\s*0/s);
assert.match(components, /\.form-row > \*[\s\S]*?min-inline-size:\s*0/);
assert.match(components, /fieldset > \*[\s\S]*?min-inline-size:\s*0/);

assert.match(components, /@media \(max-width: 767px\)[\s\S]*?\.form-row\s*\{[^}]*grid-template-columns:\s*minmax\(0, 1fr\)/);
assert.match(tokens, /--type-mobile-input:\s*1rem/);
assert.match(components, /@media \(max-width: 767px\)[\s\S]*?font-size:\s*var\(--type-mobile-input\)/);
assert.match(components, /@layer utilities[\s\S]*?\.file-picker input\[type="file"\][\s\S]*?inline-size:\s*1px[\s\S]*?min-height:\s*1px/);
assert.match(components, /\.field-caption/);
assert.doesNotMatch(components, /\.field-label\s*\{/);
assert.equal(fs.existsSync(path.join(root, 'assets/app/styles/layouts.css')), false);

for (const source of [components, collection, specimen, specimenPattern]) {
  assert.doesNotMatch(source, /@media \((?:max|min)-width:\s*(?:719|720|759|760|1099|1100)px\)/);
}

assert.match(intake, /\.specimen-intake-grid,\s*\.specimen-intake-grid > \*\s*\{[^}]*min-inline-size:\s*0[^}]*max-inline-size:\s*100%/s,
  'The shared sizing rule must constrain both the intake grid and its children');
assert.match(intake, /\.specimen-intake-grid > \*\s*\{[^}]*min-inline-size:\s*0/);
assert.match(intake, /@media \(max-width: 767px\)[\s\S]*?\.specimen-intake-grid\.is-two-column,[\s\S]*?grid-template-columns:\s*minmax\(0, 1fr\)/);

assert.match(qr, /\.qr-history-fields > \*\s*\{[^}]*min-inline-size:\s*0/);
assert.match(qr, /\.qr-batch-row > \*\s*\{[^}]*min-inline-size:\s*0/);
assert.match(qr, /@media \(max-width: 767px\)[\s\S]*?\.qr-same-date,[\s\S]*?\.qr-batch-row\s*\{\s*grid-template-columns:\s*minmax\(0, 1fr\)/);
assert.match(components, /\.input-with-unit\s*\{[^}]*grid-template-columns:\s*minmax\(0, 1fr\) auto/);

assert.match(primitives, /export function dateField/);
for (const type of ['date', 'datetime-local', 'month', 'time']) {
  assert.match(primitives, new RegExp(`dateInputTypes = new Set\\([^)]*'${type}'`));
}

const appJavaScript = productionJavaScript(path.join(root, 'assets/app'));
assert.doesNotMatch(appJavaScript, /type=["'](?:date|time|datetime-local|month)["']/);
for (const file of [
  'assets/app/components/modals.js',
  'assets/app/features/records/record-form-view.js',
  'assets/app/features/qr/view.js',
  'assets/app/features/specimen-intake/view.js'
]) {
  assert.match(read(file), /dateField\(/, `${file} must use dateField()`);
}

for (const type of ['search', 'number', 'time', 'datetime-local', 'month']) {
  assert.match(fixture, new RegExp(`type:\\s*'${type}'|type="${type}"`), `fixture must include ${type}`);
}
for (const marker of ['textField', 'dateField', 'fileField', 'selectField', 'textareaField', 'checkboxControl', 'input-with-unit', 'form-row', 'modal(', 'sheet(', 'Typhochlaena seladonia']) {
  assert.match(fixture, new RegExp(marker.replace('(', '\\(')));
}
assert.match(fixture, /querySelectorAll\('\.date-field-frame'\)/);
assert.match(fixture, /getBoundingClientRect\(\)/);
assert.match(fixture, /dataset\.dateGeometry/);
assert.match(fixture, /syncDateFieldDisplay/);

const portraitViewports = [[320, 568], [360, 800], [375, 667], [390, 844], [430, 932]];
const landscapeViewports = [[667, 375], [844, 390], [932, 430]];
assert.equal(portraitViewports.length, 5);
assert.equal(landscapeViewports.length, 3);

assert.match(registryPattern, /\.registry-frame\s*\{[^}]*overflow:\s*auto/s);
assert.doesNotMatch(nursery, /\.baby-table-wrap\b/);
assert.match(nursery, /\.nursery-specimen-registry/);
assert.match(nursery, /@media \(max-width: 767px\)[\s\S]*?\.nursery-specimen-registry \.registry-table tbody tr[\s\S]*?grid-template-columns:\s*repeat\(2, minmax\(0, 1fr\)\)/);
assert.match(nursery, /@media \(max-width: 767px\)[\s\S]*?\.nursery-count-check[\s\S]*?grid-template-columns:\s*minmax\(0, 1fr\)/);

console.log('Mobile form integrity contract tests passed');
