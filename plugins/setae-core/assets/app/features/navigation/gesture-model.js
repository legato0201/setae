export const gestureStates = Object.freeze([
  'idle',
  'possible',
  'tracking',
  'committing',
  'cancelling'
]);

export const MOBILE_GESTURE_BLOCKED_SELECTOR = [
  'input',
  'select',
  'textarea',
  'button',
  'a',
  'summary',
  '[contenteditable="true"]',
  '[role="slider"]',
  '[role="spinbutton"]',
  '[data-horizontal-scroll]',
  '.tabs',
  '.segmented',
  '.action-menu',
  '.media-grid',
  '.media-viewer',
  '.image-viewer',
  '.chart',
  '.chart-shell',
  '[data-chart]',
  'canvas',
  'video',
  'audio',
  '.qr-camera-stage',
  '.file-picker',
  '[data-no-swipe]',
  '[data-dragging="true"]',
  '[draggable="true"]'
].join(',');

export const EDGE_SWIPE_START_MAX = 26;
export const EDGE_SWIPE_DISTANCE_MIN = 72;
export const EDGE_SWIPE_AXIS_RATIO = 1.35;
export const GESTURE_VELOCITY_MIN = 0.55;
export const GESTURE_VELOCITY_DISTANCE_MIN = 48;
export const SHEET_DISMISS_DISTANCE_MIN = 96;
export const TAB_SWIPE_DISTANCE_MIN = 56;

const number = (value) => Number.isFinite(Number(value)) ? Number(value) : 0;
const duration = (start, end) => Math.max(1, number(end) - number(start));

export function gestureVelocity(distance, startedAt, endedAt) {
  return number(distance) / duration(startedAt, endedAt);
}

export function hasSelectedText(windowRef = globalThis.window) {
  try {
    return windowRef?.getSelection?.()?.type === 'Range';
  } catch {
    return false;
  }
}

export function isGestureTargetBlocked(target) {
  return Boolean(target?.closest?.(MOBILE_GESTURE_BLOCKED_SELECTOR));
}

export function hasHorizontalScrollableAncestor(target, {
  root = null,
  windowRef = globalThis.window
} = {}) {
  let element = target?.nodeType === 1 ? target : target?.parentElement || null;
  while (element && element !== root) {
    if (element.hasAttribute?.('data-horizontal-scroll')) return true;
    const overflows = number(element.scrollWidth) > number(element.clientWidth) + 1;
    let overflowX = '';
    try { overflowX = windowRef?.getComputedStyle?.(element)?.overflowX || ''; }
    catch {}
    if (overflows && ['auto', 'scroll'].includes(overflowX)) return true;
    element = element.parentElement;
  }
  return false;
}

export function isCoarsePointer(event, windowRef = globalThis.window) {
  const pointerType = String(event?.pointerType || '');
  return pointerType === 'touch'
    || pointerType === 'pen'
    || Boolean(windowRef?.matchMedia?.('(pointer: coarse)')?.matches);
}

export function createGestureStart({
  x = 0,
  y = 0,
  time = 0,
  pointerId = 0,
  target = null
} = {}) {
  return {
    startX: number(x),
    startY: number(y),
    startedAt: number(time),
    pointerId: number(pointerId),
    target
  };
}

function movement(start, { x = 0, y = 0, time = 0 } = {}) {
  const distanceX = number(x) - number(start?.startX);
  const distanceY = number(y) - number(start?.startY);
  const elapsed = duration(start?.startedAt, time);
  return {
    distanceX,
    distanceY,
    absoluteX: Math.abs(distanceX),
    absoluteY: Math.abs(distanceY),
    elapsed,
    velocityX: distanceX / elapsed,
    velocityY: distanceY / elapsed
  };
}

export function createEdgeSwipeGesture({
  x = 0,
  y = 0,
  time = 0,
  pointerId = 0,
  target = null,
  allowed = true,
  safeAreaLeft = 0,
  startMax = EDGE_SWIPE_START_MAX
} = {}) {
  const startLimit = Math.max(24, Math.min(28, number(startMax))) + Math.max(0, number(safeAreaLeft));
  if (!allowed || number(x) < 0 || number(x) > startLimit) return null;
  return { ...createGestureStart({ x, y, time, pointerId, target }), startLimit };
}

export function evaluateEdgeSwipe(gesture, point = {}, { viewportWidth = 0 } = {}) {
  const delta = movement(gesture, point);
  const horizontal = delta.distanceX > 10 && delta.distanceX > delta.absoluteY * EDGE_SWIPE_AXIS_RATIO;
  const verticalCancel = delta.absoluteY > 10 && delta.absoluteY > Math.max(0, delta.distanceX) * EDGE_SWIPE_AXIS_RATIO;
  const distanceThreshold = Math.max(EDGE_SWIPE_DISTANCE_MIN, number(viewportWidth) * 0.25);
  const velocityCommit = delta.velocityX >= GESTURE_VELOCITY_MIN
    && delta.distanceX >= GESTURE_VELOCITY_DISTANCE_MIN;
  const complete = horizontal && (delta.distanceX >= distanceThreshold || velocityCommit);
  return {
    ...delta,
    horizontal,
    verticalCancel,
    complete,
    distanceThreshold,
    feedbackX: Math.min(24, Math.max(0, delta.distanceX) * 24 / Math.max(1, distanceThreshold)),
    progress: Math.min(1, Math.max(0, delta.distanceX) / Math.max(1, distanceThreshold))
  };
}

export function createSheetGesture(options = {}) {
  return createGestureStart(options);
}

export function evaluateSheetGesture(gesture, point = {}, { panelHeight = 0 } = {}) {
  const delta = movement(gesture, point);
  const downward = delta.distanceY > 10 && delta.distanceY > delta.absoluteX * EDGE_SWIPE_AXIS_RATIO;
  const horizontalCancel = delta.absoluteX > 10 && delta.absoluteX > Math.max(0, delta.distanceY) * EDGE_SWIPE_AXIS_RATIO;
  const distanceThreshold = Math.max(SHEET_DISMISS_DISTANCE_MIN, number(panelHeight) * 0.25);
  const velocityCommit = delta.velocityY >= GESTURE_VELOCITY_MIN
    && delta.distanceY >= GESTURE_VELOCITY_DISTANCE_MIN;
  const complete = downward && (delta.distanceY >= distanceThreshold || velocityCommit);
  const dragY = delta.distanceY > 0 ? delta.distanceY : Math.max(-12, delta.distanceY * 0.16);
  return {
    ...delta,
    downward,
    horizontalCancel,
    complete,
    distanceThreshold,
    dragY,
    progress: Math.min(1, Math.max(0, delta.distanceY) / Math.max(1, distanceThreshold))
  };
}

export function createTabGesture(options = {}) {
  return createGestureStart(options);
}

export function evaluateTabGesture(gesture, point = {}, { panelWidth = 0 } = {}) {
  const delta = movement(gesture, point);
  const horizontal = delta.absoluteX > 10 && delta.absoluteX > delta.absoluteY * EDGE_SWIPE_AXIS_RATIO;
  const verticalCancel = delta.absoluteY > 10 && delta.absoluteY > delta.absoluteX * EDGE_SWIPE_AXIS_RATIO;
  const distanceThreshold = Math.max(TAB_SWIPE_DISTANCE_MIN, number(panelWidth) * 0.18);
  const velocityCommit = Math.abs(delta.velocityX) >= GESTURE_VELOCITY_MIN
    && delta.absoluteX >= GESTURE_VELOCITY_DISTANCE_MIN;
  return {
    ...delta,
    horizontal,
    verticalCancel,
    complete: horizontal && (delta.absoluteX >= distanceThreshold || velocityCommit),
    direction: delta.distanceX < 0 ? 'next' : 'previous',
    distanceThreshold,
    feedbackX: Math.max(-28, Math.min(28, delta.distanceX * 0.16)),
    progress: Math.min(1, delta.absoluteX / Math.max(1, distanceThreshold))
  };
}
