import { animalStatusLabel } from '../content/terminology.js';

export const escapeHtml = (value = '') =>
  String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');

const configuredSiteOrigin = () => {
  const configured = globalThis.window?.SETAE_CONFIG?.siteOrigin;
  return configured || globalThis.location?.origin || 'https://setae.invalid';
};

export const safeHttpUrl = (value, fallback = '') => {
  if (!String(value || '').trim()) return fallback;
  try {
    const url = new URL(String(value).trim(), configuredSiteOrigin());
    return ['http:', 'https:'].includes(url.protocol) ? url.href : fallback;
  } catch {
    return fallback;
  }
};

export const safeSameOriginHttpUrl = (value, fallback = '') => {
  const origin = configuredSiteOrigin();
  const url = safeHttpUrl(value, fallback);
  if (!url) return fallback;
  try {
    return new URL(url).origin === new URL(origin).origin ? url : fallback;
  } catch {
    return fallback;
  }
};

export const text = (value, fallback = '—') =>
  value === null || value === undefined || value === '' ? fallback : String(value);

export const scientificName = (animal) =>
  animal?.species_name ||
  animal?.species?.scientific_name ||
  animal?.species?.name ||
  animal?.custom_species ||
  '種名未設定';

export const familyName = (animal) =>
  animal?.family_name ||
  animal?.species?.family_name ||
  animal?.species?.family ||
  animal?.family ||
  '';

export const genderLabel = (gender) => ({
  female: 'メス',
  male: 'オス',
  unknown: '不明'
}[String(gender || 'unknown').toLowerCase()] || '不明');

export const animalCode = (animal) =>
  animal?.individual_code ||
  animal?.code ||
  animal?.name ||
  animal?.title ||
  `#${animal?.id ?? '?'}`;

const specimenAssetUrl = (animal) => {
  const classification = String(
    animal?.classification ||
    animal?.classification_key ||
    animal?.species?.classification ||
    'tarantula'
  ).toLowerCase();
  const isArachnid = ['tarantula', 'spider', 'arachnid', 'scorpion'].includes(classification);
  const assets = globalThis.window?.SETAE_CONFIG?.specimenAssets || {};
  const bundledAsset = new URL(
    `../../images/specimen/${isArachnid ? 'spider-silhouette.svg' : 'generic-specimen.svg'}`,
    import.meta.url
  ).href;
  return safeHttpUrl(isArachnid ? assets.spider || bundledAsset : assets.generic || bundledAsset);
};

export const specimenPlaceholder = (animal, {
  variant = 'exhibit',
  showTaxon = true
} = {}) => {
  const safeVariant = ['exhibit', 'compact', 'thumbnail'].includes(variant) ? variant : 'exhibit';
  const scientific = scientificName(animal);
  const code = animalCode(animal);
  const icon = specimenAssetUrl(animal);
  const taxon = showTaxon
    ? `<div class="setae-specimen-placeholder-taxon"><em>${escapeHtml(scientific)}</em><strong>${escapeHtml(code)}</strong></div>`
    : '';

  return `<div class="setae-specimen-placeholder is-${safeVariant}" role="img" aria-label="標本写真は未登録です">
    ${icon ? `<img class="setae-specimen-placeholder-icon" src="${escapeHtml(icon)}" alt="" aria-hidden="true" loading="eager" decoding="async" fetchpriority="low" width="80" height="80">` : ''}
    ${taxon}
    <small>個体写真は未登録です</small>
  </div>`;
};

export const normalizeStatus = (status) => {
  const v = String(status || 'unknown').toLowerCase().replaceAll('-', '_');
  if (['normal', 'fasting', 'pre_molt', 'post_molt'].includes(v)) return v;
  return 'unknown';
};

export const statusLabel = (status) => animalStatusLabel(normalizeStatus(status));

export const statusChip = (status) => {
  const normalized = normalizeStatus(status);
  return `<span class="status-chip status-${normalized}">
    <span class="status-dot" aria-hidden="true"></span>
    ${statusLabel(normalized)}
  </span>`;
};

export const formatRelativeDays = (value, todayStartMs = null) => {
  if (!value) return '—';
  if (typeof value === 'number') return `${value}日前`;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  const today = todayStartMs ?? new Date().setHours(0,0,0,0);
  const days = Math.floor((today - d.setHours(0,0,0,0)) / 86400000);
  if (days < 0) return `${Math.abs(days)}日後`;
  if (days === 0) return '今日';
  return `${days}日前`;
};
