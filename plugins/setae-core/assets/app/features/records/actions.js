import { runCollectionBatch } from '../collection/actions.js';

const textValue = (formData, key) => String(formData.get(key) || '').trim();

export const validRecordTypes = new Set(['feed', 'molt', 'observation', 'growth', 'pairing']);

export function resolveRecordType(value) {
  const type = String(value || '');
  return validRecordTypes.has(type) ? type : null;
}

export function recordDataFromForm(formData, type) {
  const resolvedType = resolveRecordType(type);
  if (!resolvedType) throw new TypeError(`Unknown SETAE record type: ${String(type || '')}`);
  const data = {};
  const note = textValue(formData, 'note');
  if (note) data.note = note;

  if (resolvedType === 'feed') {
    const preyType = textValue(formData, 'prey_type');
    if (preyType) data.prey_type = preyType;
    data.quantity = Math.max(1, Math.min(100, Number(formData.get('quantity') || 1)));
    data.refused = formData.get('refused') === 'on';
  }
  if (resolvedType === 'observation') data.label = textValue(formData, 'label') || '異常なし';
  if (resolvedType === 'molt') {
    const instar = Number(formData.get('instar') || 0);
    if (instar >= 1 && instar <= 30) data.instar = instar;
  }
  if (resolvedType === 'growth') {
    const size = textValue(formData, 'size');
    if (size) data.size = size;
  }
  if (resolvedType === 'pairing') {
    const partner = textValue(formData, 'partner_name');
    if (partner) data.partner_name = partner;
    data.result = textValue(formData, 'result') || 'attempted';
  }

  data.share_to_feed = formData.get('share_to_feed') === 'on';
  data.is_best_shot = formData.get('is_best_shot') === 'on';
  return data;
}

export function createRecordRequest({ type, date, data, image }) {
  const resolvedType = resolveRecordType(type);
  if (!resolvedType) throw new TypeError(`Unknown SETAE record type: ${String(type || '')}`);
  const jsonPayload = { type: resolvedType, date, data, compact_response: true };
  const hasImage = image && typeof image === 'object' && Number(image.size) > 0;
  if (!hasImage) return { payload: jsonPayload, jsonPayload, hasImage: false };
  const payload = new FormData();
  payload.set('type', resolvedType);
  payload.set('date', date);
  payload.set('data', JSON.stringify(data));
  payload.set('compact_response', '1');
  payload.set('image', image);
  return { payload, jsonPayload, hasImage: true };
}

export async function submitRecordTargets({ ids, type, date, data, image, create, enqueue }) {
  return runCollectionBatch(ids, async (animalId) => {
    const request = createRecordRequest({ type, date, data, image });
    try {
      return await create(animalId, request.payload);
    } catch (error) {
      if (error?.code === 'network_error' && !request.hasImage && enqueue) {
        enqueue(animalId, request.jsonPayload);
        return { queued: true };
      }
      throw error;
    }
  });
}

export function applyRecordToAnimals(animals, ids, type, date, data = {}) {
  const targets = new Set((ids || []).map(String));
  return animals.map((animal) => {
    if (!targets.has(String(animal.id))) return animal;
    if (type === 'feed' && !data.refused) return { ...animal, last_feed: date, status: 'normal' };
    if (type === 'feed' && data.refused) return { ...animal, status: 'fasting' };
    if (type === 'molt') return { ...animal, last_molt: date, instar: data.instar || animal.instar, status: 'post_molt' };
    if (type === 'observation') return { ...animal, last_observation: date, last_observation_label: data.label };
    if (type === 'pairing') return { ...animal, last_pairing: date };
    return animal;
  });
}
