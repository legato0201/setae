export const ENCLOSURE_CARE_PROFILE_STORAGE_KEY = 'setae.gui.v2.enclosureCareProfile';

export const enclosureCareDefinitions = Object.freeze({
  environment: { label: '環境確認', eventType: 'environment_check', defaultDays: 1 },
  misting: { label: '霧吹き', eventType: 'misting', defaultDays: 0 },
  watering: { label: '給水', eventType: 'watering', defaultDays: 0 },
  maintenance: { label: 'メンテナンス', eventType: 'maintenance', defaultDays: 14 },
  substrate: { label: '床材交換', eventType: 'substrate_change', defaultDays: 0 }
});

export const enclosureCareRuleKeys = Object.freeze(Object.keys(enclosureCareDefinitions));

const boundedDays = (value, fallback = 0) => {
  const number = Number(value);
  return Number.isFinite(number) ? Math.min(3650, Math.max(0, Math.round(number))) : fallback;
};

const normalizeRules = (value, { partial = false } = {}) => {
  const source = value && typeof value === 'object' ? value : {};
  const result = {};
  enclosureCareRuleKeys.forEach((key) => {
    if (partial && (source[key] === '' || source[key] === undefined || source[key] === null)) return;
    result[key] = boundedDays(source[key], enclosureCareDefinitions[key].defaultDays);
  });
  if (!partial || source.dueSoonDays !== undefined) result.dueSoonDays = Math.min(30, Math.max(1, boundedDays(source.dueSoonDays, 3)));
  return result;
};

const normalizeOverrides = (value) => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return Object.fromEntries(Object.entries(value).slice(0, 250).map(([key, rules]) => [
    String(key).slice(0, 80),
    normalizeRules(rules, { partial: true })
  ]).filter(([key, rules]) => key && Object.keys(rules).length));
};

export const defaultEnclosureCareProfile = Object.freeze({
  defaults: Object.freeze({ environment: 1, misting: 0, watering: 0, maintenance: 14, substrate: 0, dueSoonDays: 3 }),
  types: Object.freeze({}),
  enclosures: Object.freeze({})
});

export function normalizeEnclosureCareProfile(value = {}) {
  const source = value && typeof value === 'object' ? value : {};
  return {
    defaults: normalizeRules({ ...defaultEnclosureCareProfile.defaults, ...(source.defaults || {}) }),
    types: normalizeOverrides(source.types),
    enclosures: normalizeOverrides(source.enclosures)
  };
}

export function resolveEnclosureCarePlan(enclosure = {}, profile = defaultEnclosureCareProfile) {
  const normalized = normalizeEnclosureCareProfile(profile);
  const typeRules = normalized.types[String(enclosure.enclosure_type || 'unspecified')] || {};
  const enclosureRules = normalized.enclosures[String(enclosure.id || '')] || {};
  return { ...normalized.defaults, ...typeRules, ...enclosureRules };
}

export function loadEnclosureCareProfile(storage = globalThis.localStorage) {
  try {
    return normalizeEnclosureCareProfile(JSON.parse(storage?.getItem(ENCLOSURE_CARE_PROFILE_STORAGE_KEY) || 'null') || {});
  } catch {
    return normalizeEnclosureCareProfile();
  }
}

export function saveEnclosureCareProfile(storage = globalThis.localStorage, value = {}) {
  const normalized = normalizeEnclosureCareProfile(value);
  storage?.setItem(ENCLOSURE_CARE_PROFILE_STORAGE_KEY, JSON.stringify(normalized));
  return normalized;
}

export function enclosureCareRulesFromForm(formData, { partial = false } = {}) {
  const value = {};
  enclosureCareRuleKeys.forEach((key) => {
    const raw = formData.get(`care_${key}`);
    if (!partial || raw !== '') value[key] = raw;
  });
  const dueSoon = formData.get('care_dueSoonDays');
  if (!partial || dueSoon !== '') value.dueSoonDays = dueSoon;
  return normalizeRules(value, { partial });
}
