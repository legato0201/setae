import { extendListWindow, resetListWindow } from '../../components/progressive-list.js';
import { appendCollectionWindow, filterCollectionAnimals, renderCollectionSearchResults } from './view.js';
import { renderCollectionInspector } from './inspector.js';
import { createCollectionWindow } from './list-window.js';
import { reconcileCollectionSelection } from './state.js';

export function createCollectionWorkspaceController({ appRoot, getState, builtInViews = [], getCareTasks = () => [] } = {}) {
  const state = () => getState();

  function activeView() {
    const current = state();
    const views = [...builtInViews, ...current.savedAnimalViews, ...(current.transientAnimalView ? [current.transientAnimalView] : [])];
    return views.find((view) => view.id === current.activeAnimalViewId) || builtInViews[0];
  }

  function queryOptions() {
    const current = state();
    return {
      animals: current.animals,
      search: current.animalSearch,
      searchIndex: current.animalSearchIndex,
      activeView: activeView(),
      careTasks: getCareTasks()
    };
  }

  function filteredAnimals() {
    return filterCollectionAnimals(queryOptions());
  }

  function currentWindow() {
    const current = state();
    const view = activeView();
    const queryKey = JSON.stringify([current.animalSearch || '', view?.id || '', view?.query || {}]);
    const previous = createCollectionWindow(current.collectionWindow);
    const next = previous.queryKey === queryKey ? previous : resetListWindow(previous);
    current.collectionWindow = { ...next, queryKey };
    return current.collectionWindow;
  }

  function renderOptions() {
    const current = state();
    return { ...queryOptions(), mode: current.animalView, selection: current.collectionSelection,
      cardConfig: current.animalCardConfig, listWindow: currentWindow() };
  }

  function updateSearch(value) {
    const current = state();
    current.animalSearch = String(value || '');
    current.collectionSelection = reconcileCollectionSelection(current.collectionSelection, filteredAnimals());
    const clearSearch = appRoot.querySelector('[data-action="clear-collection-search"]');
    if (clearSearch) clearSearch.hidden = !current.animalSearch;
    const results = appRoot.querySelector('[data-role="collection-results-body"]');
    if (results) results.innerHTML = renderCollectionSearchResults(renderOptions());
    const selectedAnimal = current.animals.find((animal) => String(animal.id) === String(current.collectionSelection.selectedId)) || null;
    const inspector = appRoot.querySelector('[data-role="collection-inspector"]');
    if (inspector) inspector.innerHTML = renderCollectionInspector(selectedAnimal);
    appRoot.querySelector('.collection-workbench-v4')?.classList.toggle('is-selecting', Boolean(current.collectionSelection.selectionMode));
  }

  function appendWindow() {
    const previous = currentWindow();
    const total = filteredAnimals().length;
    state().collectionWindow = { ...extendListWindow(previous, total), queryKey: previous.queryKey };
    return appendCollectionWindow(appRoot, renderOptions());
  }

  return { activeView, filteredAnimals, currentWindow, renderOptions, updateSearch, appendWindow };
}
