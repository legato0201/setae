const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const model = read('assets/app/features/diagnostics/model.js');
const exporter = read('assets/app/features/diagnostics/export.js');
const view = read('assets/app/features/diagnostics/view.js');
const shell = read('includes/frontend/class-setae-app-shell.php');

[
  'schemaVersion', 'setaeVersion', 'capturedAt', 'route', 'device', 'viewport', 'pwa',
  'serviceWorker', 'storage', 'camera', 'geometry', 'checks', 'pixelRatio',
  'orientation', 'maxTouchPoints', 'visualOffsetTop', 'keyboardOpen', 'dateFieldFrame'
].forEach((field) => assert.match(model, new RegExp(`\\b${field}\\b`)));
assert.match(model, /setae-safe-area-probe/);
assert.match(model, /replace\(\/\\d\+\/g, ':id'\)/);
assert.match(shell, /current_user_can\('manage_options'\) && \$diagnostics_mode/);
assert.match(shell, /defined\('WP_DEBUG'\) && WP_DEBUG/);
assert.doesNotMatch(shell, /\$_(?:GET|REQUEST).*diagnostic/i);
assert.match(view, /if \(!enabled\) return ''/);
assert.match(view, /refresh-diagnostics/);
assert.match(view, /copy-diagnostics/);
assert.match(view, /download-diagnostics/);

const executable = exporter
  .replace(/\bexport\s+(?=(?:async\s+)?(?:const|function|class)\b)/g, '');
const context = { Blob: class {}, URL: {} };
vm.createContext(context);
vm.runInContext(`${executable}\nthis.api = { sanitizeDiagnosticData, diagnosticJson };`, context);
const safe = context.api.sanitizeDiagnosticData({
  schemaVersion: 1,
  route: '/animal/123',
  token: 'secret',
  userId: 9,
  nested: { email: 'a@example.com', viewport: 390, imageUrl: 'https://example.test/private.jpg' },
  offlineQueue: [{ payload: { animal: 'C001' } }]
});
assert.equal(safe.schemaVersion, 1);
assert.equal(safe.nested.viewport, 390);
assert.equal('token' in safe, false);
assert.equal('userId' in safe, false);
assert.equal('email' in safe.nested, false);
assert.equal('imageUrl' in safe.nested, false);
assert.equal('offlineQueue' in safe, false);
assert.doesNotMatch(context.api.diagnosticJson(safe), /secret|C001|example\.com/);

console.log('UI System v4 diagnostics tests passed');
