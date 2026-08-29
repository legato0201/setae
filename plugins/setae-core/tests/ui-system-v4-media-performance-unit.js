const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

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

async function verifyBundledAssetCache() {
  // Keep the real media/UI implementations. Only the module URL is changed
  // from Node's file: URL to the HTTPS URL a browser receives; no fetch occurs.
  const moduleUrl = 'https://fixture.test/wp-content/plugins/setae-core/assets/app/components/media.js';
  const uiUrl = pathToFileURL(path.join(root, 'assets/app/components/ui.js')).href;
  const source = media.replace("from './ui.js';", `from ${JSON.stringify(uiUrl)};`)
    .replaceAll('import.meta.url', JSON.stringify(moduleUrl));
  const { renderAnimalMedia, renderMediaFrame } = await import(`data:text/javascript,${encodeURIComponent(source)}`);
  const NativeURL = globalThis.URL;
  const saved = new Map(['URL', 'window', 'location'].map((key) => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  const calls = [];
  class ObservedURL extends NativeURL {
    constructor(input, base) {
      calls.push({ input: String(input), base });
      super(input, base);
    }
  }
  const setGlobal = (key, value) => Object.defineProperty(globalThis, key, { configurable: true, writable: true, value });
  const bundle = (file) => new NativeURL(`../../images/specimen/${file}`, moduleUrl).href;
  const spider = bundle('spider-silhouette.svg');
  const animal = { individual_code: 'C0001', species_name: 'Test species', classification: 'tarantula' };
  const options = { ratio: 'square', compact: true, code: '', scientificName: '' };
  const render = () => renderAnimalMedia(animal, options);
  const assertSources = (html, primary, fallback = '', message = '') => {
    const image = html.match(/<img class="setae-media-placeholder-icon"[^>]*>/)?.[0] || '';
    assert.equal(image.match(/\ssrc="([^"]*)"/)?.[1] || '', primary, message);
    assert.equal(image.match(/data-media-fallback-src="([^"]*)"/)?.[1] || '', fallback, message);
  };
  let config = { siteOrigin: 'https://first.fixture.test' };
  try {
    setGlobal('URL', ObservedURL);
    setGlobal('window', { SETAE_CONFIG: config });
    setGlobal('location', { origin: 'https://location.fixture.test' });
    const initial = render();
    assertSources(initial, spider);
    assert.match(initial, /data-media-fallback role="img" aria-label="標本写真は未登録です"/);
    for (let index = 1; index < 50; index += 1) assert.equal(render(), initial);
    assert.equal(calls.filter((call) => call.base === moduleUrl).length, 1,
      'Fifty identical thumbnails construct the raw bundled URL once.');
    assert.equal(calls.filter((call) => call.input === spider && call.base === config.siteOrigin).length, 50,
      'Every render still validates the cached raw URL once against the current site origin.');

    const kinds = { spider: 'spider-silhouette.svg', scorpion: 'scorpion.svg', insect: 'insect.svg',
      plant: 'plant.svg', specimen: 'specimen.svg' };
    for (const [classification, file] of Object.entries(kinds)) {
      const value = { ...animal, classification };
      assertSources(renderAnimalMedia(value, options), bundle(file));
      assertSources(renderAnimalMedia(value, options), bundle(file));
    }
    for (const classification of ['true-spider', 'arachnid', 'tarantula']) {
      assertSources(renderAnimalMedia({ ...animal, classification }, options), spider);
    }
    assertSources(renderAnimalMedia({ ...animal, classification: 'not-a-kind' }, options), bundle('specimen.svg'));
    assert.equal(calls.filter((call) => call.base === moduleUrl).length, 5,
      'Aliases and unknown classifications cannot grow the five-kind raw URL cache.');

    config.specimenAssets = { spider: '/custom-first.svg' };
    assertSources(render(), 'https://first.fixture.test/custom-first.svg', spider);
    config.specimenAssets.spider = 'http://cdn.fixture.test/custom-second.svg';
    assertSources(render(), 'http://cdn.fixture.test/custom-second.svg', spider);
    config.specimenAssets.spider = 'https://cdn.fixture.test/custom-third.svg';
    assertSources(render(), 'https://cdn.fixture.test/custom-third.svg', spider);
    delete config.specimenAssets.spider;
    assert.equal(render(), initial, 'Deleting an override restores the original markup.');
    config.specimenAssets = { spider };
    assertSources(render(), spider, '', 'An identical override must not retry itself.');
    delete config.specimenAssets;
    assert.equal(render(), initial, 'Deleting the assets configuration restores the bundled source.');

    config = { siteOrigin: 'https://second.fixture.test', specimenAssets: { spider: '/replacement.svg' } };
    window.SETAE_CONFIG = config;
    assertSources(render(), 'https://second.fixture.test/replacement.svg', spider);
    config.siteOrigin = 'https://moved.fixture.test';
    assertSources(render(), 'https://moved.fixture.test/replacement.svg', spider);
    config.siteOrigin = 'http://[';
    assertSources(render(), '', '');
    config.specimenAssets = {};
    assertSources(render(), '', '', 'An invalid base must also reject the already-cached bundled source.');
    config.siteOrigin = 'https://recovered.fixture.test';
    assert.equal(render(), initial, 'The cache must not retain a failed validation after origin recovery.');
    config.specimenAssets = { spider: '/relative.svg' };
    delete config.siteOrigin;
    assertSources(render(), 'https://location.fixture.test/relative.svg', spider);
    location.origin = 'https://new-location.fixture.test';
    assertSources(render(), 'https://new-location.fixture.test/relative.svg', spider);

    for (const unsafe of ['javascript:alert(1)', 'data:image/svg+xml,<svg/>', 'blob:https://fixture.test/id',
      'file:///tmp/specimen.svg', 'ftp://fixture.test/specimen.svg']) {
      config.specimenAssets = { spider: unsafe };
      assertSources(render(), '', '', 'A truthy rejected override retains the existing empty-icon behavior.');
      delete config.specimenAssets;
      const html = renderMediaFrame({ src: unsafe, classification: 'tarantula', compact: true });
      assert.doesNotMatch(html, /data-media-image/);
      assert.match(html, /data-media-fallback role="img"/);
      assertSources(html, spider);
    }
    for (const value of ['', false, null, 0]) {
      config.specimenAssets = { spider: value };
      assert.equal(render(), initial, 'Falsy overrides preserve the existing bundled fallback.');
    }
    delete config.specimenAssets;
    const photoAnimal = { ...animal, image_url: 'https://photos.fixture.test/animal.jpg' };
    const withPhoto = renderAnimalMedia(photoAnimal, options);
    assert.match(withPhoto, /src="https:\/\/photos\.fixture\.test\/animal\.jpg" alt="C0001" loading="lazy" decoding="async" fetchpriority="low" width="800" height="800" data-media-image/);
    assert.match(withPhoto, /data-media-fallback hidden role="img"/);
    assertSources(withPhoto, spider);
    photoAnimal.image_url = 'https://photos.fixture.test/updated.jpg';
    assert.match(renderAnimalMedia(photoAnimal, options), /src="https:\/\/photos\.fixture\.test\/updated\.jpg"/);
    photoAnimal.image_url = '';
    assert.equal(renderAnimalMedia(photoAnimal, options), initial, 'Photo updates and removal must not reuse animal HTML.');
    assert.equal(calls.filter((call) => call.base === moduleUrl).length, 5,
      'Configuration changes revalidate URLs without rebuilding immutable raw bundle URLs.');
  } finally {
    for (const [key, descriptor] of saved) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else delete globalThis[key];
    }
  }
}

verifyBundledAssetCache().then(() => {
  console.log('UI System v4 media performance tests passed (bounded raw URL cache, live configuration and safe fallback)');
}).catch((error) => { console.error(error); process.exitCode = 1; });
