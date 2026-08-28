import { escapeHtml, safeHttpUrl } from '../../components/ui.js';
import { formatDate, loadingBlock } from '../../components/content.js';
import { icon, recordIcon } from '../../components/icons.js';
import {
  actionMenu,
  button,
  emptyState,
  statusIndicator,
  textButton,
  textIconButton
} from '../../components/primitives.js';
import { registryActionRow } from '../../components/patterns.js';
import { enclosureCareDefinitions, resolveEnclosureCarePlan } from './care-plan.js';
import { mediaImage } from '../../components/media.js';

export function renderEnclosureRegistry(data) {
  if (!data) return loadingBlock('飼育容器を読み込み中…', 'registry');
  const items = Array.isArray(data) ? data : data.items || [];
  const summary = data.summary || {};
  const totals = {
    active: summary.active ?? items.length,
    occupants: summary.occupants ?? items.reduce((sum, item) => sum + Number(item.occupant_count || 0), 0),
    environment: summary.environment_due ?? items.filter((item) => item.care?.environment_due).length,
    maintenance: summary.maintenance_due ?? items.filter((item) => item.care?.maintenance_due).length
  };

  return `<div class="enclosure-registry-workbench">
    <div class="husbandry-operational-summary enclosure-summary" aria-label="飼育容器の概要">
      ${summaryItem('使用中', totals.active)}
      ${summaryItem('入居', totals.occupants)}
      ${summaryItem('環境確認', totals.environment, totals.environment > 0)}
      ${summaryItem('メンテナンス', totals.maintenance, totals.maintenance > 0)}
    </div>
    ${items.length
      ? `<div class="enclosure-registry" role="list">${items.map(renderEnclosureRow).join('')}</div>`
      : emptyState('', { title: '飼育容器はまだ登録されていません', description: '容器を登録すると、入居個体と環境記録を関連付けられます。', iconName: 'husbandry', reason: 'initial', action: 'add-enclosure', actionLabel: '容器を登録', primary: true })}
  </div>`;
}

export function renderEnclosureDetail(enclosure, { loading = false, careProfile = {} } = {}) {
  if (loading || !enclosure) return loadingBlock('容器の記録を読み込み中…', 'property');
  const occupants = enclosure.occupants || [];
  const events = enclosure.events || [];
  const history = enclosure.occupancy_history || [];
  const carePlan = resolveEnclosureCarePlan(enclosure, careProfile);
  const photoUrl = safeHttpUrl(enclosure.photo_url);

  return `<div class="enclosure-detail-workbench">
    <div class="husbandry-back-row">${textIconButton('chevronLeft', '飼育容器一覧', { action: 'close-enclosure', className: 'husbandry-back-action' })}</div>
    <article class="enclosure-workspace">
      <section class="enclosure-overview" aria-label="容器の概要">
        ${photoUrl
          ? mediaImage({ src: photoUrl, alt: `${enclosure.code}の飼育容器`, className: 'enclosure-photo', width: 1200, height: 900 })
          : `<div class="enclosure-photo-placeholder" aria-hidden="true"><span>${escapeHtml(enclosure.code)}</span></div>`}
        <div class="enclosure-overview-copy">
          <span class="eyebrow">飼育容器 / ${escapeHtml(enclosure.type_label || '種類未設定')}</span>
          <strong>${escapeHtml(enclosure.name || enclosure.location || '名称未設定')}</strong>
          <p>${escapeHtml([enclosure.dimensions_label, enclosure.location].filter(Boolean).join(' · ') || '容器情報未設定')}</p>
          <div class="enclosure-overview-status">${statusIndicator(`${occupants.length}匹入居`, { tone: occupants.length ? 'success' : 'neutral' })}${statusIndicator(enclosureDueLabel(enclosure), { tone: enclosureHasDue(enclosure) ? 'warning' : 'success' })}</div>
        </div>
      </section>

      <section class="husbandry-workbench-section enclosure-environment-section">
        <header class="husbandry-section-heading"><div><h2>環境</h2></div>${textButton('確認を記録', { action: 'record-enclosure', data: { 'enclosure-id': enclosure.id, 'event-type': 'environment_check' } })}</header>
        <div class="enclosure-readings">
          ${reading('温度', enclosure.last_environment?.temperature, '°C', enclosure.target_temp_min, enclosure.target_temp_max)}
          ${reading('湿度', enclosure.last_environment?.humidity, '%', enclosure.target_humidity_min, enclosure.target_humidity_max)}
        </div>
        <div class="enclosure-section-meta"><span>最終確認 ${formatDate(enclosure.last_environment?.event_date)}</span>${dueStatus(enclosure.care?.environment_due, enclosure.care?.environment_due_at, '次回確認')}</div>
      </section>

      <section class="husbandry-workbench-section enclosure-properties-section">
        <header class="husbandry-section-heading"><div><h2>容器情報</h2></div></header>
        <dl class="enclosure-property-list">
          ${property('種類', enclosure.type_label)}
          ${property('寸法', enclosure.dimensions_label)}
          ${property('設置場所', enclosure.location)}
          ${property('床材', enclosure.substrate)}
          ${property('床材の深さ', enclosure.substrate_depth_mm == null ? '' : `${number(enclosure.substrate_depth_mm / 10)} cm`)}
        </dl>
        <div class="enclosure-section-meta"><span>最終整備 ${formatDate(enclosure.last_maintenance?.event_date)}</span>${dueStatus(enclosure.care?.maintenance_due, enclosure.care?.maintenance_due_at, '次回整備')}</div>
      </section>

      <section class="husbandry-workbench-section enclosure-occupants-section">
        <header class="husbandry-section-heading"><div><h2>入居個体 <small>${occupants.length}</small></h2></div>${button('個体を入れる', { action: 'assign-enclosure', data: { 'enclosure-id': enclosure.id } })}</header>
        ${occupants.length ? `<div class="enclosure-occupant-list" role="list">${occupants.map((item) => renderOccupant(item, enclosure)).join('')}</div>` : emptyState('現在入居している個体はいません。', { compact: true })}
      </section>

      <section class="husbandry-workbench-section enclosure-care-plan-panel">
        <header class="husbandry-section-heading"><div><h2>作業間隔</h2></div>${textButton('個別設定', { action: 'edit-enclosure', data: { 'enclosure-id': enclosure.id } })}</header>
        <dl class="enclosure-care-plan-list">${Object.entries(enclosureCareDefinitions).map(([key, definition]) => careProperty(definition.label, carePlan[key])).join('')}</dl>
      </section>

      <section class="husbandry-workbench-section enclosure-history-section">
        <header class="husbandry-section-heading"><div><h2>容器の記録</h2></div>${button('記録を追加', { action: 'record-enclosure', data: { 'enclosure-id': enclosure.id } })}</header>
        ${events.length ? `<div class="workbench-ledger enclosure-ledger" role="list">${events.map(renderEvent).join('')}</div>` : emptyState('容器の記録はまだありません。', { compact: true })}
      </section>

      ${history.length ? `<details class="enclosure-occupancy-history"><summary>過去の入居履歴 <span>${history.length}</span></summary><div class="enclosure-occupancy-history-list">${history.map((item) => `<div><strong>${escapeHtml(item.animal_code)}</strong><span>${formatDate(item.started_at)} — ${item.ended_at ? formatDate(item.ended_at) : '入居中'}</span></div>`).join('')}</div></details>` : ''}
    </article>
  </div>`;
}

export function environmentReadingTone(value, min, max) {
  if (value === null || value === undefined || value === '') return 'unknown';
  const current = Number(value);
  if (!Number.isFinite(current)) return 'unknown';
  if (min !== null && min !== undefined && min !== '' && current < Number(min)) return 'low';
  if (max !== null && max !== undefined && max !== '' && current > Number(max)) return 'high';
  return 'within';
}

function renderEnclosureRow(enclosure) {
  const due = enclosureHasDue(enclosure);
  const content = `<span class="enclosure-record-code">${escapeHtml(enclosure.code)}</span>
    <span class="enclosure-record-identity"><strong>${escapeHtml(enclosure.name || enclosure.type_label || '飼育容器')}</strong><small>${escapeHtml([enclosure.type_label, enclosure.dimensions_label, enclosure.location].filter(Boolean).join(' · '))}</small></span>
    <span class="enclosure-record-occupants"><small>入居</small><strong>${escapeHtml(enclosure.occupant_count || 0)}</strong></span>
    <span class="enclosure-record-reading"><strong>${measurement(enclosure.last_environment?.temperature, '°C')} · ${measurement(enclosure.last_environment?.humidity, '%')}</strong><small>温度 · 湿度</small></span>
    <span class="enclosure-record-status">${statusIndicator(enclosureDueLabel(enclosure), { tone: due ? 'warning' : 'success' })}<small>最終確認 ${formatDate(enclosure.last_environment?.event_date)}</small></span>
    <span class="enclosure-record-open" aria-hidden="true">${icon('chevronRight')}</span>`;
  return `<article class="enclosure-record-row ${due ? 'is-due' : ''}" role="listitem">${registryActionRow(content, {
    action: 'open-enclosure',
    data: { 'enclosure-id': enclosure.id },
    className: 'enclosure-record-main',
    label: `${enclosure.code} ${enclosure.name || enclosure.type_label || '飼育容器'}を開く`
  })}</article>`;
}

function renderOccupant(item, enclosure) {
  const content = `<strong>${escapeHtml(item.animal_code)}</strong><span class="scientific-name">${escapeHtml(item.species_name || '種類不明')}</span><small>${formatDate(item.started_at)}から</small>`;
  return `<div class="enclosure-occupant-row" role="listitem">${registryActionRow(content, {
    action: 'open-enclosure-animal',
    data: { 'animal-id': item.animal_id },
    className: 'enclosure-occupant-main',
    label: `${item.animal_code}を開く`
  })}${actionMenu('入居個体の操作', [{
    label: '退居',
    action: 'end-enclosure-occupancy',
    data: { 'enclosure-id': enclosure.id, 'animal-id': item.animal_id, 'animal-code': item.animal_code }
  }], { iconName: 'more', iconOnly: true, className: 'enclosure-occupant-menu' })}</div>`;
}

function renderEvent(event) {
  const readings = [
    event.temperature == null ? '' : `${number(event.temperature)} °C`,
    event.humidity == null ? '' : `${number(event.humidity)} %`
  ].filter(Boolean);
  const summary = [...readings, event.animal_code || '', event.note || ''].filter(Boolean).join(' · ');
  return `<article class="workbench-ledger-row enclosure-ledger-row" role="listitem">
    <time class="workbench-ledger-date" datetime="${escapeHtml(event.event_date || '')}">${formatDate(event.event_date)}</time>
    <span class="workbench-ledger-marker" aria-hidden="true">${recordIcon(event.event_type)}</span>
    <div class="workbench-ledger-content"><strong>${escapeHtml(event.event_label || event.event_type || '記録')}</strong>${summary ? `<p class="workbench-ledger-summary">${escapeHtml(summary)}</p>` : ''}</div>
  </article>`;
}

function summaryItem(label, value, warning = false) {
  return `<span class="${warning ? 'is-warning' : ''}"><small>${escapeHtml(label)}</small><strong>${escapeHtml(value)}</strong></span>`;
}

function reading(label, value, unit, min, max) {
  const tone = environmentReadingTone(value, min, max);
  const stateLabel = tone === 'low' ? '低い' : tone === 'high' ? '高い' : '';
  const valueHtml = value === null || value === undefined || value === ''
    ? '<strong>—</strong>'
    : `<strong>${escapeHtml(number(value))}<small>${escapeHtml(unit)}</small></strong>`;
  return `<div class="enclosure-reading is-${tone}"><span>${escapeHtml(label)}</span>${valueHtml}<p>${escapeHtml(range(min, max, unit) || '目標未設定')}${stateLabel ? ` <b>${stateLabel}</b>` : ''}</p></div>`;
}

function property(label, value) {
  return `<div><dt>${escapeHtml(label)}</dt><dd>${escapeHtml(value || '—')}</dd></div>`;
}

function careProperty(label, value) {
  const interval = Number(value);
  return `<div class="${interval ? '' : 'is-disabled'}"><dt>${escapeHtml(label)}</dt><dd>${interval ? `${escapeHtml(interval)}日ごと` : '使用しない'}</dd></div>`;
}

function range(min, max, unit) {
  if (min == null && max == null) return '';
  if (min == null) return `目標 ${number(max)}${unit}以下`;
  if (max == null) return `目標 ${number(min)}${unit}以上`;
  return `目標 ${number(min)}–${number(max)}${unit}`;
}

function measurement(value, unit) {
  return value == null || value === '' ? '—' : `${number(value)}${unit}`;
}

function number(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return '—';
  return Number.isInteger(numeric) ? String(numeric) : numeric.toFixed(1);
}

function enclosureHasDue(enclosure) {
  return Boolean(enclosure.care?.environment_due || enclosure.care?.maintenance_due);
}

function enclosureDueLabel(enclosure) {
  if (enclosure.care?.environment_due && enclosure.care?.maintenance_due) return '環境・整備を確認';
  if (enclosure.care?.environment_due) return '要確認';
  if (enclosure.care?.maintenance_due) return '要整備';
  return '確認済み';
}

function dueStatus(due, date, label) {
  return statusIndicator(due ? `${label}が必要` : `${label} ${formatDate(date)}`, { tone: due ? 'warning' : 'neutral' });
}
