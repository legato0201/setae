import { escapeHtml, safeHttpUrl } from './ui.js';
import { emptyState, tabs } from './primitives.js';
import { mediaImage } from './media.js';

export const list = (value, keys = []) => {
  if (Array.isArray(value)) return value;
  for (const key of keys) {
    if (Array.isArray(value?.[key])) return value[key];
  }
  return [];
};

export const plainText = (html = '') => {
  const element = document.createElement('div');
  element.innerHTML = String(html || '');
  return element.textContent || '';
};

export const excerpt = (html = '', max = 180) => {
  const value = plainText(html).replace(/\s+/g, ' ').trim();
  return value.length > max ? `${value.slice(0, max)}…` : value;
};

export const formatDate = (value, includeTime = false) => {
  if (!value) return '—';
  const normalized = String(value).replace(' ', 'T');
  const date = new Date(normalized);
  if (Number.isNaN(date.getTime())) return escapeHtml(value);
  return new Intl.DateTimeFormat('ja-JP', includeTime
    ? { year: 'numeric', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }
    : { year: 'numeric', month: 'numeric', day: 'numeric' }
  ).format(date);
};

export const segmentedTabs = (items, active, action, label) => tabs(
  items.map(([id, text]) => ({ id, label: text })),
  { activeId: active, action, dataKey: 'tab', label, className: 'page-tabs' }
);

const loadingShape = (variant) => ({
  registry: Array.from({ length: 3 }, () => '<span class="loading-shape-row"><i class="loading-skeleton is-thumbnail"></i><b><i class="loading-skeleton"></i><i class="loading-skeleton is-short"></i></b></span>').join(''),
  ledger: Array.from({ length: 3 }, () => '<span class="loading-shape-row is-ledger"><i class="loading-skeleton is-date"></i><i class="loading-skeleton is-marker"></i><b><i class="loading-skeleton"></i><i class="loading-skeleton is-short"></i></b></span>').join(''),
  photo: Array.from({ length: 3 }, () => '<span class="loading-skeleton is-photo"></span>').join(''),
  property: Array.from({ length: 4 }, () => '<span class="loading-shape-row is-property"><i class="loading-skeleton is-label"></i><i class="loading-skeleton"></i></span>').join(''),
  form: Array.from({ length: 3 }, () => '<span class="loading-shape-field"><i class="loading-skeleton is-label"></i><i class="loading-skeleton is-control"></i></span>').join('')
})[variant] || '<span class="loading-skeleton"></span><span class="loading-skeleton is-short"></span><span class="loading-skeleton"></span>';

export const loadingBlock = (label = '読み込み中…', variant = 'default') => {
  const resolvedVariant = ['registry', 'ledger', 'photo', 'property', 'form'].includes(variant) ? variant : 'default';
  return `
    <div class="loading-state is-${resolvedVariant}" aria-busy="true" aria-live="polite">
      <span class="loading-label">${escapeHtml(label)}</span>
      <span class="loading-shape" aria-hidden="true">${loadingShape(resolvedVariant)}</span>
    </div>
  `;
};

export const emptyBlock = (message, action = '', actionLabel = '') => emptyState(message, {
  className: 'surface',
  action,
  actionLabel,
  primary: true
});

export const authorRow = (item = {}) => {
  const name = item.author_name || item.user_name || '利用者';
  const avatar = safeHttpUrl(item.author_avatar || item.avatar_url);
  return `
    <div class="author-row">
      ${avatar
        ? mediaImage({ src: avatar, alt: '', className: 'author-avatar', width: 40, height: 40 })
        : `<span class="author-avatar author-initial" aria-hidden="true">${escapeHtml(String(name).slice(0, 1))}</span>`}
      <div>
        <strong>${escapeHtml(name)}</strong>
        <span>${formatDate(item.created_at || item.date, true)}</span>
      </div>
    </div>
  `;
};
