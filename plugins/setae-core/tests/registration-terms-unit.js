const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = (relative) => fs.readFileSync(path.join(root, relative), 'utf8');
const app = read('assets/app/app.js');
const auth = read('assets/app/pages/auth.js');
const legacy = read('assets/js/setae-app.js');
const shared = read('assets/js/public-registration.js');
const dialog = read('templates/public/registration-dialog.php');
const api = read('includes/api/class-setae-api-app.php');
const operations = read('includes/class-setae-app-operations.php');

assert.match(auth, /name: 'terms_accepted', value: '1'/);
assert.match(auth, /required: true/);
assert.match(auth, /target="_blank" rel="noopener noreferrer">利用規約/);
assert.match(app, /terms_accepted: data\.get\('terms_accepted'\) === '1'/);
assert.match(app, /state\.bootstrap\?\.links\?\.terms/);
assert.doesNotMatch(legacy, /action:\s*'setae_register_user'|#reg-tos-agree/);
assert.match(shared, /payload\.set\('terms_accepted', data\.get\('terms_accepted'\) \? '1' : '0'\)/);
assert.match(dialog, /name="terms_accepted" value="1" required/);
assert.match(dialog, /name="terms_version"/);
assert.match(api, /'terms_accepted'\s*=>\s*array\('required'\s*=>\s*true,\s*'type'\s*=>\s*'boolean'\)/);
assert.match(api, /'terms'\s*=>\s*Setae_App_Operations::get_terms_url\(\)/);
assert.match(operations, /terms_not_accepted/);
assert.match(operations, /_setae_terms_accepted_at/);
assert.match(operations, /_setae_terms_version/);
assert.match(operations, /_setae_terms_url/);
assert.match(operations, /const TERMS_VERSION = '2026-03-01'/);

console.log('Registration terms acceptance tests passed');
