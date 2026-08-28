import { escapeHtml } from './ui.js';

export function renderBrand({
  subtitle = 'Living Collection Workbench',
  className = '',
  size = 'default'
} = {}) {
  const classes = [
    'setae-brand',
    ['compact', 'prominent'].includes(size) ? `is-${size}` : '',
    className
  ].filter(Boolean).join(' ');

  return `<div class="${escapeHtml(classes)}">
    <span class="setae-brand-icon" aria-hidden="true"></span>
    <span class="setae-brand-copy">
      <strong class="setae-brand-title">SETAE</strong>
      ${subtitle ? `<span class="setae-brand-subtitle">${escapeHtml(subtitle)}</span>` : ''}
    </span>
  </div>`;
}
