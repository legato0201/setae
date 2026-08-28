import {
  createEdgeSwipeGesture,
  createSheetGesture,
  createTabGesture,
  evaluateEdgeSwipe,
  evaluateSheetGesture,
  evaluateTabGesture,
  hasHorizontalScrollableAncestor,
  hasSelectedText,
  isCoarsePointer,
  isGestureTargetBlocked
} from '../features/navigation/gesture-model.js';

const SHEET_SELECTOR = '.sheet, .saved-view-sheet, .animal-card-editor-sheet';
const SHEET_HEADER_SELECTOR = '.quick-record-header, .sheet-header, .sheet-title-row, .dashboard-editor-header, .saved-view-header, .animal-card-editor-header';

const eventPoint = (event) => ({
  x: event.clientX,
  y: event.clientY,
  time: event.timeStamp || performance.now()
});

const reducedMotionDefault = (windowRef) => Boolean(windowRef.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches);

export function createMobileGestureController(root, {
  windowRef = window,
  documentRef = document,
  isStandalone = () => false,
  isBusy = () => false,
  isEdgeAllowed = () => true,
  keyboardOpen = () => false,
  onRequestBack = () => {},
  onSheetDismiss = () => false,
  onSpecimenTabChange = () => false,
  reducedMotion = () => reducedMotionDefault(windowRef)
} = {}) {
  const activePointers = new Set();
  let active = false;
  let gesture = null;
  let settleTimer = 0;
  let last = {
    type: '',
    distance: 0,
    velocity: 0,
    result: 'idle'
  };

  const state = () => gesture?.state || 'idle';

  const clearSettle = () => {
    if (!settleTimer) return;
    windowRef.clearTimeout(settleTimer);
    settleTimer = 0;
  };

  const releasePointer = (current) => {
    try {
      if (current?.captureTarget?.hasPointerCapture?.(current.pointerId)) {
        current.captureTarget.releasePointerCapture(current.pointerId);
      }
    } catch {}
  };

  const clearVisuals = (current, { animate = true } = {}) => {
    if (!current) return;
    clearSettle();
    const delay = animate && !reducedMotion() ? 140 : 0;
    root.classList.remove('is-edge-swipe-tracking');
    root.style.removeProperty('--edge-swipe-x');
    root.style.removeProperty('--edge-swipe-progress');
    current.panel?.classList.remove('is-sheet-gesture-tracking');
    current.panel?.style.removeProperty('--sheet-drag-y');
    current.backdrop?.style.removeProperty('--sheet-drag-progress');
    current.backdrop?.style.removeProperty('--sheet-backdrop-strength');
    current.backdrop?.classList.remove('is-sheet-gesture-tracking');
    current.content?.classList.remove('is-tab-swipe-tracking');
    current.content?.style.removeProperty('--specimen-swipe-x');

    const settling = [
      [root, 'is-edge-swipe-settling', current.type === 'edge'],
      [current.panel, 'is-sheet-gesture-settling', current.type === 'sheet'],
      [current.content, 'is-tab-swipe-settling', current.type === 'tab']
    ].filter(([, , matches]) => matches);
    settling.forEach(([element, className]) => element?.classList.add(className));
    const finish = () => {
      settling.forEach(([element, className]) => element?.classList.remove(className));
      settleTimer = 0;
    };
    if (delay) settleTimer = windowRef.setTimeout(finish, delay);
    else finish();
  };

  const finish = (result, metrics = {}, callback = null) => {
    const current = gesture;
    if (!current) return;
    current.state = result === 'commit' ? 'committing' : 'cancelling';
    last = {
      type: current.type,
      distance: Math.round(Math.abs(metrics.distanceX ?? metrics.distanceY ?? 0)),
      velocity: Number(Math.abs(metrics.velocityX ?? metrics.velocityY ?? 0).toFixed(3)),
      result
    };
    clearVisuals(current, { animate: result !== 'keyboard-dismiss' });
    releasePointer(current);
    gesture = null;
    callback?.(current);
  };

  const sheetFromTarget = (target) => {
    const panel = target?.closest?.(SHEET_SELECTOR);
    if (!panel || !panel.querySelector('.sheet-handle')) return null;
    const handle = target.closest?.('.sheet-handle');
    const header = target.closest?.(SHEET_HEADER_SELECTOR);
    if (!handle && (!header || header.closest(SHEET_SELECTOR) !== panel)) return null;
    if (!handle && isGestureTargetBlocked(target)) return null;
    return panel;
  };

  const canUseTabGesture = (target, content) => !isGestureTargetBlocked(target)
    && !hasHorizontalScrollableAncestor(target, { root: content, windowRef });

  const safeAreaLeft = () => {
    try {
      return Number.parseFloat(windowRef.getComputedStyle(documentRef.documentElement).getPropertyValue('--safe-left')) || 0;
    } catch {
      return 0;
    }
  };

  const begin = (event) => {
    activePointers.add(event.pointerId);
    if (activePointers.size > 1) {
      finish('multitouch-cancel');
      return;
    }
    if (gesture || event.isPrimary === false || event.button !== 0 || !isCoarsePointer(event, windowRef)) return;
    if (hasSelectedText(windowRef)) return;

    const target = event.target;
    const point = eventPoint(event);
    const panel = sheetFromTarget(target);
    const content = target?.closest?.('[data-specimen-tab-content]');
    let next = null;

    if (panel && !isBusy() && panel.getAttribute('aria-busy') !== 'true' && !panel.classList.contains('is-busy')) {
      next = {
        ...createSheetGesture({ ...point, pointerId: event.pointerId, target }),
        state: 'possible',
        type: 'sheet',
        panel,
        backdrop: panel.closest('[data-overlay-backdrop]'),
        captureTarget: target
      };
    } else if (content && !isBusy() && canUseTabGesture(target, content)) {
      next = {
        ...createTabGesture({ ...point, pointerId: event.pointerId, target }),
        state: 'possible',
        type: 'tab',
        content,
        captureTarget: target
      };
    } else if (!isBusy() && isStandalone() && isEdgeAllowed() && !isGestureTargetBlocked(target)
      && !hasHorizontalScrollableAncestor(target, { root, windowRef })) {
      const edge = createEdgeSwipeGesture({
        ...point,
        pointerId: event.pointerId,
        target,
        safeAreaLeft: safeAreaLeft(),
        allowed: true
      });
      if (edge) next = { ...edge, state: 'possible', type: 'edge', captureTarget: target };
    }

    if (!next) return;
    gesture = next;
    try { target.setPointerCapture?.(event.pointerId); }
    catch {}
  };

  const trackEdge = (event, current) => {
    const metrics = evaluateEdgeSwipe(current, eventPoint(event), { viewportWidth: windowRef.innerWidth });
    if (metrics.verticalCancel) {
      finish('vertical-cancel', metrics);
      return;
    }
    if (!metrics.horizontal) return;
    current.state = 'tracking';
    event.preventDefault();
    root.classList.add('is-edge-swipe-tracking');
    root.style.setProperty('--edge-swipe-x', `${metrics.feedbackX}px`);
    root.style.setProperty('--edge-swipe-progress', String(metrics.progress));
  };

  const trackSheet = (event, current) => {
    const metrics = evaluateSheetGesture(current, eventPoint(event), { panelHeight: current.panel.offsetHeight });
    if (metrics.horizontalCancel) {
      finish('horizontal-cancel', metrics);
      return;
    }
    if (!metrics.downward) return;
    current.state = 'tracking';
    event.preventDefault();
    if (keyboardOpen()) {
      documentRef.activeElement?.blur?.();
      finish('keyboard-dismiss', metrics);
      return;
    }
    current.panel.classList.add('is-sheet-gesture-tracking');
    current.panel.style.setProperty('--sheet-drag-y', `${Math.max(0, metrics.dragY)}px`);
    current.backdrop?.classList.add('is-sheet-gesture-tracking');
    current.backdrop?.style.setProperty('--sheet-drag-progress', String(metrics.progress));
    current.backdrop?.style.setProperty('--sheet-backdrop-strength', `${Math.round(100 - metrics.progress * 35)}%`);
  };

  const trackTab = (event, current) => {
    const metrics = evaluateTabGesture(current, eventPoint(event), { panelWidth: current.content.offsetWidth });
    if (metrics.verticalCancel) {
      finish('vertical-cancel', metrics);
      return;
    }
    if (!metrics.horizontal) return;
    current.state = 'tracking';
    event.preventDefault();
    current.content.classList.add('is-tab-swipe-tracking');
    current.content.style.setProperty('--specimen-swipe-x', `${metrics.feedbackX}px`);
  };

  const move = (event) => {
    if (!gesture || event.pointerId !== gesture.pointerId) return;
    if (activePointers.size > 1 || isBusy()) {
      finish('busy-cancel');
      return;
    }
    if (gesture.type === 'edge') trackEdge(event, gesture);
    else if (gesture.type === 'sheet') trackSheet(event, gesture);
    else if (gesture.type === 'tab') trackTab(event, gesture);
  };

  const end = (event) => {
    activePointers.delete(event.pointerId);
    if (!gesture || event.pointerId !== gesture.pointerId) return;
    const current = gesture;
    if (current.type === 'edge') {
      const metrics = evaluateEdgeSwipe(current, eventPoint(event), { viewportWidth: windowRef.innerWidth });
      finish(metrics.complete ? 'commit' : 'threshold-cancel', metrics, metrics.complete ? () => onRequestBack() : null);
      return;
    }
    if (current.type === 'sheet') {
      const metrics = evaluateSheetGesture(current, eventPoint(event), { panelHeight: current.panel.offsetHeight });
      finish(metrics.complete ? 'commit' : 'threshold-cancel', metrics, metrics.complete ? () => onSheetDismiss(current.panel) : null);
      return;
    }
    const metrics = evaluateTabGesture(current, eventPoint(event), { panelWidth: current.content.offsetWidth });
    if (!metrics.complete) {
      finish('threshold-cancel', metrics);
      return;
    }
    finish('commit', metrics, () => {
      const changed = onSpecimenTabChange(metrics.direction);
      if (changed === false) last.result = 'boundary-cancel';
    });
  };

  const cancel = (event) => {
    if (event?.pointerId !== undefined) activePointers.delete(event.pointerId);
    if (!gesture || (event?.pointerId !== undefined && event.pointerId !== gesture.pointerId)) return;
    finish('pointer-cancel');
  };

  return {
    start() {
      if (active) return this;
      active = true;
      documentRef.documentElement.dataset.setaeStandalone = isStandalone() ? 'true' : 'false';
      root.addEventListener('pointerdown', begin, { capture: true, passive: true });
      root.addEventListener('pointermove', move, { capture: true, passive: false });
      root.addEventListener('pointerup', end, { capture: true, passive: true });
      root.addEventListener('pointercancel', cancel, { capture: true, passive: true });
      return this;
    },
    stop() {
      if (!active) return;
      active = false;
      root.removeEventListener('pointerdown', begin, true);
      root.removeEventListener('pointermove', move, true);
      root.removeEventListener('pointerup', end, true);
      root.removeEventListener('pointercancel', cancel, true);
      activePointers.clear();
      finish('controller-stop');
      clearSettle();
      root.classList.remove('is-edge-swipe-tracking', 'is-edge-swipe-settling');
      root.style.removeProperty('--edge-swipe-x');
      root.style.removeProperty('--edge-swipe-progress');
      root.querySelectorAll('.is-sheet-gesture-tracking, .is-sheet-gesture-settling, .is-tab-swipe-tracking, .is-tab-swipe-settling').forEach((element) => {
        element.classList.remove('is-sheet-gesture-tracking', 'is-sheet-gesture-settling', 'is-tab-swipe-tracking', 'is-tab-swipe-settling');
        element.style.removeProperty('--sheet-drag-y');
        element.style.removeProperty('--sheet-drag-progress');
        element.style.removeProperty('--sheet-backdrop-strength');
        element.style.removeProperty('--specimen-swipe-x');
      });
    },
    cancel,
    snapshot() {
      return {
        enabled: active,
        standalone: Boolean(isStandalone()),
        state: state(),
        currentType: gesture?.type || '',
        lastType: last.type,
        lastDistance: last.distance,
        lastVelocity: last.velocity,
        lastResult: last.result
      };
    }
  };
}
