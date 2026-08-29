const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { spawnSync } = require('node:child_process');

const root = path.resolve(__dirname, '..');
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');
const collectionDirectory = path.join(root, 'assets/app/features/collection');
const collectionSources = fs.readdirSync(collectionDirectory)
  .filter((name) => name.endsWith('.js'))
  .map((name) => read(`assets/app/features/collection/${name}`));

const primitives = read('assets/app/components/primitives.js');
const uiSource = read('assets/app/components/ui.js');
const appFrameSource = read('assets/app/components/app-frame.js');
const collectionPage = read('assets/app/pages/collection.js');
const collectionView = read('assets/app/features/collection/view.js');
const collectionInspector = read('assets/app/features/collection/inspector.js');
const collectionDialog = read('assets/app/features/collection/dialog.js');
const app = read('assets/app/app.js');
const shell = read('includes/frontend/class-setae-app-shell.php');
const tokens = read('assets/app/styles/tokens.css');
const appFrameCss = read('assets/app/styles/app-frame.css');
const workbenchCss = read('assets/app/styles/components/workbench.css');
const workspaceCss = read('assets/app/styles/patterns/workspace.css');
const registryCss = read('assets/app/styles/patterns/registry.css');
const collectionCss = read('assets/app/styles/screens/collection.css');

[
  'assets/app/styles/reset.css',
  'assets/app/styles/app-frame.css',
  'assets/app/styles/components/workbench.css',
  'assets/app/styles/patterns/workspace.css',
  'assets/app/styles/patterns/registry.css',
  'assets/app/styles/screens/collection.css'
].forEach((file) => assert.ok(fs.existsSync(path.join(root, file)), `Missing ${file}`));

[
  'selectControl',
  'checkboxControl',
  'navigationItem',
  'menuItem',
  'statusIndicator'
].forEach((name) => assert.match(primitives, new RegExp(`export function ${name}`)));

const rawControl = /<(?:button|input|select|textarea)\b/i;
collectionSources.forEach((source) => assert.doesNotMatch(source, rawControl, 'Collection features must render controls through primitives'));
assert.doesNotMatch(collectionPage, rawControl, 'Collection page must render controls through primitives');
assert.doesNotMatch(appFrameSource, rawControl, 'App Frame must render controls through primitives');

assert.match(collectionView, /mode = 'table'/);
assert.match(collectionView, /collection-workbench-v4/);
assert.match(collectionView, /registry-table/);
assert.match(collectionView, /renderCollectionInspector/);
assert.doesNotMatch(collectionView, /NATURAL HISTORY COLLECTION/);
assert.match(collectionInspector, /statusIndicator\(/);
assert.match(collectionDialog, /modal\(/);
assert.match(app, /setae\.gui\.v4\.collectionView'\) \|\| 'table'/);
assert.match(app, /renderAppFrame\(/);
assert.doesNotMatch(appFrameSource, /record-dock|topbar/);
assert.match(uiSource, /if \(!String\(value \|\| ''\)\.trim\(\)\) return fallback;/, 'Empty media URLs must not resolve to the site root');

assert.match(tokens, /--app-rail-width:\s*216px/);
assert.match(tokens, /--collection-inspector-width:\s*300px/);
assert.match(appFrameCss, /var\(--app-rail-width\)/);
assert.match(collectionCss, /var\(--collection-inspector-width\)/);
assert.match(collectionCss, /grid-template-columns:\s*minmax\(0, 1fr\) var\(--collection-inspector-width\)/);
assert.match(collectionCss, /\.collection-gallery-v4 \.animal-card\.is-focused::before/);
assert.match(collectionCss, /inset-block:\s*0/);
assert.match(collectionCss, /width:\s*var\(--active-indicator-width\)/);
assert.match(collectionCss, /\.animal-card\.card-mode-photo\.is-focused::before\s*\{[^}]*content:\s*none/s);
assert.match(collectionCss, /\.collection-gallery-v4 \.animal-card:focus-visible/);
assert.match(collectionCss, /@media \(min-width:\s*768px\)[\s\S]*?\.collection-registry-table tbody tr\s*\{[^}]*content-visibility:\s*auto[^}]*contain-intrinsic-size:\s*auto 61px/s);
assert.match(collectionCss, /tbody tr:is\(\.is-selected, \.is-focused, :focus-within\)[^}]*content-visibility:\s*visible[^}]*contain:\s*none/s);
assert.doesNotMatch(collectionCss, /\.animal-card\.is-focused\s*\{[^}]*border-color:\s*var\(--accent\)/s);
assert.equal(fs.existsSync(path.join(root, 'assets/app/styles/layouts.css')), false);

const v4Css = [appFrameCss, workbenchCss, workspaceCss, registryCss, collectionCss].join('\n');
assert.doesNotMatch(v4Css, /(?:margin|padding|gap)(?:-[a-z]+)?:\s*[^;]*[1-9][0-9.]*px/i, 'V4 spacing must use tokens');
assert.doesNotMatch(v4Css, /#[0-9a-f]{3,8}|rgba?\(|hsla?\(/i, 'V4 colors must use tokens');
assert.doesNotMatch(v4Css, /font-size:\s*[0-9.]+(?:px|rem|em)/i, 'V4 typography must use tokens');

const breakpoints = v4Css.split('\n')
  .filter((line) => line.includes('@media'))
  .flatMap((line) => [...line.matchAll(/(?:min|max)-width:\s*([0-9]+)px/g)].map((match) => Number(match[1])));
assert.deepEqual([...new Set(breakpoints)].sort((a, b) => a - b), [767, 768, 1199, 1200]);

[
  'setae-gui-reset',
  'setae-gui-workbench-components',
  'setae-gui-app-frame',
  'setae-gui-workspace-pattern',
  'setae-gui-registry-pattern',
  'setae-gui-collection-screen'
].forEach((handle) => assert.match(shell, new RegExp(`'${handle}'`)));

async function verifyRegistryRendering() {
  const { appendCollectionWindow, renderCollectionSearchResults } = await import(pathToFileURL(path.join(collectionDirectory, 'view.js')).href);
  const { createCollectionWindow } = await import(pathToFileURL(path.join(collectionDirectory, 'list-window.js')).href);
  const { extendListWindow, resetListWindow } = await import(pathToFileURL(path.join(root, 'assets/app/components/progressive-list.js')).href);
  const animals = Array.from({ length: 500 }, (_, index) => ({
    id: index + 1,
    individual_code: `C${String(index + 1).padStart(4, '0')}`,
    species_name: index % 3 ? 'Caribena versicolor' : 'Typhochlaena seladonia',
    gender: index % 2 ? 'female' : 'male',
    last_feed: 2,
    last_molt: 4,
    status: 'normal'
  }));
  const activeView = { id: 'all', title: 'すべて', query: {} };
  const rows = (html) => [...html.matchAll(/<tr\b[^>]*data-animal-id="([^"]+)"[^>]*>/g)];
  const options = { animals, activeView };
  assert.deepEqual(createCollectionWindow(), { initial: 50, step: 50, limit: 50, queryKey: '' });
  assert.deepEqual(createCollectionWindow({ limit: 150, queryKey: 'same-query', initial: 100, step: 100 }),
    { initial: 50, step: 50, limit: 150, queryKey: 'same-query' });
  assert.equal(createCollectionWindow(-1).limit, 50);
  assert.equal(resetListWindow(createCollectionWindow(150)).limit, 50);
  const normal = renderCollectionSearchResults(options);
  assert.equal(rows(normal).length, 50, 'Render the first window once, with no hidden duplicate list.');
  assert.deepEqual(rows(normal).map((match) => match[1]), animals.slice(0, 50).map((animal) => String(animal.id)));
  assert.equal((normal.match(/data-collection-animal\b/g) || []).length, 50);
  assert.equal((normal.match(/<table\b/g) || []).length, 1);
  assert.match(normal, /<table class="registry-table collection-registry-table" aria-label="個体台帳"/);
  assert.doesNotMatch(normal, /<(?:table|thead|tbody|tr|td)\b[^>]*\srole="(?:table|rowgroup|row|cell)"/,
    'Use the native table accessibility tree without hundreds of redundant ARIA role attributes.');
  const registryMarkup = normal.match(/<div class="registry-frame collection-registry-frame">[\s\S]*?<\/table><\/div>/)?.[0] || '';
  assert.ok(registryMarkup);
  assert.doesNotMatch(registryMarkup, />\s+</, 'Do not create inert whitespace text nodes in the 50-row table.');
  assert.doesNotMatch(normal, /registry-mobile-list|registry-mobile-row|type="checkbox"/,
    'Hidden mobile rows and inactive selection controls must not be generated.');
  assert.doesNotMatch(normal, /setae-media-placeholder-identity/,
    'The thumbnail must not generate identity markup that is never displayed.');
  assert.match(normal, /<strong>500<\/strong>匹/);
  assert.match(normal, /50 \/ 500匹を表示/);
  assert.match(normal, /data-action="show-more-collection"/);
  assert.match(normal, /aria-rowcount="501"/);
  assert.match(rows(normal)[0][0], /aria-rowindex="2"/);

  const search = renderCollectionSearchResults({ ...options, search: 'seladonia' });
  assert.equal(rows(search).length, 50, 'Search windows the DOM, not the matching dataset.');
  assert.match(search, /<strong>167<\/strong>匹/);
  assert.match(search, /50 \/ 167匹を表示/);

  const selected = renderCollectionSearchResults({ ...options,
    selection: { selectionMode: true, selectedIds: ['2', '99'], selectedId: '2' }
  });
  assert.equal((selected.match(/type="checkbox"/g) || []).length, 51,
    'Selection mode restores one checkbox per visible result plus the query-wide select-all control.');
  assert.match(rows(selected).find((match) => match[1] === '2')[0], /is-selected is-focused/);
  assert.match(rows(selected).find((match) => match[1] === '2')[0], /tabindex="0" aria-selected="true"/);
  assert.match(selected, /2匹を選択中/);
  const allSelected = renderCollectionSearchResults({ ...options,
    selection: { selectionMode: true, selectedIds: animals.map((animal) => String(animal.id)) }
  });
  assert.equal((allSelected.match(/\bchecked\b/g) || []).length, 51,
    'Select all still represents the complete filtered result set.');
  assert.match(allSelected, /条件に一致する500匹をすべて選択/);
  assert.match(allSelected, /500匹を選択中/);
  const pageSelected = renderCollectionSearchResults({ ...options,
    selection: { selectionMode: true, selectedIds: animals.slice(0, 50).map((animal) => String(animal.id)) }
  });
  assert.equal((pageSelected.match(/\bchecked\b/g) || []).length, 50,
    'Selecting only the first window must not check the query-wide select-all control.');

  // A small DOM boundary exercises the real append function without replacing its renderer.
  const fixture = (html, mode = 'table') => {
    const parseItems = (markup) => [...markup.matchAll(/<(?:tr|article)\b[^>]*data-animal-id="([^"]+)"[^>]*data-collection-animal[^>]*>/g)]
      .map((match) => ({ dataset: { animalId: match[1] }, markup: match[0], checkbox: { checked: /aria-selected="true"/.test(match[0]) } }));
    const nodes = parseItems(html);
    const appended = [];
    const items = {
      tagName: mode === 'table' ? 'TBODY' : 'DIV',
      dataset: {
        collectionTotal: html.match(/data-collection-total="([^"]+)"/)[1],
        selectionMode: html.match(/data-selection-mode="([^"]+)"/)[1]
      },
      querySelectorAll(selector) { assert.equal(selector, '[data-collection-animal]'); return nodes; },
      insertAdjacentHTML(position, markup) {
        assert.equal(position, 'beforeend');
        appended.push(markup);
        nodes.push(...parseItems(markup));
      }
    };
    const footer = { outerHTML: '' };
    const searchInput = { value: 'unchanged search', focused: true };
    return { nodes, appended, items, footer, searchInput,
      querySelector(selector) {
        return selector === '[data-role="collection-items"]' ? items
          : selector === '[data-role="collection-progressive-footer"]' ? footer : null;
      }
    };
  };

  const selectedOptions = { ...options, selection: { selectionMode: true, selectedIds: ['2', '99'], selectedId: '2' } };
  const retained = fixture(selected);
  const originalRows = [...retained.nodes];
  const originalCheckbox = retained.nodes[1].checkbox;
  let listWindow = createCollectionWindow();
  for (let count = 100; count <= animals.length; count += 50) {
    listWindow = extendListWindow(listWindow, animals.length);
    assert.equal(appendCollectionWindow(retained, { ...selectedOptions, listWindow }), true);
    assert.equal(retained.nodes.length, count);
    assert.equal(retained.nodes[0], originalRows[0], 'Append keeps existing row identity.');
    assert.equal(retained.nodes[1].checkbox, originalCheckbox, 'Append keeps checkbox identity and user state.');
    assert.equal(originalCheckbox.checked, true);
    assert.equal(retained.searchInput.value, 'unchanged search');
    assert.equal(retained.searchInput.focused, true);
  }
  assert.deepEqual(retained.nodes.map((row) => row.dataset.animalId), animals.map((animal) => String(animal.id)),
    'Every result is reachable exactly once and in original order.');
  assert.match(retained.nodes[98].markup, /is-selected/);
  assert.match(retained.nodes.at(-1).markup, /aria-rowindex="501"/);
  assert.match(retained.footer.outerHTML, /500 \/ 500匹を表示/);
  assert.doesNotMatch(retained.footer.outerHTML, /data-action="show-more-collection"/);
  assert.equal(appendCollectionWindow(retained, { ...selectedOptions, listWindow }), true);
  assert.equal(retained.nodes.length, 500, 'Repeated append must not duplicate results.');
  assert.equal(retained.appended.length, 9);

  const searched = fixture(search);
  let searchWindow = createCollectionWindow();
  for (let count = 100; count <= 200; count += 50) {
    searchWindow = extendListWindow(searchWindow, 167);
    assert.equal(appendCollectionWindow(searched, { ...options, search: 'seladonia', listWindow: searchWindow }), true);
    assert.equal(searched.nodes.length, Math.min(count, 167));
    if (count === 150) assert.match(searched.footer.outerHTML, /さらに17匹表示/);
  }
  assert.deepEqual(searched.nodes.map((row) => row.dataset.animalId), animals.filter((animal) => animal.species_name.includes('seladonia')).map((animal) => String(animal.id)));
  assert.match(searched.footer.outerHTML, /167 \/ 167匹を表示/);

  for (const changed of [
    { animals: [...animals].reverse() }, { animals: animals.slice(0, 499) }, { mode: 'gallery' },
    { selection: { selectionMode: true } }
  ]) {
    const stale = fixture(normal);
    assert.equal(appendCollectionWindow(stale, { ...options, listWindow: createCollectionWindow(100), ...changed }), false);
    assert.equal(stale.appended.length, 0, 'A stale query/DOM must fall back without a partial mutation.');
    assert.equal(stale.footer.outerHTML, '');
  }
  assert.equal(appendCollectionWindow(null, options), false);
  assert.equal(appendCollectionWindow(retained, { ...selectedOptions, listWindow: createCollectionWindow() }), false,
    'A smaller window must be rendered normally instead of leaving stale extra rows.');

  const galleryOptions = { ...options, mode: 'gallery' };
  const gallery = fixture(renderCollectionSearchResults(galleryOptions), 'gallery');
  const firstCard = gallery.nodes[0];
  assert.equal(appendCollectionWindow(gallery, { ...galleryOptions, listWindow: createCollectionWindow(100) }), true);
  assert.equal(gallery.nodes.length, 100);
  assert.equal(gallery.nodes[0], firstCard);
  assert.deepEqual(gallery.nodes.map((row) => row.dataset.animalId), animals.slice(0, 100).map((animal) => String(animal.id)));
  const selectedGallery = renderCollectionSearchResults({ ...selectedOptions, mode: 'gallery' });
  assert.equal((selectedGallery.match(/data-collection-animal\b/g) || []).length, 50);
  assert.match(selectedGallery, /data-animal-id="2" data-collection-animal tabindex="0" aria-selected="true"/);
  assert.match(selectedGallery, /data-action="toggle-collection-selection"/);

  const saved = renderCollectionSearchResults({ ...options, animals: animals.slice(0, 20),
    activeView: { id: 'females', title: 'メス', query: {
      filters: [{ field: 'gender', value: 'female' }], sort: { field: 'code', direction: 'desc' }, limit: 5
    } }
  });
  assert.deepEqual(rows(saved).map((match) => match[1]), ['20', '18', '16', '14', '12'],
    'Saved filters, sort direction, and an explicit saved-view limit stay intact.');

  const photoAnimal = { ...animals[0], image_url: 'https://fixture.test/specimen.jpg' };
  for (const mode of ['table', 'gallery']) {
    const html = renderCollectionSearchResults({ animals: [photoAnimal], mode });
    assert.match(html, /src="https:\/\/fixture\.test\/specimen\.jpg" alt="C0001"/);
    assert.match(html, /data-media-image/);
    assert.match(html, /data-media-fallback hidden/);
    assert.equal((html.match(/data-collection-animal\b/g) || []).length, 1);
  }

  const firstRegistryRow = (html) => html.match(/<tr\b(?=[^>]*data-collection-animal)[^>]*>[\s\S]*?<\/tr>/)?.[0] || '';
  const registryRowFor = (html, id) => [...html.matchAll(/<tr\b(?=[^>]*data-collection-animal)[^>]*>[\s\S]*?<\/tr>/g)]
    .map((match) => match[0]).find((row) => row.includes(`data-animal-id="${id}"`)) || '';
  let nextCacheProbeId = 9000;
  const createCacheProbe = (overrides = {}) => {
    let imageUrl = Object.prototype.hasOwnProperty.call(overrides, 'image_url')
      ? overrides.image_url
      : 'https://fixture.test/cache-primary.jpg';
    let imageReads = 0;
    const animal = {
      id: nextCacheProbeId++,
      individual_code: 'CACHE-PROBE',
      species_name: 'Cache species',
      gender: 'female',
      instar: 'L4',
      origin: 'CB',
      status: 'normal',
      last_feed: 2,
      last_molt: 4,
      image: { url: 'https://fixture.test/cache-nested.jpg' },
      thumbnail_url: 'https://fixture.test/cache-thumbnail.jpg',
      thumb: 'https://fixture.test/cache-thumb.jpg',
      classification: 'spider',
      classification_key: 'scorpion',
      species: { classification: 'insect' },
      ...overrides
    };
    delete animal.image_url;
    Object.defineProperty(animal, 'image_url', {
      configurable: true,
      enumerable: true,
      get() { imageReads += 1; return imageUrl; },
      set(value) { imageUrl = value; }
    });
    return {
      animal,
      imageReads: () => imageReads,
      resetImageReads: () => { imageReads = 0; },
      setImageUrl: (value) => { imageUrl = value; }
    };
  };
  const renderProbe = (probe, context = {}) => {
    const probeAnimals = typeof context.animals === 'function'
      ? context.animals(probe.animal)
      : [probe.animal];
    const html = renderCollectionSearchResults({
      animals: probeAnimals,
      search: context.search || '',
      activeView: context.activeView || null,
      selection: context.selection || {}
    });
    return {
      html,
      row: context.targetId
        ? registryRowFor(html, context.targetId)
        : firstRegistryRow(html)
    };
  };
  const warmProbe = (probe, context = {}) => {
    probe.resetImageReads();
    const first = renderProbe(probe, context);
    assert.ok(probe.imageReads() >= 2, 'An uncached row must render its media after reading the signature.');
    probe.resetImageReads();
    const second = renderProbe(probe, context);
    assert.equal(probe.imageReads(), 1, 'An identical row must read the media signature without regenerating media markup.');
    assert.equal(second.row, first.row, 'A cache hit must return byte-identical escaped row markup.');
    return second;
  };
  const assertProbeMiss = (probe, context, before, label, expected = null) => {
    probe.resetImageReads();
    const after = renderProbe(probe, context);
    assert.ok(probe.imageReads() >= 2, `${label} must invalidate the row and regenerate media markup.`);
    assert.notEqual(after.row, before.row, `${label} must refresh visible row markup.`);
    if (expected) assert.match(after.row, expected, `${label} must render the updated escaped value.`);
    return after;
  };

  const originalWindow = globalThis.window;
  globalThis.window = { SETAE_CONFIG: {
    siteOrigin: 'https://fixture.test/',
    specimenAssets: {
      specimen: 'https://fixture.test/specimen.svg',
      spider: 'https://fixture.test/spider.svg',
      scorpion: 'https://fixture.test/scorpion.svg',
      insect: 'https://fixture.test/insect.svg',
      plant: 'https://fixture.test/plant.svg'
    }
  } };
  const mutationCases = [
    { label: 'id mutation', mutate: (probe) => { probe.animal.id = '9100<&"'; }, expected: /data-animal-id="9100&lt;&amp;&quot;"/ },
    { label: 'code mutation', mutate: (probe) => { probe.animal.individual_code = 'CODE<&"'; }, expected: /CODE&lt;&amp;&quot;/ },
    { label: 'scientific-name mutation', mutate: (probe) => { probe.animal.species_name = 'Species <&"'; }, expected: /Species &lt;&amp;&quot;/ },
    { label: 'gender mutation', mutate: (probe) => { probe.animal.gender = 'male'; }, expected: />オス</ },
    { label: 'instar mutation', mutate: (probe) => { probe.animal.instar = 'L5<&"'; }, expected: /L5&lt;&amp;&quot;/ },
    { label: 'origin mutation', mutate: (probe) => { probe.animal.origin = 'WC<&"'; }, expected: /WC&lt;&amp;&quot;/ },
    { label: 'status mutation', mutate: (probe) => { probe.animal.status = 'fasting'; }, expected: /status-fasting/ },
    { label: 'formatted feed mutation', mutate: (probe) => { probe.animal.last_feed = 3; }, expected: /3日前/ },
    { label: 'formatted molt mutation', mutate: (probe) => { probe.animal.last_molt = 5; }, expected: /5日前/ },
    { label: 'primary image mutation', mutate: (probe) => { probe.setImageUrl('https://fixture.test/cache-primary-next.jpg'); }, expected: /cache-primary-next\.jpg/ },
    { label: 'primary image deletion', mutate: (probe) => { probe.setImageUrl(''); }, expected: /cache-nested\.jpg/ },
    { label: 'nested image URL mutation', setup: (probe) => { probe.setImageUrl(''); }, mutate: (probe) => { probe.animal.image.url = 'https://fixture.test/cache-nested-next.jpg'; }, expected: /cache-nested-next\.jpg/ },
    { label: 'thumbnail URL mutation', setup: (probe) => { probe.setImageUrl(''); probe.animal.image.url = ''; }, mutate: (probe) => { probe.animal.thumbnail_url = 'https://fixture.test/cache-thumbnail-next.jpg'; }, expected: /cache-thumbnail-next\.jpg/ },
    { label: 'thumb URL mutation', setup: (probe) => { probe.setImageUrl(''); probe.animal.image.url = ''; probe.animal.thumbnail_url = ''; }, mutate: (probe) => { probe.animal.thumb = 'https://fixture.test/cache-thumb-next.jpg'; }, expected: /cache-thumb-next\.jpg/ },
    { label: 'classification mutation', mutate: (probe) => { probe.animal.classification = 'scorpion'; }, expected: /scorpion\.svg/ },
    { label: 'classification-key mutation', setup: (probe) => { probe.animal.classification = ''; }, mutate: (probe) => { probe.animal.classification_key = 'plant'; }, expected: /plant\.svg/ },
    { label: 'nested classification mutation', setup: (probe) => { probe.animal.classification = ''; probe.animal.classification_key = ''; }, mutate: (probe) => { probe.animal.species.classification = 'plant'; }, expected: /plant\.svg/ }
  ];
  for (const testCase of mutationCases) {
    const probe = createCacheProbe();
    testCase.setup?.(probe);
    const context = {};
    const before = warmProbe(probe, context);
    testCase.mutate(probe);
    assertProbeMiss(probe, context, before, testCase.label, testCase.expected);
  }

  for (const contextCase of [
    {
      label: 'selection-mode mutation',
      before: { selection: {} },
      after: (probe) => ({ selection: { selectionMode: true }, targetId: String(probe.animal.id) }),
      expected: /data-action="toggle-collection-selection"/
    },
    {
      label: 'selected-state mutation',
      before: { selection: { selectionMode: true, selectedIds: [] } },
      after: (probe) => ({ selection: { selectionMode: true, selectedIds: [String(probe.animal.id)] }, targetId: String(probe.animal.id) }),
      expected: /class="is-selected [^"]*"[^>]*aria-selected="true"/
    },
    {
      label: 'focused-state mutation',
      before: { selection: {} },
      after: (probe) => ({ selection: { selectedId: String(probe.animal.id) }, targetId: String(probe.animal.id) }),
      expected: /is-focused[^>]*data-focused="true"/
    }
  ]) {
    const probe = createCacheProbe();
    const before = warmProbe(probe, contextCase.before);
    assertProbeMiss(probe, contextCase.after(probe), before, contextCase.label, contextCase.expected);
  }

  {
    const probe = createCacheProbe({ individual_code: 'CACHE-ORDER' });
    const other = { id: 9991, individual_code: 'OTHER-ORDER', species_name: 'Other species', status: 'normal' };
    const beforeContext = { animals: (animal) => [animal, other], targetId: String(probe.animal.id) };
    const before = warmProbe(probe, beforeContext);
    assertProbeMiss(probe, { animals: (animal) => [other, animal], targetId: String(probe.animal.id) }, before,
      'row-order mutation', /aria-rowindex="3"/);
  }
  {
    const probe = createCacheProbe({ individual_code: 'CACHE-FILTER' });
    const other = { id: 9992, individual_code: 'OTHER-FILTER', species_name: 'Other species', status: 'normal' };
    const beforeContext = { animals: (animal) => [other, animal], targetId: String(probe.animal.id) };
    const before = warmProbe(probe, beforeContext);
    assertProbeMiss(probe, { ...beforeContext, search: 'cache-filter' }, before,
      'filter row-index mutation', /aria-rowindex="2"/);
  }

  {
    const firstProbe = createCacheProbe({ id: 9993, individual_code: 'CACHE-SAME' });
    const first = warmProbe(firstProbe, { search: 'cache-same' });
    const equalProbe = createCacheProbe({ id: 9993, individual_code: 'CACHE-SAME' });
    equalProbe.resetImageReads();
    const equal = renderProbe(equalProbe, { search: 'cache-same' });
    assert.ok(equalProbe.imageReads() >= 2,
      'A different object with equal values must get its own WeakMap entry and render once.');
    assert.equal(equal.row, first.row);
    equalProbe.resetImageReads();
    const repeated = renderProbe(equalProbe, { search: 'cache-same' });
    assert.equal(equalProbe.imageReads(), 1,
      'Consecutive identical searches must reuse media and row markup for the same object.');
    assert.equal(repeated.row, equal.row);
  }

  try {
    globalThis.window = { SETAE_CONFIG: {
      siteOrigin: 'https://one.fixture.test/base/',
      specimenAssets: { spider: 'icons/spider-a.svg' },
      iconOverrides: { 'ui.check': '<svg viewBox="0 0 1 1"><path d="M0 0"/></svg>' }
    } };
    const probe = createCacheProbe({ image_url: '', classification: 'spider' });
    const context = { selection: { selectionMode: true } };
    let before = warmProbe(probe, context);
    globalThis.window.SETAE_CONFIG.siteOrigin = 'https://two.fixture.test/base/';
    before = assertProbeMiss(probe, context, before, 'site-origin mutation', /two\.fixture\.test\/base\/icons\/spider-a\.svg/);
    probe.resetImageReads();
    assert.equal(renderProbe(probe, context).row, before.row);
    assert.equal(probe.imageReads(), 1);
    globalThis.window.SETAE_CONFIG.specimenAssets.spider = 'icons/spider-b.svg';
    before = assertProbeMiss(probe, context, before, 'specimen-asset mutation', /spider-b\.svg/);
    probe.resetImageReads();
    assert.equal(renderProbe(probe, context).row, before.row);
    assert.equal(probe.imageReads(), 1);
    globalThis.window.SETAE_CONFIG.iconOverrides['ui.check'] = '<svg viewBox="0 0 1 1"><path d="M1 1"/></svg>';
    assertProbeMiss(probe, context, before, 'selection-icon mutation', /M1 1/);
  } finally {
    if (originalWindow === undefined) delete globalThis.window;
    else globalThis.window = originalWindow;
  }

  assert.match(collectionView, /const registryRowCache = new WeakMap\(\)/,
    'The row cache must be weakly keyed by the source animal object.');
  assert.match(collectionView, /sameRegistryRowSignature\(cached\.signature, signature\)\) return cached\.html;[\s\S]*renderAnimalMedia\(/,
    'The cache hit must return before media and row markup generation.');
  assert.match(collectionCss, /\.collection-registry-frame \{ display: block; overflow: visible; \}/);
  assert.match(collectionCss, /grid-template-areas: 'identity status' 'taxon status' 'metadata status'/);
  assert.match(collectionCss, /grid-template-areas: 'check identity status' 'check taxon status' 'check metadata status'/);
  assert.match(collectionCss, /thead \.checkbox-control \{ visibility: hidden; \}/,
    'The clipped mobile header must not contain an invisible tab stop.');
}

async function verifyRelativeDateBatch() {
  const { renderCollectionSearchResults } = await import(pathToFileURL(path.join(collectionDirectory, 'view.js')).href);
  const { formatRelativeDays } = await import(pathToFileURL(path.join(root, 'assets/app/components/ui.js')).href);
  const NativeDate = globalThis.Date;
  let now = new NativeDate(2026, 7, 29, 23, 59, 30).getTime();
  let clockReads = 0;
  let parsed = [];
  class TestDate extends NativeDate {
    constructor(...args) {
      super(...(args.length ? args : [now]));
      if (args.length) parsed.push(args[0]);
      else clockReads += 1;
    }
    static now() { return now; }
  }
  const legacy = (value, at = now) => {
    if (!value) return '—';
    if (typeof value === 'number') return `${value}日前`;
    const date = new NativeDate(value);
    if (Number.isNaN(date.getTime())) return String(value);
    const today = new NativeDate(at);
    const days = Math.floor((today.setHours(0, 0, 0, 0) - date.setHours(0, 0, 0, 0)) / 86400000);
    return days < 0 ? `${Math.abs(days)}日後` : days === 0 ? '今日' : `${days}日前`;
  };
  const escaped = (value) => value.replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' })[character]);
  const cells = (html) => [...html.matchAll(/<td class="registry-date registry-desktop-cell">([^<]*)<\/td>/g)].map((match) => match[1]);
  const values = [undefined, null, '', false, 0, 2, -3, 'invalid<&"', '2026-08-29',
    '2026-08-29T00:30:00+14:00', '2026-08-28T23:30:00-12:00', '2026-08-31T09:00:00',
    '2026-03-08T05:30:00Z', '2026-11-01T05:30:00Z'];
  const animal = (id, feed, molt) => ({ id, individual_code: `DATE-${id}`, species_name: 'Test species',
    last_feed: feed, last_molt: molt, status: 'normal' });
  try {
    assert.equal(new Intl.DateTimeFormat().resolvedOptions().timeZone, process.env.TZ,
      'Each child must actually use its requested timezone, not silently test the host timezone.');
    globalThis.Date = TestDate;
    // The original one-argument API and the shared baseline must retain local
    // midnight/DST, timezone offsets, future, unset, numeric and invalid inputs.
    for (const at of [now, new NativeDate(2026, 2, 9, 0, 15).getTime(), new NativeDate(2026, 10, 2, 0, 15).getTime()]) {
      now = at;
      const start = new NativeDate(now).setHours(0, 0, 0, 0);
      for (const value of values) {
        assert.equal(formatRelativeDays(value), legacy(value));
        assert.equal(formatRelativeDays(value, start), legacy(value));
      }
    }
    assert.equal(formatRelativeDays('1970-01-01T12:00:00', 0), legacy('1970-01-01T12:00:00', 0),
      'A zero timestamp must not fall back to the current date.');
    now = new NativeDate(2026, 7, 29, 23, 59, 30).getTime();
    const animals = Array.from({ length: 50 }, (_, index) => animal(index + 1,
      '2026-08-27T22:30:00Z', '2026-08-29T04:30:00+09:00'));
    const render = () => {
      clockReads = 0;
      parsed = [];
      const html = renderCollectionSearchResults({ animals });
      assert.equal(clockReads, 1, 'One render computes today once for every visible row.');
      assert.deepEqual(cells(html), animals.flatMap((item) => [item.last_feed, item.last_molt].map((value) => escaped(legacy(value)))));
      assert.equal((html.match(/data-collection-animal\b/g) || []).length, 50);
      return html;
    };
    const first = render();
    assert.deepEqual(parsed, [animals[0].last_feed, animals[0].last_molt],
      'Repeated input dates are parsed once per render, not once per animal.');
    now = new NativeDate(2026, 7, 30, 0, 0, 30).getTime();
    const nextDay = render();
    assert.notDeepEqual(cells(nextDay), cells(first), 'The same animals must show the next day after midnight.');
    animals[0].last_feed = '2026-09-05T10:00:00+09:00';
    animals[0].last_molt = 'invalid<&"';
    const changed = render();
    assert.match(cells(changed)[0], /日後$/);
    assert.equal(cells(changed)[1], 'invalid&lt;&amp;&quot;');
    assert.equal(parsed.filter((value) => value === animals[0].last_feed).length, 1);
    assert.deepEqual(cells(changed).slice(2), cells(nextDay).slice(2),
      'Mutating one animal invalidates its labels without changing the other rows.');
    const varied = values.map((value, index) => animal(index + 1, value, value));
    assert.deepEqual(cells(renderCollectionSearchResults({ animals: varied })),
      varied.flatMap((item) => [item.last_feed, item.last_molt].map((value) => escaped(legacy(value)))));
  } finally { globalThis.Date = NativeDate; }
}

const isDateChild = process.argv.includes('--relative-date-child');
const verification = isDateChild ? verifyRelativeDateBatch() : verifyRegistryRendering().then(() => {
  for (const zone of ['UTC', 'Asia/Tokyo', 'America/New_York']) {
    const result = spawnSync(process.execPath, [__filename, '--relative-date-child'], {
      env: { ...process.env, TZ: zone }, encoding: 'utf8', timeout: 60000
    });
    assert.equal(result.status, 0, `Relative-date behavior failed in ${zone}: ${result.error || ''}\n${result.stdout}\n${result.stderr}`);
  }
});
verification.then(() => {
  console.log(isDateChild ? `Relative-date render tests passed (${process.env.TZ})`
    : 'UI System v4 Collection tests passed (50-row window, 500 reachable results, retained DOM, WeakMap row cache invalidation, selection, saved views, photos, fresh date labels in 3 timezones)');
}).catch((error) => { console.error(error); process.exitCode = 1; });
