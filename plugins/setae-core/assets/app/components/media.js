import {
  animalCode,
  escapeHtml,
  safeHttpUrl,
  scientificName
} from './ui.js';

const classificationKinds = {
  tarantula: 'spider',
  true_spider: 'spider',
  spider: 'spider',
  arachnid: 'spider',
  scorpion: 'scorpion',
  insect: 'insect',
  plant: 'plant',
  specimen: 'specimen',
  other: 'specimen'
};

const allowedKinds = new Set(['specimen', 'spider', 'scorpion', 'insect', 'plant']);
const bundledSpecimenAssetUrls = new Map();
const mediaTimers = new WeakMap();
const ratioDimensions = Object.freeze({
  square: [800, 800],
  portrait: [800, 1000],
  wide: [1600, 1000],
  exhibit: [1200, 900],
  auto: [1200, 900]
});

export function mediaKind(classification, fallback = 'specimen') {
  const normalized = String(classification || '').toLowerCase().replaceAll('-', '_');
  const mapped = classificationKinds[normalized] || fallback;
  return allowedKinds.has(mapped) ? mapped : 'specimen';
}

function bundledSpecimenAssetUrl(kind) {
  const resolvedKind = allowedKinds.has(kind) ? kind : 'specimen';
  if (!bundledSpecimenAssetUrls.has(resolvedKind)) {
    const files = {
      spider: 'spider-silhouette.svg',
      scorpion: 'scorpion.svg',
      insect: 'insect.svg',
      plant: 'plant.svg',
      specimen: 'specimen.svg'
    };
    bundledSpecimenAssetUrls.set(resolvedKind, new URL(`../../images/specimen/${files[resolvedKind]}`, import.meta.url).href);
  }
  // Cache the module-relative URL only; site-origin validation must stay live.
  return safeHttpUrl(bundledSpecimenAssetUrls.get(resolvedKind));
}

function specimenAssetSources(kind) {
  const assets = globalThis.window?.SETAE_CONFIG?.specimenAssets || {};
  const fallback = bundledSpecimenAssetUrl(kind);
  const override = assets[kind];
  const primary = override ? safeHttpUrl(override) : fallback;
  return {
    primary,
    fallback: primary && fallback && primary !== fallback ? fallback : ''
  };
}

function fallbackMarkup({ kind, classification, code, scientificName: taxon, compact }) {
  const resolvedKind = mediaKind(classification, allowedKinds.has(kind) ? kind : 'specimen');
  const { primary: icon, fallback } = specimenAssetSources(resolvedKind);
  const fallbackAttribute = fallback
    ? ` data-media-fallback-src="${escapeHtml(fallback)}"`
    : '';
  return `<div class="setae-media-placeholder${compact ? ' is-compact' : ''}" data-media-fallback role="img" aria-label="標本写真は未登録です">
    ${icon ? `<img class="setae-media-placeholder-icon" src="${escapeHtml(icon)}"${fallbackAttribute} alt="" aria-hidden="true" loading="eager" decoding="async" fetchpriority="low" width="64" height="64">` : ''}
    ${taxon || code ? `<div class="setae-media-placeholder-identity">${taxon ? `<em>${escapeHtml(taxon)}</em>` : ''}${code ? `<strong>${escapeHtml(code)}</strong>` : ''}</div>` : ''}
    ${compact ? '' : '<small>SPECIMEN IMAGE · NOT RECORDED</small>'}
  </div>`;
}

export function renderMediaFrame({
  src = '',
  alt = '',
  kind = 'specimen',
  classification = '',
  code = '',
  scientificName: taxon = '',
  attribution = '',
  ratio = 'exhibit',
  compact = false,
  loading = 'lazy',
  decoding = 'async',
  fetchPriority = 'low',
  width = 0,
  height = 0
} = {}) {
  const safeSrc = safeHttpUrl(src);
  const safeRatio = ['square', 'portrait', 'wide', 'exhibit', 'auto'].includes(ratio) ? ratio : 'exhibit';
  const [ratioWidth, ratioHeight] = ratioDimensions[safeRatio];
  const fallback = fallbackMarkup({ kind, classification, code, scientificName: taxon, compact });
  return `<figure class="setae-media-frame is-${safeRatio}${safeSrc ? '' : ' is-media-empty'}" data-setae-media>
    <div class="setae-media-visual">
      ${safeSrc ? mediaImage({
        src: safeSrc,
        alt: alt || [code, taxon].filter(Boolean).join(' · ') || '標本写真',
        loading,
        decoding,
        fetchPriority,
        width: width || ratioWidth,
        height: height || ratioHeight,
        attributes: 'data-media-image'
      }) : ''}
      ${safeSrc ? fallback.replace(' data-media-fallback', ' data-media-fallback hidden') : fallback}
    </div>
    ${attribution ? `<figcaption class="media-attribution">${attribution}</figcaption>` : ''}
  </figure>`;
}

export function mediaImage({
  src = '',
  alt = '',
  className = '',
  loading = 'lazy',
  decoding = 'async',
  fetchPriority = 'low',
  width = 0,
  height = 0,
  attributes = ''
} = {}) {
  const safeSrc = safeHttpUrl(src);
  if (!safeSrc) return '';
  const resolvedLoading = loading === 'eager' ? 'eager' : 'lazy';
  const resolvedDecoding = ['sync', 'auto'].includes(decoding) ? decoding : 'async';
  const resolvedPriority = ['high', 'auto'].includes(fetchPriority) ? fetchPriority : 'low';
  const resolvedWidth = Math.max(1, Number.parseInt(width, 10) || 1);
  const resolvedHeight = Math.max(1, Number.parseInt(height, 10) || 1);
  return `<img${className ? ` class="${escapeHtml(className)}"` : ''} src="${escapeHtml(safeSrc)}" alt="${escapeHtml(alt)}" loading="${resolvedLoading}" decoding="${resolvedDecoding}" fetchpriority="${resolvedPriority}" width="${resolvedWidth}" height="${resolvedHeight}"${attributes ? ` ${attributes}` : ''}>`;
}

export function renderAnimalMedia(animal, options = {}) {
  const src = animal?.image_url || animal?.image?.url || animal?.thumbnail_url || animal?.thumb || '';
  return renderMediaFrame({
    src,
    alt: animalCode(animal),
    classification: animal?.classification || animal?.classification_key || animal?.species?.classification,
    code: animalCode(animal),
    scientificName: scientificName(animal),
    ...options
  });
}

function showMediaFallback(image, reason = 'error') {
  const frame = image?.closest?.('[data-setae-media]');
  if (!frame) return;
  const timer = mediaTimers.get(image);
  if (timer) globalThis.clearTimeout(timer);
  image.hidden = true;
  const fallback = frame.querySelector('[data-media-fallback]');
  if (fallback) fallback.hidden = false;
  frame.classList.add('is-media-error');
  image.dataset.mediaLoadState = reason;
}

function beginImageTimeout(image, timeoutMs) {
  if (!(image instanceof HTMLImageElement) || mediaTimers.has(image)) return;
  if (image.complete) {
    if (!image.naturalWidth) showMediaFallback(image, 'error');
    else image.dataset.mediaLoadState = 'loaded';
    return;
  }
  image.dataset.mediaLoadState = 'loading';
  const timer = globalThis.setTimeout(() => showMediaFallback(image, 'timeout'), timeoutMs);
  mediaTimers.set(image, timer);
}

function retryPlaceholderIcon(image) {
  if (!image.matches('.setae-media-placeholder-icon')) return false;
  if (image.dataset.mediaFallbackAttempted === 'true') return false;
  const fallback = safeHttpUrl(image.dataset.mediaFallbackSrc || '');
  if (!fallback || fallback === image.src) return false;

  image.dataset.mediaFallbackAttempted = 'true';
  image.hidden = false;
  image.classList.remove('is-media-error');
  image.src = fallback;
  return true;
}

export function registerMediaFallbacks(root, { timeoutMs = 15000 } = {}) {
  if (!root || root.dataset?.mediaFallbacksReady === 'true') return;
  if (root.dataset) root.dataset.mediaFallbacksReady = 'true';
  const lazyObserver = typeof IntersectionObserver === 'function'
    ? new IntersectionObserver((entries) => entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        lazyObserver.unobserve(entry.target);
        beginImageTimeout(entry.target, timeoutMs);
      }), { rootMargin: '600px 0px' })
    : null;

  root.addEventListener('error', (event) => {
    if (!(event.target instanceof HTMLImageElement)) return;
    lazyObserver?.unobserve(event.target);
    if (event.target.matches('[data-media-image]')) showMediaFallback(event.target, 'error');
    else if (!retryPlaceholderIcon(event.target)) {
      event.target.hidden = true;
      event.target.classList.add('is-media-error');
    }
  }, true);
  root.addEventListener('load', (event) => {
    if (!(event.target instanceof HTMLImageElement)) return;
    if (event.target.matches('.setae-media-placeholder-icon')) {
      event.target.hidden = false;
      event.target.classList.remove('is-media-error');
      return;
    }
    if (!event.target.matches('[data-media-image]')) return;
    lazyObserver?.unobserve(event.target);
    const timer = mediaTimers.get(event.target);
    if (timer) globalThis.clearTimeout(timer);
    mediaTimers.delete(event.target);
    event.target.dataset.mediaLoadState = 'loaded';
  }, true);

  const observe = (node) => {
    if (!(node instanceof Element)) return;
    const watch = (image) => {
      if (!(image instanceof HTMLImageElement)) return;
      if (image.complete) {
        beginImageTimeout(image, timeoutMs);
        return;
      }
      if (image.loading === 'lazy' && lazyObserver) {
        image.dataset.mediaLoadState = 'idle';
        lazyObserver.observe(image);
      } else {
        beginImageTimeout(image, timeoutMs);
      }
    };
    if (node.matches('[data-media-image]')) watch(node);
    node.querySelectorAll?.('[data-media-image]').forEach(watch);
  };
  observe(root);
  new MutationObserver((mutations) => mutations.forEach((mutation) => mutation.addedNodes.forEach(observe)))
    .observe(root, { childList: true, subtree: true });
  globalThis.addEventListener?.('beforeprint', () => {
    root.querySelectorAll('img[loading="lazy"]').forEach((image) => {
      image.loading = 'eager';
      lazyObserver?.unobserve(image);
      if (image.matches('[data-media-image]')) beginImageTimeout(image, timeoutMs);
    });
  });
}
