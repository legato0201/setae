import { escapeHtml, animalCode, scientificName } from '../components/ui.js';
import { recordIcon } from '../components/icons.js';
import { formatDate, loadingBlock } from '../components/content.js';
import {
  actionMenu,
  button,
  emptyState,
  selectControl,
  statusIndicator,
  tabPanel,
  tabs,
  textButton
} from '../components/primitives.js';
import { nurseryCodeRange, nurseryEventSummary } from '../features/nursery/model.js';
import { renderQrWorkspace } from '../features/qr/view.js';
import { recordTypeLabel, terminologyMaps } from '../content/terminology.js';
import {
  createListWindow,
  renderProgressiveListFooter,
  visibleListItems
} from '../components/progressive-list.js';

const eventData = (event) => {
  if (event?.data && typeof event.data === 'object') return event.data;
  if (typeof event?.data === 'string') {
    try { return JSON.parse(event.data) || {}; }
    catch { return { note: event.data }; }
  }
  return {};
};

const recordRows = new WeakMap();

export function renderRecords({ records = [], animals = [], filter = 'all', view = 'history', qr = {}, loading = false, listWindow = createListWindow(), deferRows = false }) {
  const navigation = tabs([
    { id: 'history', label: '記録履歴' },
    { id: 'qr', label: 'QR記録' }
  ], {
    activeId: view,
    action: 'records-tab',
    dataKey: 'tab',
    label: '記録画面',
    className: 'records-tabs',
    idPrefix: 'records',
    panelId: 'records-tabpanel'
  });

  return tabPanel(`
      <header class="page-header compact-header records-header">
        <div>
          <div class="eyebrow">LABORATORY JOURNAL</div>
          <h1>${view === 'qr' ? 'QR記録' : '記録履歴'}</h1>
        </div>
        ${button('記録する', { action: 'open-record-sheet', iconName: 'plus', primary: true })}
      </header>
      ${navigation}
      ${view === 'qr'
        ? renderQrWorkspace({ qr, animals })
        : renderHistory({ records, filter, loading, listWindow, deferRows })}
  `, {
    id: 'records-tabpanel',
    idPrefix: 'records',
    activeId: view,
    className: 'page records-page records-workbench'
  });
}

function renderHistory({ records, filter, loading, listWindow, deferRows = false }) {
  const filtered = filterRecords(records, filter);
  const visible = deferRows ? [] : visibleListItems(filtered, listWindow);
  const activeFilterLabel = filter === 'all' ? '' : recordTypeLabel(filter);
  const filterControl = selectControl({
    value: filter,
    options: [
      { value: 'all', label: 'すべて' },
      ...Object.keys(terminologyMaps.recordTypes).filter((value) => value !== 'other').map((value) => ({ value, label: recordTypeLabel(value) }))
    ],
    label: '記録の種類',
    role: 'record-filter',
    className: 'records-filter-select'
  });
  return `
    <div class="records-filter-toolbar">
      <div class="records-filter-group">
        <span class="records-filter-label">種類</span>
        ${filterControl}
      </div>
      <output class="records-count" aria-live="polite">${filtered.length}件${activeFilterLabel ? ` · 種類：${escapeHtml(activeFilterLabel)}` : ''}</output>
    </div>
    ${loading
      ? loadingBlock('記録を読み込み中…', 'ledger')
      : filtered.length
        ? `<div class="workbench-ledger records-ledger" role="list" data-role="records-ledger"${deferRows ? ' aria-busy="true"' : ''}>${visible.map(renderRecord).join('')}</div>
          ${renderRecordsProgressiveFooter(visible.length, filtered.length, deferRows ? '記録を準備しています。' : '', deferRows)}`
        : records.length === 0
          ? emptyState('', {
              title: 'まだ記録がありません',
              description: '給餌・脱皮・観察などを記録すると、ここに時系列で表示されます。',
              iconName: 'records',
              reason: 'initial',
              className: 'records-empty',
              action: 'open-record-sheet',
              actionLabel: '最初の記録を追加',
              primary: true
            })
          : emptyState('', {
              title: 'この種類の記録はありません',
              description: 'すべての記録へ戻すか、別の種類を選んでください。',
              iconName: 'filter',
              reason: 'filtered',
              className: 'records-empty',
              action: 'clear-record-filter',
              actionLabel: 'すべての記録を表示'
            })}
  `;
}

export function filterRecords(records = [], filter = 'all') {
  return filter === 'all' ? records : records.filter((item) => item.event?.type === filter);
}

function renderRecordsProgressiveFooter(visible, total, announcement = '', pending = false) {
  return renderProgressiveListFooter({ visible, total, action: pending ? '' : 'show-more-records', label: 'さらに100件表示', noun: '件',
    role: 'records-progressive-footer', className: 'records-progressive-footer', announcement });
}

export function appendRecordsWindow(root, { records = [], filter = 'all', listWindow = createListWindow(), pending = false, automatic = false } = {}) {
  const ledger = root?.querySelector?.('[data-role="records-ledger"]');
  const footer = root?.querySelector?.('[data-role="records-progressive-footer"]');
  if (!ledger || !footer) return false;
  const filtered = filterRecords(records, filter);
  const visible = visibleListItems(filtered, listWindow);
  const existing = ledger.querySelectorAll('[data-record-id]').length;
  const added = visible.slice(existing);
  if (added.length) ledger.insertAdjacentHTML('beforeend', added.map(renderRecord).join(''));
  ledger.toggleAttribute?.('aria-busy', pending);
  footer.outerHTML = renderRecordsProgressiveFooter(visible.length, filtered.length,
    automatic ? pending ? '' : `記録の準備が完了しました。${visible.length}件を表示しています。`
      : `${added.length}件を追加しました。${visible.length} / ${filtered.length}件を表示しています。`, pending);
  return true;
}

export async function hydrateRecordsWindow(root, {
  records = [], filter = 'all', initialWindow = createListWindow({ initial: 5, limit: 5 }), renderedLimit = null,
  targetWindow = createListWindow(), batchSize = 25,
  nextPaint = () => Promise.resolve(), guard = () => true
} = {}) {
  let current = createListWindow(initialWindow);
  const target = createListWindow(targetWindow);
  const step = Math.max(1, Math.trunc(Number(batchSize) || 25));
  let rendered = renderedLimit === null ? current.limit : Math.max(0, Math.min(current.limit, Math.trunc(Number(renderedLimit) || 0)));
  while (rendered < target.limit) {
    await nextPaint();
    if (!guard()) return false;
    const nextLimit = rendered < current.limit ? current.limit : Math.min(target.limit, rendered + step);
    current = { ...current, limit: nextLimit };
    if (!appendRecordsWindow(root, { records, filter, listWindow: current, pending: nextLimit < target.limit, automatic: true })) return false;
    rendered = nextLimit;
  }
  return current;
}

export function renderRecord(item) {
  const event = item.event || {};
  const data = eventData(event);
  const refused = Boolean(data.refused || event.refused);
  const target = recordTarget(item);
  const summary = recordSummary(item, event, data);
  const targetButton = textButton(target.code, target.button);
  const marker = recordIcon(event.type);
  // Append is followed by a page-cache render. Reuse rows only while every
  // displayed value and action target still matches; API objects may mutate.
  const inputs = [event.id || '', event.date || '', event.type, refused, targetButton,
    target.description, target.taxon, summary, item.targetType, event.id,
    item.animal?.id ?? item.targetId, marker]
    .map((value) => value !== null && typeof value === 'object' ? String(value) : value);
  const cached = recordRows.get(item);
  if (cached && inputs.every((value, index) => Object.is(value, cached.inputs[index]))) return cached.html;
  const actions = recordActions(item, event, refused);
  const html = `
    <article class="workbench-ledger-row records-ledger-row" role="listitem" data-record-id="${escapeHtml(event.id || '')}">
      <time class="workbench-ledger-date" datetime="${escapeHtml(event.date || '')}">${formatDate(event.date)}</time>
      <span class="workbench-ledger-marker records-ledger-marker" aria-hidden="true">${marker}</span>
      <div class="workbench-ledger-content records-ledger-content">
        <div class="records-event-heading">
          <strong class="records-event-type">${escapeHtml(recordTypeLabel(event.type))}</strong>
          ${refused ? statusIndicator('拒食', { tone: 'warning', className: 'records-status' }) : ''}
        </div>
        <div class="workbench-ledger-identity records-target-identity">
          ${targetButton}
          ${target.description ? `<span class="records-target-description ${target.taxon ? 'is-taxon' : ''}">${escapeHtml(target.description)}</span>` : ''}
        </div>
        ${summary ? `<p class="workbench-ledger-summary">${escapeHtml(summary)}</p>` : ''}
      </div>
      ${actions ? `<div class="workbench-ledger-actions">${actions}</div>` : ''}
    </article>
  `;
  if (item && typeof item === 'object') recordRows.set(item, { inputs, html });
  return html;
}

function recordTarget(item) {
  if (item.targetType === 'enclosure') {
    const enclosure = item.enclosure || {};
    const id = enclosure.id ?? item.targetId;
    return {
      code: enclosure.code || `容器 #${id}`,
      description: enclosure.name || enclosure.type_label || enclosure.enclosure_type || '飼育容器',
      taxon: false,
      button: {
        action: 'open-journal-enclosure',
        data: { 'enclosure-id': id },
        className: 'workbench-ledger-target-code',
        title: '容器の記録を開く'
      }
    };
  }

  if (item.targetType === 'nursery') {
    const nursery = item.nursery || {};
    const id = nursery.id ?? item.targetId;
    return {
      code: nurseryCodeRange(nursery),
      description: nursery.species_name || nursery.species?.scientific_name || nursery.name || 'ベビー群',
      taxon: Boolean(nursery.species_name || nursery.species?.scientific_name),
      button: {
        action: 'open-journal-nursery',
        data: { 'group-id': id },
        className: 'workbench-ledger-target-code',
        title: 'ベビー群の記録を開く'
      }
    };
  }

  const animal = item.animal || {};
  const id = animal.id ?? item.targetId;
  return {
    code: animalCode(animal),
    description: scientificName(animal),
    taxon: true,
    button: {
      data: { 'animal-id': id },
      className: 'workbench-ledger-target-code',
      title: '個体詳細を開く'
    }
  };
}

function recordSummary(item, event, data) {
  if (item.targetType === 'nursery') return nurseryEventSummary(event) || data.note || event.note || '';

  if (event.type === 'feed') {
    const prey = data.prey_type || data.label || '';
    const quantity = Number(data.quantity ?? data.prey_count ?? event.quantity ?? 0);
    const feeding = [prey, quantity > 0 ? `×${quantity}` : ''].filter(Boolean).join(' ');
    return [feeding, data.note || event.note || ''].filter(Boolean).join(' · ');
  }
  if (event.type === 'molt') {
    const instar = data.instar ?? data.new_instar ?? event.instar;
    return [instar ? `${instar}齢` : '', data.note || event.note || ''].filter(Boolean).join(' · ');
  }
  if (event.type === 'growth') {
    const size = data.size ?? data.body_length ?? event.size;
    return [size ? `${size}${data.unit || ' cm'}` : '', data.note || event.note || ''].filter(Boolean).join(' · ');
  }
  if (event.type === 'pairing') {
    return [data.partner_name, data.result, data.note || event.note || ''].filter(Boolean).join(' · ');
  }
  if (event.type === 'environment_check') {
    return [
      data.temperature != null ? `${data.temperature} °C` : '',
      data.humidity != null ? `${data.humidity} %` : '',
      data.note || event.note || ''
    ].filter(Boolean).join(' · ');
  }
  return data.note || data.label || data.prey_type || event.note || '';
}

function recordActions(item, event, refused) {
  if (item.targetType === 'enclosure' || item.targetType === 'nursery') return '';
  const items = [];
  if (event.type === 'feed') {
    items.push({
      label: refused ? '給餌成功に変更' : '拒食に変更',
      action: 'toggle-refused',
      data: { 'log-id': event.id, refused: refused ? '1' : '0' }
    });
  }
  items.push({ label: '共有', action: 'share-record', data: { 'log-id': event.id } });
  items.push({ separator: true });
  items.push({
    label: '削除',
    action: 'delete-record',
    className: 'danger',
    data: { 'log-id': event.id, 'animal-id': item.animal?.id ?? item.targetId }
  });
  return actionMenu('記録操作', items, {
    iconName: '',
    iconOnly: true,
    className: 'records-action-menu',
    lazy: true
  });
}
