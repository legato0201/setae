const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const view = fs.readFileSync(path.join(root, 'assets/app/features/qr/view.js'), 'utf8');
const css = fs.readFileSync(path.join(root, 'assets/app/styles/screens/qr.css'), 'utf8');
const stateSource = fs.readFileSync(path.join(root, 'assets/app/features/qr/state.js'), 'utf8')
  .replace(/\bexport\s+(?=(?:const|function|class)\b)/g, '');
const context = {};
vm.createContext(context);
vm.runInContext(`${stateSource}\nthis.normalizeLabelConfig = normalizeLabelConfig; this.labelDimensions = labelDimensions;`, context);

assert.match(view, /class="label-option-groups"/);
assert.equal((view.match(/class="label-option-group"/g) || []).length, 2);
assert.match(view, /<legend>印刷内容<\/legend>/);
assert.match(view, /<legend>印刷・手書き補助<\/legend>/);
['QR', '個体番号', '学名', '齢期・性別', '裁断マーク', '外枠', 'メモ中央罫線'].forEach((label) => {
  assert.match(view, new RegExp(`'${label}'`));
});
assert.match(view, /config\.output === 'a4' \? labelToggle\('cropMarks'/);
assert.match(view, /microId \? '' : labelToggle\('showScientificName'/);
assert.match(view, /microId \? '' : labelToggle\('showStageSex'/);
assert.match(view, /マイクロIDではQRと個体番号を必ず印刷します。/);
assert.match(view, /description: requiredDescription/);
assert.match(view, /refreshQrLabelPreview/);
assert.match(view, /hydrateQrCodes\(previewCanvas\)/);
assert.match(view, /ラベルプレビューを更新しました。/);
assert.doesNotMatch(view, /class="label-option-row"/);

assert.match(css, /\.label-option-grid\s*\{[^}]*repeat\(auto-fit/s);
assert.match(css, /@media \(min-width: 768px\) and \(max-width: 1199px\)[\s\S]*\.label-option-grid\s*\{\s*grid-template-columns: repeat\(2/s);
assert.match(css, /@media \(max-width: 767px\)[\s\S]*\.label-option-grid\s*\{\s*grid-template-columns: minmax\(0, 1fr\)/s);
assert.match(css, /\.label-option-toggle\s*\{[^}]*min-height: var\(--control-height\)/s);
assert.match(css, /\.label-option-toggle\s*\{\s*min-height: var\(--touch-target\)/);

const a4Micro = context.normalizeLabelConfig({ output: 'a4', format: 'micro-id', a4Size: 'standard' });
const tapeMicro = context.normalizeLabelConfig({ output: 'tape', format: 'micro-id', tapeLengthMm: 18 });
const a4Dimensions = context.labelDimensions(a4Micro);
const tapeDimensions = context.labelDimensions(tapeMicro);
assert.equal(a4Dimensions.width, 65);
assert.equal(a4Dimensions.height, 25);
assert.equal(tapeDimensions.width, 18);
assert.equal(tapeDimensions.height, 12);

console.log('QR Label Studio option architecture checks passed');
