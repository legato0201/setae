export const ONBOARDING_STORAGE_PREFIX = 'setae.gui.v2.onboarding';
export const ONBOARDING_VERSION = 1;

export const defaultOnboardingState = Object.freeze({
  version: ONBOARDING_VERSION,
  dismissed: false,
  completionAnnounced: false
});

const ownerKey = (ownerId) => String(ownerId || '') === 'mock'
  ? `${ONBOARDING_STORAGE_PREFIX}.mock`
  : `${ONBOARDING_STORAGE_PREFIX}.${Number(ownerId) || 0}`;

export function normalizeOnboardingState(value = {}) {
  const source = value && typeof value === 'object' ? value : {};
  return {
    version: ONBOARDING_VERSION,
    dismissed: Boolean(source.dismissed),
    completionAnnounced: Boolean(source.completionAnnounced)
  };
}

export function loadOnboardingState(storage = globalThis.localStorage, ownerId = 0) {
  try {
    return normalizeOnboardingState(JSON.parse(storage?.getItem(ownerKey(ownerId)) || 'null'));
  } catch {
    return normalizeOnboardingState();
  }
}

export function saveOnboardingState(storage = globalThis.localStorage, ownerId = 0, value = {}) {
  const normalized = normalizeOnboardingState(value);
  storage?.setItem(ownerKey(ownerId), JSON.stringify(normalized));
  return normalized;
}

const activeNurseries = (babyGroups) => {
  if (Array.isArray(babyGroups)) return babyGroups;
  if (Array.isArray(babyGroups?.items)) return babyGroups.items;
  if (Array.isArray(babyGroups?.groups)) return babyGroups.groups;
  return [];
};

export function deriveOnboardingProgress({ animals = [], babyGroups = null, records = [], firstRecordAt = null } = {}) {
  const collectionRegistered = (Array.isArray(animals) && animals.length > 0)
    || activeNurseries(babyGroups).some((group) => !group?.archived);
  const firstRecordAdded = Boolean(firstRecordAt)
    || (Array.isArray(records) && records.some((record) => {
      const event = record.event || record;
      const target = record.targetType || record.target_type || (event.enclosure_id ? 'enclosure' : 'animal');
      return ['animal', 'nursery'].includes(target) && event.recorded_by_current_user === true;
    }))
    || activeNurseries(babyGroups).some((group) => (group.events || []).some((event) => event.recorded_by_current_user === true));
  const completed = Number(collectionRegistered) + Number(firstRecordAdded);
  return {
    collectionRegistered,
    firstRecordAdded,
    completed,
    required: 2,
    complete: collectionRegistered && firstRecordAdded
  };
}

export function shouldShowGettingStarted({ setupCompleted = false, onboarding = {}, progress = {} } = {}) {
  return Boolean(!onboarding.dismissed && !progress.complete);
}

export function completeOnboardingIfNeeded(onboarding, progress, { announce = true } = {}) {
  const normalized = normalizeOnboardingState(onboarding);
  if (!progress?.complete || normalized.completionAnnounced || !announce) return { state: normalized, announced: false };
  return {
    state: { ...normalized, completionAnnounced: true, dismissed: true },
    announced: true
  };
}

export const onboardingStorageKey = ownerKey;
