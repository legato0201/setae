import { animalQueryFromSettings } from './animal-query.js';

const STORAGE_KEY = 'setae.gui.v2.savedAnimalViews';

export const builtInAnimalViews = [
  { id: 'all', title: 'すべて', builtin: true, query: { filters: [], sort: { field: 'code', direction: 'asc' } } },
  { id: 'favorites', title: 'お気に入り', builtin: true, query: { filters: [{ field: 'is_favorite', operator: '=', value: true }], sort: { field: 'code', direction: 'asc' } } },
  { id: 'pre_molt', title: '脱皮前', builtin: true, query: { filters: [{ field: 'status', operator: '=', value: 'pre_molt' }], sort: { field: 'days_since_molt', direction: 'desc' } } },
  { id: 'feeding', title: '給餌対象', builtin: true, query: { careTaskType: 'feed', filters: [], sort: { field: 'code', direction: 'asc' } } }
];

const viewId = () => globalThis.crypto?.randomUUID?.() || `view-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

export function normalizeSavedView(view = {}) {
  return {
    id: String(view.id || viewId()),
    title: String(view.title || '新しいView').trim().slice(0, 40) || '新しいView',
    builtin: false,
    query: {
      filters: Array.isArray(view.query?.filters) ? view.query.filters : [],
      sort: view.query?.sort || { field: 'code', direction: 'asc' }
    }
  };
}

export function loadSavedViews(storage = globalThis.localStorage) {
  try {
    const parsed = JSON.parse(storage?.getItem(STORAGE_KEY) || '[]');
    return Array.isArray(parsed) ? parsed.map(normalizeSavedView) : [];
  } catch {
    return [];
  }
}

export function saveSavedViews(views, storage = globalThis.localStorage) {
  storage?.setItem(STORAGE_KEY, JSON.stringify((views || []).map(normalizeSavedView)));
}

export function findAnimalView(id, savedViews = []) {
  return [...builtInAnimalViews, ...savedViews].find((view) => view.id === id) || builtInAnimalViews[0];
}

export function savedViewFromSettings({ id, title, ...settings }) {
  return normalizeSavedView({ id, title, query: animalQueryFromSettings(settings) });
}
