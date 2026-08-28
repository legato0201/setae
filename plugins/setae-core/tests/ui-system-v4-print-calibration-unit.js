const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const raw = fs.readFileSync(path.join(root, 'assets/app/features/qr/labels.js'), 'utf8');
const source = raw
  .replace(/^import .*$/gm, '')
  .replace(/\bexport\s+(?=(?:const|function|class)\b)/g, '');
function QRCode() {
  this._oQRCode = { getModuleCount: () => 1, isDark: () => true };
}
QRCode.CorrectLevel = { M: 0 };
const context = {
  normalizeLabelConfig: (value) => value,
  labelDimensions: () => ({ width: 65, height: 25, columns: 3 }),
  labelConfigValidation: () => '',
  document: { createElement: () => ({}) },
  QRCode,
  Date,
  setTimeout() {},
  requestAnimationFrame(callback) { callback(); }
};
context.globalThis = context;
vm.createContext(context);
vm.runInContext(`${source}\nthis.api = { buildPrintCalibrationDocument };`, context);

const a4 = context.api.buildPrintCalibrationDocument({ type: 'a4', version: '1.0.244' });
assert.equal(a4.error, '');
assert.match(a4.html, /50 mm HORIZONTAL/);
assert.match(a4.html, /50 mm VERTICAL/);
assert.match(a4.html, /10 mm SCALE/);
assert.match(a4.html, /20 × 20 mm/);
assert.match(a4.html, /25 × 25 mm QR/);
assert.match(a4.html, /SETAE 1\.0\.244/);
assert.match(a4.html, /「実際のサイズ」または「100%」/);
assert.match(a4.html, /「用紙に合わせる」は使用しない/);

const tape = context.api.buildPrintCalibrationDocument({ type: 'tape', version: '1.0.244' });
assert.equal(tape.error, '');
[18, 24, 36, 50, 70].forEach((length) => {
  assert.match(tape.html, new RegExp(`${length} × 12 mm`));
  assert.match(tape.html, new RegExp(`@page tape-${length}\\{size:${length}mm 12mm`));
});
assert.match(tape.html, /MICRO ID/);

const view = fs.readFileSync(path.join(root, 'assets/app/features/qr/view.js'), 'utf8');
assert.match(view, /<summary>印刷サイズを確認<\/summary>/);
assert.match(view, /data:\s*\{ type: 'a4' \}/);
assert.match(view, /data:\s*\{ type: 'tape' \}/);

console.log('UI System v4 print calibration tests passed');
