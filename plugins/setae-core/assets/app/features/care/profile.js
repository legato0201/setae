export const CARE_PROFILE_STORAGE_KEY = 'setae.gui.v2.careProfile';

export const defaultCareRules = Object.freeze({
  feedIntervalDays: 7,
  observationIntervalDays: 14,
  preMoltObservationDays: 1,
  postMoltFeedDelayDays: 3,
  dueSoonDays: 3,
  excludePreMoltFeed: true
});

const numericRules = {
  feedIntervalDays: [1, 365],
  observationIntervalDays: [1, 365],
  preMoltObservationDays: [1, 30],
  postMoltFeedDelayDays: [0, 90],
  dueSoonDays: [1, 30]
};

const boundedNumber = (value, fallback, [min, max]) => {
  const number = Number(value);
  return Number.isFinite(number) ? Math.min(max, Math.max(min, Math.round(number))) : fallback;
};

function normalizeRules(value, { partial = false } = {}) {
  const source = value && typeof value === 'object' ? value : {};
  const result = {};
  Object.entries(numericRules).forEach(([key, range]) => {
    if (partial && (source[key] === '' || source[key] === undefined || source[key] === null)) return;
    result[key] = boundedNumber(source[key], defaultCareRules[key], range);
  });
  if (!partial || Object.prototype.hasOwnProperty.call(source, 'excludePreMoltFeed')) {
    result.excludePreMoltFeed = source.excludePreMoltFeed === undefined
      ? defaultCareRules.excludePreMoltFeed
      : Boolean(source.excludePreMoltFeed);
  }
  return result;
}

function normalizeOverrides(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return Object.fromEntries(Object.entries(value)
    .slice(0, 250)
    .map(([key, rules]) => [String(key).slice(0, 160), normalizeRules(rules, { partial: true })])
    .filter(([key, rules]) => key && Object.keys(rules).length));
}

export const defaultCareProfile = Object.freeze({
  defaults: defaultCareRules,
  species: {},
  animals: {}
});

export function normalizeCareProfile(value = {}) {
  const source = value && typeof value === 'object' ? value : {};
  return {
    defaults: normalizeRules({ ...defaultCareRules, ...(source.defaults || {}) }),
    species: normalizeOverrides(source.species),
    animals: normalizeOverrides(source.animals)
  };
}

export function careSpeciesKey(animal = {}) {
  const id = Number(animal.species_id || animal.speciesId || 0);
  if (id > 0) return String(id);
  const name = String(animal.species_name || animal.scientific_name || '').trim().toLowerCase();
  return name ? `name--${name}` : '';
}

export function resolveCareRules(animal, profile = defaultCareProfile) {
  const normalized = normalizeCareProfile(profile);
  const speciesRules = normalized.species[careSpeciesKey(animal)] || {};
  const animalRules = normalized.animals[String(animal?.id ?? '')] || {};
  return { ...normalized.defaults, ...speciesRules, ...animalRules };
}

export function loadCareProfile(storage = globalThis.localStorage) {
  try {
    return normalizeCareProfile(JSON.parse(storage?.getItem(CARE_PROFILE_STORAGE_KEY) || 'null') || {});
  } catch {
    return normalizeCareProfile();
  }
}

export function saveCareProfile(storage = globalThis.localStorage, value = {}) {
  const normalized = normalizeCareProfile(value);
  storage?.setItem(CARE_PROFILE_STORAGE_KEY, JSON.stringify(normalized));
  return normalized;
}

export function rulesFromFormData(formData, { partial = false } = {}) {
  const value = {};
  Object.keys(numericRules).forEach((key) => {
    const raw = formData.get(key);
    if (!partial || raw !== '') value[key] = raw;
  });
  if (!partial || formData.has('excludePreMoltFeed')) {
    value.excludePreMoltFeed = formData.get('excludePreMoltFeed') === 'on';
  }
  return normalizeRules(value, { partial });
}
