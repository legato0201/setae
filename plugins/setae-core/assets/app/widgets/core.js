import { animalCode, escapeHtml, formatRelativeDays, normalizeStatus, safeHttpUrl, scientificName, statusLabel } from '../components/ui.js';
import { actionRow, button, contentAction, textButton } from '../components/primitives.js';
import { careTasksByType } from '../features/care/tasks.js';
import { queryAnimals } from '../queries/animal-query.js';
import { registerWidget } from './registry.js';
import { enclosureEventLabel, nurseryEventLabel, recordTypeLabel } from '../content/terminology.js';
import { mediaImage } from '../components/media.js';

const imageUrl = (animal) => animal?.image_url || animal?.image?.url || animal?.thumbnail_url || animal?.thumb || '';
const items = (value, key = 'items') => Array.isArray(value) ? value : Array.isArray(value?.[key]) ? value[key] : [];

function compactAnimals(animals, { quickAction = '', empty = '該当する個体はいません。', note = null } = {}) {
  if (!animals.length) return `<div class="widget-empty">${escapeHtml(empty)}</div>`;
  return `<div class="widget-animal-list">${animals.map((animal) => `
    <div class="widget-animal-row" data-animal-id="${escapeHtml(animal.id)}">
      ${actionRow({ label: animalCode(animal), description: note ? note(animal) : scientificName(animal), data: { 'animal-id': animal.id }, trailingIcon: '', className: 'widget-animal-main' })}
      ${quickAction ? button(recordTypeLabel(quickAction), { action: 'smart-quick-record', className: 'widget-quick-action', data: { 'animal-id': animal.id, 'record-type': quickAction } }) : ''}
    </div>`).join('')}</div>`;
}

function renderWidgetRecordRow({ action = '', data = {}, label = '', description = '' } = {}) {
  return actionRow({ label, description, action, data, trailingIcon: '', className: 'widget-record-row' });
}

function renderWidgetPhotoButton(animal) {
  return contentAction({
    contentHtml: `${mediaImage({ src: imageUrl(animal), alt: animalCode(animal), width: 320, height: 320 })}<span>${escapeHtml(animalCode(animal))}</span>`,
    data: { 'animal-id': animal.id },
    className: 'widget-photo-button',
    ariaLabel: `${animalCode(animal)}を開く`
  });
}

function renderCareTaskRow(task) {
  if (task.targetType === 'enclosure') {
    return `<div class="widget-animal-row">${contentAction({ contentHtml: `<strong>${escapeHtml(task.title)}</strong><span>${escapeHtml(task.reason)}</span>`, action: 'open-task-enclosure', data: { 'enclosure-id': task.targetId }, className: 'widget-animal-main', ariaLabel: `${task.title}を開く` })}${button(task.type === 'environment' ? '環境確認' : '整備', { action: 'record-enclosure-task', className: 'widget-quick-action', data: { 'enclosure-id': task.targetId, 'event-type': task.action.eventType } })}</div>`;
  }
  if (task.targetType === 'nursery') {
    const label = ({ feed: '給餌', observation: '観察', count: '個体数', environment: '環境' })[task.type] || '記録';
    return `<div class="widget-animal-row">${contentAction({ contentHtml: `<strong>${escapeHtml(task.title)}</strong><span>${escapeHtml(task.reason)}</span>`, action: 'open-task-nursery', data: { 'group-id': task.targetId }, className: 'widget-animal-main', ariaLabel: `${task.title}を開く` })}${button(label, { action: 'record-nursery-task', className: 'widget-quick-action', data: { 'group-id': task.targetId, 'event-type': task.action.eventType } })}</div>`;
  }
  return `<div class="widget-animal-row">${contentAction({ contentHtml: `<strong>${escapeHtml(animalCode(task.animal))}</strong><span>${escapeHtml(task.reason)}</span>`, data: { 'animal-id': task.animalId }, className: 'widget-animal-main', ariaLabel: `${animalCode(task.animal)}を開く` })}${button(task.type === 'feed' ? '給餌' : '観察', { action: 'smart-quick-record', className: 'widget-quick-action', data: { 'animal-id': task.animalId, 'record-type': task.recommendedAction } })}</div>`;
}

function registerCoreWidgets() {
  registerWidget({
    type: 'care_queue', title: '作業キュー', description: '期限が近い個体と飼育容器', defaultSize: 'large',
    render: ({ widget, config, context }) => {
      const rows = (context.care?.tasks || []).slice(0, Number(config.limit || 6));
      if (!rows.length) return '<div class="widget-empty">現在、期限の近い作業はありません。</div>';
      return `<div class="widget-animal-list">${rows.map(renderCareTaskRow).join('')}</div>`;
    }
  });

  registerWidget({
    type: 'smart_animals', title: '個体リスト', description: '条件に合う個体を自動抽出', defaultSize: 'large', configurable: true,
    defaultConfig: { query: { filters: [], sort: { field: 'code', direction: 'asc' }, limit: 8 }, quickAction: '', display: 'compact' },
    render: ({ widget, config, context }) => {
      const matched = queryAnimals(context.animals, config.query);
      return `<div class="widget-countline"><strong>${matched.length}</strong><span>匹</span></div>${compactAnimals(matched, { quickAction: config.quickAction })}${textButton('すべて表示', { action: 'open-widget-animals', className: 'widget-link', data: { 'widget-id': widget.id } })}`;
    }
  });

  registerWidget({
    type: 'status_summary', title: '状態サマリー', description: '現在の状態別個体数', defaultSize: 'medium',
    render: ({ context }) => {
      const statuses = ['normal', 'fasting', 'pre_molt', 'post_molt'];
      return `<div class="widget-status-grid">${statuses.map((status) => `<div><strong>${context.animals.filter((animal) => normalizeStatus(animal.status) === status).length}</strong><span>${escapeHtml(statusLabel(status))}</span></div>`).join('')}</div>`;
    }
  });

  registerWidget({
    type: 'feed_due', title: 'そろそろ給餌', description: '飼育ルールから自動判定', defaultSize: 'large', configurable: true,
    defaultConfig: { limit: 8, quickAction: 'feed' },
    render: ({ widget, config, context }) => {
      const tasks = careTasksByType((context.care?.tasks || []).filter((task) => task.targetType === 'animal'), 'feed', { limit: Number(config.limit || 8) });
      if (!tasks.length) return '<div class="widget-empty">給餌予定の個体はありません。</div>';
      return `<div class="widget-animal-list">${tasks.map((task) => `<div class="widget-animal-row">${contentAction({ contentHtml: `<strong>${escapeHtml(animalCode(task.animal))}</strong><span>${escapeHtml(task.reason)}</span>`, data: { 'animal-id': task.animalId }, className: 'widget-animal-main', ariaLabel: `${animalCode(task.animal)}を開く` })}${button('給餌', { action: 'smart-quick-record', className: 'widget-quick-action', data: { 'animal-id': task.animalId, 'record-type': 'feed' } })}</div>`).join('')}</div>${textButton('すべて表示', { action: 'open-care-tasks', className: 'widget-link', data: { 'task-type': 'feed' } })}`;
    }
  });

  registerWidget({
    type: 'recent_molts', title: '最近の脱皮', description: '脱皮日の新しい個体', defaultSize: 'medium',
    render: ({ config, context }) => compactAnimals(queryAnimals(context.animals, { filters: [{ field: 'days_since_molt', operator: 'exists', value: true }], sort: { field: 'days_since_molt', direction: 'asc' }, limit: Number(config.limit || 5) }), { note: (animal) => `脱皮 ${formatRelativeDays(animal.last_molt ?? animal.last_molt_date)}` })
  });

  registerWidget({
    type: 'recent_records', title: '最近の記録', description: '新しい飼育記録', defaultSize: 'large',
    render: ({ config, context }) => {
      const source = config.eventType
        ? (context.records || []).filter(({ event }) => event?.type === config.eventType)
        : (context.records || []);
      const rows = source.slice(0, Number(config.limit || 6));
      if (!rows.length) return '<div class="widget-empty">最近の記録はまだありません。</div>';
      return `<div class="widget-record-list">${rows.map(({ targetType, targetId, animal, enclosure, nursery, event }) => targetType === 'enclosure'
        ? renderWidgetRecordRow({ action: 'open-journal-enclosure', data: { 'enclosure-id': enclosure?.id || targetId }, label: enclosure?.code || `容器 #${targetId}`, description: `${event?.date || ''} / ${enclosureEventLabel(event?.type)}` })
        : targetType === 'nursery'
          ? renderWidgetRecordRow({ action: 'open-journal-nursery', data: { 'group-id': nursery?.id || targetId }, label: nursery?.name || `ベビー群 #${targetId}`, description: `${event?.date || ''} / ${nurseryEventLabel(event?.type)}` })
          : renderWidgetRecordRow({ data: { 'animal-id': animal?.id }, label: animalCode(animal), description: `${event?.date || ''} / ${recordTypeLabel(event?.type)}` })).join('')}</div>`;
    }
  });

  registerWidget({
    type: 'favorites', title: 'お気に入り', description: 'お気に入りの個体', defaultSize: 'medium',
    render: ({ config, context }) => compactAnimals(queryAnimals(context.animals, { filters: [{ field: 'is_favorite', operator: '=', value: true }], sort: { field: 'code', direction: 'asc' }, limit: Number(config.limit || 5) }))
  });

  registerWidget({
    type: 'environment', title: '飼育環境', description: '最新の温度・湿度と容器', defaultSize: 'medium',
    render: ({ context }) => {
      const enclosureItems = items(context.enclosures);
      const temperatures = enclosureItems.map((enclosure) => Number(enclosure.last_environment?.temperature)).filter(Number.isFinite);
      const humidities = enclosureItems.map((enclosure) => Number(enclosure.last_environment?.humidity)).filter(Number.isFinite);
      const average = (values) => values.length ? Math.round((values.reduce((sum, value) => sum + value, 0) / values.length) * 10) / 10 : null;
      return `<dl class="widget-environment"><div><dt>平均温度</dt><dd>${average(temperatures) ?? '—'}${temperatures.length ? ' °C' : ''}</dd></div><div><dt>平均湿度</dt><dd>${average(humidities) ?? '—'}${humidities.length ? ' %' : ''}</dd></div><div><dt>使用中の容器</dt><dd>${enclosureItems.length}</dd></div></dl>`;
    }
  });

  registerWidget({
    type: 'baby_summary', title: 'ベビー群', description: '管理中のベビーと群', defaultSize: 'medium',
    render: ({ context }) => {
      const summary = context.babyGroups?.summary || {};
      const count = summary.currently_managed ?? summary.babies_total ?? context.babyGroups?.total ?? 0;
      const groups = summary.active_groups ?? items(context.babyGroups).length;
      return `<div class="widget-metric-pair"><div><strong>${escapeHtml(count)}</strong><span>管理中</span></div><div><strong>${escapeHtml(groups)}</strong><span>群</span></div></div>${textButton('ベビー群を開く', { action: 'open-babies', className: 'widget-link' })}`;
    }
  });

  registerWidget({
    type: 'feeder_stock', title: '餌在庫', description: '餌の総数と在庫不足', defaultSize: 'medium',
    render: ({ context }) => {
      const summary = context.feeders?.summary || {};
      return `<div class="widget-metric-pair"><div><strong>${escapeHtml(summary.total_count ?? 0)}</strong><span>総在庫</span></div><div><strong>${escapeHtml(summary.low_stock_count ?? 0)}</strong><span>在庫少</span></div></div>${textButton('餌在庫を開く', { action: 'open-feeders', className: 'widget-link' })}`;
    }
  });

  registerWidget({
    type: 'egg_schedule', title: '孵化予定', description: '次の孵化予定と卵セット', defaultSize: 'small',
    render: ({ context }) => {
      const summary = context.feeders?.summary || {};
      return `<div class="widget-primary-metric"><strong>${escapeHtml(summary.active_egg_batches ?? 0)}</strong><span>孵化待ち</span></div><div class="widget-note-line">${escapeHtml(summary.next_hatch_date || '予定日なし')}</div>`;
    }
  });

  registerWidget({
    type: 'breeding', title: '繁殖', description: 'ペアリングとベビー群', defaultSize: 'small',
    render: ({ context }) => `<div class="widget-primary-metric"><strong>${escapeHtml(context.babyGroups?.summary?.active_groups ?? items(context.babyGroups).length)}</strong><span>進行中の群</span></div>${textButton('繁殖管理へ', { action: 'open-babies', className: 'widget-link' })}`
  });

  registerWidget({
    type: 'recent_photos', title: '最近の写真', description: '写真のある個体', defaultSize: 'large',
    render: ({ config, context }) => {
      const withPhotos = context.animals.filter((animal) => safeHttpUrl(imageUrl(animal))).slice(0, Number(config.limit || 6));
      if (!withPhotos.length) return '<div class="widget-empty">写真のある個体はまだいません。</div>';
      return `<div class="widget-photo-grid">${withPhotos.map(renderWidgetPhotoButton).join('')}</div>`;
    }
  });

  registerWidget({
    type: 'collection_stats', title: 'コレクション集計', description: '個体数と種数', defaultSize: 'medium',
    render: ({ context }) => {
      const species = new Set(context.animals.map(scientificName).filter(Boolean));
      return `<div class="widget-metric-pair"><div><strong>${context.animals.length}</strong><span>個体</span></div><div><strong>${species.size}</strong><span>種</span></div></div>`;
    }
  });

  registerWidget({
    type: 'growth', title: '成長', description: '齢期と最近の脱皮', defaultSize: 'medium',
    render: ({ config, context }) => compactAnimals(queryAnimals(context.animals, { filters: [{ field: 'days_since_molt', operator: 'exists', value: true }], sort: { field: 'days_since_molt', direction: 'asc' }, limit: Number(config.limit || 5) }), { note: (animal) => `齢期 ${animal.instar || '—'} / 脱皮 ${formatRelativeDays(animal.last_molt ?? animal.last_molt_date)}` })
  });

  registerWidget({
    type: 'quick_actions', title: 'クイック操作', description: 'よく使う記録と登録', defaultSize: 'large', configurable: true,
    render: () => `<div class="widget-action-grid">${button('給餌', { action: 'start-record', data: { 'record-type': 'feed' } })}${button('脱皮', { action: 'start-record', data: { 'record-type': 'molt' } })}${button('観察', { action: 'start-record', data: { 'record-type': 'observation' } })}${button('個体登録', { action: 'add-animal' })}${button('QR', { action: 'open-qr-page' })}</div>`
  });
}

registerCoreWidgets();
