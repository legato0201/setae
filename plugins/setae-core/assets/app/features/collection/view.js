import {
  animalCode,
  escapeHtml,
  formatRelativeDays,
  genderLabel,
  scientificName,
  statusChip
} from '../../components/ui.js';
import { renderAnimalMedia } from '../../components/media.js';
import {
  button,
  checkboxControl,
  emptyState,
  iconButton,
  searchControl,
  segmentedControl,
  selectControl
} from '../../components/primitives.js';
import { workspaceHeader, workspaceToolbar } from '../../components/patterns.js';
import { queryAnimals } from '../../queries/animal-query.js';
import { normalizeAnimalCardConfig } from './card-config.js';
import { renderAnimalCard } from './card-view.js';
import { renderCollectionInspector } from './inspector.js';
import { normalizeAnimalSearchValue, searchAnimalIds } from '../../queries/animal-search-index.js';
import { renderProgressiveListFooter, visibleListItems } from '../../components/progressive-list.js';
import { createCollectionWindow } from './list-window.js';

export function filterCollectionAnimals({ animals = [], search = '', activeView = null, careTasks = [], searchIndex = null } = {}) {
  let queried;
  if (activeView?.query?.careTaskType) {
    const taskIds = careTasks
      .filter((task) => task.type === activeView.query.careTaskType)
      .map((task) => String(task.animalId));
    const order = new Map(taskIds.map((id, index) => [id, index]));
    queried = animals
      .filter((animal) => order.has(String(animal.id)))
      .sort((a, b) => order.get(String(a.id)) - order.get(String(b.id)));
  } else {
    queried = activeView ? queryAnimals(animals, activeView.query) : [...animals];
  }
  const q = normalizeAnimalSearchValue(search);
  if (!q) return queried;
  if (searchIndex) {
    const matchedIds = searchAnimalIds(searchIndex, q);
    return queried.filter((animal) => matchedIds.has(String(animal.id)));
  }
  return queried.filter((animal) => {
    const haystack = [
      animalCode(animal),
      scientificName(animal),
      animal?.name,
      animal?.status,
      animal?.gender
    ].filter(Boolean).join(' ').toLowerCase();
    return haystack.includes(q);
  });
}

export function renderCollectionAnimals({
  animals = [],
  mode = 'table',
  search = '',
  embedded = false,
  views = [],
  activeView = null,
  careTasks = [],
  selection = {},
  cardConfig = {},
  searchIndex = null,
  listWindow = createCollectionWindow(),
  headerHtml = ''
}) {
  const normalizedCardConfig = normalizeAnimalCardConfig(cardConfig);
  const selectedAnimal = animals.find((animal) => String(animal.id) === String(selection.selectedId)) || null;
  const selecting = Boolean(selection.selectionMode);
  const resolvedHeader = headerHtml || workspaceHeader('コレクション', { meta: `${animals.length}匹` });
  const content = `<div class="collection-workbench-v4 is-${mode === 'table' ? 'registry' : 'gallery'} ${selecting ? 'is-selecting' : ''}">
    <section class="collection-workbench-main" aria-label="コレクション">
      ${resolvedHeader}
      ${selection.selectionMode
        ? renderSelectionToolbar(selection.selectedIds?.length || 0)
        : renderCollectionToolbar({ mode, search, views, activeView, selection, cardConfig: normalizedCardConfig })}
      <div class="collection-results-v4" data-role="collection-results-body">${renderCollectionSearchResults({
        animals,
        mode,
        search,
        activeView,
        careTasks,
        searchIndex,
        selection,
        listWindow,
        cardConfig: normalizedCardConfig
      })}</div>
    </section>
    <div class="collection-inspector-region-v4" data-role="collection-inspector">${renderCollectionInspector(selectedAnimal)}</div>
  </div>`;

  return embedded ? content : `<div class="collection-screen-v4">${content}</div>`;
}

function renderCollectionToolbar({ mode, search, views, activeView, selection }) {
  const editable = activeView && !activeView.builtin && activeView.id !== 'dashboard';
  const filters = views.map((view) => ({ value: view.id, label: view.title }));
  const primary = `${searchControl({
    value: search,
    placeholder: '個体番号・学名・名前を検索',
    label: '個体を検索',
    role: 'animal-search',
    className: 'collection-search-v4',
    clearAction: 'clear-collection-search',
    persistentClear: true,
    clearLabel: '検索語をクリア'
  })}${selectControl({
    value: activeView?.id || 'all',
    options: filters,
    label: '絞り込み',
    role: 'collection-view-filter',
    className: 'collection-filter-v4'
  })}${editable ? iconButton('edit', {
    action: 'edit-saved-view',
    label: '現在の絞り込みを編集',
    data: { 'view-id': activeView.id }
  }) : iconButton('filter', { action: 'create-saved-view', label: '絞り込みを作成' })}`;

  const secondary = `${segmentedControl([
    { id: 'table', label: '台帳' },
    { id: 'gallery', label: '写真' }
  ], {
    activeId: mode === 'table' ? 'table' : 'gallery',
    action: 'animal-card-mode',
    dataKey: 'card-mode',
    label: '表示形式',
    className: 'collection-view-switch'
  })}${button(selection.selectionMode ? '選択を終了' : '選択', {
    action: 'collection-selection-mode',
    iconName: 'check',
    className: selection.selectionMode ? 'is-active' : '',
    aria: { 'aria-pressed': selection.selectionMode ? 'true' : 'false' }
  })}${mode === 'table' ? '' : iconButton('settings', {
    action: 'open-card-editor',
    label: '写真表示を設定',
    className: 'collection-card-settings'
  })}${button('個体登録', { action: 'add-animal', iconName: 'plus', primary: true })}`;

  return workspaceToolbar(primary, {
    secondaryHtml: secondary,
    className: 'collection-toolbar-v4',
    label: 'コレクション操作'
  });
}

export function renderCollectionSearchResults({
  animals = [],
  mode = 'table',
  search = '',
  activeView = null,
  careTasks = [],
  searchIndex = null,
  selection = {},
  cardConfig = {},
  listWindow = createCollectionWindow()
} = {}) {
  const filtered = filterCollectionAnimals({ animals, search, activeView, careTasks, searchIndex });
  const visible = visibleListItems(filtered, createCollectionWindow(listWindow));
  const renderOptions = collectionItemOptions({ selection, cardConfig, mode });
  const { selectedIds, selecting } = renderOptions;
  const hasConditions = Boolean(search.trim() || (activeView?.id && activeView.id !== 'all'));
  const filterSummary = [
    activeView?.id && activeView.id !== 'all' ? `絞り込み：${activeView.title}` : '',
    search.trim() ? `検索：${search.trim()}` : ''
  ].filter(Boolean).join(' · ');

  const summary = `<div class="collection-result-summary" data-role="collection-result-count" aria-live="polite">
      <span><strong>${filtered.length}</strong>匹</span>
      ${selecting ? `<span>${selectedIds.size}匹を選択中</span>` : filterSummary ? `<span>${escapeHtml(filterSummary)}</span>` : ''}
    </div>`;
  if (filtered.length) {
    const content = mode === 'table'
      ? renderRegistry(visible, { ...renderOptions, allSelected: filtered.every((animal) => selectedIds.has(String(animal.id))), total: filtered.length })
      : `<div class="collection-gallery-v4 card-grid-${renderOptions.config.mode} density-${renderOptions.config.density}" data-role="collection-items" data-collection-total="${filtered.length}" data-selection-mode="${selecting}">${renderCollectionItems(visible, renderOptions)}</div>`;
    return `${summary}${content}${renderCollectionProgressiveFooter(visible.length, filtered.length)}`;
  }

  return `${summary}${animals.length === 0
    ? emptyState('', {
        title: 'まだ個体が登録されていません',
        description: '最初の個体を登録すると、給餌・脱皮・観察を記録できます。',
        iconName: 'collection',
        reason: 'initial',
        action: 'add-animal',
        actionLabel: '個体を登録',
        primary: true,
        className: 'collection-empty-v4'
      })
    : emptyState('', {
        title: '条件に一致する個体はありません',
        description: '検索語または絞り込みを変更してください。',
        iconName: 'search',
        reason: hasConditions ? 'filtered' : 'initial',
        action: 'clear-collection-filters',
        actionLabel: '条件をクリア',
        className: 'collection-empty-v4'
      })}`;
}

function collectionItemOptions({ selection = {}, cardConfig = {}, mode = 'table' } = {}) {
  const selectedIds = new Set((selection.selectedIds || []).map(String));
  const selecting = Boolean(selection.selectionMode);
  const focusedId = selection.selectedId === null || selection.selectedId === undefined
    ? ''
    : String(selection.selectedId);
  return { selectedIds, selecting, focusedId, mode, config: mode === 'table' ? null : normalizeAnimalCardConfig(cardConfig) };
}

function renderCollectionItems(animals, options, offset = 0) {
  return animals.map((animal, index) => options.mode === 'table'
    ? renderRegistryRow(animal, options, offset + index + 2)
    : renderAnimalCard(animal, {
        config: options.config,
        selected: options.selectedIds.has(String(animal.id)),
        focused: options.focusedId === String(animal.id),
        selectionMode: options.selecting,
        collection: true
      })).join('');
}

function renderCollectionProgressiveFooter(visible, total, announcement = '') {
  return renderProgressiveListFooter({ visible, total, action: 'show-more-collection', noun: '匹',
    label: `さらに${Math.min(50, total - visible)}匹表示`, role: 'collection-progressive-footer', announcement });
}

export function appendCollectionWindow(root, options = {}) {
  const items = root?.querySelector?.('[data-role="collection-items"]');
  const footer = root?.querySelector?.('[data-role="collection-progressive-footer"]');
  if (!items || !footer) return false;
  const filtered = filterCollectionAnimals(options);
  const visible = visibleListItems(filtered, createCollectionWindow(options.listWindow));
  const existing = [...items.querySelectorAll('[data-collection-animal]')];
  // A stale filter/order must be re-rendered; never append a different query to retained rows.
  if (Number(items.dataset.collectionTotal) !== filtered.length || existing.length > visible.length
    || existing.some((row, index) => row.dataset.animalId !== String(visible[index]?.id))) return false;
  const renderOptions = collectionItemOptions(options);
  if ((renderOptions.mode === 'table') !== (items.tagName === 'TBODY')
    || items.dataset.selectionMode !== String(renderOptions.selecting)) return false;
  const added = visible.slice(existing.length);
  if (added.length) items.insertAdjacentHTML('beforeend', renderCollectionItems(added, renderOptions, existing.length));
  footer.outerHTML = renderCollectionProgressiveFooter(visible.length, filtered.length,
    `${added.length}匹を追加しました。${visible.length} / ${filtered.length}匹を表示しています。`);
  return true;
}

function renderSelectionToolbar(count) {
  return workspaceToolbar(`<strong class="collection-selection-count">${count}匹を選択</strong>`, {
    label: '選択した個体の操作',
    className: 'collection-selection-toolbar-v4',
    secondaryHtml: `${button('給餌', {
      action: 'collection-bulk-record',
      iconName: 'feed',
      primary: true,
      disabled: count === 0,
      data: { 'record-type': 'feed' }
    })}${button('観察', {
      action: 'collection-bulk-record',
      iconName: 'observation',
      disabled: count === 0,
      data: { 'record-type': 'observation' }
    })}${button('状態変更', { action: 'open-collection-status', disabled: count === 0 })}${button('ラベル', {
      action: 'collection-bulk-qr',
      iconName: 'qr',
      disabled: count === 0
    })}${iconButton('close', { action: 'clear-collection-selection', label: '選択を終了' })}`
  });
}

function renderRegistry(animals, options) {
  const { selecting, allSelected, total } = options;
  const rows = renderCollectionItems(animals, options);

  return `<div class="registry-frame collection-registry-frame"><table class="registry-table collection-registry-table" role="table" aria-label="個体台帳" aria-rowcount="${total + 1}">
    <colgroup><col class="registry-col-select"><col class="registry-col-photo"><col class="registry-col-id"><col class="registry-col-taxon"><col class="registry-col-sex"><col class="registry-col-instar"><col class="registry-col-origin"><col class="registry-col-status"><col class="registry-col-date"><col class="registry-col-date"></colgroup>
    <thead role="rowgroup"><tr role="row">
      <th class="registry-select-cell" scope="col">${selecting ? checkboxControl({
        checked: allSelected,
        action: 'toggle-collection-select-all',
        label: `条件に一致する${total}匹をすべて選択`,
        compact: true,
        labelMode: 'sr-only'
      }) : ''}</th>
      <th scope="col"><span class="visually-hidden">写真</span></th>
      <th scope="col">管理番号</th><th scope="col">分類</th><th scope="col">性別</th><th scope="col">齢期</th><th scope="col">由来</th><th scope="col">状態</th><th scope="col">最終給餌</th><th scope="col">最終脱皮</th>
    </tr></thead>
    <tbody role="rowgroup" data-role="collection-items" data-collection-total="${total}" data-selection-mode="${selecting}">${rows}</tbody>
  </table></div>`;
}

function renderRegistryRow(animal, { selectedIds, focusedId, selecting }, rowIndex) {
  const id = String(animal.id);
  const code = animalCode(animal);
  const lastFeed = escapeHtml(formatRelativeDays(animal.last_feed ?? animal.last_feed_date));
  const selected = selectedIds.has(id);
  const focused = focusedId === id;
  return `<tr class="${selected ? 'is-selected' : ''} ${focused ? 'is-focused' : ''}" role="row" aria-rowindex="${rowIndex}" data-animal-id="${escapeHtml(id)}" data-collection-animal tabindex="0" aria-selected="${selected ? 'true' : 'false'}" ${focused ? 'data-focused="true"' : ''}>
    <td class="registry-select-cell" role="cell">${selecting ? checkboxControl({
      checked: selected,
      action: 'toggle-collection-selection',
      label: `${code}を選択`,
      compact: true,
      labelMode: 'sr-only',
      data: { 'animal-id': id }
    }) : ''}</td>
    <td class="registry-photo-cell registry-desktop-cell" role="cell"><div class="registry-thumbnail">${renderAnimalMedia(animal, { ratio: 'square', compact: true, code: '', scientificName: '' })}</div></td>
    <td class="registry-id-cell" role="cell"><strong class="animal-code">${escapeHtml(code)}</strong></td>
    <td class="registry-taxon-cell" role="cell"><span class="scientific-name">${escapeHtml(scientificName(animal))}</span></td>
    <td class="registry-sex-cell" role="cell">${escapeHtml(genderLabel(animal.gender))}<span class="registry-mobile-feed"> · ${lastFeed}</span></td>
    <td class="registry-desktop-cell" role="cell">${escapeHtml(animal.instar || '—')}</td>
    <td class="registry-desktop-cell" role="cell">${escapeHtml(animal.origin || '—')}</td>
    <td class="registry-status-cell" role="cell">${statusChip(animal.status)}</td>
    <td class="registry-date registry-desktop-cell" role="cell">${lastFeed}</td>
    <td class="registry-date registry-desktop-cell" role="cell">${escapeHtml(formatRelativeDays(animal.last_molt ?? animal.last_molt_date))}</td>
  </tr>`;
}
