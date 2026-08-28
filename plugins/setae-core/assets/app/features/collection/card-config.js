export const ANIMAL_CARD_STORAGE_KEY = 'setae.gui.v2.animalCard';

export const animalCardModes = ['photo', 'hybrid', 'data'];
export const animalCardDensities = ['compact', 'standard', 'detailed'];
export const animalCardFieldKeys = [
  'scientificName',
  'gender',
  'instar',
  'status',
  'lastFeed',
  'lastMolt',
  'lastObservation',
  'origin',
  'temperature',
  'humidity',
  'enclosure',
  'acquiredDate'
];
export const animalCardQuickActions = ['feed', 'observation', 'molt', 'growth'];

export const defaultAnimalCardConfig = {
  mode: 'hybrid',
  density: 'standard',
  fields: {
    scientificName: true,
    gender: true,
    instar: true,
    status: true,
    lastFeed: true,
    lastMolt: true,
    lastObservation: false,
    origin: false,
    temperature: false,
    humidity: false,
    enclosure: false,
    acquiredDate: false
  },
  quickActions: ['feed', 'observation']
};

export function normalizeAnimalCardConfig(value = {}) {
  const source = value && typeof value === 'object' ? value : {};
  const sourceFields = source.fields && typeof source.fields === 'object' ? source.fields : {};
  const fields = Object.fromEntries(animalCardFieldKeys.map((key) => [
    key,
    Object.hasOwn(sourceFields, key) ? Boolean(sourceFields[key]) : defaultAnimalCardConfig.fields[key]
  ]));
  const quickActions = [];
  const sourceActions = Array.isArray(source.quickActions) ? source.quickActions : defaultAnimalCardConfig.quickActions;

  for (const action of sourceActions) {
    if (!animalCardQuickActions.includes(action) || quickActions.includes(action)) continue;
    quickActions.push(action);
    if (quickActions.length === 3) break;
  }

  return {
    mode: animalCardModes.includes(source.mode) ? source.mode : defaultAnimalCardConfig.mode,
    density: animalCardDensities.includes(source.density) ? source.density : defaultAnimalCardConfig.density,
    fields,
    quickActions
  };
}

export function loadAnimalCardConfig(storage = globalThis.localStorage) {
  try {
    return normalizeAnimalCardConfig(JSON.parse(storage?.getItem(ANIMAL_CARD_STORAGE_KEY) || 'null'));
  } catch {
    return normalizeAnimalCardConfig();
  }
}

export function saveAnimalCardConfig(storage = globalThis.localStorage, config = defaultAnimalCardConfig) {
  const normalized = normalizeAnimalCardConfig(config);
  storage?.setItem(ANIMAL_CARD_STORAGE_KEY, JSON.stringify(normalized));
  return normalized;
}
