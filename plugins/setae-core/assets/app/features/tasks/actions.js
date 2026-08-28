import { normalizeTaskAction } from './lifecycle.js';

export const TASK_ACTION_STORAGE_KEY = 'setae.gui.v2.taskActions';

const storageKey = (scope) => `${TASK_ACTION_STORAGE_KEY}.${String(scope || 'anonymous').replace(/[^a-zA-Z0-9_-]/g, '')}`;

export function normalizeTaskActions(value = []) {
  const items = Array.isArray(value) ? value : value?.items || [];
  const map = new Map();
  items.map(normalizeTaskAction).filter(Boolean).forEach((item) => map.set(item.occurrenceKey, item));
  return [...map.values()].sort((left, right) => String(right.actedOn).localeCompare(String(left.actedOn))).slice(0, 500);
}

export function loadTaskActions(storage = globalThis.localStorage, scope = 'anonymous') {
  try {
    return normalizeTaskActions(JSON.parse(storage?.getItem(storageKey(scope)) || '[]'));
  } catch {
    return [];
  }
}

export function saveTaskActions(storage = globalThis.localStorage, actions = [], scope = 'anonymous') {
  const normalized = normalizeTaskActions(actions);
  storage?.setItem(storageKey(scope), JSON.stringify(normalized));
  return normalized;
}

export function upsertTaskAction(actions, action) {
  return normalizeTaskActions([...(actions || []).filter((item) => normalizeTaskAction(item)?.occurrenceKey !== action.occurrenceKey), action]);
}
