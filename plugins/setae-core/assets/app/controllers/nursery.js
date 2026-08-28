import { applyNurseryEvent } from '../features/nursery/actions.js';

export async function saveNurseryEvent({ service, group, payload, mock = false } = {}) {
  if (!group?.id) throw new Error('記録するベビー群が見つかりません。');
  if (mock) {
    const previous = Number(group.events?.find((event) => event.type === 'count_check')?.data?.current_count ?? group.stats?.alive ?? group.count ?? 0);
    const current = Number(payload.current_count ?? previous);
    const event = {
      id: `mock-nursery-${Date.now()}`,
      target_type: 'nursery',
      target_id: group.id,
      type: payload.type,
      date: payload.date,
      note: payload.note || '',
      data: {
        prey_type: payload.prey_type || '', quantity: payload.quantity || 0, label: payload.label || '',
        temperature: payload.temperature ?? null, humidity: payload.humidity ?? null,
        ...(payload.type === 'count_check' ? { previous_count: previous, current_count: current, difference: current - previous } : {})
      }
    };
    return { event, group: applyNurseryEvent(group, event) };
  }
  return service.record(group.id, payload);
}
