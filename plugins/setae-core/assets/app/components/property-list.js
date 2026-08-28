import { escapeHtml } from './ui.js';

const displayValue = (value, fallback = '—') => value === null || value === undefined || value === ''
  ? fallback
  : String(value);

export function propertyRow(label, value, {
  valueHtml = '',
  detail = '',
  mono = false,
  actionHtml = '',
  className = ''
} = {}) {
  return `<div class="property-row ${mono ? 'is-mono' : ''} ${escapeHtml(className)}"><dt>${escapeHtml(label)}</dt><dd><span>${valueHtml || escapeHtml(displayValue(value))}</span>${detail ? `<small>${escapeHtml(detail)}</small>` : ''}</dd>${actionHtml ? `<div class="property-row-action">${actionHtml}</div>` : ''}</div>`;
}

export function propertyList(title, rows = [], {
  eyebrow = '',
  actionHtml = '',
  className = '',
  labelledBy = ''
} = {}) {
  const id = labelledBy || `property-${String(title || 'list').toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
  const content = rows.map((row) => Array.isArray(row)
    ? propertyRow(row[0], row[1], row[2] || {})
    : propertyRow(row.label, row.value, row)).join('');
  return `<section class="property-list ${escapeHtml(className)}" aria-labelledby="${escapeHtml(id)}"><header class="property-list-header"><div>${eyebrow ? `<span>${escapeHtml(eyebrow)}</span>` : ''}<h2 id="${escapeHtml(id)}">${escapeHtml(title)}</h2></div>${actionHtml}</header><dl>${content}</dl></section>`;
}
