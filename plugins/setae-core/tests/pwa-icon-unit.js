const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file));
const text = (file) => read(file).toString('utf8');
const pngSize = (file) => {
  const data = read(file);
  assert.equal(data.subarray(1, 4).toString('ascii'), 'PNG');
  return [data.readUInt32BE(16), data.readUInt32BE(20)];
};

assert.deepEqual(pngSize('assets/app/icons/setae-icon-192.png'), [192, 192]);
assert.deepEqual(pngSize('assets/app/icons/setae-icon-512.png'), [512, 512]);
assert.deepEqual(pngSize('assets/app/icons/setae-icon-maskable-512.png'), [512, 512]);
assert.deepEqual(pngSize('assets/app/icons/apple-touch-icon-180.png'), [180, 180]);
assert.deepEqual(pngSize('assets/app/icons/setae-badge-96.png'), [96, 96]);

const pwa = text('includes/class-setae-pwa.php');
const shell = text('templates/app-shell.php');
assert.match(pwa, /assets\/app\/icons\//);
assert.match(pwa, /setae-icon-192\.png/);
assert.match(pwa, /setae-icon-512\.png/);
assert.match(pwa, /setae-icon-maskable-512\.png/);
assert.doesNotMatch(pwa, /get_template_directory_uri\(\).*pwa-icon/);
assert.match(shell, /rel="manifest"/);
assert.match(shell, /rel="apple-touch-icon" sizes="180x180"/);
assert.match(shell, /mobile-web-app-capable/);
assert.match(shell, /apple-mobile-web-app-capable/);

console.log('PWA icon tests passed');
