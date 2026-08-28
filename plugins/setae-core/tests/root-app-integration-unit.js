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
assert.match(index, /Setae_App_Shell::is_app_page_request\(\)/);
assert.match(header, /Setae_App_Shell::is_app_page_request\(\)/);
assert.match(header, /if \(!\$setae_header_app_requested\):[\s\S]*?id="setae-preloader"/);
assert.match(plugin, /Version: 1\.0\.251/);
assert.match(theme, /Version: 1\.0\.14/);

console.log('Root App integration checks passed');
