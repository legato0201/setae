const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const media = read('assets/app/components/media.js');
const specimen = read('assets/app/features/specimen/view.js');
const inspector = read('assets/app/features/collection/inspector.js');
const community = read('assets/app/pages/community.js');
const progressiveCss = read('assets/app/styles/components/progressive-list.css');
const ownerCss = [
  'assets/app/styles/components/specimen-card.css',
  'assets/app/styles/components/media-grid.css',
  'assets/app/styles/components/property-list.css',
  'assets/app/styles/patterns/ledger.css',
  'assets/app/styles/screens/community.css'
].map(read).join('\n');

['loading', 'decoding', 'fetchPriority', 'width', 'height'].forEach((option) => assert.match(media, new RegExp(`\\b${option}\\b`)));
assert.match(media, /loading="\$\{resolvedLoading\}"/);
assert.match(media, /decoding="\$\{resolvedDecoding\}"/);
assert.match(media, /fetchpriority="\$\{resolvedPriority\}"/);
assert.match(media, /rootMargin:\s*'600px 0px'/);
assert.match(media, /image\.loading === 'lazy' && lazyObserver/);
assert.match(media, /image\.dataset\.mediaLoadState = 'idle'/);
assert.match(media, /showMediaFallback\(image, 'timeout'\)/);
assert.match(media, /addEventListener\?\.\('beforeprint'/);
assert.match(specimen, /loading:\s*'eager', fetchPriority:\s*'high'/);
assert.match(inspector, /loading:\s*'eager', fetchPriority:\s*'high'/);
assert.match(community, /detail-image'[\s\S]*?loading:\s*'eager'[\s\S]*?fetchPriority:\s*'high'/);
assert.match(ownerCss, /content-visibility:\s*auto/);
assert.match(ownerCss, /contain-intrinsic-size:/);
assert.match(ownerCss, /@media print[\s\S]*?content-visibility:\s*visible/);
assert.doesNotMatch(progressiveCss, /\.modal|\.sheet|qr-camera|field-label/);

console.log('UI System v4 media performance tests passed');
