const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const stateSource = read('assets/app/features/qr/state.js').replace(/\bexport\s+(?=(?:const|function|class)\b)/g, '');
const labelSource = read('assets/app/features/qr/labels.js')
  .replace(/^import .*$/gm, '')
  .replace(/\bexport\s+(?=(?:const|function|class)\b)/g, '');
const context = {};
vm.createContext(context);
vm.runInContext(`${stateSource}\n${labelSource}\nthis.exports = { labelTapeFormatMetrics, normalizeLabelConfig, labelDimensions, labelConfigValidation, renderFieldLabel };`, context);
const {
  labelTapeFormatMetrics,
  normalizeLabelConfig,
  labelDimensions,
  labelConfigValidation,
  renderFieldLabel
} = context.exports;

[18, 24, 36, 50, 70].forEach((length) => {
  const dimensions = labelDimensions({ schemaVersion: 2, output: 'tape', tapeLengthMm: length, format: 'micro-id' });
  assert.equal(dimensions.width, length);
  assert.equal(dimensions.height, 12);
});

assert.equal(labelTapeFormatMetrics['micro-id'].digitalWidthMm, 15.6);
assert.equal(labelTapeFormatMetrics.compact.digitalWidthMm, 28);
assert.equal(labelTapeFormatMetrics.field.digitalWidthMm, 34);
assert.equal(labelTapeFormatMetrics['micro-id'].minimumLengthMm, 18);
assert.equal(labelTapeFormatMetrics.compact.minimumLengthMm, 30);
assert.equal(labelTapeFormatMetrics.field.minimumLengthMm, 36);

assert.equal(normalizeLabelConfig({ output: 'tape', size: 'compact' }).tapeLengthMm, 70);
assert.equal(normalizeLabelConfig({ output: 'tape', size: 'standard' }).tapeLengthMm, 80);
assert.equal(normalizeLabelConfig({ output: 'tape', size: 'large' }).tapeLengthMm, 90);
assert.equal(normalizeLabelConfig({ schemaVersion: 2, output: 'tape' }).tapeLengthMm, 24);
assert.match(labelConfigValidation({ schemaVersion: 2, output: 'tape', tapeLengthMm: 24, format: 'field' }), /36mm以上/);
assert.match(labelConfigValidation({ schemaVersion: 2, output: 'tape', tapeLengthMm: 24, format: 'compact' }), /30mm以上/);
assert.equal(labelConfigValidation({ schemaVersion: 2, output: 'tape', tapeLengthMm: 18, format: 'micro-id' }), '');
assert.equal(labelConfigValidation({ schemaVersion: 2, output: 'tape', tapeLengthMm: 36, format: 'field' }), '');

const item = {
  manage_code: 'B001',
  species_name: 'Typhochlaena seladonia',
  instar: 2,
  gender: 'female',
  url: 'https://setae.net/k7mp3x/'
};
const html = renderFieldLabel(item, {
  schemaVersion: 2,
  output: 'tape',
  tapeLengthMm: 18,
  format: 'micro-id',
  handwriting: 'none',
  showScientificName: true,
  showStageSex: true,
  guideLine: true,
  cropMarks: true
}, { qrSvg: '<svg data-test-qr></svg>' });
assert.match(html, /format-micro-id/);
assert.match(html, /has-guide-line/);
assert.match(html, /data-test-qr/);
assert.match(html, />B001</);
assert.match(html, /field-label-digital/);
assert.match(html, /field-label-notes/);
assert.doesNotMatch(html, /Typhochlaena|seladonia|I2|♀|FIELD NOTES|has-crop-marks/);

const noGuideHtml = renderFieldLabel(item, {
  schemaVersion: 2,
  output: 'tape',
  tapeLengthMm: 70,
  format: 'micro-id',
  handwriting: 'none',
  guideLine: false
}, { qrSvg: '<svg data-test-qr></svg>' });
assert.match(noGuideHtml, /field-label-notes/);
assert.doesNotMatch(noGuideHtml, /has-guide-line/);

const previewCss = read('assets/app/styles/screens/qr.css');
[
  ['field', '34mm'],
  ['compact', '28mm'],
  ['micro-id', '15.6mm']
].forEach(([format, width]) => {
  const selector = `.field-label.output-tape.format-${format}`;
  assert.match(previewCss, new RegExp(`${selector.replaceAll('.', '\\\.')}\\s*\\{[^}]*--digital-width:\\s*${width}`));
  assert.ok(labelSource.includes(`${selector}{--digital-width:${width}}`), `Print CSS is missing fixed ${format} width`);
});

['.field-label.format-micro-id .field-label-qr', '.field-label.format-micro-id .field-label-identity', '.field-label.format-micro-id .field-label-identity strong'].forEach((selector) => {
  assert.ok(previewCss.includes(selector), `Preview CSS is missing ${selector}`);
  assert.ok(labelSource.includes(selector), `Print CSS is missing ${selector}`);
});
assert.match(previewCss, /grid-template-columns:\s*var\(--digital-width\)\s+minmax\(0,\s*1fr\)/);
assert.match(labelSource, /grid-template-columns:var\(--digital-width\) minmax\(0,1fr\)/);
assert.doesNotMatch(previewCss, /\.field-label\.output-tape\s*\{[^}]*%/);
assert.doesNotMatch(labelSource, /\.field-label\.output-tape\{[^}]*%/);
assert.doesNotMatch(previewCss, /\.field-label\.output-tape\.format-micro-id \.field-label-digital\s*\{[^}]*minmax\(0,\s*1fr\)/);
assert.doesNotMatch(labelSource, /\.field-label\.output-tape\.format-micro-id \.field-label-digital\{[^}]*minmax\(0,1fr\)/);
assert.doesNotMatch(previewCss, /\.field-label\.output-tape\.format-micro-id \.field-label-digital\s*\{[^}]*width:\s*100%/);
assert.doesNotMatch(labelSource, /\.field-label\.output-tape\.format-micro-id \.field-label-digital\{[^}]*width:100%/);

assert.match(previewCss, /transform:\s*rotate\(-90deg\)/);
assert.match(labelSource, /transform:rotate\(-90deg\)/);
assert.match(previewCss, /field-label-identity strong\s*\{[^}]*left:\s*-1mm/);
assert.match(labelSource, /field-label-identity strong\{[^}]*left:-1mm/);
assert.match(previewCss, /grid-template-columns:\s*10\.4mm 3mm/);
assert.match(labelSource, /grid-template-columns:10\.4mm 3mm/);
assert.match(previewCss, /padding:\s*\.8mm \.85mm \.8mm \.8mm/);
assert.match(labelSource, /padding:\.8mm \.85mm \.8mm \.8mm/);
assert.match(previewCss, /border-right:\s*\.15mm dashed/);
assert.match(labelSource, /border-right:\.15mm dashed/);
assert.doesNotMatch(previewCss, /format-micro-id[^}]*border-right:\s*0/);
assert.doesNotMatch(labelSource, /format-micro-id[^}]*border-right:0/);
assert.match(previewCss, /has-guide-line \.field-label-notes::after\s*\{[^}]*top:\s*50%/);
assert.match(labelSource, /has-guide-line \.field-label-notes:after\{[^}]*top:50%/);
assert.doesNotMatch(previewCss, /bottom:\s*35%/);
assert.doesNotMatch(labelSource, /bottom:35%|FIELD NOTES/);

console.log('QR Label Studio tests passed');
