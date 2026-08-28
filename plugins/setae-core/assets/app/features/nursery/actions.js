export function nurseryEventPayload(formData) {
  const payload = {
    type: String(formData.get('type') || ''),
    date: String(formData.get('date') || ''),
    note: String(formData.get('note') || '').trim()
  };
  if (payload.type === 'feed') {
    payload.prey_type = String(formData.get('prey_type') || '').trim();
    payload.quantity = Number(formData.get('quantity') || 0);
  } else if (payload.type === 'observation') {
    payload.label = String(formData.get('label') || '状態確認').trim();
  } else if (payload.type === 'count_check') {
    payload.current_count = Number(formData.get('current_count'));
  } else if (payload.type === 'environment_check') {
    const temperature = formData.get('temperature');
    const humidity = formData.get('humidity');
    if (temperature !== '') payload.temperature = Number(temperature);
    if (humidity !== '') payload.humidity = Number(humidity);
  }
  return payload;
}

export function applyNurseryEvent(group = {}, event = {}) {
  const events = [event, ...(Array.isArray(group.events) ? group.events : [])];
  return { ...group, events };
}
