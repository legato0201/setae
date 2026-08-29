const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const root = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const app = read('assets/app/app.js');
const frame = read('assets/app/components/app-frame.js');
const coordinator = read('assets/app/runtime/render-coordinator.js');
const frameCss = read('assets/app/styles/app-frame.css');

assert.match(coordinator, /export function createRenderCoordinator/);
assert.match(coordinator, /appRoot\.innerHTML = asHtml\(html\)/, 'Only the coordinator mount may replace the App root');
assert.match(coordinator, /if \(!force && current === next\)/, 'Unchanged islands must preserve DOM identity');
['mount', 'prepareMount', 'page', 'chrome', 'overlays', 'feedback', 'updateNotice', 'error', 'all', 'schedule'].forEach((api) => {
  assert.match(coordinator, new RegExp(`\\b${api}\\b`), `Render Coordinator must expose ${api}`);
});

[
  'data-app-frame',
  'data-app-rail-root',
  'data-app-mobile-bar-root',
  'data-app-page-root',
  'data-app-mobile-navigation-root',
  'data-app-overlay-root',
  'data-app-feedback-root',
  'data-app-update-root',
  'data-app-error-root',
  'data-app-sync-root'
].forEach((contract) => assert.match(frame, new RegExp(contract), `Missing App Frame root ${contract}`));

const feedbackCallback = app.slice(app.indexOf('const feedbackController'), app.indexOf('const formSafety'));
assert.match(feedbackCallback, /renderCoordinator\.feedback\(renderAppFeedback\(toastState\)\)/);
assert.doesNotMatch(feedbackCallback, /render\(\);[\s\S]*renderCoordinator\.feedback/, 'Toast must not render the page before feedback');
assert.match(app, /function renderAppIslands/);
assert.match(app, /const regions = renderAppFrameRegions\(options\)/);
assert.match(app, /renderCoordinator\.all\(regions\)/);
assert.match(app, /renderCoordinator\.accept\('page', regions\.page\)/, 'Partial list updates must reconcile the page cache without replacing the page');
assert.doesNotMatch(app, /app\.innerHTML\s*=/, 'app.js must not replace the App root');
assert.match(app, /renderCoordinator\.updateNotice\(appUpdateNotice\(\)\)/);
assert.match(app, /renderCoordinator\.error\(''\)/);
assert.match(frameCss, /\[data-app-page-root\]/);

function fakeClock() {
  let nextId = 1;
  const frames = new Map();
  const timeouts = new Map();
  const cancelledFrames = [];
  const cancelledTimeouts = [];
  const requestFrame = (callback) => { const id = nextId++; frames.set(id, callback); return id; };
  const cancelFrame = (id) => { cancelledFrames.push(id); frames.delete(id); };
  const scheduleTimeout = (callback, delay) => { const id = nextId++; timeouts.set(id, { callback, delay }); return id; };
  const cancelTimeout = (id) => { cancelledTimeouts.push(id); timeouts.delete(id); };
  const runFrame = (id) => { const callback = frames.get(id); frames.delete(id); callback(); };
  const runTimeout = (id) => { const entry = timeouts.get(id); timeouts.delete(id); entry.callback(); };
  return { frames, timeouts, cancelledFrames, cancelledTimeouts, requestFrame, cancelFrame, scheduleTimeout, cancelTimeout, runFrame, runTimeout };
}

function fakeAppRoot() {
  const selectors = {
    '[data-app-rail-root]': 'rail',
    '[data-app-mobile-bar-root]': 'mobileBar',
    '[data-app-page-root]': 'page',
    '[data-app-mobile-navigation-root]': 'mobileNavigation',
    '[data-app-overlay-root]': 'overlays',
    '[data-app-feedback-root]': 'feedback',
    '[data-app-update-root]': 'updateNotice',
    '[data-app-error-root]': 'error',
    '[data-app-sync-root]': 'sync'
  };
  const elements = new Map();
  let html = '';
  let queryCount = 0;
  const appRoot = {
    get innerHTML() { return html; },
    set innerHTML(value) {
      html = String(value);
      elements.clear();
      Object.entries(selectors).forEach(([selector, name]) => {
        const match = html.match(new RegExp(`<[^>]+${selector.slice(1, -1)}[^>]*>([\\s\\S]*?)<\\/[^>]+>`));
        if (match) elements.set(name, { innerHTML: match[1] });
      });
    },
    querySelector(selector) {
      queryCount += 1;
      return elements.get(selectors[selector]) || null;
    },
    queryCount: () => queryCount,
    element: (name) => elements.get(name)
  };
  return appRoot;
}

async function verifyPreparedMounts() {
  const { createRenderCoordinator, waitForInitialPaint } = await import(pathToFileURL(path.join(root, 'assets/app/runtime/render-coordinator.js')).href);
  const appRoot = { innerHTML: 'legacy mount', querySelector: () => null };
  const instance = createRenderCoordinator(appRoot);
  instance.mount('immediate', { view: 'legacy' });
  assert.equal(appRoot.innerHTML, 'immediate', 'Existing mounts remain synchronous.');

  const mutable = { value: 'prepared', toString() { return this.value; } };
  const stale = instance.prepareMount(mutable, { view: 'stale' });
  mutable.value = 'changed later';
  const current = instance.prepareMount('current', { view: 'current' });
  assert.equal(stale.html, 'prepared', 'Prepared HTML is fixed before the paint checkpoint.');
  assert.equal(stale.commit(), false, 'A newer generation invalidates an older prepared mount.');
  assert.equal(current.commit(), true);
  assert.equal(current.commit(), false, 'A prepared mount commits at most once.');
  assert.equal(appRoot.innerHTML, 'current');
  assert.equal(instance.mode, 'current');
  const guarded = instance.prepareMount('guarded');
  assert.equal(guarded.commit({ guard: () => false }), false);
  assert.equal(guarded.commit(), false, 'A rejected guard cannot be retried with stale HTML.');
  const superseded = instance.prepareMount('waiting');
  instance.mount('newer synchronous render', { view: 'newer' });
  assert.equal(superseded.commit(), false, 'A synchronous render invalidates HTML waiting at the checkpoint.');
  assert.equal(appRoot.innerHTML, 'newer synchronous render');

  const cacheClock = fakeClock();
  const cacheRoot = fakeAppRoot();
  const cacheInstance = createRenderCoordinator(cacheRoot, { requestFrame: cacheClock.requestFrame });
  const preparedCache = cacheInstance.prepareMount('<main data-app-page-root>prepared</main>', { view: 'app' });
  assert.equal(preparedCache.commit(), true);
  assert.match(cacheRoot.innerHTML, />prepared</, 'Prepared content commits to the DOM immediately.');
  assert.equal(cacheClock.frames.size, 1, 'Prepared cache population waits for the next frame.');
  assert.equal(cacheInstance.page('prepared'), false, 'A same-value update reads the live DOM before cache population.');
  assert.equal(cacheInstance.page('changed'), true, 'A changed update remains synchronous before cache population.');
  assert.equal(cacheRoot.element('page').innerHTML, 'changed');
  cacheClock.runFrame([...cacheClock.frames.keys()][0]);
  assert.equal(cacheInstance.page('changed'), false, 'The deferred cache records the latest island value.');

  const staleCache = cacheInstance.prepareMount('<main data-app-page-root>old prepared</main>', { view: 'app' });
  assert.equal(staleCache.commit(), true);
  const staleCacheFrame = [...cacheClock.frames.keys()][0];
  cacheInstance.mount('<main data-app-page-root>replacement</main>', { view: 'app' });
  const queriesAfterReplacement = cacheRoot.queryCount();
  cacheClock.runFrame(staleCacheFrame);
  assert.equal(cacheRoot.queryCount(), queriesAfterReplacement, 'A replaced mount rejects deferred cache work from its predecessor.');
  cacheRoot.element('page').innerHTML = 'external mutation';
  assert.equal(cacheInstance.page('replacement'), false, 'The replacement mount keeps its synchronous cache.');
  assert.equal(cacheRoot.element('page').innerHTML, 'external mutation');

  const paintClock = fakeClock();
  const painted = waitForInitialPaint({ ...paintClock, timeoutMs: 500 });
  const firstFrame = [...paintClock.frames.keys()][0];
  assert.equal([...paintClock.timeouts.values()][0].delay, 100, 'Fallback stays bounded at 100ms.');
  paintClock.runFrame(firstFrame);
  const secondFrame = [...paintClock.frames.keys()][0];
  paintClock.runFrame(secondFrame);
  assert.equal(await painted, 'paint');
  assert.equal(paintClock.timeouts.size, 0);
  assert.equal(paintClock.cancelledTimeouts.length, 1, 'Paint completion cancels its timeout.');

  const timeoutClock = fakeClock();
  const timedOut = waitForInitialPaint({ ...timeoutClock });
  const timeoutFrame = [...timeoutClock.frames.keys()][0];
  timeoutClock.runTimeout([...timeoutClock.timeouts.keys()][0]);
  assert.equal(await timedOut, 'timeout');
  assert.deepEqual(timeoutClock.cancelledFrames, [timeoutFrame], 'Timeout completion cancels its pending frame.');
  assert.equal(timeoutClock.frames.size, 0);

  const secondFrameClock = fakeClock();
  const secondFrameTimeout = waitForInitialPaint({ ...secondFrameClock });
  secondFrameClock.runFrame([...secondFrameClock.frames.keys()][0]);
  const pendingSecondFrame = [...secondFrameClock.frames.keys()][0];
  secondFrameClock.runTimeout([...secondFrameClock.timeouts.keys()][0]);
  assert.equal(await secondFrameTimeout, 'timeout');
  assert.deepEqual(secondFrameClock.cancelledFrames, [pendingSecondFrame], 'Timeout completion cancels a pending second frame.');

  const unavailableClock = fakeClock();
  const unavailable = waitForInitialPaint({ ...unavailableClock, requestFrame: null });
  unavailableClock.runTimeout([...unavailableClock.timeouts.keys()][0]);
  assert.equal(await unavailable, 'timeout');

  const failedFrameClock = fakeClock();
  const failedFrame = waitForInitialPaint({ ...failedFrameClock, requestFrame: () => { throw new Error('frame unavailable'); } });
  assert.equal(await failedFrame, 'frame-error');
  assert.equal(failedFrameClock.timeouts.size, 0);
  assert.equal(failedFrameClock.cancelledTimeouts.length, 1, 'Frame failure cancels its timeout.');
}

verifyPreparedMounts().then(() => {
  console.log('UI System v4 render island tests passed');
}).catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
