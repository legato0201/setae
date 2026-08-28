const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const searchPath = path.join(root, 'assets/app/features/collection/search.js');
const appSource = fs.readFileSync(path.join(root, 'assets/app/app.js'), 'utf8');
const viewSource = fs.readFileSync(path.join(root, 'assets/app/features/collection/view.js'), 'utf8');
const searchSource = fs.readFileSync(searchPath, 'utf8');
const workspaceSource = fs.readFileSync(path.join(root, 'assets/app/features/collection/workspace-controller.js'), 'utf8');

const sandbox = { module: { exports: {} } };
vm.runInNewContext(
  `${searchSource.replace(/\bexport\s+(?=(?:const|function|class)\b)/g, '')}\nmodule.exports = { createCollectionSearchController, clearCollectionSearchInput };`,
  sandbox
);

const commits = [];
const controller = sandbox.module.exports.createCollectionSearchController((value) => commits.push(value));
const inputNode = { value: '' };
const inputBefore = inputNode;

controller.compositionStart();
['セ', 'セラ', 'セラド'].forEach((value) => {
  inputNode.value = value;
  assert.equal(controller.input(inputNode.value, { isComposing: true }), false);
});
assert.deepEqual(commits, [], 'IME composition must not update results mid-conversion.');

inputNode.value = 'セラドニア';
controller.compositionEnd(inputNode.value);
controller.input(inputNode.value, { isComposing: false });
assert.deepEqual(commits, ['セラドニア']);
assert.strictEqual(inputNode, inputBefore, 'The search input node must remain the same object.');

assert.equal(controller.reset(), true, 'Explicit clear resets the search commit and IME state.');
assert.equal(commits.at(-1), '');
assert.equal(controller.input('セラドニア'), true, 'The same query must commit again after clear.');
assert.equal(commits.at(-1), 'セラドニア');
controller.compositionStart();
assert.equal(controller.isComposing(), true);
controller.reset();
assert.equal(controller.isComposing(), false, 'Clear must not leave the controller stuck in composition.');
assert.equal(controller.input('セラドニア'), true);
assert.deepEqual(commits.slice(-4), ['', 'セラドニア', '', 'セラドニア']);

const historyCommits = [];
const historyController = sandbox.module.exports.createCollectionSearchController((value) => historyCommits.push(value));
assert.equal(historyController.input('セラドニア'), true);
historyController.compositionStart();
assert.equal(historyController.isComposing(), true);
historyController.adopt('ブラキペルマ');
assert.deepEqual(historyCommits, ['セラドニア'], 'Adopting a restored query must not commit or trigger a results update.');
assert.equal(historyController.isComposing(), false, 'History restoration clears stale IME composition state.');
assert.equal(historyController.input('ブラキペルマ'), false, 'A restored value becomes the duplicate-input baseline.');
assert.equal(historyController.compositionEnd('ブラキペルマ'), false, 'A trailing composition event must not recommit the restored value.');
assert.equal(historyController.input('セラドニア'), true, 'An earlier different query must commit again after history restoration.');
assert.deepEqual(historyCommits, ['セラドニア', 'セラドニア']);
historyController.compositionStart();
historyController.adopt();
assert.equal(historyController.isComposing(), false);
assert.deepEqual(historyCommits, ['セラドニア', 'セラドニア'], 'Adopting an empty history value must not commit.');
assert.equal(historyController.input(''), false, 'The default adopted value is the empty query.');
assert.equal(historyController.input('セラドニア'), true, 'Typing a previous query after empty history restoration must update results.');
assert.deepEqual(historyCommits, ['セラドニア', 'セラドニア', 'セラドニア']);

const clearCommits = [];
const focusCalls = [];
const clearInput = {
  value: 'LOCAL-002',
  focus(options) { focusCalls.push({ ...options }); }
};
const clearRoot = {
  querySelector(selector) {
    assert.equal(selector, '[data-role="animal-search"]');
    return clearInput;
  }
};
const clearController = sandbox.module.exports.createCollectionSearchController((value) => {
  clearCommits.push(value);
  if (value === '') assert.equal(clearInput.value, '', 'Reset must observe the cleared input.');
});
clearController.input(clearInput.value);
clearController.compositionStart();
sandbox.module.exports.clearCollectionSearchInput(clearRoot, clearController);
assert.equal(clearInput.value, '', 'The production clear helper clears the existing input.');
assert.equal(clearController.isComposing(), false, 'The helper clears pending IME state.');
assert.deepEqual(clearCommits, ['LOCAL-002', '']);
assert.deepEqual(focusCalls, [{ preventScroll: true }], 'Clear returns focus without scrolling.');
assert.strictEqual(clearRoot.querySelector('[data-role="animal-search"]'), clearInput);
assert.equal(clearController.input('LOCAL-002'), true, 'The identical query commits again after the helper clears it.');
assert.deepEqual(clearCommits, ['LOCAL-002', '', 'LOCAL-002']);
sandbox.module.exports.clearCollectionSearchInput({ querySelector: () => null }, clearController);
assert.equal(clearCommits.at(-1), '', 'Missing input still resets the controller safely.');
assert.equal(focusCalls.length, 1, 'Missing input does not attempt focus.');

const updateWrapper = appSource.match(/function updateCollectionSearch\(value\)\s*\{[\s\S]*?\n}/)?.[0] || '';
const updateBody = workspaceSource.match(/function updateSearch\(value\)\s*\{[\s\S]*?\n  }/)?.[0] || '';
assert.match(appSource, /import\s*\{\s*createCollectionWorkspaceController\s*\}\s*from '\.\/features\/collection\/workspace-controller\.js'/);
const workspaceWiring = appSource.match(/const collectionWorkspace = createCollectionWorkspaceController\(\{[\s\S]*?\}\);/)?.[0] || '';
assert.match(workspaceWiring, /appRoot:\s*app/);
assert.match(workspaceWiring, /getState:\s*\(\) => state/);
assert.match(workspaceWiring, /builtInViews:\s*builtInAnimalViews/);
assert.match(workspaceWiring, /getCareTasks:\s*\(\) => currentCareModel\(\)\.tasks/);
assert.match(updateWrapper, /collectionWorkspace\.updateSearch\(value\)/);
assert.doesNotMatch(updateWrapper, /innerHTML|replaceChildren|\brender\(/, 'The app wrapper must delegate without replacing the input or app.');
assert.match(updateBody, /collection-results-body/);
assert.match(updateBody, /collection-inspector/);
assert.doesNotMatch(updateBody, /\brender\(\)/, 'Search updates must not render the whole app.');
assert.doesNotMatch(updateBody, /appRoot\.innerHTML|appRoot\.replaceChildren|animal-search.*innerHTML/, 'Search must replace only the result and inspector islands.');
assert.match(appSource, /compositionstart/);
assert.match(appSource, /compositionend/);
assert.match(appSource, /event\.isComposing/);
const routeContextBody = appSource.match(/function applyRouteContext\(route\)\s*\{[\s\S]*?\n}/)?.[0] || '';
assert.match(routeContextBody, /state\.animalSearch = context\.animalSearch;[\s\S]*collectionSearchController\.adopt\(state\.animalSearch\);\s*}/,
  'Route restoration must adopt the final restored query after applying route context.');
assert.doesNotMatch(routeContextBody, /collectionSearchController\.(?:reset|input|compositionEnd)\(/,
  'Applying history must synchronize search state without issuing a new commit.');
assert.match(viewSource, /data-role="collection-results-body"/);
assert.match(viewSource, /data-role="collection-result-count"/);
assert.match(viewSource, /一致する個体はありません/);

const clearAction = appSource.match(/if \(action === 'clear-collection-search'\)[\s\S]*?\n  }/)?.[0] || '';
assert.match(clearAction, /clearCollectionSearchInput\(app, collectionSearchController\)/);
assert.doesNotMatch(clearAction, /activeAnimalViewId\s*=/, 'Clearing search must not reset the saved view.');
assert.match(updateBody, /clear-collection-search/);
assert.match(updateBody, /clearSearch\.hidden = !current\.animalSearch/);

console.log('Collection search IME tests passed');
