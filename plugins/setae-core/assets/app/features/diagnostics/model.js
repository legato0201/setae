const numberValue = (value) => Number.isFinite(Number(value)) ? Math.round(Number(value) * 100) / 100 : null;

const rectValue = (element) => {
  if (!element?.getBoundingClientRect) return null;
  const rect = element.getBoundingClientRect();
  return {
    top: numberValue(rect.top),
    right: numberValue(rect.right),
    bottom: numberValue(rect.bottom),
    left: numberValue(rect.left),
    width: numberValue(rect.width),
    height: numberValue(rect.height),
    scrollWidth: numberValue(element.scrollWidth),
    clientWidth: numberValue(element.clientWidth)
  };
};

export function readSafeAreaInsets({ documentRef = document, windowRef = window } = {}) {
  if (!documentRef.body || !windowRef.getComputedStyle) return { top: 0, right: 0, bottom: 0, left: 0 };
  const probe = documentRef.createElement('div');
  probe.className = 'setae-safe-area-probe';
  probe.setAttribute('aria-hidden', 'true');
  documentRef.body.appendChild(probe);
  const style = windowRef.getComputedStyle(probe);
  const insets = {
    top: numberValue(parseFloat(style.paddingTop)) || 0,
    right: numberValue(parseFloat(style.paddingRight)) || 0,
    bottom: numberValue(parseFloat(style.paddingBottom)) || 0,
    left: numberValue(parseFloat(style.paddingLeft)) || 0
  };
  probe.remove();
  return insets;
}

async function storageEstimate(navigatorRef) {
  try {
    const estimate = await navigatorRef.storage?.estimate?.();
    return {
      usage: numberValue(estimate?.usage),
      quota: numberValue(estimate?.quota)
    };
  } catch {
    return { usage: null, quota: null };
  }
}

async function cameraPermission(navigatorRef) {
  try {
    const permission = await navigatorRef.permissions?.query?.({ name: 'camera' });
    return permission?.state || 'unknown';
  } catch {
    return 'unknown';
  }
}

async function serviceWorkerState(navigatorRef) {
  try {
    const registration = await navigatorRef.serviceWorker?.getRegistration?.();
    return {
      controlled: Boolean(navigatorRef.serviceWorker?.controller),
      waiting: Boolean(registration?.waiting),
      installing: Boolean(registration?.installing),
      active: Boolean(registration?.active)
    };
  } catch {
    return { controlled: false, waiting: false, installing: false, active: false };
  }
}

const focusDescription = (element) => element ? {
  tag: String(element.tagName || '').toLowerCase(),
  role: element.getAttribute?.('role') || '',
  dataRole: element.dataset?.role || ''
} : null;

export async function collectDiagnostics({
  version = '',
  route = '',
  nativeViewport = {},
  gesture = {},
  documentRef = document,
  windowRef = window
} = {}) {
  const navigatorRef = windowRef.navigator || {};
  const viewport = windowRef.visualViewport;
  const dateFrame = documentRef.querySelector('.date-field-frame');
  const dateInput = dateFrame?.querySelector('.date-field-control') || null;
  const displayModeStandalone = Boolean(windowRef.matchMedia?.('(display-mode: standalone)')?.matches);
  const [storage, serviceWorker, permission] = await Promise.all([
    storageEstimate(navigatorRef),
    serviceWorkerState(navigatorRef),
    cameraPermission(navigatorRef)
  ]);

  return {
    schemaVersion: 1,
    setaeVersion: String(version || ''),
    capturedAt: new Date().toISOString(),
    route: String(route || '').replace(/\d+/g, ':id'),
    device: {
      pixelRatio: numberValue(windowRef.devicePixelRatio),
      orientation: windowRef.screen?.orientation?.type || (windowRef.innerWidth > windowRef.innerHeight ? 'landscape' : 'portrait'),
      pointer: windowRef.matchMedia?.('(pointer: coarse)')?.matches ? 'coarse' : 'fine',
      hover: Boolean(windowRef.matchMedia?.('(hover: hover)')?.matches),
      maxTouchPoints: numberValue(navigatorRef.maxTouchPoints),
      online: navigatorRef.onLine !== false
    },
    viewport: {
      innerWidth: numberValue(windowRef.innerWidth),
      innerHeight: numberValue(windowRef.innerHeight),
      visualWidth: numberValue(viewport?.width || windowRef.innerWidth),
      visualHeight: numberValue(viewport?.height || windowRef.innerHeight),
      visualOffsetTop: numberValue(viewport?.offsetTop || 0),
      documentScrollWidth: numberValue(documentRef.documentElement?.scrollWidth),
      safeArea: readSafeAreaInsets({ documentRef, windowRef }),
      keyboardOpen: Boolean(nativeViewport.keyboardOpen),
      keyboardInset: numberValue(nativeViewport.keyboardInset || 0)
    },
    pwa: {
      mode: displayModeStandalone || navigatorRef.standalone === true ? 'standalone' : 'browser',
      navigatorStandalone: navigatorRef.standalone === true,
      displayModeStandalone
    },
    gesture: {
      enabled: Boolean(gesture.enabled),
      standalone: Boolean(gesture.standalone),
      state: String(gesture.state || 'idle'),
      currentType: String(gesture.currentType || ''),
      lastType: String(gesture.lastType || ''),
      lastDistance: numberValue(gesture.lastDistance || 0),
      lastVelocity: numberValue(gesture.lastVelocity || 0),
      lastResult: String(gesture.lastResult || '')
    },
    serviceWorker: {
      ...serviceWorker,
      cacheVersion: String(version || '')
    },
    storage,
    camera: {
      barcodeDetector: typeof windowRef.BarcodeDetector === 'function',
      getUserMedia: typeof navigatorRef.mediaDevices?.getUserMedia === 'function',
      permission,
      imageBitmap: typeof windowRef.createImageBitmap === 'function'
    },
    geometry: {
      dateFieldFrame: rectValue(dateFrame),
      dateInput: rectValue(dateInput),
      overlayCount: documentRef.querySelectorAll('[role="dialog"], [role="alertdialog"], [data-sheet]').length,
      focusElement: focusDescription(documentRef.activeElement)
    },
    checks: {
      documentFitsViewport: Number(documentRef.documentElement?.scrollWidth || 0) <= Number(windowRef.innerWidth || 0) + 1,
      dateInputInsideFrame: !dateFrame || !dateInput || (() => {
        const frame = dateFrame.getBoundingClientRect();
        const input = dateInput.getBoundingClientRect();
        return input.left >= frame.left - 0.5 && input.right <= frame.right + 0.5;
      })()
    }
  };
}
