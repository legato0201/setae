import { escapeHtml } from './ui.js';
import { dataAttributes } from './primitives.js';

export function activityRow({
  date = '',
  time = '',
  title = '',
  summary = '',
  iconHtml = '',
  mediaHtml = '',
  flag = '',
  actionsHtml = '',
  action = '',
  data = {},
  className = ''
} = {}) {
  const tag = action ? 'button' : 'article';
  const actionAttributes = action ? `type="button" data-action="${escapeHtml(action)}" ${dataAttributes(data)}` : '';
  return `<${tag} class="activity-row ${action ? 'is-actionable' : ''} ${escapeHtml(className)}" ${actionAttributes}><time class="activity-row-date">${escapeHtml(date || '—')}${time ? `<small>${escapeHtml(time)}</small>` : ''}</time><span class="activity-row-icon" aria-hidden="true">${iconHtml}</span><div class="activity-row-content"><div class="activity-row-heading"><strong>${escapeHtml(title || '記録')}</strong>${flag ? `<span>${escapeHtml(flag)}</span>` : ''}</div>${summary ? `<p>${escapeHtml(summary)}</p>` : ''}${mediaHtml}</div>${actionsHtml ? `<div class="activity-row-actions">${actionsHtml}</div>` : ''}</${tag}>`;
}

export function activityList(groups = [], {
  emptyMessage = '記録はありません。',
  className = ''
} = {}) {
  if (!groups.length) return `<div class="activity-empty">${escapeHtml(emptyMessage)}</div>`;
  return `<div class="activity-list ${escapeHtml(className)}">${groups.map((group) => `<section class="activity-group"><h3>${escapeHtml(group.title || '')}</h3><div>${group.rowsHtml || ''}</div></section>`).join('')}</div>`;
}
