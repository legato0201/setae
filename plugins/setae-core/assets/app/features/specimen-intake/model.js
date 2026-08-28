import { specimenPublicSettings } from '../specimen/public-settings.js';

const hasValue = (value) => String(value ?? '').trim() !== '';

export function specimenHasPhoto(animal = {}) {
  return Boolean(animal.image_url || animal.image?.url || animal.thumbnail_url || animal.thumb);
}

export function specimenSectionHasValues(section, values = {}, { hasImage = false } = {}) {
  if (section === 'condition') {
    return (hasValue(values.gender) && values.gender !== 'unknown')
      || hasValue(values.instar)
      || (hasValue(values.status) && values.status !== 'normal')
      || (hasValue(values.enclosure_id) && String(values.enclosure_id) !== '0');
  }
  if (section === 'husbandry') {
    return ['last_molt', 'last_feed', 'acquired_date', 'temperature', 'humidity', 'substrate', 'origin']
      .some((name) => hasValue(values[name]));
  }
  if (section === 'records') return hasImage || hasValue(values.notes);
  if (section === 'administration') {
    const settings = specimenPublicSettings(values);
    return settings.visibility !== 'private' || settings.transfer_enabled || values.bl_status === 'recruiting'
      || ['breeding_contact_url', 'breeding_contact_label', 'bl_terms'].some((name) => hasValue(values[name]))
      || [true, 1, '1', 'on'].includes(values.archived);
  }
  return false;
}
