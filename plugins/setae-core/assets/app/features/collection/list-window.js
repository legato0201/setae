import { createListWindow } from '../../components/progressive-list.js';

export function createCollectionWindow(value = {}) {
  const settings = typeof value === 'number' ? { limit: value } : value || {};
  return {
    ...createListWindow({ ...settings, initial: 50, step: 50 }),
    queryKey: typeof settings.queryKey === 'string' ? settings.queryKey : ''
  };
}
