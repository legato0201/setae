const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const app = fs.readFileSync(path.resolve(__dirname, '../assets/app/app.js'), 'utf8');

assert.match(app, /function consumeRequestedReturnUrl\(\)/);
assert.match(app, /currentUrl\.searchParams\.delete\('setae_return'\)/);
assert.match(app, /currentUrl\.searchParams\.delete\('setae_auth'\)/);
assert.match(app, /history\.replaceState\(\{\}, '', `\$\{currentUrl\.pathname\}\$\{currentUrl\.search\}\$\{currentUrl\.hash\}` \|\| '\/'\)/);
assert.match(app, /targetUrl\.searchParams\.delete\('setae_return'\)/);
assert.match(app, /if \(targetUrl\.href === cleanCurrentUrl\) return '';/);
assert.doesNotMatch(app, /requestedReturnUrl\(\)/);

console.log('Return URL loop regression checks passed');
