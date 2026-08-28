const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const primitives = read('assets/app/components/primitives.js');
const workbench = read('assets/app/styles/components/workbench.css');
const collectionView = read('assets/app/features/collection/view.js');
const collectionCard = read('assets/app/features/collection/card-view.js');
const qrView = read('assets/app/features/qr/view.js');
const docs = read('docs/design-system-v4.md');

assert.match(primitives, /labelMode = 'visible'/);
assert.match(primitives, /labelMode === 'sr-only'/);
assert.doesNotMatch(primitives, /compact \? 'has-sr-only-label'/);
assert.doesNotMatch(workbench, /\.checkbox-control\.is-compact\s+\.checkbox-control-label/);

const collectionSelectionControls = [collectionView, collectionCard]
  .flatMap((source) => [...source.matchAll(/checkboxControl\(\{([\s\S]*?)\}\)/g)].map((match) => match[1]));
assert.equal(collectionSelectionControls.length, 3,
  'The shared responsive row, query-wide select-all, and gallery selection each have one control definition.');
collectionSelectionControls.forEach((control) => assert.match(control, /labelMode: 'sr-only'/,
  'Every Collection icon-only selection control must explicitly keep its screen-reader label.'));
assert.deepEqual(collectionSelectionControls.map((control) => control.match(/action: '([^']+)'/)[1]).sort(),
  ['toggle-collection-select-all', 'toggle-collection-selection', 'toggle-collection-selection']);
assert.match(qrView, /labelMode: 'visible'/);
assert.match(qrView, /compact: true/);
assert.match(qrView, /Settings|印刷内容/);

assert.match(docs, /Compact density never hides semantic content\./);
assert.match(docs, /Icon-only controls require an explicit screen-reader-only label contract\./);
assert.match(docs, /コンパクト密度は意味のある情報を非表示にしない。/);

console.log('Control density architecture checks passed');
