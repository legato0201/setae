const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const pluginRoot = path.resolve(__dirname, '..');
const read = (relativePath) => fs.readFileSync(path.join(pluginRoot, relativePath), 'utf8');

const worker = read('assets/js/setae-sw.js');
const app = read('assets/app/app.js');
const updateNoticeCss = read('assets/app/styles/components/update-notice.css');
const legacyClient = read('assets/js/modules/pwa-client.js');

const installBlock = worker.slice(
  worker.indexOf("self.addEventListener('install'"),
  worker.indexOf("self.addEventListener('activate'")
);

assert.doesNotMatch(installBlock, /skipWaiting/);
assert.match(worker, /function networkFirstAsset\(request\)/);
assert.match(worker, /fetch\(request, \{ cache: 'no-cache' \}\)/);
assert.match(worker, /isCodeAsset\(request, url\)[\s\S]*?networkFirstAsset\(request\)/);
assert.match(worker, /isLongLivedAsset\(request, url\)[\s\S]*?staleWhileRevalidate\(request, APP_CACHE\)/);
assert.match(worker, /event\.data\.type === 'SKIP_WAITING'[\s\S]*?self\.skipWaiting\(\)/);

assert.match(app, /navigator\.serviceWorker\.register\(appConfig\.serviceWorkerUrl, \{[\s\S]*?scope: '\/'[\s\S]*?updateViaCache: 'none'/);
assert.match(app, /registration\.waiting[\s\S]*?offerServiceWorkerUpdate\(registration\.waiting\)/);
assert.match(app, /button\([\s\S]*?action: 'apply-app-update'/);
assert.match(app, /waitingServiceWorker\.postMessage\(\{ type: 'SKIP_WAITING' \}\)/);
assert.match(app, /controllerchange[\s\S]*?serviceWorkerReloadRequested[\s\S]*?location\.reload\(\)/);
assert.match(updateNoticeCss, /\.app-update-notice\s*\{/);
assert.doesNotMatch(worker, /styles\/layouts\.css/);

assert.match(legacyClient, /updateViaCache:\s*'none'/);
assert.doesNotMatch(legacyClient, /postMessage\(\{ type: 'SKIP_WAITING' \}\)/);

console.log('Service Worker strategy checks passed');
