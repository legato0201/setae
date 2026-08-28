const PANEL_SELECTOR = '.modal, .sheet, .saved-view-sheet, .animal-card-editor-sheet, .setae-setup';
const BACKDROP_SELECTOR = '.modal-backdrop, .sheet-backdrop, .saved-view-backdrop, .animal-card-editor-backdrop, .dashboard-editor-backdrop, .setup-backdrop';
const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])'
].join(',');

export function resolveActionInvocation(event) {
  const target = event?.target;
  if (!target?.closest) return null;
  const explicitAction = target.closest('[data-action]');
  if (explicitAction) {
    return {
      element: explicitAction,
      action: String(explicitAction.dataset.action || '')
    };
  }
  const backdrop = target.closest('[data-overlay-backdrop][data-backdrop-action]');
  if (!backdrop || target !== backdrop) return null;
  return {
    element: backdrop,
    action: String(backdrop.dataset.backdropAction || '')
  };
}

const numericZIndex = (element, windowRef) => {
  const value = Number.parseInt(windowRef.getComputedStyle(element).zIndex, 10);
  return Number.isFinite(value) ? value : 0;
};

const visible = (element, windowRef) => {
  if (!element || element.hidden || element.getAttribute('aria-hidden') === 'true') return false;
  const style = windowRef.getComputedStyle(element);
  return style.display !== 'none' && style.visibility !== 'hidden';
};

export function overlayPanels(root, windowRef = window) {
  if (!root?.querySelectorAll) return [];
  return [...root.querySelectorAll(PANEL_SELECTOR)].filter((panel) => visible(panel, windowRef));
}

export function topmostOverlay(root, windowRef = window) {
  return overlayPanels(root, windowRef)
    .map((panel, order) => ({
      panel,
      order,
      layer: numericZIndex(panel.closest(BACKDROP_SELECTOR) || panel, windowRef)
    }))
    .sort((left, right) => left.layer - right.layer || left.order - right.order)
    .at(-1)?.panel || null;
}

export function isBusyOverlay(panel) {
  return Boolean(panel?.classList.contains('is-busy') || panel?.getAttribute('aria-busy') === 'true');
}

function focusableElements(panel, windowRef) {
  return [...panel.querySelectorAll(FOCUSABLE_SELECTOR)].filter((element) => (
    visible(element, windowRef)
    && !element.closest('[hidden], [inert]')
    && element.getAttribute('aria-hidden') !== 'true'
  ));
}

function elementLocator(element) {
  if (!element || element.nodeType !== 1) return null;
  const identity = {
    id: element.id || '',
    name: element.getAttribute('name') || '',
    action: element.dataset.action || '',
    nav: element.dataset.nav || '',
    role: element.dataset.role || '',
    type: element.getAttribute('type') || '',
    datasets: {}
  };
  Object.entries(element.dataset).forEach(([key, value]) => {
    if (['action', 'nav', 'role'].includes(key)) return;
    identity.datasets[key] = value;
  });
  return identity;
}

function locateElement(root, locator) {
  if (!locator || !root?.querySelectorAll) return null;
  if (locator.id) {
    const byId = root.ownerDocument?.getElementById(locator.id);
    if (byId) return byId;
  }
  const candidates = [...root.querySelectorAll(FOCUSABLE_SELECTOR)];
  return candidates.find((element) => {
    if (locator.name && element.getAttribute('name') !== locator.name) return false;
    if (locator.action && element.dataset.action !== locator.action) return false;
    if (locator.nav && element.dataset.nav !== locator.nav) return false;
    if (locator.role && element.dataset.role !== locator.role) return false;
    if (locator.type && element.getAttribute('type') !== locator.type) return false;
    return Object.entries(locator.datasets).every(([key, value]) => element.dataset[key] === value);
  }) || null;
}

function overlayIdentity(panel) {
  if (!panel) return '';
  return [
    panel.className,
    panel.getAttribute('aria-labelledby') || panel.getAttribute('aria-label') || '',
    panel.dataset.modal || '',
    panel.dataset.sheet || ''
  ].join('|');
}

export function createOverlayController(root, {
  documentRef = document,
  windowRef = window,
  onRequestClose = null
} = {}) {
  let activePanel = null;
  let previousIdentity = '';
  let beforeIdentity = '';
  let beforeHadOverlay = false;
  let beforeFocus = null;
  let beforeFocusLocator = null;
  let beforeBusy = false;
  let returnFocus = null;
  let returnFocusLocator = null;
  let scrollLocked = false;
  let scrollY = 0;
  let bodyStyle = null;
  const inerted = new Set();

  const touchEnvironment = () => Boolean(windowRef.matchMedia?.('(hover: none) and (pointer: coarse)').matches);

  const setInert = (element) => {
    if (!element || element.hasAttribute('inert')) return;
    element.setAttribute('inert', '');
    element.dataset.setaeOverlayInert = 'true';
    inerted.add(element);
  };

  const clearInert = () => {
    inerted.forEach((element) => {
      if (element.dataset?.setaeOverlayInert === 'true') {
        element.removeAttribute('inert');
        delete element.dataset.setaeOverlayInert;
      }
    });
    inerted.clear();
  };

  const inertBehind = (panel) => {
    clearInert();
    let path = panel.closest(BACKDROP_SELECTOR) || panel;
    while (path && path !== root) {
      const parent = path.parentElement;
      if (!parent) break;
      [...parent.children].forEach((sibling) => {
        if (sibling !== path) setInert(sibling);
      });
      path = parent;
    }
  };

  const lockScroll = () => {
    if (scrollLocked) return;
    const body = documentRef.body;
    scrollY = windowRef.scrollY || documentRef.documentElement.scrollTop || 0;
    bodyStyle = {
      position: body.style.position,
      top: body.style.top,
      left: body.style.left,
      right: body.style.right,
      width: body.style.width,
      overflow: body.style.overflow
    };
    Object.assign(body.style, {
      position: 'fixed',
      top: `-${scrollY}px`,
      left: '0',
      right: '0',
      width: '100%',
      overflow: 'hidden'
    });
    documentRef.documentElement.dataset.setaeOverlayOpen = 'true';
    scrollLocked = true;
  };

  const unlockScroll = () => {
    if (!scrollLocked) return;
    Object.assign(documentRef.body.style, bodyStyle || {});
    delete documentRef.documentElement.dataset.setaeOverlayOpen;
    scrollLocked = false;
    windowRef.scrollTo(0, scrollY);
  };

  const focusElement = (element) => {
    if (!element?.isConnected || element.matches?.('[disabled], [hidden], [inert]')) return false;
    element.focus({ preventScroll: true });
    return documentRef.activeElement === element;
  };

  const focusInitial = (panel) => {
    const headingId = panel.getAttribute('aria-labelledby');
    const heading = headingId ? documentRef.getElementById(headingId) : null;
    const close = panel.querySelector('[data-action^="close-"], [data-action="dismiss-setae-setup"]');
    if (touchEnvironment()) {
      const target = close || heading || panel;
      if (target === heading && !heading.hasAttribute('tabindex')) heading.setAttribute('tabindex', '-1');
      focusElement(target);
      return;
    }
    const invalid = panel.querySelector('[aria-invalid="true"], input:invalid, select:invalid, textarea:invalid');
    const firstField = panel.querySelector('input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled])');
    const first = focusableElements(panel, windowRef).find((element) => element !== close);
    focusElement(panel.querySelector('[autofocus]') || invalid || firstField || first || close || panel);
  };

  const requestClose = (panel) => {
    if (!panel || isBusyOverlay(panel)) return false;
    const closeControl = panel.querySelector([
      '[data-action="close-modal"]',
      '[data-action="close-sheet"]',
      '[data-action="close-quick-record"]',
      '[data-action="close-dashboard-editor"]',
      '[data-action="close-saved-view-editor"]',
      '[data-action="close-card-editor"]',
      '[data-action="dismiss-setae-setup"]',
      '[data-action="cancel-collection-status"]'
    ].join(','));
    if (closeControl && !closeControl.disabled) {
      closeControl.click();
      return true;
    }
    const backdrop = panel.closest(BACKDROP_SELECTOR);
    if (backdrop?.dataset.backdropAction) {
      backdrop.click();
      return true;
    }
    onRequestClose?.(panel);
    return true;
  };

  const beforeRender = () => {
    const panel = topmostOverlay(root, windowRef);
    beforeHadOverlay = Boolean(panel);
    beforeIdentity = overlayIdentity(panel);
    beforeBusy = isBusyOverlay(panel);
    beforeFocus = documentRef.activeElement?.nodeType === 1 ? documentRef.activeElement : null;
    beforeFocusLocator = elementLocator(beforeFocus);
    if (!panel) {
      returnFocus = beforeFocus;
      returnFocusLocator = beforeFocusLocator;
    }
  };

  const sync = () => {
    const nextPanel = topmostOverlay(root, windowRef);
    const nextIdentity = overlayIdentity(nextPanel);
    if (nextPanel) {
      activePanel = nextPanel;
      previousIdentity = nextIdentity;
      inertBehind(nextPanel);
      lockScroll();
      if (!beforeHadOverlay || beforeIdentity !== nextIdentity) {
        if (beforeHadOverlay) {
          returnFocus = beforeFocus;
          returnFocusLocator = beforeFocusLocator;
        }
        windowRef.requestAnimationFrame(() => focusInitial(nextPanel));
      } else if (beforeBusy && !isBusyOverlay(nextPanel) && nextPanel.querySelector('[data-overlay-error]')) {
        windowRef.requestAnimationFrame(() => focusElement(nextPanel.querySelector('[data-overlay-error]')));
      } else if (beforeFocusLocator) {
        windowRef.requestAnimationFrame(() => focusElement(locateElement(nextPanel, beforeFocusLocator)));
      }
      return;
    }

    activePanel = null;
    previousIdentity = '';
    clearInert();
    unlockScroll();
    if (beforeHadOverlay) {
      const target = returnFocus?.isConnected ? returnFocus : locateElement(root, returnFocusLocator);
      windowRef.requestAnimationFrame(() => focusElement(target));
    }
    returnFocus = null;
    returnFocusLocator = null;
  };

  const onKeyDown = (event) => {
    const panel = topmostOverlay(root, windowRef);
    if (!panel) return;
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopImmediatePropagation();
      requestClose(panel);
      return;
    }
    if (event.key !== 'Tab') return;
    const focusable = focusableElements(panel, windowRef);
    if (!focusable.length) {
      event.preventDefault();
      focusElement(panel);
      return;
    }
    const first = focusable[0];
    const last = focusable.at(-1);
    if (!panel.contains(documentRef.activeElement)) {
      event.preventDefault();
      focusElement(event.shiftKey ? last : first);
    } else if (event.shiftKey && documentRef.activeElement === first) {
      event.preventDefault();
      focusElement(last);
    } else if (!event.shiftKey && documentRef.activeElement === last) {
      event.preventDefault();
      focusElement(first);
    }
  };

  const onClickCapture = (event) => {
    const backdrop = event.target.closest?.(BACKDROP_SELECTOR);
    if (!backdrop || event.target !== backdrop) return;
    const panel = topmostOverlay(root, windowRef);
    if (!panel || !backdrop.contains(panel) || !isBusyOverlay(panel)) return;
    event.preventDefault();
    event.stopImmediatePropagation();
  };

  documentRef.addEventListener('keydown', onKeyDown, true);
  root.addEventListener('click', onClickCapture, true);

  return {
    beforeRender,
    sync,
    requestClose: () => requestClose(topmostOverlay(root, windowRef)),
    destroy() {
      documentRef.removeEventListener('keydown', onKeyDown, true);
      root.removeEventListener('click', onClickCapture, true);
      clearInert();
      unlockScroll();
    },
    get activePanel() { return activePanel; },
    get identity() { return previousIdentity; }
  };
}
