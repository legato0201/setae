const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');
const css = read('assets/app/styles/screens/collection.css');
const tokens = read('assets/app/styles/tokens.css');
const cardEditor = read('assets/app/features/collection/card-editor.js');
const cardView = read('assets/app/features/collection/card-view.js');
const fixture = read('tests/fixtures/ui-system-v4-collection-preview.html');

assert.match(tokens, /--collection-photo-card-min-width:\s*200px/);
assert.match(tokens, /--collection-photo-card-min-width-mobile:\s*160px/);
assert.match(css, /\.collection-gallery-v4\.card-grid-photo\s*\{[^}]*var\(--collection-photo-card-min-width\)[^}]*row-gap:\s*var\(--space-6\)[^}]*column-gap:\s*var\(--space-4\)/s);
assert.match(css, /\.collection-gallery-v4\s*\{[^}]*--collection-card-info-inline:\s*var\(--space-4\)[^}]*--collection-card-info-min-width:\s*280px[^}]*--collection-card-media-width:\s*112px[^}]*--collection-hybrid-card-min-width:\s*400px/s);
assert.match(css, /\.collection-gallery-v4\.card-grid-hybrid\s*\{[^}]*var\(--collection-hybrid-card-min-width\)/s);

assert.match(css, /\.collection-gallery-v4 \.animal-card\.card-mode-photo\s*\{[^}]*overflow:\s*visible[^}]*border:\s*0[^}]*border-radius:\s*0[^}]*background:\s*transparent[^}]*box-shadow:\s*none/s);
assert.match(css, /\.collection-gallery-v4 \.card-mode-photo \.animal-card-media\s*\{[^}]*aspect-ratio:\s*4\s*\/\s*3[^}]*overflow:\s*hidden[^}]*border:\s*1px solid var\(--border-default\)[^}]*border-radius:\s*var\(--radius-surface\)[^}]*background:\s*var\(--bg-subtle\)[^}]*box-shadow:\s*none/s);
assert.match(css, /\.collection-gallery-v4 \.card-mode-photo \.animal-card-content\s*\{[^}]*min-height:\s*0[^}]*padding:\s*var\(--space-3\) var\(--row-inset-compact\) 0[^}]*background:\s*transparent/s);

assert.match(css, /\.collection-gallery-v4 \.animal-card:not\(\.card-mode-photo\)\s*\{[^}]*overflow:\s*hidden[^}]*background:\s*var\(--bg-surface\)/s);
assert.match(css, /\.collection-gallery-v4 \.animal-card\.card-mode-hybrid\s*\{[^}]*grid-template-columns:\s*var\(--collection-card-media-width\) minmax\(var\(--collection-card-info-min-width\), 1fr\)/s);
assert.match(css, /\.collection-gallery-v4 \.card-mode-hybrid \.animal-card-content\s*\{[^}]*min-width:\s*var\(--collection-card-info-min-width\)[^}]*padding:\s*0/s);
assert.match(css, /\.collection-gallery-v4 \.card-mode-hybrid \.animal-card-info-section\s*\{[^}]*padding-inline:\s*var\(--collection-card-info-inline\)/s);
assert.match(css, /\.collection-gallery-v4 \.card-mode-hybrid \.animal-card-care\s*\{[^}]*grid-template-columns:\s*repeat\(3, minmax\(0, 1fr\)\)[^}]*column-gap:\s*var\(--space-3\)[^}]*margin:\s*0[^}]*padding-block:\s*var\(--space-2\)/s);
assert.match(css, /\.collection-gallery-v4 \.card-mode-hybrid \.animal-card-care > div\s*\{[^}]*padding:\s*0/s);
assert.match(css, /\.collection-gallery-v4 \.card-mode-hybrid \.animal-card-details\s*\{[^}]*margin:\s*0[^}]*padding-block:\s*var\(--space-2\)/s);
assert.match(css, /\.collection-gallery-v4 \.card-mode-hybrid \.animal-card-actions\s*\{[^}]*margin-top:\s*auto[^}]*padding-block:\s*var\(--space-1\)/s);
assert.match(css, /\.collection-gallery-v4 \.card-mode-hybrid \.animal-card-actions \.button\s*\{[^}]*min-height:\s*var\(--touch-target\)/s);
assert.match(css, /\.animal-card-media \.setae-media-frame,[\s\S]*\.animal-card-media \.setae-media-visual,[\s\S]*\.animal-card-media \.setae-media-placeholder\s*\{[^}]*width:\s*100%[^}]*overflow:\s*hidden/s);
// Image sizing/fit now share the registry and inspector rules; the gallery retains its own display rule.
assert.match(css, /\.animal-card-media img\[data-media-image\]\s*\{[^}]*width:\s*100%[^}]*height:\s*100%/s);
assert.match(css, /\.animal-card-media img\[data-media-image\]\s*\{[^}]*object-fit:\s*cover/s);
assert.match(css, /\.animal-card-media img\[data-media-image\]\s*\{[^}]*display:\s*block/s);

assert.match(css, /\.animal-card\.card-mode-photo\.is-focused::before\s*\{[^}]*content:\s*none/s);
assert.match(css, /\.animal-card\.card-mode-photo\.is-focused \.animal-card-media\s*\{[^}]*border-color:\s*var\(--border-selected\)[^}]*outline:\s*var\(--active-indicator-width\) solid var\(--border-selected\)/s);
assert.match(css, /\.animal-card\.card-mode-photo:focus-visible \.animal-card-media\s*\{[^}]*outline:\s*2px solid var\(--focus-ring\)/s);
assert.match(css, /\.animal-card\.card-mode-photo:focus-visible\s*\{[^}]*outline:\s*none/s);

assert.match(css, /@media \(max-width: 767px\)[\s\S]*\.collection-gallery-v4\.card-grid-photo\s*\{[^}]*var\(--collection-photo-card-min-width-mobile\)/s);
assert.match(css, /@media \(max-width: 767px\)[\s\S]*\.collection-gallery-v4\s*\{[^}]*--collection-card-info-inline:\s*var\(--space-3\)/s);
assert.match(css, /@media \(max-width: 767px\)[\s\S]*\.animal-card\.card-mode-hybrid\s*\{[^}]*grid-template-columns:\s*108px minmax\(0, 1fr\)/s);
assert.match(css, /@media \(max-width: 767px\)[\s\S]*\.card-mode-hybrid \.animal-card-content\s*\{[^}]*min-width:\s*0/s);
// The shared 4:3 rule applies at every width; mobile must not override it.
const mobileStart = css.indexOf('@media (max-width: 767px)');
assert.match(css.slice(0, mobileStart), /\.card-mode-photo \.animal-card-media\s*\{[^}]*aspect-ratio:\s*4\s*\/\s*3/s);
for (const [, declarations] of css.slice(mobileStart).matchAll(/\.card-mode-photo \.animal-card-media\s*\{([^}]*)\}/g)) {
  const ratio = declarations.match(/aspect-ratio:\s*([^;]+)/);
  if (ratio) assert.equal(ratio[1].replace(/\s/g, ''), '4/3');
}
assert.doesNotMatch(css, /card-mode-photo[^}]*aspect-ratio:\s*16\s*\/\s*10/);

assert.match(cardView, /card-mode-\$\{cardConfig\.mode\}/);
assert.match(cardView, /class="animal-card-info-section animal-card-identity"/);
assert.match(cardView, /class="animal-card-info-section animal-card-care"/);
assert.match(cardView, /class="animal-card-info-section animal-card-details"/);
assert.match(cardView, /class="animal-card-info-section animal-card-actions"/);
assert.match(cardEditor, /card-preview-frame collection-gallery-v4 card-grid-\$\{cardConfig\.mode\}/);
assert.match(fixture, /cardMode: \['photo', 'hybrid', 'data'\]/);
assert.match(fixture, /const detailedCard = params\.get\('details'\) === '1'/);
assert.match(fixture, /lastObservation: true, origin: true, temperature: true, humidity: true/);
assert.match(fixture, /renderAnimalCardEditor/);
assert.match(fixture, /params\.get\('editor'\) === '1'/);
assert.match(fixture, /const specimenPhoto = new URL\('\.\.\/\.\.\/assets\/images\/specimen\/spider\.svg', location\.href\)\.href/);
assert.equal(fs.existsSync(path.join(root, 'assets/app/styles/layouts.css')), false);

console.log('Collection Photo View tests passed');
