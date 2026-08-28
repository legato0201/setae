import { escapeHtml } from './ui.js';

export function mediaGrid(items = [], {
  emptyMessage = '写真はありません。',
  className = ''
} = {}) {
  if (!items.length) return `<div class="media-grid-empty">${escapeHtml(emptyMessage)}</div>`;
  return `<div class="media-grid ${escapeHtml(className)}">${items.map((item) => `<article class="media-grid-item"><div class="media-grid-visual">${item.mediaHtml || ''}${item.actionsHtml ? `<div class="media-grid-actions">${item.actionsHtml}</div>` : ''}</div><div class="media-grid-caption"><time>${escapeHtml(item.date || '—')}</time>${item.title ? `<strong>${escapeHtml(item.title)}</strong>` : ''}${item.detail ? `<span>${escapeHtml(item.detail)}</span>` : ''}</div></article>`).join('')}</div>`;
}
