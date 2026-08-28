import { careDateKey } from '../care/tasks.js';
import { enclosureCareDefinitions, resolveEnclosureCarePlan } from '../husbandry/care-plan.js';

const DAY_MS = 86400000;

const localDate = (value) => {
  if (value instanceof Date) return new Date(value.getFullYear(), value.getMonth(), value.getDate());
  const match = String(value || '').match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return null;
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  return Number.isNaN(date.getTime()) ? null : date;
};

const daysBetween = (from, to) => {
  const start = localDate(from);
  const end = localDate(to);
  return start && end ? Math.round((end.getTime() - start.getTime()) / DAY_MS) : null;
};

const priorityFor = (daysUntilDue) => {
  if (daysUntilDue < 0) return { priority: 'overdue', bucket: 'overdue', overdueDays: Math.abs(daysUntilDue), score: 320 + Math.abs(daysUntilDue) };
  if (daysUntilDue === 0) return { priority: 'today', bucket: 'today', overdueDays: 0, score: 220 };
  return { priority: 'upcoming', bucket: 'upcoming', overdueDays: 0, score: 120 - daysUntilDue };
};

const reasonFor = (type, daysUntilDue) => {
  const label = enclosureCareDefinitions[type]?.label || '作業';
  if (daysUntilDue < 0) return `${label}を${Math.abs(daysUntilDue)}日超過`;
  if (daysUntilDue === 0) return `${label}予定日`;
  if (daysUntilDue === 1) return `明日が${label}予定`;
  return `${daysUntilDue}日後に${label}予定`;
};

const eventDate = (enclosure, type) => {
  if (type === 'environment' && enclosure.last_environment?.event_date) return enclosure.last_environment.event_date;
  if (type === 'maintenance' && enclosure.last_maintenance?.event_date) return enclosure.last_maintenance.event_date;
  const eventType = enclosureCareDefinitions[type]?.eventType;
  const events = Array.isArray(enclosure.events) ? enclosure.events : [];
  const event = events.find((item) => (item.event_type || item.type) === eventType);
  return event?.event_date || event?.date || enclosure.created_at;
};

const addDays = (value, days) => {
  const date = localDate(value);
  if (!date) return null;
  date.setDate(date.getDate() + Number(days || 0));
  return careDateKey(date);
};

function createTask(enclosure, type, intervalDays, now, dueSoonDays) {
  if (!intervalDays) return null;
  const dueAt = addDays(eventDate(enclosure, type), intervalDays)
    || (type === 'environment' ? enclosure.care?.environment_due_at : type === 'maintenance' ? enclosure.care?.maintenance_due_at : null)
    || careDateKey(now);
  const daysUntilDue = daysBetween(now, dueAt);
  if (daysUntilDue === null || daysUntilDue > dueSoonDays) return null;
  const eventType = enclosureCareDefinitions[type]?.eventType || type;
  return {
    id: `enclosure:${enclosure.id}:${type}`,
    targetType: 'enclosure',
    targetId: enclosure.id,
    target: enclosure,
    enclosureId: enclosure.id,
    enclosure,
    type,
    intervalDays,
    dueAt: careDateKey(dueAt),
    daysUntilDue,
    reason: reasonFor(type, daysUntilDue),
    recommendedAction: eventType,
    title: enclosure.code || `容器 #${enclosure.id}`,
    subtitle: enclosure.name || enclosure.location || enclosure.type_label || '飼育容器',
    action: {
      kind: 'enclosure-record',
      eventType
    },
    ...priorityFor(daysUntilDue)
  };
}

export function createEnclosureTasks(enclosures = [], profile = {}, { now = new Date() } = {}) {
  const items = Array.isArray(enclosures) ? enclosures : enclosures?.items || [];
  return items.flatMap((enclosure) => {
    const plan = resolveEnclosureCarePlan(enclosure, profile);
    return Object.keys(enclosureCareDefinitions).map((type) => createTask(
      enclosure,
      type,
      Number(plan[type] || 0),
      now,
      Number(plan.dueSoonDays || 3)
    )).filter(Boolean);
  });
}
