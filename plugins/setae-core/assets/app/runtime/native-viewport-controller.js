const KEYBOARD_MIN_REDUCTION = 120;
const KEYBOARD_REDUCTION_RATIO = 0.18;

export function isEditableElement(element) {
  if (!element || typeof element.matches !== 'function') return false;
  return element.matches('input:not([type="hidden"]):not([disabled]), textarea:not([disabled]), select:not([disabled]), [contenteditable="true"]');
}

export function keyboardOpenForViewport({
  editableFocused = false,
  layoutHeight = 0,
  visualHeight = 0
} = {}) {
  const reduction = Math.max(0, Number(layoutHeight) - Number(visualHeight));
  return Boolean(
    editableFocused
    && visualHeight > 0
    && reduction > Math.max(KEYBOARD_MIN_REDUCTION, Number(layoutHeight) * KEYBOARD_REDUCTION_RATIO)
  );
}

export function createViewportSnapshot({ windowRef = window, documentRef = document } = {}) {
  const viewport = windowRef.visualViewport;
  const layoutHeight = Math.max(0, Number(windowRef.innerHeight) || Number(documentRef.documentElement?.clientHeight) || 0);
  const visualHeight = Math.max(0, Number(viewport?.height) || layoutHeight);
  const visualWidth = Math.max(0, Number(viewport?.width) || Number(windowRef.innerWidth) || 0);
  const offsetTop = Math.max(0, Number(viewport?.offsetTop) || 0);
  const editableFocused = isEditableElement(documentRef.activeElement);
  const keyboardOpen = Boolean(viewport) && keyboardOpenForViewport({ editableFocused, layoutHeight, visualHeight });
  return {
    layoutHeight,
    visualHeight,
    visualWidth,
    offsetTop,
    keyboardInset: keyboardOpen ? Math.max(0, layoutHeight - visualHeight - offsetTop) : 0,
    keyboardOpen,
    editableFocused,
    standalone: Boolean(
      windowRef.navigator?.standalone === true
      || windowRef.matchMedia?.('(display-mode: standalone)')?.matches
    )
  };
}

export function createNativeViewportController({
  windowRef = window,
  documentRef = document,
  onChange = () => {}
} = {}) {
  let active = false;
  let frame = 0;
  let focusFrame = 0;
  let focusOutTimer = 0;
  let focusedElement = null;
  let firstMeasurement = true;
  let snapshot = createViewportSnapshot({ windowRef, documentRef });
  const viewport = windowRef.visualViewport;

  const ensureFocusedFieldVisible = (expectedField) => {
    const field = documentRef.activeElement;
    const next = createViewportSnapshot({ windowRef, documentRef });
    if (!active || field !== expectedField || !next.keyboardOpen || !isEditableElement(field) || typeof field.getBoundingClientRect !== 'function') return;
    const rect = field.getBoundingClientRect();
    let top = next.offsetTop + 8;
    let bottom = next.offsetTop + next.visualHeight - 8;
    // A dialog's scrolling body is smaller than the viewport: its title and
    // save footer must not cover the field even when the keyboard stays open.
    for (let parent = field.parentElement; parent && parent !== documentRef.body; parent = parent.parentElement) {
      const style = windowRef.getComputedStyle?.(parent);
      if (!/(auto|scroll|hidden|clip)/.test(style?.overflowY || '') || typeof parent.getBoundingClientRect !== 'function') continue;
      const bounds = parent.getBoundingClientRect();
      top = Math.max(top, bounds.top + 8);
      bottom = Math.min(bottom, bounds.bottom - 8);
    }
    if (rect.top < top || rect.bottom > bottom) field.scrollIntoView?.({ block: 'nearest', inline: 'nearest' });
  };

  const cancelFrame = (id) => {
    if (!id) return;
    if (windowRef.requestAnimationFrame) windowRef.cancelAnimationFrame?.(id);
    else windowRef.clearTimeout?.(id);
  };

  const apply = () => {
    frame = 0;
    const previous = snapshot;
    const next = createViewportSnapshot({ windowRef, documentRef });
    const nextField = documentRef.activeElement;
    const fieldChanged = nextField !== focusedElement;
    const viewportResized = previous.visualHeight !== next.visualHeight
      || previous.visualWidth !== next.visualWidth || previous.layoutHeight !== next.layoutHeight;
    focusedElement = nextField;
    snapshot = next;
    const root = documentRef.documentElement;
    root?.style?.setProperty('--setae-visual-viewport-height', `${next.visualHeight}px`);
    root?.style?.setProperty('--setae-visual-viewport-offset-top', `${next.offsetTop}px`);
    root?.style?.setProperty('--setae-keyboard-inset', `${next.keyboardInset}px`);
    root?.style?.setProperty('--setae-layout-viewport-height', `${next.layoutHeight}px`);
    if (root?.dataset) root.dataset.setaeKeyboardOpen = next.keyboardOpen ? 'true' : 'false';
    if (next.keyboardOpen && (firstMeasurement || !previous.keyboardOpen || fieldChanged || viewportResized)) {
      cancelFrame(focusFrame);
      const reveal = () => { focusFrame = 0; ensureFocusedFieldVisible(nextField); };
      focusFrame = windowRef.requestAnimationFrame ? windowRef.requestAnimationFrame(reveal) : windowRef.setTimeout(reveal, 0);
    } else if (!next.keyboardOpen) {
      cancelFrame(focusFrame);
      focusFrame = 0;
    }
    firstMeasurement = false;
    onChange({ ...next });
  };

  const schedule = () => {
    if (!active || frame) return;
    frame = windowRef.requestAnimationFrame?.(apply) || windowRef.setTimeout(apply, 0);
  };

  const focusOut = () => {
    if (focusOutTimer) windowRef.clearTimeout(focusOutTimer);
    focusOutTimer = windowRef.setTimeout(() => { focusOutTimer = 0; schedule(); }, 0);
  };

  return {
    start() {
      if (active) return this;
      active = true;
      viewport?.addEventListener?.('resize', schedule);
      viewport?.addEventListener?.('scroll', schedule);
      windowRef.addEventListener?.('resize', schedule);
      windowRef.addEventListener?.('orientationchange', schedule);
      documentRef.addEventListener?.('focusin', schedule, true);
      documentRef.addEventListener?.('focusout', focusOut, true);
      apply();
      return this;
    },
    stop() {
      if (!active) return;
      active = false;
      viewport?.removeEventListener?.('resize', schedule);
      viewport?.removeEventListener?.('scroll', schedule);
      windowRef.removeEventListener?.('resize', schedule);
      windowRef.removeEventListener?.('orientationchange', schedule);
      documentRef.removeEventListener?.('focusin', schedule, true);
      documentRef.removeEventListener?.('focusout', focusOut, true);
      cancelFrame(frame);
      cancelFrame(focusFrame);
      if (focusOutTimer) windowRef.clearTimeout(focusOutTimer);
      frame = 0;
      focusFrame = 0;
      focusOutTimer = 0;
      focusedElement = null;
      firstMeasurement = true;
    },
    measure: apply,
    snapshot: () => ({ ...snapshot })
  };
}
