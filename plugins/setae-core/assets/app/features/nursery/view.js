import { escapeHtml } from '../../components/ui.js';
import { formatDate, list } from '../../components/content.js';
import {
  actionMenu,
  actionRow,
  button,
  emptyState,
  textIconButton
} from '../../components/primitives.js';
import { workspaceToolbar } from '../../components/patterns.js';
import { recordIcon } from '../../components/icons.js';
import { babyStatusLabel } from '../../content/terminology.js';
import {
  createListWindow,
  renderProgressiveListFooter,
  visibleListItems
} from '../../components/progressive-list.js';
import {
  nurseryCareStatus,
  nurseryCodeRange,
  nurseryEventLabels,
  nurseryEventSummary,
  nurseryHistory,
  nurseryLivingCount
} from './model.js';

const addDays = (value, days) => {
  const match = String(value || '').match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return '';
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  date.setDate(date.getDate() + Number(days || 0));
  return date.toLocaleDateString('sv-SE');
};

const nurseryRegisterRows = new WeakMap();

export function renderNurseryRegistry(data) {
  const items = list(data, ['items']);
  const archived = list(data, ['archived_items']);
  const summary = data?.summary || {};
  if (!items.length && !archived.length) {
    return emptyState('', {
      title: 'ベビー群はまだありません',
      description: '孵化したベビーを番号単位で管理できます。',
      iconName: 'growth',
      reason: 'initial',
      action: 'add-baby-group',
      actionLabel: 'ベビー群を作成',
      primary: true
    });
  }

  const managed = summary.currently_managed ?? items.reduce((total, group) => total + nurseryLivingCount(group), 0);
  const dead = summary.dead ?? items.reduce((total, group) => total + Number(group.stats?.dead || 0), 0);
  const rehomed = summary.rehomed ?? items.reduce((total, group) => total + Number(group.stats?.rehomed || 0), 0);
  return `<div class="nursery-operational-summary" aria-label="ベビー群の管理状況">
      <span><strong>${escapeHtml(managed)}匹</strong> 管理中</span><i aria-hidden="true">·</i>
      <span><strong>${escapeHtml(summary.active_groups ?? items.length)}群</strong></span><i aria-hidden="true">·</i>
      <span>死亡 <strong>${escapeHtml(dead)}</strong></span><i aria-hidden="true">·</i>
      <span>譲渡 <strong>${escapeHtml(rehomed)}</strong></span>
    </div>
    <section class="nursery-registry-section" aria-label="管理中のベビー群">
      <div class="nursery-registry">${items.map(renderNurseryRow).join('')}</div>
    </section>
    ${archived.length ? `<details class="nursery-archive"><summary><span>アーカイブ</span><strong>${archived.length}</strong></summary><div class="nursery-registry">${archived.map(renderNurseryRow).join('')}</div></details>` : ''}`;
}

function renderNurseryRow(group) {
  const last = nurseryHistory(group, 1)[0];
  const meta = [
    group.name,
    group.birth_date ? `孵化 ${formatDate(group.birth_date)}` : '',
    last?.date ? `最終記録 ${formatDate(last.date)}` : '最終記録なし'
  ].filter(Boolean).join(' · ');
  return actionRow({
    label: nurseryCodeRange(group),
    description: group.species_name || '種未設定',
    meta,
    trailingLabel: `${nurseryLivingCount(group)}匹生存`,
    action: 'open-baby-group',
    data: { 'group-id': group.id },
    className: 'nursery-registry-row'
  });
}

export function renderNurseryWorkspace(group, { careProfile = {}, registerWindow = createListWindow() } = {}) {
  const items = list(group, ['items']);
  const care = nurseryCareStatus(group, careProfile);
  const history = nurseryHistory(group);
  const development = Array.isArray(group.development) ? group.development : [];
  const groupId = group.id;
  const primaryActions = [
    textIconButton('chevronLeft', 'ベビー群一覧', { action: 'close-baby-group', className: 'text-button nursery-back-action' }),
    '<span class="nursery-toolbar-divider" aria-hidden="true"></span>',
    button('給餌', { action: 'record-nursery', iconName: 'feed', data: { 'event-type': 'feed' } }),
    button('観察', { action: 'record-nursery', iconName: 'observation', data: { 'event-type': 'observation' } }),
    button('個体数', { action: 'record-nursery', iconName: 'collection', data: { 'event-type': 'count_check' } })
  ].join('');
  const bulkMenu = actionMenu('一括記録', [
    { label: '脱皮を記録', action: 'baby-bulk', iconName: 'molt', data: { 'event-type': 'molt', 'group-id': groupId } },
    { label: '死亡を記録', action: 'baby-bulk', iconName: 'records', data: { 'event-type': 'dead', 'group-id': groupId } },
    { label: '生存へ戻す', action: 'baby-bulk', iconName: 'observation', data: { 'event-type': 'alive', 'group-id': groupId } },
    { label: '譲渡済みにする', action: 'baby-bulk', iconName: 'collection', data: { 'event-type': 'rehomed', 'group-id': groupId } }
  ], { iconName: 'more', className: 'nursery-bulk-menu' });

  return `<div class="nursery-workspace">
    ${workspaceToolbar(primaryActions, { secondaryHtml: bulkMenu, className: 'nursery-action-toolbar', label: 'ベビー群の記録操作' })}
    <div class="nursery-group-meta">
      <span class="scientific-name">${escapeHtml(group.species_name || '種未設定')}</span>
      <span>${group.birth_date ? `孵化 ${formatDate(group.birth_date)}` : '孵化日未設定'}</span>
    </div>
    <div class="nursery-workspace-grid">
      ${renderCareStatus(care)}
      ${renderDevelopment(development)}
    </div>
    ${renderHistory(history)}
    ${renderSpecimenRegister(items, groupId, registerWindow)}
  </div>`;
}

function renderCareStatus(care) {
  return `<section class="nursery-data-section nursery-care-section">
    <header class="nursery-section-header"><div><h2>群全体の飼育</h2></div></header>
    <div class="nursery-care-status" role="table" aria-label="ベビー群の作業間隔">
      <div class="nursery-care-heading" role="row"><span role="columnheader"></span><span role="columnheader">最終</span><span role="columnheader">次回</span></div>
      ${care.map(careStatusRow).join('')}
    </div>
  </section>`;
}

function careStatusRow(item) {
  const next = item.last ? addDays(item.last.date, item.intervalDays) : '';
  const lastLabel = item.last ? formatDate(item.last.date) : '未記録';
  const nextLabel = item.intervalDays ? (next ? formatDate(next) : '記録後に算出') : '予定なし';
  return `<div class="nursery-care-row" role="row"><strong role="rowheader">${escapeHtml(item.label)}</strong><span data-label="最終" role="cell">${lastLabel}</span><span data-label="次回" role="cell">${nextLabel}</span></div>`;
}

function renderDevelopment(development) {
  return `<section class="nursery-data-section nursery-development-section">
    <header class="nursery-section-header"><div><h2>齢期分布</h2></div></header>
    ${development.length
      ? `<dl class="nursery-development">${development.map((item) => `<div><dt>${escapeHtml(item.instar)}齢</dt><dd>${escapeHtml(item.count)}</dd></div>`).join('')}</dl>`
      : emptyState('齢期データはまだありません。', { compact: true })}
  </section>`;
}

function renderHistory(history) {
  return `<section class="nursery-data-section nursery-ledger-section">
    <header class="nursery-section-header"><div><h2>ベビー群の履歴</h2></div></header>
    ${history.length
      ? `<div class="workbench-ledger nursery-ledger" role="list">${history.map(renderNurseryLedgerRow).join('')}</div>`
      : emptyState('記録はまだありません。', { compact: true })}
  </section>`;
}

function renderNurseryLedgerRow(event) {
  const summary = nurseryEventSummary(event);
  const scope = event.scope === 'baby' ? event.code : '群全体';
  return `<article class="workbench-ledger-row nursery-ledger-row" role="listitem">
    <time class="workbench-ledger-date" datetime="${escapeHtml(event.date || '')}">${formatDate(event.date)}</time>
    <span class="workbench-ledger-marker" aria-hidden="true">${recordIcon(event.type)}</span>
    <div class="workbench-ledger-content">
      <strong class="nursery-ledger-event">${escapeHtml(nurseryEventLabels[event.type] || event.type)}</strong>
      <span class="workbench-ledger-target-code">${escapeHtml(scope)}</span>
      ${summary || event.note ? `<p class="workbench-ledger-summary">${escapeHtml(summary || event.note)}</p>` : ''}
    </div>
  </article>`;
}

function renderSpecimenRegister(items, groupId, registerWindow) {
  const visible = visibleListItems(items, registerWindow);
  const actions = `<div class="nursery-register-actions">
    ${button('一括記録', { action: 'baby-bulk', primary: true, data: { 'group-id': groupId } })}
    ${actionMenu('番号別管理の操作', [
      { label: '通常個体へ移動', action: 'baby-promote', data: { 'group-id': groupId } }
    ], { iconName: 'more', iconOnly: true, className: 'nursery-register-menu' })}
  </div>`;
  return `<section class="nursery-data-section nursery-register-section">
    <header class="nursery-section-header"><div><h2>番号別管理</h2></div>${actions}</header>
    ${items.length ? `${renderResponsiveRegister(visible)}${renderNurseryProgressiveFooter(visible.length, items.length)}` : emptyState('管理番号はまだありません。', { compact: true })}
  </section>`;
}

function renderNurseryProgressiveFooter(visible, total, announcement = '') {
  return renderProgressiveListFooter({ visible, total, action: 'show-more-nursery-items', label: 'さらに100匹表示', noun: '匹',
    role: 'nursery-progressive-footer', className: 'nursery-progressive-footer', announcement });
}

export function appendNurseryRegisterWindow(root, { items = [], registerWindow = createListWindow() } = {}) {
  const body = root?.querySelector?.('.nursery-specimen-registry tbody');
  const footer = root?.querySelector?.('[data-role="nursery-progressive-footer"]');
  if (!body || !footer) return false;
  const visible = visibleListItems(items, registerWindow);
  const existing = body.querySelectorAll('[data-nursery-item-code]').length;
  const added = visible.slice(existing);
  if (added.length) body.insertAdjacentHTML('beforeend', added.map(renderNurseryRegisterRow).join(''));
  footer.outerHTML = renderNurseryProgressiveFooter(visible.length, items.length,
    `${added.length}匹を追加しました。${visible.length} / ${items.length}匹を表示しています。`);
  return true;
}

function renderResponsiveRegister(items) {
  return `<div class="registry-frame nursery-specimen-registry"><table class="registry-table"><caption class="visually-hidden">ベビー群の番号別管理</caption><thead><tr><th scope="col">番号</th><th scope="col">状態</th><th scope="col">最終脱皮</th><th scope="col">メモ</th></tr></thead><tbody>${items.map(renderNurseryRegisterRow).join('')}</tbody></table></div>`;
}

export function renderNurseryRegisterRow(item) {
  // Keep the prefix and newly appended rows reusable by the page-cache render,
  // but never reuse a row after an in-place status, date, code or note change.
  const inputs = [item.code, item.status, item.last_molt, item.note]
    .map((value) => value !== null && typeof value === 'object' ? String(value) : value);
  const cached = nurseryRegisterRows.get(item);
  if (cached && inputs.every((value, index) => Object.is(value, cached.inputs[index]))) return cached.html;
  const html = `<tr data-nursery-item-code="${escapeHtml(item.code)}">
    <td data-label="番号"><strong class="nursery-specimen-code">${escapeHtml(item.code)}</strong></td>
    <td data-label="状態"><span class="nursery-specimen-status ${babyStatusClass(item.status)}">${escapeHtml(babyStatus(item.status))}</span></td>
    <td data-label="最終脱皮"><time datetime="${escapeHtml(item.last_molt || '')}">${formatDate(item.last_molt)}</time></td>
    <td data-label="メモ" class="nursery-specimen-note" title="${escapeHtml(item.note || '')}">${escapeHtml(item.note || '—')}</td>
  </tr>`;
  if (item && typeof item === 'object') nurseryRegisterRows.set(item, { inputs, html });
  return html;
}

function babyStatus(status) {
  return babyStatusLabel(status || 'alive');
}

function babyStatusClass(status) {
  return ['dead', 'rehomed', 'transferred'].includes(status) ? `is-${status}` : 'is-alive';
}
