const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const pluginRoot = path.resolve(__dirname, '..');
const projectRoot = path.resolve(pluginRoot, '../../..');
const themeRoot = path.join(projectRoot, 'wp-content/themes/setae-theme');

if (!fs.existsSync(themeRoot)) {
  console.log('Root App integration checks skipped: setae-theme is not installed beside the plugin.');
  process.exit(0);
}

const readPlugin = (relativePath) => fs.readFileSync(path.join(pluginRoot, relativePath), 'utf8');
const readTheme = (relativePath) => fs.readFileSync(path.join(themeRoot, relativePath), 'utf8');

const shell = readPlugin('includes/frontend/class-setae-app-shell.php');
const core = readPlugin('includes/class-setae-core.php');
const app = readPlugin('assets/app/app.js');
const plugin = readPlugin('setae-core.php');
const index = readTheme('index.php');
const header = readTheme('header.php');
const theme = readTheme('style.css');

assert.match(shell, /if \(is_front_page\(\)\)\s*\{\s*return true;\s*\}/);
assert.match(shell, /public static function app_url[\s\S]*?\$url = home_url\('\/'\)/);
assert.match(shell, /public function prepare_request[\s\S]*?DONOTCACHEPAGE[\s\S]*?nocache_headers\(\)/);
assert.match(core, /template_redirect', \$app_shell, 'prepare_request', 0/);
assert.match(core, /template_include', \$app_shell, 'select_template', 999/);
assert.match(app, /function consumeRequestedReturnUrl[\s\S]*?searchParams\.delete\('setae_return'\)[\s\S]*?targetUrl\.href === cleanCurrentUrl/);
assert.match(app, /const returnUrl = consumeRequestedReturnUrl\(\);[\s\S]*?if \(returnUrl\)[\s\S]*?location\.replace\(returnUrl\)/);
assert.match(app, /createRenderCoordinator, waitForInitialPaint/);
assert.match(app, /if \(app\.querySelector\('\[data-app-startup\]'\)\) await waitForInitialPaint\(\); else render\(\);/,
  'Server startup markup must paint while a legacy empty mount renders immediately.');
assert.equal((app.match(/await waitForInitialPaint\(\)/g) || []).length, 3,
  'Production boot has server-startup, prepared-shell, and staged-page checkpoints.');
const startupPaint = app.indexOf("if (app.querySelector('[data-app-startup]')) await waitForInitialPaint(); else render();");
const bootstrapRequest = app.indexOf('state.bootstrap = await services.app.bootstrap();');
const preparedContent = app.indexOf('const prepared = render({ prepare: true });');
const contentPaint = app.indexOf('await waitForInitialPaint();', preparedContent);
const contentCommit = app.indexOf('await commitPreparedAppContent(prepared)', contentPaint);
assert.ok(startupPaint >= 0 && startupPaint < bootstrapRequest
  && bootstrapRequest < preparedContent
  && preparedContent < contentPaint && contentPaint < contentCommit,
  'SSR paint, bootstrap/data, prepared HTML, content paint, and commit must stay ordered.');
assert.match(app, /if \(state\.loading\) return standalone\(renderBootPage\(\)\)/,
  'The legacy empty mount must still synchronously render the client boot view.');
assert.match(app, /const generation = \+\+initialRenderGeneration/);
assert.match(app, /const prepared = render\(\{ prepare: true \}\); await waitForInitialPaint\(\);[\s\S]*?commitPreparedAppContent\(prepared\)/,
  'Final HTML must be generated before the checkpoint and committed afterward.');
assert.match(app, /async function commitPreparedAppContent[\s\S]*?prepared\.mount\.commit[\s\S]*?await waitForInitialPaint\(\)[\s\S]*?prepared\.generation !== initialRenderGeneration[\s\S]*?renderCoordinator\.page\(prepared\.stagedPage, \{ force: true \}\)/,
  'Initial app chrome must paint before the guarded final page region is mounted.');
assert.match(app, /renderAppFrame\(\{ \.\.\.preparedFrame, content: renderAppPagePreparation\(\) \}\)[\s\S]*?stagedPage: content/,
  'Prepared app content must use the shared lightweight page placeholder and retain the final page HTML.');
assert.match(app, /afterPageCommit: preparedRecordsWindow \? async \(\) =>[\s\S]*?hydrateRecordsWindow[\s\S]*?nextPaint: waitForInitialPaint[\s\S]*?generation === initialRenderGeneration[\s\S]*?renderCoordinator\.accept\('page'/,
  'Cold records must append in guarded paint-sized batches and cache the complete page only after hydration.');
assert.match(app, /deferRows: Boolean\(preparedRecordsWindow\)/);
assert.match(app, /initialWindow: preparedRecordsWindow, renderedLimit: 0/);
assert.match(app, /menuTrigger\?\.focus\(\{ preventScroll: true \}\)/);
assert.match(app, /prepared\.generation !== initialRenderGeneration[\s\S]*?guard: \(\) => prepared\.generation === initialRenderGeneration/,
  'A render during the checkpoint must reject the stale initial commit.');
assert.match(app, /const committed = prepared \? await commitPreparedAppContent\(prepared\) : false;\s+if \(!committed && navigationInitialized\) return;/,
  'A stale prepared mount must not erase a newer route or skip initial history for a same-route refresh.');
assert.match(index, /Setae_App_Shell::is_app_page_request\(\)/);
assert.match(header, /Setae_App_Shell::is_app_page_request\(\)/);
assert.match(header, /if \(!\$setae_header_app_requested\):[\s\S]*?id="setae-preloader"/);
assert.match(plugin, /Version: 1\.0\.252(?:\s|$)/);
assert.match(theme, /Version: 1\.0\.14/);

console.log('Root App integration checks passed');
