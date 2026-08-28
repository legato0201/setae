const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const source = fs.readFileSync(path.resolve(__dirname, '../assets/app/components/icons.js'), 'utf8');
const required = ['qr', 'feed', 'molt', 'star'];

required.forEach((name) => {
    assert.match(source, new RegExp(`\\n\\s*${name}:\\s*'`), `Missing required icon: ${name}`);
});
assert.match(source, /viewBox="0 0 24 24"/);
assert.match(source, /stroke-width="1\.5"/);
assert.match(source, /stroke-linecap="round"/);
assert.match(source, /stroke-linejoin="round"/);
assert.doesNotMatch(source, /<(path|circle|rect|ellipse|polygon)[^>]*\bd=(?:""|''|[^"'])/);
assert.doesNotMatch(source, /fill="(?!none)[^"]+"/);

console.log('Icon grammar tests passed');
