const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { execFileSync } = require('node:child_process');

const pluginRoot = path.resolve(__dirname, '../..');
const driver = path.join(__dirname, 'passport-acquisition-driver.php');
const workspacePhp = path.resolve(pluginRoot, '../../../tmp/runtime-php-8.4.25/php.exe');
const php = process.env.SETAE_PHP || process.env.PHP_BINARY || process.env.PHP_BIN || (fs.existsSync(workspacePhp) ? workspacePhp : 'php');
function runProduction(input = {}) {
  const raw = execFileSync(php, [driver], { cwd: pluginRoot, encoding: 'utf8', input: JSON.stringify(input), maxBuffer: 8 * 1024 * 1024, timeout: 30000, windowsHide: true });
  const result = JSON.parse(raw);
  assert.equal(result.failure, null, 'Actual PHP fixture execution must succeed: ' + result.failure);
  return result;
}
function sourceHashes() {
  const files = [
    'includes/class-setae-core.php', 'includes/class-setae-app-operations.php', 'includes/class-setae-ajax.php',
    'includes/class-setae-claim-registration.php', 'includes/class-setae-entitlements.php', 'includes/class-setae-qr-manager.php',
    'includes/frontend/class-setae-public-qr.php', 'includes/frontend/class-setae-public-registration.php',
    'includes/frontend/class-setae-public-partner.php', 'includes/frontend/class-setae-public-home.php',
    'templates/public/registration-dialog.php', 'templates/public/passport-content.php', 'templates/public/passport-transfer-state.php',
    'templates/public/partner-content.php', 'assets/js/public-registration.js', 'assets/js/public-passport.js',
    'assets/js/public-product-events.js', 'assets/css/public-registration.css', 'assets/css/public-foundation.css',
    'tests/helpers/passport-acquisition-driver.php', 'tests/helpers/claim-registration-fixture.php', 'tests/helpers/public-passport-fixture.php'
  ];
  return Object.fromEntries(files.map((file) => [file, crypto.createHash('sha256').update(fs.readFileSync(path.join(pluginRoot, file))).digest('hex')]));
}
const requests = (state) => Object.values(state.posts).filter((post) => post.post_type === 'setae_transfer');
module.exports = { pluginRoot, runProduction, sourceHashes, requests };
