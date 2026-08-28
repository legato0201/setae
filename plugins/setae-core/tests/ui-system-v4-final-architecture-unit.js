const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');
const exists = (relativePath) => fs.existsSync(path.join(root, relativePath));

function filesBelow(relativePath, extension = '') {
  const base = path.join(root, relativePath);
  const results = [];
  const walk = (directory) => {
    fs.readdirSync(directory, { withFileTypes: true }).forEach((entry) => {
      const absolute = path.join(directory, entry.name);
      if (entry.isDirectory()) walk(absolute);
      else if (!extension || entry.name.endsWith(extension)) results.push(absolute);
    });
  };
  walk(base);
  return results;
}

const ownershipFiles = [
  'assets/app/styles/components/media.css',
  'assets/app/styles/components/specimen-card.css',
  'assets/app/styles/components/update-notice.css',
  'assets/app/styles/components/form-safety.css',
  'assets/app/styles/components/feedback.css',
  'assets/app/styles/components/progressive-list.css',
  'assets/app/styles/components/mobile-gestures.css',
  'assets/app/styles/patterns/task-workspace.css',
  'assets/app/styles/patterns/onboarding.css',
  'assets/app/styles/screens/auth.css',
  'assets/app/styles/screens/collection-editor.css'
];
ownershipFiles.forEach((file) => assert.ok(exists(file), `Missing owned stylesheet: ${file}`));

[
  'assets/app/styles/layouts.css',
  'assets/app/styles/legacy.css',
  'assets/app/styles/compat.css',
  'assets/app/styles/compatibility.css',
  'assets/app/styles/shared-layouts.css'
].forEach((file) => assert.equal(exists(file), false, `Forbidden compatibility stylesheet exists: ${file}`));

const tokens = read('assets/app/styles/tokens.css');
assert.match(tokens, /^@layer reset, foundation, components, app-frame, patterns, screens, utilities;/);
assert.doesNotMatch(tokens.split('\n', 1)[0], /layouts(?:-base)?/);

const shell = read('includes/frontend/class-setae-app-shell.php');
assert.doesNotMatch(shell, /setae-gui-layouts|styles\/layouts\.css/);
const orderedAssets = [
  'styles/components/media.css',
  'styles/components/specimen-card.css',
  'styles/components/update-notice.css',
  'styles/components/form-safety.css',
  'styles/components/feedback.css',
  'styles/components/progressive-list.css',
  'styles/components/mobile-gestures.css',
  'styles/app-frame.css',
  'styles/patterns/task-workspace.css',
  'styles/patterns/onboarding.css',
  'styles/screens/auth.css',
  'styles/screens/collection.css',
  'styles/screens/collection-editor.css',
  'styles/screens/specimen.css',
  'styles/screens/settings.css'
];
let previousIndex = -1;
orderedAssets.forEach((asset) => {
  const index = shell.indexOf(asset);
  assert.ok(index > previousIndex, `${asset} must follow the production ownership order`);
  previousIndex = index;
});
assert.match(shell, /'setae-gui-mobile-gestures-component',[\s\S]*?array\('setae-gui-progressive-list-component'\)/);
assert.match(shell, /'setae-gui-app-frame',[\s\S]*?array\('setae-gui-mobile-gestures-component'\)/);

const appStyles = filesBelow('assets/app/styles', '.css');
const combinedStyles = appStyles.map((file) => fs.readFileSync(file, 'utf8')).join('\n');
assert.doesNotMatch(combinedStyles, /\.(?:desktop-sidebar|topbar|bottom-nav|mobile-community-button|fab-slot)\b/);

const cssLines = appStyles.reduce((total, file) => total + fs.readFileSync(file, 'utf8').split('\n').length, 0);
const cssBytes = appStyles.reduce((total, file) => total + fs.statSync(file).size, 0);
assert.ok(cssLines <= 11860, `CSS line budget exceeded: ${cssLines} > 11860`);
assert.ok(cssBytes <= 300000, `CSS byte budget exceeded: ${cssBytes} > 300000`);

const worker = read('assets/js/setae-sw.js');
assert.doesNotMatch(worker, /styles\/layouts\.css/);
assert.match(worker, /const CACHE_VERSION = '__SETAE_CACHE_VERSION__'/);
assert.match(worker, /isCodeAsset\(request, url\)[\s\S]*?networkFirstAsset\(request\)/);

filesBelow('tests/fixtures', '.html').forEach((file) => {
  assert.doesNotMatch(fs.readFileSync(file, 'utf8'), /styles\/layouts\.css/, `${path.basename(file)} still loads layouts.css`);
});

const designSystem = read('docs/design-system-v4.md');
[
  'Component ownership',
  'Pattern ownership',
  'Screen ownership',
  'App Frame ownership',
  'media.css',
  'specimen-card.css',
  'task-workspace.css',
  'auth.css',
  'collection-editor.css'
].forEach((contract) => assert.match(designSystem, new RegExp(contract.replace('.', '\\.'))));

console.log(`UI System v4 final architecture checks passed (${cssLines} CSS lines / ${cssBytes} bytes)`);
