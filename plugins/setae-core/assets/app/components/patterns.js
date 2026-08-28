import { escapeHtml } from './ui.js';
import { contentAction } from './primitives.js';

export function workspaceHeader(title, {
  meta = '',
  navigationHtml = '',
  actionsHtml = '',
  className = ''
} = {}) {
  return `<header class="workspace-header ${escapeHtml(className)}">
    <div class="workspace-header-main">
      <div class="workspace-title-row">
        <h1>${escapeHtml(title)}</h1>
        ${meta ? `<span class="workspace-meta">${escapeHtml(meta)}</span>` : ''}
      </div>
      ${navigationHtml ? `<div class="workspace-navigation">${navigationHtml}</div>` : ''}
    </div>
    ${actionsHtml ? `<div class="workspace-header-actions">${actionsHtml}</div>` : ''}
  </header>`;
}

export function workspaceToolbar(primaryHtml, {
  secondaryHtml = '',
  className = '',
  label = '操作'
} = {}) {
  return `<div class="workspace-toolbar ${escapeHtml(className)}" role="toolbar" aria-label="${escapeHtml(label)}">
    <div class="workspace-toolbar-primary">${primaryHtml}</div>
    ${secondaryHtml ? `<div class="workspace-toolbar-secondary">${secondaryHtml}</div>` : ''}
  </div>`;
}

export function workspaceSection(title, contentHtml, { className = '', meta = '' } = {}) {
  return `<section class="workspace-section ${escapeHtml(className)}">
    <header class="workspace-section-header"><h2>${escapeHtml(title)}</h2>${meta ? `<span>${escapeHtml(meta)}</span>` : ''}</header>
    <div class="workspace-section-body">${contentHtml}</div>
  </section>`;
}

export function registryActionRow(contentHtml, {
  action = '',
  data = {},
  className = '',
  label = ''
} = {}) {
  return contentAction({
    contentHtml,
    action,
    data,
    className: `registry-action-row ${className}`,
    ariaLabel: label
  });
}
