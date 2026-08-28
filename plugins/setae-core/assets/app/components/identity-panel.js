import { escapeHtml } from './ui.js';

export function identityPanel({
  mediaHtml = '',
  mediaLabel = '個体写真',
  identity = {},
  facts = [],
  actionsHtml = '',
  labelHtml = '',
  className = ''
} = {}) {
  const identityHtml = identity.code || identity.title || identity.meta
    ? `<header class="identity-panel-heading"><strong>${escapeHtml(identity.code || '—')}</strong><h2>${escapeHtml(identity.title || 'Species undetermined')}</h2>${identity.meta ? `<p>${escapeHtml(identity.meta)}</p>` : ''}</header>`
    : '';
  return `<aside class="identity-panel ${escapeHtml(className)}" aria-label="個体識別情報"><figure class="identity-panel-media"><div>${mediaHtml}</div><figcaption>${escapeHtml(mediaLabel)}</figcaption></figure>${identityHtml}<dl class="identity-panel-facts">${facts.map((fact) => `<div><dt>${escapeHtml(fact.label)}</dt><dd class="${fact.mono ? 'is-mono' : ''}">${escapeHtml(fact.value || '—')}</dd></div>`).join('')}</dl>${actionsHtml ? `<div class="identity-panel-actions">${actionsHtml}</div>` : ''}${labelHtml ? `<div class="identity-panel-label">${labelHtml}</div>` : ''}</aside>`;
}

export function fieldLabelSummary(title, detail, actionHtml, description = '') {
  return `<section class="field-label-summary"><div><strong>${escapeHtml(title)}</strong><span>${escapeHtml(detail)}</span>${description ? `<p>${escapeHtml(description)}</p>` : ''}</div>${actionHtml ? `<div class="field-label-summary-actions">${actionHtml}</div>` : ''}</section>`;
}
