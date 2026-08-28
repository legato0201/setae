import { careDateKey } from '../care/tasks.js';
import {
  addTaskDays,
  classifyTaskDate,
  normalizeTask,
  normalizeTaskAction,
  rescheduleTask,
  taskOccurrenceKey
} from './lifecycle.js';

const enclosureTaskType = (eventType) => {
  if (eventType === 'environment_check') return 'environment';
  if (eventType === 'misting') return 'misting';
  if (eventType === 'watering') return 'watering';
  if (eventType === 'substrate_change') return 'substrate';
  if (eventType === 'maintenance') return 'maintenance';
  return '';
};

const nurseryTaskType = (eventType) => {
  if (eventType === 'count_check') return 'count';
  if (eventType === 'environment_check') return 'environment';
  if (eventType === 'feed' || eventType === 'observation') return eventType;
  return '';
};

const recordTarget = (item) => {
  const event = item?.event || item || {};
  const explicitType = item?.targetType || item?.target_type;
  if (explicitType === 'nursery' || item?.nursery || item?.nursery_id || event?.target_type === 'nursery') {
    return {
      targetType: 'nursery',
      targetId: item?.targetId ?? item?.target_id ?? item?.nursery?.id ?? item?.nursery_id ?? event?.target_id,
      type: nurseryTaskType(event.event_type || event.type),
      date: event.event_date || event.date,
      refused: false,
      item
    };
  }
  if (explicitType === 'enclosure' || item?.enclosure || item?.enclosure_id || event?.enclosure_id) {
    return {
      targetType: 'enclosure',
      targetId: item?.targetId ?? item?.target_id ?? item?.enclosure?.id ?? item?.enclosure_id ?? event?.enclosure_id,
      type: enclosureTaskType(event.event_type || event.type),
      date: event.event_date || event.date,
      refused: false,
      item
    };
  }
  const data = event?.data && typeof event.data === 'object' ? event.data : {};
  return {
    targetType: 'animal',
    targetId: item?.targetId ?? item?.target_id ?? item?.animal?.id ?? item?.animal_id ?? item?.spider_id ?? event?.animal_id ?? event?.spider_id,
    type: event.type,
    date: event.date,
    refused: Boolean(event.refused ?? data.refused),
    item
  };
};

const sameTarget = (task, record) => task.targetType === record.targetType
  && String(task.targetId) === String(record.targetId)
  && task.type === record.type;

const handledFrom = (task, action, item = null) => ({
  id: action.occurrenceKey,
  taskId: action.taskId,
  targetType: action.targetType || task?.targetType,
  targetId: action.targetId ?? task?.targetId,
  type: action.type || task?.type,
  scheduledFor: action.scheduledFor,
  outcome: action.outcome,
  retryAt: action.retryAt,
  title: action.title || task?.title || '',
  subtitle: action.subtitle || task?.subtitle || '',
  reason: action.reason || task?.reason || '',
  item
});

function actionFromRecord(task, record, today) {
  const attempted = task.type === 'feed' && record.refused;
  return normalizeTaskAction({
    taskId: task.id,
    targetType: task.targetType,
    targetId: task.targetId,
    taskType: task.type,
    scheduledFor: task.scheduledFor,
    outcome: attempted ? 'attempted' : 'completed',
    retryAt: attempted ? addTaskDays(today, 1) : '',
    actedOn: today,
    reason: attempted ? '給餌を試みましたが食べませんでした' : task.reason,
    title: task.title,
    subtitle: task.subtitle
  });
}

export function resolveTaskCompletion({ tasks = [], records = [], actions = [], now = new Date() } = {}) {
  const today = careDateKey(now);
  const normalizedActions = actions.map(normalizeTaskAction).filter(Boolean);
  const actionMap = new Map(normalizedActions.map((action) => [action.occurrenceKey, action]));
  const todayRecords = records.map(recordTarget).filter((record) => record.targetId && record.type && careDateKey(record.date) === today);
  const usedRecords = new Set();
  const handled = new Map();
  const requiredHandled = new Map();

  const pending = tasks.map(normalizeTask).map((initialTask) => {
    let task = initialTask;
    const requiredToday = initialTask.bucket === 'overdue' || initialTask.bucket === 'today';
    const visited = new Set();
    while (true) {
      const occurrenceKey = taskOccurrenceKey(task.id, task.scheduledFor);
      if (visited.has(occurrenceKey)) return classifyTaskDate(task, now);
      visited.add(occurrenceKey);

      const action = actionMap.get(occurrenceKey);
      if (action) {
        if (action.actedOn === today) {
          const item = handledFrom(task, action);
          handled.set(action.occurrenceKey, item);
          if (requiredToday) requiredHandled.set(action.occurrenceKey, item);
        }
        if (action.outcome === 'completed' || !action.retryAt) return null;
        task = classifyTaskDate(rescheduleTask(task, action.retryAt, action.outcome), now);
        continue;
      }

      if (task.bucket === 'overdue' || task.bucket === 'today') {
        const recordIndex = todayRecords.findIndex((record, index) => !usedRecords.has(index) && sameTarget(task, record));
        if (recordIndex >= 0) {
          usedRecords.add(recordIndex);
          const recordAction = actionFromRecord(task, todayRecords[recordIndex], today);
          const item = handledFrom(task, recordAction, todayRecords[recordIndex].item);
          handled.set(recordAction.occurrenceKey, item);
          if (requiredToday) requiredHandled.set(recordAction.occurrenceKey, item);
          if (recordAction.outcome === 'attempted') {
            return classifyTaskDate(rescheduleTask(task, recordAction.retryAt, recordAction.outcome), now);
          }
          return null;
        }
      }
      return classifyTaskDate(task, now);
    }
  }).filter(Boolean);

  normalizedActions.filter((action) => action.actedOn === today).forEach((action) => {
    if (!handled.has(action.occurrenceKey)) handled.set(action.occurrenceKey, handledFrom(null, action));
    if (action.required && !requiredHandled.has(action.occurrenceKey)) requiredHandled.set(action.occurrenceKey, handledFrom(null, action));
  });

  const completed = [...requiredHandled.values()];
  const handledToday = [...handled.values()];
  const overdue = pending.filter((task) => task.bucket === 'overdue');
  const dueToday = pending.filter((task) => task.bucket === 'today');
  const upcoming = pending.filter((task) => task.bucket === 'upcoming');
  const required = overdue.length + dueToday.length + completed.length;

  return {
    tasks: pending,
    overdue,
    today: dueToday,
    upcoming,
    completed,
    handled: handledToday,
    progress: {
      completed: completed.length,
      required,
      percent: required ? Math.round((completed.length / required) * 100) : 100
    }
  };
}
