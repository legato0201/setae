const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

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
  assert.match(normal, /role="table" aria-label="個体台帳"/);
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
  assert.match(collectionCss, /\.collection-registry-frame \{ display: block; overflow: visible; \}/);
  assert.match(collectionCss, /grid-template-areas: 'identity status' 'taxon status' 'metadata status'/);
  assert.match(collectionCss, /grid-template-areas: 'check identity status' 'check taxon status' 'check metadata status'/);
  assert.match(collectionCss, /thead \.checkbox-control \{ visibility: hidden; \}/,
    'The clipped mobile header must not contain an invisible tab stop.');
}

verifyRegistryRendering().then(() => {
  console.log('UI System v4 Collection tests passed (50-row window, 500 reachable results, retained DOM, selection, saved views, photos)');
}).catch((error) => { console.error(error); process.exitCode = 1; });
