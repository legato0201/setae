import { careDateKey } from '../care/tasks.js';
import { latestNurseryEvent, nurseryLivingCount } from '../nursery/model.js';
import { nurseryCareDefinitions, resolveNurseryCarePlan } from '../nursery/care-plan.js';

const DAY_MS = 86400000;
const localDate = (value) => {
  if (value instanceof Date) return new Date(value.getFullYear(), value.getMonth(), value.getDate());
  const match = String(value || '').match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return null;
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  return Number.isNaN(date.getTime()) ? null : date;
};
const addDays = (value, days) => {
  const date = localDate(value);
  if (!date) return null;
  date.setDate(date.getDate() + Number(days || 0));
  return careDateKey(date);
};
const daysBetween = (from, to) => {
  const start = localDate(from);
  const end = localDate(to);
  return start && end ? Math.round((end.getTime() - start.getTime()) / DAY_MS) : null;
};
const priorityFor = (days) => days < 0
  ? { priority: 'overdue', bucket: 'overdue', overdueDays: Math.abs(days), score: 320 + Math.abs(days) }
  : days === 0
    ? { priority: 'today', bucket: 'today', overdueDays: 0, score: 220 }
    : { priority: 'upcoming', bucket: 'upcoming', overdueDays: 0, score: 120 - days };
const reasonFor = (label, days) => days < 0 ? `${label}を${Math.abs(days)}日超過` : days === 0 ? `${label}予定日` : days === 1 ? `明日が${label}予定` : `${days}日後に${label}予定`;

function createTask(group, type, intervalDays, now, dueSoonDays) {
  if (!intervalDays || group.archived || nurseryLivingCount(group) < 1) return null;
  const definition = nurseryCareDefinitions[type];
  const latest = latestNurseryEvent(group, definition.eventType);
  const dueAt = addDays(latest?.date || group.birth_date || group.updated_at || careDateKey(now), intervalDays);
  const daysUntilDue = daysBetween(now, dueAt);
  if (daysUntilDue === null || daysUntilDue > dueSoonDays) return null;
  return {
    id: `nursery:${group.id}:${type}`,
    targetType: 'nursery', targetId: group.id, target: group, nursery: group, nurseryId: group.id,
    type, intervalDays, dueAt, daysUntilDue,
    reason: reasonFor(definition.label, daysUntilDue),
    recommendedAction: definition.eventType,
    title: group.name || `ベビー群 #${group.id}`,
    subtitle: `${group.species_name || '種未設定'} · ${nurseryLivingCount(group)}匹生存`,
    action: { kind: 'nursery-record', eventType: definition.eventType },
    ...priorityFor(daysUntilDue)
  };
}

export function createNurseryTasks(groups = [], profile = {}, { now = new Date() } = {}) {
  const items = Array.isArray(groups) ? groups : groups?.items || [];
  return items.flatMap((group) => {
    const plan = resolveNurseryCarePlan(group, profile);
    return Object.keys(nurseryCareDefinitions).map((type) => createTask(group, type, Number(plan[type] || 0), now, Number(plan.dueSoonDays || 3))).filter(Boolean);
  });
}
