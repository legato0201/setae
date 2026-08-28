const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const cssFiles = [];
const walk = (directory) => fs.readdirSync(directory, { withFileTypes: true }).forEach((entry) => {
  const absolute = path.join(directory, entry.name);
  if (entry.isDirectory()) walk(absolute);
  else if (entry.name.endsWith('.css')) cssFiles.push(absolute);
});
walk(path.join(root, 'assets/app/styles'));

const tokens = read('assets/app/styles/tokens.css');
const foundation = read('assets/app/styles/foundation.css');
const components = read('assets/app/styles/components.css');
const registry = read('assets/app/styles/patterns/registry.css');
const frame = read('assets/app/styles/app-frame.css');
const collection = read('assets/app/styles/screens/collection.css');
const harness = read('tests/fixtures/ui-system-v4-visual-craft-harness.html');
const combined = cssFiles.map((file) => fs.readFileSync(file, 'utf8')).join('\n');

['--row-inset:', '--row-inset-compact:', '--page-gutter-mobile:', '--page-gutter-tablet:', '--page-gutter-desktop:', '--tracking-eyebrow:', '--icon-size-sm:', '--icon-size-md:', '--icon-size-lg:', '--icon-size-nav:'].forEach((token) => assert.match(tokens, new RegExp(token.replace('--', '--'))));
assert.doesNotMatch(combined, /font-weight\s*:\s*(?:650|680|740|750)\b/);
assert.match(components, /\.action-row\s*\{[^}]*padding:\s*var\(--space-3\) var\(--row-inset\)/s);
assert.match(components, /\.data-row\s*\{[^}]*padding:\s*var\(--space-2\) var\(--row-inset\)/s);
assert.match(foundation, /\.page\s*\{[^}]*var\(--page-gutter-mobile\)/s);
assert.match(foundation, /\.eyebrow,[\s\S]*letter-spacing:\s*var\(--tracking-eyebrow\)/s);
assert.match(components, /\.ui-icon\s*\{[^}]*var\(--icon-size-md\)/s);

const shadowViolations = [];
cssFiles.filter((file) => path.basename(file) !== 'tokens.css').forEach((file) => {
  const source = fs.readFileSync(file, 'utf8');
  for (const match of source.matchAll(/box-shadow\s*:\s*([^;]+);/g)) {
    const value = match[1].trim();
    if (value === 'none' || value === 'none !important' || value.includes('var(--shadow-')) continue;
    shadowViolations.push(`${path.relative(root, file)}: ${value}`);
  }
});
assert.deepEqual(shadowViolations, []);
assert.match(tokens, /--bg-selected:/);
assert.match(tokens, /--border-selected:/);
assert.match(registry, /background:\s*var\(--bg-selected\)/);
assert.match(frame, /background:\s*var\(--bg-selected\)/);
assert.match(collection, /border-color:\s*var\(--border-selected\)/);
assert.match(tokens, /--touch-target:\s*44px/);
assert.match(components, /@media \(max-width: 767px\)[\s\S]*\.button,[\s\S]*min-height:\s*var\(--touch-target\)/s);

['app-frame', 'page-header', 'buttons', 'forms', 'tabs', 'registry', 'ledger', 'photo-index', 'inspector', 'task', 'toast', 'empty', 'loading', 'error', 'modal', 'sheet', 'auth', 'update-notice'].forEach((state) => assert.match(harness, new RegExp(`['"]?${state}['"]?\\s*:`)));
assert.match(harness, /querySelectorAll\('h1'\)\.length/);
assert.match(harness, /querySelectorAll\('button button, button a, a button'\)\.length/);
assert.doesNotMatch(combined, /transform\s*:\s*scale\(/);

console.log(`UI System v4 visual rhythm checks passed (${cssFiles.length} stylesheets)`);
