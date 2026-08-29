const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');
const files = [
  'THIRD_PARTY_NOTICES.md',
  'licenses/lucide.txt',
  'licenses/jsqr.txt',
  'licenses/qrcodejs.txt',
  'licenses/chartjs.txt',
  'licenses/jspdf.txt',
  'licenses/pako.txt',
  'licenses/php-dependencies.txt'
];

files.forEach((file) => {
  assert.ok(fs.existsSync(path.join(root, file)), `Missing ${file}`);
  assert.ok(read(file).trim().length > 100, `${file} is unexpectedly empty.`);
});

assert.match(read('licenses/lucide.txt'), /ISC License/);
assert.match(read('licenses/lucide.txt'), /Feather-derived icons[\s\S]*MIT License/);
assert.match(read('licenses/jsqr.txt'), /Apache License[\s\S]*Version 2\.0/);
assert.match(read('licenses/qrcodejs.txt'), /MIT License/);
assert.match(read('licenses/chartjs.txt'), /MIT License/);
assert.match(read('licenses/jspdf.txt'), /Permission is hereby granted, free of charge/);
assert.match(read('THIRD_PARTY_NOTICES.md'), /Pako 2\.1\.0 \(MIT and Zlib\).*licenses\/pako\.txt/);
assert.match(read('licenses/pako.txt'), /MIT License[\s\S]*Vitaly Puzrin and Andrei Tuputcyn[\s\S]*Permission is hereby granted/);
assert.match(read('licenses/pako.txt'), /Zlib notice source:[\s\S]*Jean-loup Gailly and Mark Adler[\s\S]*This notice may not be removed or altered/);
assert.match(read('licenses/php-dependencies.txt'), /minishlink\/web-push[\s\S]*stripe\/stripe-php/);

const about = read('assets/app/features/settings/about.js');
const settings = read('assets/app/pages/settings.js');
const bootstrap = read('includes/api/class-setae-api-app.php');
assert.match(settings, /\{ id: 'about', label: 'アプリ情報' \}/);
assert.match(about, /オープンソースライセンス/);
assert.match(about, /画像・コンテンツのクレジットについて/);
assert.match(about, /利用規約/);
assert.match(about, /プライバシーポリシー/);
assert.match(about, /Version/);
assert.match(about, /© 2026 中野かえる商店/);
assert.match(bootstrap, /'privacy'\s*=>\s*Setae_App_Operations::get_privacy_url\(\)/);
assert.equal(fs.existsSync(path.join(root, 'templates/partials/modal-credits.php')), false, 'Obsolete credits modal must be retired.');

console.log('Third-party notice tests passed');
