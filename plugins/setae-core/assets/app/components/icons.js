const paths = {
  today: '<path d="M8 2v4M16 2v4"/><rect width="18" height="18" x="3" y="4" rx="2"/><path d="M3 10h18M8 14h.01M12 14h.01M16 14h.01M8 18h.01M12 18h.01"/>',
  collection: '<rect width="20" height="5" x="2" y="3" rx="1"/><path d="M4 8v11a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8M10 12h4"/>',
  records: '<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2Z"/>',
  calendar: '<path d="M8 2v4"/><path d="M16 2v4"/><rect width="18" height="18" x="3" y="4" rx="2"/><path d="M3 10h18"/>',
  community: '<path d="M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4Z"/><path d="M8 9h8M8 13h5"/>',
  settings: '<path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.38a2 2 0 0 0-.73-2.73l-.15-.09a2 2 0 0 1-1-1.74v-.51a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2Z"/><circle cx="12" cy="12" r="3"/>',
  plus: '<path d="M5 12h14M12 5v14"/>',
  logout: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 22a8 8 0 0 1 16 0"/>',
  star: '<path d="m12 2.8 2.85 5.77 6.37.93-4.61 4.49 1.09 6.34L12 17.34l-5.7 2.99 1.09-6.34L2.78 9.5l6.37-.93L12 2.8Z"/>',
  qr: '<path d="M3.5 3.5h6v6h-6zM5.5 5.5h2v2h-2zM14.5 3.5h6v6h-6zM16.5 5.5h2v2h-2zM3.5 14.5h6v6h-6zM5.5 16.5h2v2h-2zM13 13h2v2h-2zM18 13h2.5v3M13 18h3v2.5M18.5 18.5h2"/>',
  husbandry: '<path d="M14 4v10.54a4 4 0 1 1-4 0V4a2 2 0 0 1 4 0Z"/><path d="M12 8v8M8 4h2M8 8h2"/>',
  feed: '<ellipse cx="12" cy="8.2" rx="2.1" ry="2.5"/><ellipse cx="12" cy="13.2" rx="2.8" ry="3.1"/><path d="M10.9 5.8 9.3 3.7M13.1 5.8l1.6-2.1M9.6 10 6.3 8.2M14.4 10l3.3-1.8M9.2 13H5.3M14.8 13h3.9M9.7 15.4l-3 3M14.3 15.4l3 3"/>',
  observation: '<path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z"/><circle cx="12" cy="12" r="2.5"/>',
  molt: '<path d="M11.2 4.2c-3.7.6-6.3 3.2-6.3 6.4 0 4 2.8 7.2 6.3 9.2M12.8 4.2c3.7.6 6.3 3.2 6.3 6.4 0 4-2.8 7.2-6.3 9.2M12 3v18M9.7 7.2 7 5.4M14.3 7.2 17 5.4M9.3 11.4 5.5 10M14.7 11.4l3.8-1.4M9.6 15.2 6.8 17M14.4 15.2l2.8 1.8"/>',
  growth: '<path d="M5 19 19 5M8 16l-2-2M11 13l-2-2M14 10l-2-2M17 7l-2-2"/><path d="m15 5 4 4"/>',
  photo: '<path d="M14.5 5 13 3h-2L9.5 5H5a2 2 0 0 0-2 2v11a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-4.5Z"/><circle cx="12" cy="12.5" r="3.5"/>',
  pairing: '<path d="M10 13a5 5 0 0 0 7.1.1l2-2a5 5 0 0 0-7.1-7.1l-1.1 1.1"/><path d="M14 11a5 5 0 0 0-7.1-.1l-2 2A5 5 0 0 0 12 20l1.1-1.1"/>',
  environment: '<path d="M14 4v10.54a4 4 0 1 1-4 0V4a2 2 0 0 1 4 0Z"/><path d="M12 8v8M17 7h4M17 12h3"/>',
  maintenance: '<path d="m14.7 6.3 3-3a4 4 0 0 1-5 5L5 16l-1 4 4-1 7.7-7.7a4 4 0 0 1 5-5l-3 3-3-3Z"/>',
  more: '<circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/>',
  close: '<path d="m6 6 12 12M18 6 6 18"/>',
  chevronRight: '<path d="m9 18 6-6-6-6"/>',
  chevronLeft: '<path d="m15 18-6-6 6-6"/>',
  chevronUp: '<path d="m18 15-6-6-6 6"/>',
  chevronDown: '<path d="m6 9 6 6 6-6"/>',
  edit: '<path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L8 18l-4 1 1-4Z"/>',
  trash: '<path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6M10 11v5M14 11v5"/>',
  moveUp: '<path d="M12 19V5M6 11l6-6 6 6"/>',
  moveDown: '<path d="M12 5v14M18 13l-6 6-6-6"/>',
  moveLeft: '<path d="M19 12H5M11 18l-6-6 6-6"/>',
  moveRight: '<path d="M5 12h14M13 6l6 6-6 6"/>',
  resize: '<path d="M8 3H3v5M16 21h5v-5M3 8l6-6M21 16l-6 6"/>',
  externalLink: '<path d="M15 3h6v6M10 14 21 3M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>',
  print: '<path d="M6 9V2h12v7M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect width="12" height="8" x="6" y="14"/>',
  copy: '<rect width="14" height="14" x="8" y="8" rx="2"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"/>',
  check: '<path d="m5 12 4 4L19 6"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/>',
  filter: '<path d="M4 5h16M7 12h10M10 19h4"/>',
  sort: '<path d="M8 7h12M8 12h8M8 17h4M4 5v14"/>',
  minus: '<path d="M5 12h14"/>'
};

export const iconRegistryKeys = Object.freeze({
  today: 'nav.today',
  collection: 'nav.collection',
  records: 'nav.records',
  calendar: 'public.calendar',
  community: 'nav.community',
  settings: 'nav.settings',
  plus: 'ui.plus',
  logout: 'ui.logout',
  user: 'ui.user',
  star: 'status.favorite',
  qr: 'ui.qr',
  husbandry: 'nav.husbandry',
  feed: 'action.feed',
  observation: 'action.observation',
  molt: 'action.molt',
  growth: 'action.growth',
  photo: 'action.photo',
  pairing: 'action.pairing',
  environment: 'action.environment',
  maintenance: 'action.maintenance',
  more: 'ui.more',
  close: 'ui.close',
  chevronRight: 'ui.chevron-right',
  chevronLeft: 'ui.chevron-left',
  chevronUp: 'ui.chevron-up',
  chevronDown: 'ui.chevron-down',
  edit: 'ui.edit',
  trash: 'ui.trash',
  moveUp: 'ui.move-up',
  moveDown: 'ui.move-down',
  moveLeft: 'ui.move-left',
  moveRight: 'ui.move-right',
  resize: 'ui.resize',
  externalLink: 'ui.external-link',
  print: 'ui.print',
  copy: 'ui.copy',
  check: 'ui.check',
  search: 'ui.search',
  filter: 'ui.filter',
  sort: 'ui.sort',
  minus: 'ui.minus'
});

export const iconNames = Object.freeze(Object.keys(paths));

const runtimeConfig = () => globalThis.window?.SETAE_CONFIG || globalThis.SETAE_CONFIG || {};

const configuredOverrides = () => {
  const config = runtimeConfig();
  return config.iconOverrides && typeof config.iconOverrides === 'object'
    ? config.iconOverrides
    : {};
};

const safeClassName = (value) => String(value || '').replace(/[^a-zA-Z0-9 _-]/g, '').trim();
const warnedOverrideKeys = new Set();

function warnRejectedOverride(registryKey) {
  if (!runtimeConfig().debug || !registryKey || warnedOverrideKeys.has(registryKey)) return;
  warnedOverrideKeys.add(registryKey);
  globalThis.console?.warn?.(`[SETAE Icon Registry] Custom SVG rejected: ${registryKey}`);
}

function renderCustomIcon(svg, className, registryKey) {
  const source = String(svg || '').trim();
  if (!source) return '';
  if (
    !/^<svg\b[^>]*\bviewBox=(['"])[^'"]+\1[^>]*>/i.test(source) ||
    !/<\/svg>\s*$/i.test(source) ||
    /<!DOCTYPE|<!ENTITY|<\s*(script|foreignObject|iframe|object|embed|image|style|a|use)\b|\bon[a-z0-9_-]+\s*=|\b(?:href|xlink:href)\s*=|javascript\s*:|data\s*:/i.test(source)
  ) {
    warnRejectedOverride(registryKey);
    return '';
  }

  const opening = source.match(/^<svg\b[^>]*>/i)?.[0];
  if (!opening) {
    warnRejectedOverride(registryKey);
    return '';
  }
  const classes = ['ui-icon', 'is-custom-icon', safeClassName(className)].filter(Boolean).join(' ');
  const normalizedOpening = opening
    .replace(/\s(?:width|height|class|aria-hidden|focusable|tabindex)=("[^"]*"|'[^']*')/gi, '')
    .replace(/^<svg\b/i, `<svg class="${classes}" aria-hidden="true" focusable="false"`);
  return normalizedOpening + source.slice(opening.length);
}

export function icon(name, className = '') {
  const registryKey = iconRegistryKeys[name];
  if (registryKey) {
    const custom = renderCustomIcon(configuredOverrides()[registryKey], className, registryKey);
    if (custom) return custom;
  }
  const body = paths[name] || paths.records;
  return `<svg class="ui-icon ${className}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg>`;
}

export function recordIcon(type, className = '') {
  const name = ({
    feed: 'feed',
    observation: 'observation',
    molt: 'molt',
    growth: 'growth',
    measurement: 'growth',
    photo: 'photo',
    pairing: 'pairing',
    environment: 'environment',
    environment_check: 'environment',
    maintenance: 'maintenance',
    substrate_change: 'maintenance',
    watering: 'environment',
    misting: 'environment',
    animal_move_in: 'collection',
    animal_move_out: 'collection'
  })[type] || 'records';
  return icon(name, `record-type-icon ${className}`.trim());
}
