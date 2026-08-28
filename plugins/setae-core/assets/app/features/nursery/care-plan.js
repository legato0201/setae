export const NURSERY_CARE_PROFILE_STORAGE_KEY = 'setae.gui.v2.nurseryCareProfile';

export const nurseryCareDefinitions = Object.freeze({
  feed: { label: '給餌', eventType: 'feed', defaultDays: 3 },
  observation: { label: '観察', eventType: 'observation', defaultDays: 2 },
  count: { label: '個体数確認', eventType: 'count_check', defaultDays: 7 },
  environment: { label: '環境確認', eventType: 'environment_check', defaultDays: 1 }
});

export const nurseryCareRuleKeys = Object.freeze(Object.keys(nurseryCareDefinitions));

const boundedDays = (value, fallback = 0) => {
  const number = Number(value);
  return Number.isFinite(number) ? Math.min(3650, Math.max(0, Math.round(number))) : fallback;
};

const normalizeRules = (value, { partial = false } = {}) => {
  const source = value && typeof value === 'object' ? value : {};
  const result = {};
  nurseryCareRuleKeys.forEach((key) => {
    if (partial && (source[key] === '' || source[key] === undefined || source[key] === null)) return;
    result[key] = boundedDays(source[key], nurseryCareDefinitions[key].defaultDays);
  });
  if (!partial || source.dueSoonDays !== undefined) {
    result.dueSoonDays = Math.min(30, Math.max(1, boundedDays(source.dueSoonDays, 3)));
  }
  return result;
};

const normalizeOverrides = (value, maxKeyLength = 160) => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return Object.fromEntries(Object.entries(value).slice(0, 250).map(([key, rules]) => [
    String(key).slice(0, maxKeyLength),
    normalizeRules(rules, { partial: true })
  ]).filter(([key, rules]) => key && Object.keys(rules).length));
};

export const defaultNurseryCareProfile = Object.freeze({
  defaults: Object.freeze({ feed: 3, observation: 2, count: 7, environment: 1, dueSoonDays: 3 }),
  species: Object.freeze({}),
  nurseries: Object.freeze({})
});

export function normalizeNurseryCareProfile(value = {}) {
  const source = value && typeof value === 'object' ? value : {};
  return {
    defaults: normalizeRules({ ...defaultNurseryCareProfile.defaults, ...(source.defaults || {}) }),
    species: normalizeOverrides(source.species),
    nurseries: normalizeOverrides(source.nurseries, 80)
  };
}

export function nurserySpeciesKey(group = {}) {
  return String(group.species_id || group.species_name || '').trim();
}

export function resolveNurseryCarePlan(group = {}, profile = defaultNurseryCareProfile) {
  const normalized = normalizeNurseryCareProfile(profile);
  return {
    ...normalized.defaults,
    ...(normalized.species[nurserySpeciesKey(group)] || {}),
    ...(normalized.nurseries[String(group.id || '')] || {})
  };
}

export function loadNurseryCareProfile(storage = globalThis.localStorage) {
  try {
    return normalizeNurseryCareProfile(JSON.parse(storage?.getItem(NURSERY_CARE_PROFILE_STORAGE_KEY) || 'null') || {});
  } catch {
    return normalizeNurseryCareProfile();
  }
}

export function saveNurseryCareProfile(storage = globalThis.localStorage, value = {}) {
  const normalized = normalizeNurseryCareProfile(value);
  storage?.setItem(NURSERY_CARE_PROFILE_STORAGE_KEY, JSON.stringify(normalized));
  return normalized;
}

export function nurseryCareRulesFromForm(formData, { partial = false } = {}) {
  const value = {};
  nurseryCareRuleKeys.forEach((key) => {
    const raw = formData.get(`care_${key}`);
    if (!partial || raw !== '') value[key] = raw;
  });
  const dueSoon = formData.get('care_dueSoonDays');
  if (!partial || dueSoon !== '') value.dueSoonDays = dueSoon;
  return normalizeRules(value, { partial });
}
