import { recordTypeLabel } from '../../content/terminology.js';

const DAY_MS = 86400000;

const rawEvents = (value) => {
  if (Array.isArray(value)) return value;
  if (Array.isArray(value?.items)) return value.items;
  if (Array.isArray(value?.events)) return value.events;
  if (Array.isArray(value?.data)) return value.data;
  return [];
};

export function parseEventData(value) {
  if (value && typeof value === 'object' && !Array.isArray(value)) return value;
  if (typeof value !== 'string' || !value.trim()) return {};
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return { note: value };
  }
}

const dateTime = (value) => {
  const date = new Date(value || '');
  return Number.isNaN(date.getTime()) ? 0 : date.getTime();
};

const dayDifference = (left, right) => {
  const diff = dateTime(right) - dateTime(left);
  return diff > 0 ? Math.round(diff / DAY_MS) : 0;
};

export function normalizeSpecimenEvents(value) {
  return rawEvents(value).map((event) => {
    const data = parseEventData(event?.data);
    return {
      ...event,
      type: String(event?.type || 'observation').toLowerCase(),
      date: event?.date || event?.event_date || event?.created_at || '',
      data,
      note: data.note || data.label || event?.note || '',
      image: event?.image || event?.image_url || data.image || '',
      refused: Boolean(event?.refused ?? data.refused),
      isBestShot: Boolean(event?.is_best_shot ?? data.is_best_shot)
    };
  }).sort((a, b) => dateTime(b.date) - dateTime(a.date) || Number(b.id || 0) - Number(a.id || 0));
}

export function eventTypeLabel(type) {
  return recordTypeLabel(type);
}

export function eventSummary(event) {
  const data = event?.data || {};
  const parts = [];
  if (event.type === 'feed') {
    if (event.refused) parts.push('食べなかった');
    else {
      if (data.prey_type) parts.push(data.prey_type);
      if (data.quantity) parts.push(`× ${data.quantity}`);
    }
  }
  if (event.type === 'molt' && (data.instar || data.stage)) parts.push(`齢期 ${data.instar || data.stage}`);
  if (event.type === 'growth' && data.size) parts.push(`サイズ ${data.size}`);
  if (event.type === 'observation' && data.label) parts.push(data.label);
  if (event.type === 'pairing') {
    if (data.partner_name || data.partner) parts.push(data.partner_name || data.partner);
    if (data.result || data.status) parts.push(data.result || data.status);
  }
  const note = data.note || event?.note || '';
  if (note && !parts.includes(note)) parts.push(note);
  return parts.join(' / ');
}

export function buildGrowthMetrics(eventsValue, currentInstar = 0) {
  const events = normalizeSpecimenEvents(eventsValue);
  const molts = events.filter((event) => event.type === 'molt' && dateTime(event.date)).sort((a, b) => dateTime(a.date) - dateTime(b.date));
  const feeds = events.filter((event) => event.type === 'feed' && !event.refused && dateTime(event.date)).sort((a, b) => dateTime(a.date) - dateTime(b.date));
  const growth = events.filter((event) => event.type === 'growth' && dateTime(event.date)).sort((a, b) => dateTime(a.date) - dateTime(b.date));
  const fallbackStart = Math.max(1, Number(currentInstar || 0) - Math.max(0, molts.length - 1));
  const moltPoints = molts.map((event, index) => ({
    date: event.date,
    instar: Number(event.data?.instar || event.data?.stage || fallbackStart + index),
    event
  })).filter((point) => point.instar > 0);
  const moltIntervals = moltPoints.slice(1).map((point, index) => ({
    from: moltPoints[index].instar,
    to: point.instar,
    days: dayDifference(moltPoints[index].date, point.date),
    date: point.date
  })).filter((item) => item.days > 0);
  const feedIntervals = feeds.slice(1).map((event, index) => dayDifference(feeds[index].date, event.date)).filter((days) => days > 0);
  const sizes = growth.map((event) => ({ date: event.date, size: Number.parseFloat(event.data?.size), event })).filter((point) => Number.isFinite(point.size));

  return {
    moltPoints,
    moltIntervals,
    sizePoints: sizes,
    feedIntervals,
    feedStats: feedIntervals.length ? {
      average: Math.round((feedIntervals.reduce((sum, days) => sum + days, 0) / feedIntervals.length) * 10) / 10,
      minimum: Math.min(...feedIntervals),
      maximum: Math.max(...feedIntervals)
    } : null
  };
}

function instarAtDate(date, growthMetrics, currentInstar) {
  const target = dateTime(date);
  if (!target || !growthMetrics.moltPoints.length) return Number(currentInstar || 0) || null;
  const after = growthMetrics.moltPoints.filter((point) => dateTime(point.date) > target).length;
  return Math.max(1, Number(currentInstar || growthMetrics.moltPoints.at(-1)?.instar || 1) - after);
}

export function buildPhotoRecords(animal, eventsValue) {
  const events = normalizeSpecimenEvents(eventsValue);
  const growth = buildGrowthMetrics(events, animal?.instar);
  const photos = [];
  const seen = new Set();
  const add = (record) => {
    if (!record.url || seen.has(record.url)) return;
    seen.add(record.url);
    photos.push(record);
  };
  const mainPhoto = animal?.image_url || animal?.image?.url || animal?.thumbnail_url || animal?.thumb || '';
  if (animal?.has_own_image !== false && animal?.image_source !== 'species') add({
    id: 'profile',
    url: mainPhoto,
    date: animal?.photo_date || animal?.updated_at || animal?.acquired_date || animal?.created_at || '',
    instar: Number(animal?.instar || 0) || null,
    type: 'profile',
    status: animal?.status || '',
    best: false
  });
  events.forEach((event) => add({
    id: String(event.id || event.image),
    url: event.image,
    date: event.date,
    instar: instarAtDate(event.date, growth, animal?.instar),
    type: event.type,
    status: event.data?.status || '',
    best: event.isBestShot,
    event
  }));
  return photos.sort((a, b) => dateTime(b.date) - dateTime(a.date));
}

export function relatedBabyGroups(babyGroups, animalId) {
  const groups = [
    ...(Array.isArray(babyGroups) ? babyGroups : babyGroups?.items || []),
    ...(babyGroups?.archived_items || [])
  ];
  return groups.filter((group) => {
    const ids = Array.isArray(group?.parent_spider_ids)
      ? group.parent_spider_ids
      : String(group?.parent_spider_ids || '').split(/[\s,]+/);
    return ids.some((id) => String(id) === String(animalId));
  });
}

export function groupEventsByMonth(eventsValue) {
  const groups = [];
  normalizeSpecimenEvents(eventsValue).forEach((event) => {
    const date = new Date(event.date || '');
    const key = Number.isNaN(date.getTime()) ? '日付未設定' : `${date.getFullYear()}年${date.getMonth() + 1}月`;
    let group = groups.find((item) => item.key === key);
    if (!group) {
      group = { key, events: [] };
      groups.push(group);
    }
    group.events.push(event);
  });
  return groups;
}
