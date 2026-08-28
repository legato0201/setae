const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');
const primitiveSource = read('assets/app/components/primitives.js');
const componentCss = read('assets/app/styles/components.css');
const specimenCss = read('assets/app/styles/screens/specimen.css');
const specimenView = read('assets/app/features/specimen/view.js');
const app = read('assets/app/app.js');

const executableSource = primitiveSource
  .replace(/^import .*$/gm, '')
  .replace(/\bexport\s+(?=(?:const|function|class)\b)/g, '');
const context = {
  icon: () => '',
  escapeHtml: (value) => String(value ?? '').replace(/[&<>"']/g, ''),
  safeHttpUrl: (value) => String(value || '')
};
vm.createContext(context);
vm.runInContext(`${executableSource}\nthis.testExports = { tabs, nextTabIndex };`, context);

const { tabs, nextTabIndex } = context.testExports;
const items = [
  { id: 'overview', label: '概要' },
  { id: 'timeline', label: '生活史' },
  { id: 'growth', label: '成長' },
  { id: 'photos', label: '写真' },
  { id: 'breeding', label: '繁殖' }
];

function buttonAttributes(html) {
  return [...html.matchAll(/<button\b([^>]*)>/g)].map((match) => match[1]);
}

items.forEach((item) => {
  const html = tabs(items, {
    activeId: item.id,
    action: 'specimen-tab',
    dataKey: 'tab',
    label: '個体ワークスペース'
  });
  const buttons = buttonAttributes(html);
  assert.match(html, /role="tablist"/);
  assert.equal(buttons.length, 5);
  assert.equal(buttons.filter((attributes) => /aria-selected="true"/.test(attributes)).length, 1);
  assert.equal(buttons.filter((attributes) => /class="is-active"/.test(attributes)).length, 1);
  assert.equal(buttons.filter((attributes) => /tabindex="0"/.test(attributes)).length, 1);
  assert.match(buttons.find((attributes) => /aria-selected="true"/.test(attributes)), new RegExp(`data-tab="${item.id}"`));
  assert.doesNotMatch(html, /aria-current/);
});

items.forEach((item, index) => {
  assert.equal(nextTabIndex(index, items.length, 'ArrowRight'), (index + 1) % items.length);
  assert.equal(nextTabIndex(index, items.length, 'ArrowLeft'), (index - 1 + items.length) % items.length);
  assert.match(specimenView, new RegExp(`id: '${item.id}', label: '${item.label}'`));
});

[
  /if \(tab === 'timeline'\) return renderTimeline\(context\)/,
  /if \(tab === 'growth'\) return renderGrowth\(context\)/,
  /if \(tab === 'photos'\) return renderPhotos\(context\)/,
  /if \(tab === 'breeding'\) return renderBreeding\(context\)/,
  /return renderOverview\(context\)/
].forEach((pattern) => assert.match(specimenView, pattern));

assert.match(componentCss, /\.tabs > button\.is-active::after/);
assert.match(componentCss, /\.tabs > button\[aria-selected="true"\]::after/);
assert.match(componentCss, /height:\s*var\(--active-indicator-width\)/);
assert.match(componentCss, /border-radius:\s*0/);
assert.doesNotMatch(specimenCss, /\.specimen-(?:workspace|filter)-tabs\s*>\s*button/);
assert.match(app, /\['ArrowLeft', 'ArrowRight'\]\.includes\(event\.key\)/);
assert.match(app, /nextTabIndex\(/);

const updateStart = app.indexOf('function updateSpecimenTab');
const updateEnd = app.indexOf('\nfunction escapeForApp', updateStart);
const updateSource = app.slice(updateStart, updateEnd);
assert.match(updateSource, /state\.specimenTab = normalizeSpecimenTab\(tab\)/);
assert.match(updateSource, /renderSpecimenTabNavigation\(state\.specimenTab\)/);
assert.match(updateSource, /renderSpecimenTabContent\(state\.specimenTab/);
assert.doesNotMatch(updateSource, /classList\.toggle|aria-current/);

console.log('UI Tabs tests passed');
