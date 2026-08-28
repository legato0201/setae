const routePages = new Set([
  'today',
  'animals',
  'animal-detail',
  'records',
  'husbandry',
  'community',
  'settings'
]);

export const SETAE_ROUTE_STATE = 'setae-route-v1';

export function createRouteState(value = {}) {
  const context = value.context && typeof value.context === 'object'
    ? structuredClone(value.context)
    : {};
  const objectId = value.objectId === null || value.objectId === undefined || value.objectId === ''
    ? null
    : String(value.objectId);
  return {
    setae: SETAE_ROUTE_STATE,
    page: routePages.has(value.page) ? value.page : 'today',
    subTab: String(value.subTab || ''),
    objectId,
    scrollY: Math.max(0, Number(value.scrollY) || 0),
    index: Math.max(0, Number(value.index) || 0),
    context
  };
}

export function isRouteState(value) {
  return Boolean(value && value.setae === SETAE_ROUTE_STATE && routePages.has(value.page));
}

export function sameRoute(left, right) {
  const a = createRouteState(left);
  const b = createRouteState(right);
  return a.page === b.page
    && a.subTab === b.subTab
    && a.objectId === b.objectId
    && String(a.context?.objectType || '') === String(b.context?.objectType || '');
}

export function resolveBackPriority({
  menuOpen = false,
  modalOpen = false,
  sheetOpen = false,
  selectionMode = false,
  nestedRoute = false
} = {}) {
  if (menuOpen) return 'close-menu';
  if (modalOpen) return 'close-modal';
  if (sheetOpen) return 'close-sheet';
  if (selectionMode) return 'exit-selection';
  if (nestedRoute) return 'nested-route';
  return 'history';
}

export {
  EDGE_SWIPE_AXIS_RATIO,
  EDGE_SWIPE_DISTANCE_MIN,
  EDGE_SWIPE_START_MAX,
  createEdgeSwipeGesture,
  evaluateEdgeSwipe,
  isGestureTargetBlocked as isEdgeSwipeTargetBlocked
} from './gesture-model.js';
