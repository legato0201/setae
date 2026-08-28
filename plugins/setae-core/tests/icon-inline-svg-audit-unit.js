const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = (relative) => fs.readFileSync(path.join(root, relative), 'utf8');
const walk = (directory) => fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
  const file = path.join(directory, entry.name);
  return entry.isDirectory() ? walk(file) : [file];
});

const activeAppSvgFiles = walk(path.join(root, 'assets/app'))
  .filter((file) => !file.includes(`${path.sep}vendor${path.sep}`))
  .filter((file) => /\.(?:js|html)$/.test(file))
  .filter((file) => read(path.relative(root, file)).includes('<svg'))
  .map((file) => path.relative(root, file).replaceAll(path.sep, '/'))
  .sort();

assert.deepEqual(activeAppSvgFiles, [
  'assets/app/components/icons.js',
  'assets/app/features/qr/labels.js',
  'assets/app/features/specimen/view.js'
], 'Active App inline SVG must be limited to Registry icons, generated QR, and data visualization.');

assert.doesNotMatch(read('includes/frontend/class-setae-public-qr.php'), /<svg/, 'Public QR must not keep its own inline icon map.');
assert.doesNotMatch(read('templates/app-shell.php'), /<svg/, 'The active App Shell template should not bypass the Registry.');
assert.match(read('assets/app/features/qr/labels.js'), /QRコード/);
assert.match(read('assets/app/features/specimen/view.js'), /齢期の推移/);

const legacyCore = read('includes/class-setae-core.php');
assert.match(legacyCore, /if \(\$app_shell->is_enabled\(\)\)/);
assert.match(legacyCore, /else \{\s*\$plugin_public = new Setae_Dashboard/s);

const registry = read('includes/class-setae-icon-registry.php');
[
  'spider-silhouette.svg', 'spider.svg', 'scorpion.svg', 'insect.svg',
  'plant.svg', 'generic-specimen.svg', 'specimen.svg'
].forEach((file) => assert.match(registry, new RegExp(file.replace('.', '\\.'))));

console.log('Inline SVG inventory tests passed');
