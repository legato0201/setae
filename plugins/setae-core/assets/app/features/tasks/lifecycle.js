import { careDateKey } from '../care/tasks.js';

export const taskOutcomes = Object.freeze(['completed', 'attempted', 'deferred', 'skipped']);

const DAY_MS = 86400000;

const localDate = (value) => {
  if (value instanceof Date) return new Date(value.getFullYear(), value.getMonth(), value.getDate());
  const match = String(value || '').match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return null;
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  return Number.isNaN(date.getTime()) ? null : date;
};

export const addTaskDays = (value, days) => {
  const date = localDate(value);
  if (!date) return careDateKey();
  date.setDate(date.getDate() + Number(days || 0));
  return careDateKey(date);
};

export const taskDaysBetween = (from, to) => {
  const start = localDate(from);
  const end = localDate(to);
  return start && end ? Math.round((end.getTime() - start.getTime()) / DAY_MS) : null;
};

export const taskOccurrenceKey = (taskId, scheduledFor) => `${taskId}@${careDateKey(scheduledFor)}`;

export function normalizeTask(task) {
  const scheduledFor = careDateKey(task?.scheduledFor || task?.dueAt);
  return {
    ...task,
    scheduledFor,
    dueAt: scheduledFor,
    status: task?.status || 'pending',
    allowedOutcomes: Array.isArray(task?.allowedOutcomes) ? task.allowedOutcomes : [...taskOutcomes],
    occurrenceKey: taskOccurrenceKey(task.id, scheduledFor)
  };
}

export function normalizeTaskAction(value = {}) {
  const outcome = String(value.outcome || '').toLowerCase();
  const taskId = String(value.taskId || value.task_id || '');
  const scheduledFor = careDateKey(value.scheduledFor || value.scheduled_for);
  if (!taskId || !taskOutcomes.includes(outcome)) return null;
  return {
    id: value.id || null,
    taskId,
    occurrenceKey: taskOccurrenceKey(taskId, scheduledFor),
    targetType: value.targetType || value.target_type || '',
    targetId: value.targetId ?? value.target_id ?? null,
    type: value.type || value.taskType || value.task_type || '',
    scheduledFor,
    outcome,
    retryAt: value.retryAt || value.retry_at ? careDateKey(value.retryAt || value.retry_at) : '',
    actedOn: careDateKey(value.actedOn || value.acted_on || value.created_at || new Date()),
    reason: value.reason || '',
    title: value.title || '',
    subtitle: value.subtitle || '',
    required: Boolean(value.required ?? value.was_required),
    createdAt: value.createdAt || value.created_at || ''
  };
}

export function taskRetryDate(task, outcome, { retryAt = '', now = new Date() } = {}) {
  if (retryAt) return careDateKey(retryAt);
  if (outcome === 'attempted' || outcome === 'deferred') return addTaskDays(now, 1);
  if (outcome === 'skipped') return addTaskDays(now, Math.max(1, Number(task?.intervalDays || 1)));
  return '';
}

export function createTaskAction(task, outcome, options = {}) {
  const normalized = normalizeTask(task);
  const actedOn = careDateKey(options.actedOn || new Date());
  return normalizeTaskAction({
    taskId: normalized.id,
    targetType: normalized.targetType,
    targetId: normalized.targetId,
    taskType: normalized.type,
    scheduledFor: normalized.scheduledFor,
    outcome,
    retryAt: taskRetryDate(normalized, outcome, options),
    actedOn,
    reason: options.reason || normalized.reason,
    title: normalized.title,
    subtitle: normalized.subtitle,
    required: normalized.bucket === 'overdue' || normalized.bucket === 'today'
  });
}

export function rescheduleTask(task, retryAt, outcome) {
  const dueAt = careDateKey(retryAt);
  const reasonPrefix = outcome === 'attempted'
    ? '前回は食べなかったため再確認'
    : outcome === 'skipped'
      ? '前回は見送り・次回予定'
      : '延期した作業';
  return normalizeTask({
    ...task,
    dueAt,
    scheduledFor: dueAt,
    reason: reasonPrefix,
    lifecycleSource: outcome
  });
}

export function classifyTaskDate(task, now = new Date()) {
  const daysUntilDue = taskDaysBetween(now, task.dueAt);
  if (daysUntilDue === null) return task;
  if (daysUntilDue < 0) return { ...task, daysUntilDue, priority: 'overdue', bucket: 'overdue', overdueDays: Math.abs(daysUntilDue), score: 320 + Math.abs(daysUntilDue) };
  if (daysUntilDue === 0) return { ...task, daysUntilDue, priority: 'today', bucket: 'today', overdueDays: 0, score: 220 };
  return { ...task, daysUntilDue, priority: 'upcoming', bucket: 'upcoming', overdueDays: 0, score: 120 - daysUntilDue };
}
