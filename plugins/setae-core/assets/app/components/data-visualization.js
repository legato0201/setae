import { escapeHtml } from './ui.js';

export function metricSummary(items = [], { className = '' } = {}) {
  return `<dl class="metric-summary ${escapeHtml(className)}">${items.map((item) => `<div><dt>${escapeHtml(item.label)}</dt><dd data-metric>${escapeHtml(item.value ?? '—')}</dd>${item.detail ? `<small>${escapeHtml(item.detail)}</small>` : ''}</div>`).join('')}</dl>`;
}

export function chartFrame(contentHtml, {
  label = 'データグラフ',
  caption = '',
  className = ''
} = {}) {
  return `<figure class="chart-frame ${escapeHtml(className)}" aria-label="${escapeHtml(label)}"><div class="chart-frame-canvas">${contentHtml}</div>${caption ? `<figcaption>${escapeHtml(caption)}</figcaption>` : ''}</figure>`;
}
