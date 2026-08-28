import { button } from './primitives.js';
import { escapeHtml } from './ui.js';

const positiveInteger = (value, fallback) => {
  const parsed = Number.parseInt(value, 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
};

export function createListWindow(options = {}) {
  const settings = typeof options === 'number' ? { limit: options } : options || {};
  const initial = positiveInteger(settings.initial, 100);
  const step = positiveInteger(settings.step, 100);
  return {
    initial,
    step,
    limit: Math.max(initial, positiveInteger(settings.limit, initial))
  };
}

export function visibleListItems(items = [], windowState = createListWindow()) {
  const source = Array.isArray(items) ? items : [];
  const window = createListWindow(windowState);
  return source.slice(0, Math.min(source.length, window.limit));
}

export function extendListWindow(windowState, total = Number.POSITIVE_INFINITY) {
  const window = createListWindow(windowState);
  const maximum = Number.isFinite(Number(total)) ? Math.max(0, Number(total)) : Number.POSITIVE_INFINITY;
  return { ...window, limit: Math.min(maximum, window.limit + window.step) };
}

export function resetListWindow(windowState = {}) {
  const window = createListWindow(windowState);
  return { ...window, limit: window.initial };
}

export function listWindowForGroup(windowState = {}, groupId = '') {
  return { ...createListWindow(windowState), groupId: String(groupId || '') };
}

export function clampListWindow(windowState, total = 0) {
  const window = createListWindow(windowState);
  const maximum = Math.max(0, Number(total) || 0);
  if (maximum === 0) return { ...window, limit: window.initial };
  return { ...window, limit: Math.max(window.initial, Math.min(window.limit, maximum)) };
}

export function renderProgressiveListFooter({
  visible = 0,
  total = 0,
  action = '',
  label = 'さらに表示',
  noun = '件',
  role = '',
  className = '',
  announcement = ''
} = {}) {
  const shown = Math.min(Math.max(0, Number(visible) || 0), Math.max(0, Number(total) || 0));
  const count = Math.max(0, Number(total) || 0);
  const remaining = Math.max(0, count - shown);
  return `<footer class="progressive-list-footer ${escapeHtml(className)}"${role ? ` data-role="${escapeHtml(role)}"` : ''}>
    <output class="progressive-list-count" tabindex="-1">${shown.toLocaleString('ja-JP')} / ${count.toLocaleString('ja-JP')}${escapeHtml(noun)}を表示</output>
    <span class="visually-hidden" aria-live="polite">${escapeHtml(announcement)}</span>
    ${remaining && action ? button(label, {
      action,
      className: 'progressive-list-more',
      data: { remaining },
      aria: { 'aria-label': `${label}。残り${remaining}${noun}` }
    }) : ''}
  </footer>`;
}

export function restoreProgressiveListFocus(root, action, footerRole, scrollY, windowRef = globalThis.window) {
  windowRef?.requestAnimationFrame?.(() => {
    const target = root?.querySelector?.(`[data-action="${action}"]`)
      || root?.querySelector?.(`[data-role="${footerRole}"] .progressive-list-count`);
    target?.focus?.({ preventScroll: true });
    if (Math.abs((windowRef.scrollY || 0) - scrollY) > 1) {
      windowRef.scrollTo({ top: scrollY, left: 0, behavior: 'auto' });
    }
  });
}
