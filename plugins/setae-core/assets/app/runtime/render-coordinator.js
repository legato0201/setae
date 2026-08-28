export const appRenderRoots = Object.freeze({
  rail: '[data-app-rail-root]',
  mobileBar: '[data-app-mobile-bar-root]',
  page: '[data-app-page-root]',
  mobileNavigation: '[data-app-mobile-navigation-root]',
  overlays: '[data-app-overlay-root]',
  feedback: '[data-app-feedback-root]',
  updateNotice: '[data-app-update-root]',
  error: '[data-app-error-root]',
  sync: '[data-app-sync-root]'
});

const chromeRoots = ['rail', 'mobileBar', 'mobileNavigation', 'sync'];
const allRoots = [...chromeRoots, 'error', 'page', 'overlays', 'feedback', 'updateNotice'];

const asHtml = (value) => String(value ?? '');

export function createRenderCoordinator(appRoot, {
  requestFrame = globalThis.requestAnimationFrame?.bind(globalThis) || ((callback) => globalThis.setTimeout(callback, 0))
} = {}) {
  if (!appRoot?.querySelector) throw new TypeError('Render Coordinator requires an App root.');

  const cache = new Map();
  let mode = '';
  let scheduled = null;
  let scheduledFrame = 0;

  const root = (name) => {
    const selector = appRenderRoots[name];
    return selector ? appRoot.querySelector(selector) : null;
  };

  const rememberMountedRoots = () => {
    cache.clear();
    allRoots.forEach((name) => {
      const element = root(name);
      if (element) cache.set(name, element.innerHTML);
    });
  };

  const update = (name, html, { force = false } = {}) => {
    const element = root(name);
    if (!element) return false;
    const next = asHtml(html);
    const current = cache.has(name) ? cache.get(name) : element.innerHTML;
    if (!force && current === next) {
      cache.set(name, current);
      return false;
    }
    element.innerHTML = next;
    cache.set(name, next);
    return true;
  };

  const updateMany = (names, regions = {}, options = {}) => names
    .filter((name) => Object.hasOwn(regions, name))
    .filter((name) => update(name, regions[name], options));

  const mount = (html, { view = 'app' } = {}) => {
    appRoot.innerHTML = asHtml(html);
    mode = view;
    rememberMountedRoots();
    return root('page');
  };

  const all = (regions = {}, options = {}) => updateMany(allRoots, regions, options);
  const chrome = (regions = {}, options = {}) => updateMany(chromeRoots, regions, options);

  const schedule = (regions = {}, options = {}) => {
    scheduled = { ...(scheduled || {}), ...regions };
    if (scheduledFrame) return scheduledFrame;
    scheduledFrame = requestFrame(() => {
      const pending = scheduled || {};
      scheduled = null;
      scheduledFrame = 0;
      all(pending, options);
    });
    return scheduledFrame;
  };

  return {
    mount,
    page: (html, options) => update('page', html, options),
    chrome,
    overlays: (html, options) => update('overlays', html, options),
    feedback: (html, options) => update('feedback', html, options),
    updateNotice: (html, options) => update('updateNotice', html, options),
    error: (html, options) => update('error', html, options),
    sync: (html, options) => update('sync', html, options),
    all,
    schedule,
    root,
    accept(name, html) {
      if (!root(name)) return false;
      cache.set(name, asHtml(html));
      return true;
    },
    invalidate(name = '') {
      if (name) cache.delete(name);
      else cache.clear();
    },
    get mode() { return mode; },
    get frameMounted() { return mode === 'app' && Boolean(appRoot.querySelector('[data-app-frame]')); }
  };
}
