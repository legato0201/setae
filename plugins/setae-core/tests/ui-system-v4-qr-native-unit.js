const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const raw = fs.readFileSync(path.join(root, 'assets/app/features/qr/scanner.js'), 'utf8');
const source = raw
  .replace(/^import .*$/gm, '')
  .replace(/\bexport\s+(?=(?:async\s+)?(?:const|function|class)\b)/g, '');
const context = {
  parseQrCode: (value) => String(value || '').includes('valid') ? 'valid1' : '',
  location: { origin: 'https://setae.net' },
  document: { visibilityState: 'visible', addEventListener() {}, removeEventListener() {} },
  navigator: { mediaDevices: {}, vibrate() {} },
  requestAnimationFrame: () => 1,
  cancelAnimationFrame() {},
  setTimeout(callback) { callback(); return 1; },
  URL: { createObjectURL: () => 'blob:test', revokeObjectURL: () => {} },
  Error,
  DOMException,
  Set
};
context.globalThis = context;
vm.createContext(context);
vm.runInContext(`${source}\nthis.api = { QR_CAMERA_STATES, QR_IMAGE_MESSAGES, cameraErrorPresentation, startQrCamera, stopQrCamera, decodeQrImage };`, context);
const api = context.api;

assert.deepEqual(Array.from(api.QR_CAMERA_STATES), ['idle', 'requesting', 'active', 'paused', 'denied', 'unavailable', 'busy', 'error']);
assert.equal(api.cameraErrorPresentation({ name: 'NotAllowedError' }).state, 'denied');
assert.equal(api.cameraErrorPresentation({ name: 'NotFoundError' }).state, 'unavailable');
assert.equal(api.cameraErrorPresentation({ name: 'NotReadableError' }).state, 'busy');
assert.equal(api.cameraErrorPresentation({ name: 'SecurityError' }).state, 'unavailable');
assert.equal(api.cameraErrorPresentation({ name: 'UnknownError' }).state, 'error');
assert.doesNotMatch(fs.readFileSync(path.join(root, 'assets/app/features/qr/view.js'), 'utf8'), /capture(?:=|:)/);

(async () => {
  let attempts = 0;
  let stopped = 0;
  const track = { readyState: 'live', addEventListener() {}, stop() { stopped += 1; } };
  const stream = { getTracks: () => [track], getVideoTracks: () => [track] };
  context.navigator.mediaDevices.getUserMedia = async (constraints) => {
    attempts += 1;
    if (attempts === 1) {
      assert.equal(constraints.video.width.ideal, 1280);
      throw Object.assign(new Error('retry'), { name: 'OverconstrainedError' });
    }
    assert.equal(constraints.video.facingMode, 'environment');
    return stream;
  };
  const states = [];
  const video = { readyState: 0, pause() {}, async play() {} };
  const canvas = { getContext: () => ({}) };
  await api.startQrCamera({ video, canvas, onCode() {}, onState: (state) => states.push(state) });
  assert.equal(attempts, 2, 'OverconstrainedError must retry exactly once with simple constraints');
  assert.deepEqual(states.slice(0, 2), ['requesting', 'active']);
  api.stopQrCamera();
  assert.equal(stopped, 1);

  let revoked = false;
  let draw = null;
  context.createImageBitmap = async () => { throw new Error('bitmap decode failed'); };
  context.Image = class {
    constructor() { this.width = 4000; this.height = 2000; }
    async decode() {}
  };
  context.URL = { createObjectURL: () => 'blob:image', revokeObjectURL: () => { revoked = true; } };
  context.jsQR = () => ({ data: 'https://setae.net/valid1/' });
  const imageCanvas = {
    width: 0,
    height: 0,
    getContext: () => ({ drawImage: (...args) => { draw = args; }, getImageData: () => ({ data: new Uint8ClampedArray(4) }) })
  };
  const decoded = await api.decodeQrImage({ size: 1, type: 'image/jpeg' }, imageCanvas);
  assert.equal(decoded, 'valid1');
  assert.equal(imageCanvas.width, 1400);
  assert.equal(imageCanvas.height, 700);
  assert.ok(draw);
  assert.equal(revoked, true);

  await assert.rejects(() => api.decodeQrImage({ size: 1, type: 'image/tiff' }, imageCanvas), new RegExp(api.QR_IMAGE_MESSAGES.decode.split('。')[0]));
  context.jsQR = () => null;
  await assert.rejects(() => api.decodeQrImage({ size: 1, type: 'image/png' }, imageCanvas), new RegExp(api.QR_IMAGE_MESSAGES.notFound.split('。')[0]));
  console.log('UI System v4 QR native tests passed');
})().catch((error) => { console.error(error); process.exitCode = 1; });
