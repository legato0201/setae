const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const source = read('assets/app/features/navigation/controller.js')
  .replace(/export\s*\{[\s\S]*?\}\s*from\s*['"][^'"]+['"];?/g, '')
  .replace(/\bexport\s+(?=(?:const|function|class)\b)/g, '');
const context = { structuredClone };
vm.createContext(context);
vm.runInContext(`${source}\nthis.exports = { createRouteState, isRouteState, sameRoute, SETAE_ROUTE_STATE };`, context);
const { createRouteState, isRouteState, sameRoute } = context.exports;

const collection = createRouteState({
  page: 'animals',
  subTab: 'animals',
  scrollY: 684,
  index: 3,
  context: {
    activeAnimalViewId: 'feeding',
    collectionSelection: { selectedId: '17', selectedIds: [], selectionMode: false }
  }
});
assert.equal(isRouteState(collection), true);
assert.equal(collection.scrollY, 684);
assert.equal(collection.context.collectionSelection.selectedId, '17');
assert.equal(collection.context.activeAnimalViewId, 'feeding');
assert.equal(sameRoute(collection, { ...collection, scrollY: 0 }), true);
assert.equal(sameRoute(collection, { ...collection, page: 'animal-detail', objectId: '17' }), false);

const app = read('assets/app/app.js');
assert.match(app, /function navigateRoute\(/);
assert.match(app, /function replaceRoute\(/);
assert.match(app, /async function restoreRoute\(/);
assert.match(app, /history\.scrollRestoration = 'manual'/);
assert.match(app, /saveCurrentRouteScroll\(\)/);
assert.match(app, /restoreRouteScroll\(route\.scrollY\)/);
assert.match(app, /openAnimal\(id, \{ history: historyMode = 'push'/);
assert.match(
  app,
  /window\.addEventListener\('popstate',[\s\S]*?requestBack\(\{ fromPopstate: true/
);
assert.match(
  app,
  /async function requestBack[\s\S]*?await restoreRoute\(poppedState\)/
);
assert.doesNotMatch(app, /previousPage/);
assert.doesNotMatch(app, /popstate[^\n]*boot\(/);

async function verifyMissingDetailRecovery() {
  const { createHarness } = require('./helpers/specimen-intake-app-harness.cjs');
  for (const navigationIndex of [0, 5]) {
    const harness = createHarness();
    harness.state.page = 'animal-detail';
    harness.state.modal = null;
    harness.state.collectionTab = 'babies';
    harness.state.error = 'Local missing detail error';
    harness.sandbox.overlayController.activePanel = null;
    harness.sandbox.navigationIndex = navigationIndex;
    const routes = [];
    let backRequests = 0;
    harness.sandbox.navigateRoute = async (page, options) => routes.push({ page, options: { ...options } });
    harness.sandbox.requestBack = async () => { backRequests += 1; };
    await harness.dispatch('click', harness.make('button', { 'data-action': 'recover-collection' }, harness.background));
    assert.deepEqual(routes, [{ page: 'animals', options: { collectionTab: 'animals', history: 'replace' } }],
      'The real app recovery delegate must request the specimen tab, independent of history depth.');
    assert.equal(harness.state.error, null, 'Explicit recovery clears the error from the failed detail request.');
    assert.equal(backRequests, 0, 'Recovery must not use history back to an unrelated origin.');
    await harness.dispatch('click', harness.make('button', { 'data-action': 'back-animals' }, harness.background));
    assert.equal(backRequests, 1, 'Ordinary specimen back behavior is unchanged.');
    assert.equal(routes.length, 1);
  }
}

verifyMissingDetailRecovery().then(() => console.log('Navigation history tests passed (including real app missing-detail recovery delegate)'))
  .catch((error) => { console.error(error); process.exitCode = 1; });
