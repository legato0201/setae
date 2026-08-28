import { resolveRecordType } from './actions.js';

const STORAGE_KEY = 'setae.gui.v2.quickRecordRecent';
const MAX_ITEMS = 80;

const normalize = (item = {}) => ({
  animalId: String(item.animalId || ''),
  type: resolveRecordType(item.type) || '',
  lastUsedAt: Number(item.lastUsedAt || 0),
  count: Math.max(1, Number(item.count || 1)),
  preyType: String(item.preyType || '')
});

export function loadQuickRecordRecent(storage = globalThis.localStorage) {
  try {
    const parsed = JSON.parse(storage?.getItem(STORAGE_KEY) || '[]');
    return Array.isArray(parsed) ? parsed.map(normalize).filter((item) => item.animalId && item.type) : [];
  } catch {
    return [];
  }
}

export function saveQuickRecordRecent(items, storage = globalThis.localStorage) {
  const normalized = (items || []).map(normalize).filter((item) => item.animalId && item.type);
  storage?.setItem(STORAGE_KEY, JSON.stringify(normalized.slice(0, MAX_ITEMS)));
  return normalized;
}

export function recordQuickRecordUsage(storage, { animalId, type, preyType = '', usedAt = Date.now() }) {
  const id = String(animalId || '');
  const recordType = resolveRecordType(type);
  if (!id || !recordType) return loadQuickRecordRecent(storage);
  const items = loadQuickRecordRecent(storage);
  const index = items.findIndex((item) => item.animalId === id && item.type === recordType);
  const current = index >= 0 ? items[index] : { animalId: id, type: recordType, count: 0 };
  const next = normalize({
    ...current,
    lastUsedAt: Number(usedAt),
    count: Number(current.count || 0) + 1,
    preyType: preyType || current.preyType || ''
  });
  if (index >= 0) items.splice(index, 1);
  items.unshift(next);
  return saveQuickRecordRecent(items.sort((a, b) => b.lastUsedAt - a.lastUsedAt), storage);
}

export function recentAnimalActions(animals = [], entries = [], { limit = 5, now = Date.now() } = {}) {
  const animalMap = new Map(animals.map((animal) => [String(animal.id), animal]));
  const grouped = new Map();
  entries.forEach((entry) => {
    const animal = animalMap.get(String(entry.animalId));
    if (!animal) return;
    const current = grouped.get(String(entry.animalId));
    const ageDays = Math.max(0, (now - Number(entry.lastUsedAt || 0)) / 86400000);
    const score = Math.max(0, 45 - ageDays) + Math.log2(Number(entry.count || 1) + 1) * 8;
    if (!current || score > current.score) grouped.set(String(entry.animalId), { animal, entry, score });
  });
  return [...grouped.values()]
    .sort((left, right) => right.score - left.score || right.entry.lastUsedAt - left.entry.lastUsedAt)
    .slice(0, limit);
}

export function recentPreyTypes(entries = [], limit = 4) {
  const grouped = new Map();
  entries.forEach((entry) => {
    const preyType = String(entry.preyType || '').trim();
    if (!preyType) return;
    const current = grouped.get(preyType) || { preyType, count: 0, lastUsedAt: 0 };
    current.count += Number(entry.count || 1);
    current.lastUsedAt = Math.max(current.lastUsedAt, Number(entry.lastUsedAt || 0));
    grouped.set(preyType, current);
  });
  return [...grouped.values()]
    .sort((left, right) => right.lastUsedAt - left.lastUsedAt || right.count - left.count)
    .slice(0, limit)
    .map((item) => item.preyType);
}
