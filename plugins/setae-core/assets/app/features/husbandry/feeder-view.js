import { escapeHtml } from '../../components/ui.js';
import { formatDate, list, loadingBlock } from '../../components/content.js';
import { recordIcon } from '../../components/icons.js';
import { actionMenu, button, emptyState, statusIndicator } from '../../components/primitives.js';

export function renderFeeders(data) {
  if (!data) return loadingBlock('餌在庫を読み込み中…', 'registry');
  const inventory = list(data, ['inventory']);
  const eggs = list(data, ['egg_batches']);
  const events = list(data, ['events']);
  const summary = data.summary || {};

  return `<div class="husbandry-feeder-workbench">
    <div class="husbandry-operational-summary" aria-label="餌在庫の概要">
      ${summaryItem('総在庫', summary.total_count ?? 0)}
      ${summaryItem('在庫少', summary.low_stock_count ?? 0, Number(summary.low_stock_count) > 0)}
      ${summaryItem('孵化待ち', summary.active_egg_batches ?? 0)}
      ${summaryItem('次回', summary.next_hatch_date ? formatDate(summary.next_hatch_date) : '—')}
    </div>

    <section class="husbandry-workbench-section feeder-inventory-section">
      <header class="husbandry-section-heading"><div><h2>在庫</h2></div></header>
      ${inventory.length ? `<div class="feeder-registry" role="list">${inventory.map(renderFeederRow).join('')}</div>` : emptyState('', { title: '餌在庫はまだ登録されていません', description: '在庫を記録すると、残数と入出庫を確認できます。', iconName: 'feed', reason: 'initial', action: 'add-feeder-action', actionLabel: '最初の在庫を記録', primary: true })}
    </section>

    <section class="husbandry-workbench-section feeder-egg-section">
      <header class="husbandry-section-heading"><div><h2>卵セット</h2></div>${button('卵セットを追加', { action: 'add-egg-batch', iconName: 'plus' })}</header>
      ${eggs.length ? `<div class="workbench-ledger feeder-ledger" role="list">${eggs.map(renderEggBatch).join('')}</div>` : emptyState('登録された卵セットはありません。', { compact: true })}
    </section>

    <section class="husbandry-workbench-section feeder-history-section">
      <header class="husbandry-section-heading"><div><h2>在庫履歴</h2></div></header>
      ${events.length ? `<div class="workbench-ledger feeder-ledger" role="list">${events.slice(0, 20).map(renderInventoryEvent).join('')}</div>` : emptyState('在庫履歴はまだありません。', { compact: true })}
    </section>
  </div>`;
}

function renderFeederRow(item) {
  const low = item.initialized && Number(item.count) <= Number(item.low_stock_threshold);
  return `<article class="feeder-registry-row ${low ? 'is-low' : ''}" role="listitem">
    <div class="feeder-registry-name"><strong>${escapeHtml(item.common_name || item.label)}</strong><span class="scientific-name">${escapeHtml(item.label || '')}</span></div>
    <div class="feeder-registry-count"><strong>${escapeHtml(item.count ?? 0)}</strong><span>匹</span></div>
    ${button('記録', { action: 'add-feeder-action', data: { 'feeder-type': item.feeder_type } })}
  </article>`;
}

function renderEggBatch(batch) {
  const incubating = batch.status === 'incubating';
  const status = batch.status === 'hatched' ? '孵化済み' : batch.status === 'cancelled' ? '終了' : '孵化待ち';
  const actions = incubating
    ? `${button('孵化を記録', { action: 'finish-egg', data: { 'batch-id': batch.id, 'egg-status': 'hatched' } })}${actionMenu('卵セットの操作', [{ label: '中止', action: 'finish-egg', data: { 'batch-id': batch.id, 'egg-status': 'cancelled' } }], { iconName: 'more', iconOnly: true })}`
    : statusIndicator(status, { tone: batch.status === 'hatched' ? 'success' : 'neutral' });
  return `<article class="workbench-ledger-row feeder-ledger-row" role="listitem">
    <time class="workbench-ledger-date" datetime="${escapeHtml(batch.set_date || '')}">${formatDate(batch.set_date)}</time>
    <span class="workbench-ledger-marker" aria-hidden="true">${recordIcon('feed')}</span>
    <div class="workbench-ledger-content"><strong>${escapeHtml(batch.feeder_common_name || batch.feeder_label || batch.feeder_type)}</strong><p class="workbench-ledger-summary">孵化予定 ${formatDate(batch.estimated_hatch_date)}</p></div>
    <div class="workbench-ledger-actions feeder-ledger-actions">${actions}</div>
  </article>`;
}

function renderInventoryEvent(event) {
  const quantity = Number(event.quantity || 0);
  const summary = [event.feeder_label || '', `${quantity > 0 ? '+' : ''}${event.quantity ?? ''}匹`].filter(Boolean).join(' · ');
  return `<article class="workbench-ledger-row feeder-ledger-row" role="listitem">
    <time class="workbench-ledger-date" datetime="${escapeHtml(event.date || '')}">${formatDate(event.date)}</time>
    <span class="workbench-ledger-marker" aria-hidden="true">${recordIcon('feed')}</span>
    <div class="workbench-ledger-content"><strong>${escapeHtml(event.action_label || feederAction(event.action))}</strong>${summary ? `<p class="workbench-ledger-summary">${escapeHtml(summary)}</p>` : ''}</div>
  </article>`;
}

function summaryItem(label, value, warning = false) {
  return `<span class="${warning ? 'is-warning' : ''}"><small>${escapeHtml(label)}</small><strong>${escapeHtml(value)}</strong></span>`;
}

function feederAction(action) {
  return ({ purchase: '追加購入', consume: '給餌に使用', breed: '自家繁殖', box_reset: 'ボックス清掃', adjust: '在庫調整' })[action] || '在庫記録';
}
