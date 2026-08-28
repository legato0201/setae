import { resolveNurseryCarePlan, nurseryCareDefinitions } from './care-plan.js';
import { nurseryEventLabel } from '../../content/terminology.js';

export const nurseryEventLabels = Object.freeze(Object.fromEntries([
  'feed', 'observation', 'count_check', 'environment_check', 'molt', 'dead', 'alive', 'rehomed', 'transferred'
].map((type) => [type, nurseryEventLabel(type)])));

export const nurseryEvents = (group = {}) => Array.isArray(group.events) ? group.events : [];

const nurseryItemNumber = (item = {}, index = 0) => {
  const explicit = Number(item.number);
  if (Number.isInteger(explicit) && explicit > 0) return explicit;
  const matched = String(item.code || '').match(/(\d+)$/);
  return matched ? Number(matched[1]) : index + 1;
};

export function nurseryCodeRange(group = {}) {
  const explicitRange = group.code_range || group.range || group.code;
  if (explicitRange) return String(explicitRange);

  const prefix = String(group.prefix || 'B').trim() || 'B';
  const items = (Array.isArray(group.items) ? group.items : [])
    .map((item, index) => ({
      code: String(item?.code || '').trim(),
      number: nurseryItemNumber(item, index)
    }))
    .sort((left, right) => left.number - right.number || left.code.localeCompare(right.code));

  if (!items.length) return String(group.name || prefix);
  const itemCode = (item) => item.code || `${prefix}${String(item.number).padStart(3, '0')}`;
  if (items.length === 1) return itemCode(items[0]);
  return `${itemCode(items[0])}–${itemCode(items.at(-1))}`;
}

export function latestNurseryEvent(group, eventType) {
  return nurseryEvents(group)
    .filter((event) => event.type === eventType)
    .sort((left, right) => String(right.date || '').localeCompare(String(left.date || '')) || Number(right.id || 0) - Number(left.id || 0))[0] || null;
}

export function nurseryLivingCount(group = {}) {
  const countEvent = latestNurseryEvent(group, 'count_check');
  return Number(countEvent?.data?.current_count ?? group.living_count ?? group.stats?.alive ?? group.count ?? 0);
}

export function nurseryCareStatus(group = {}, profile = {}) {
  const plan = resolveNurseryCarePlan(group, profile);
  return Object.entries(nurseryCareDefinitions).map(([type, definition]) => ({
    type,
    label: definition.label,
    intervalDays: Number(plan[type] || 0),
    last: latestNurseryEvent(group, definition.eventType)
  }));
}

export function nurseryHistory(group = {}, limit = 30) {
  const groupEvents = nurseryEvents(group).map((event) => ({
    id: `nursery-${event.id}`,
    scope: 'nursery',
    type: event.type,
    date: event.date,
    note: event.note || '',
    data: event.data || {}
  }));
  const babyEvents = (Array.isArray(group.items) ? group.items : []).flatMap((item) => (
    Array.isArray(item.history) ? item.history.map((event, index) => ({
      id: `baby-${item.code}-${event.date}-${event.type}-${index}`,
      scope: 'baby',
      code: item.code,
      type: event.type,
      date: event.date,
      note: event.note || '',
      data: {}
    })) : []
  ));
  return [...groupEvents, ...babyEvents]
    .sort((left, right) => String(right.date || '').localeCompare(String(left.date || '')) || String(right.id).localeCompare(String(left.id)))
    .slice(0, limit);
}

export function nurseryEventSummary(event = {}) {
  const data = event.data || {};
  if (event.type === 'feed') return [data.prey_type, Object.hasOwn(data, 'quantity') ? `×${data.quantity}` : ''].filter(Boolean).join(' ');
  if (event.type === 'count_check') {
    const difference = Number(data.difference || 0);
    return `${data.current_count ?? '—'}匹生存${difference ? ` · ${difference > 0 ? '+' : ''}${difference}` : ''}`;
  }
  if (event.type === 'environment_check') return [data.temperature != null ? `${data.temperature} °C` : '', data.humidity != null ? `${data.humidity} %` : ''].filter(Boolean).join(' · ');
  return data.label || event.note || '';
}
