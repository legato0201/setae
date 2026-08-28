import { careSpeciesKey, resolveCareRules } from './profile.js';

const DAY_MS = 86400000;

const localDate = (value) => {
  if (value instanceof Date) return new Date(value.getFullYear(), value.getMonth(), value.getDate());
  const match = String(value || '').match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return null;
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  return Number.isNaN(date.getTime()) ? null : date;
};

export const careDateKey = (value = new Date()) => {
  const date = localDate(value) || localDate(new Date());
  const part = (number) => String(number).padStart(2, '0');
  return `${date.getFullYear()}-${part(date.getMonth() + 1)}-${part(date.getDate())}`;
};

const addDays = (value, days) => {
  const date = localDate(value);
  if (!date) return null;
  date.setDate(date.getDate() + Number(days || 0));
  return date;
};

const daysBetween = (from, to) => {
  const start = localDate(from);
  const end = localDate(to);
  return start && end ? Math.round((end.getTime() - start.getTime()) / DAY_MS) : null;
};

const laterDate = (...values) => values.filter(Boolean).reduce((latest, value) => {
  const date = localDate(value);
  return !latest || (date && date > latest) ? date : latest;
}, null);

const statusValue = (animal) => String(animal?.status || 'normal').toLowerCase().replaceAll('-', '_');

function taskPriority(daysUntilDue) {
  if (daysUntilDue < 0) return { priority: 'overdue', bucket: 'overdue', overdueDays: Math.abs(daysUntilDue), score: 300 + Math.abs(daysUntilDue) };
  if (daysUntilDue === 0) return { priority: 'today', bucket: 'today', overdueDays: 0, score: 200 };
  return { priority: 'upcoming', bucket: 'upcoming', overdueDays: 0, score: 100 - daysUntilDue };
}

function createTask(animal, type, dueDate, now, reason, rules) {
  const daysUntilDue = daysBetween(now, dueDate);
  if (daysUntilDue === null || daysUntilDue > rules.dueSoonDays) return null;
  return {
    id: `${animal.id}:${type}`,
    animalId: animal.id,
    animal,
    speciesKey: careSpeciesKey(animal),
    type,
    dueAt: careDateKey(dueDate),
    daysUntilDue,
    reason,
    recommendedAction: type,
    rules,
    ...taskPriority(daysUntilDue)
  };
}

function feedTask(animal, rules, now) {
  const status = statusValue(animal);
  if (status === 'pre_molt' && rules.excludePreMoltFeed) return null;

  const lastFeed = localDate(animal.last_feed ?? animal.last_feed_date);
  const startedAt = localDate(animal.acquired_date ?? animal.created_at);
  let dueDate = lastFeed ? addDays(lastFeed, rules.feedIntervalDays) : startedAt ? addDays(startedAt, rules.feedIntervalDays) : localDate(now);

  if (status === 'post_molt') {
    const afterMolt = addDays(animal.last_molt ?? animal.last_molt_date, rules.postMoltFeedDelayDays);
    dueDate = laterDate(dueDate, afterMolt) || dueDate;
  }

  const elapsed = lastFeed ? daysBetween(lastFeed, now) : null;
  const until = daysBetween(now, dueDate);
  const reason = !lastFeed
    ? '給餌記録なし'
    : until < 0
      ? `最終給餌から${elapsed}日`
      : until === 0
        ? '給餌予定日'
        : `${until}日後に給餌予定`;
  return createTask(animal, 'feed', dueDate, now, reason, rules);
}

function observationTask(animal, rules, now) {
  const preMolt = statusValue(animal) === 'pre_molt';
  const interval = preMolt ? rules.preMoltObservationDays : rules.observationIntervalDays;
  const lastObservation = localDate(animal.last_observation ?? animal.last_observation_date);
  const dueDate = lastObservation ? addDays(lastObservation, interval) : localDate(now);
  const elapsed = lastObservation ? daysBetween(lastObservation, now) : null;
  const until = daysBetween(now, dueDate);
  const reason = preMolt
    ? lastObservation && elapsed > 0 ? `脱皮前・前回確認から${elapsed}日` : '脱皮前・状態確認'
    : !lastObservation ? '観察記録なし' : until < 0 ? `前回観察から${elapsed}日` : until === 0 ? '観察予定日' : `${until}日後に観察予定`;
  const task = createTask(animal, 'observation', dueDate, now, reason, rules);
  return task && preMolt ? { ...task, score: task.score + 50 } : task;
}

export function createCareTasks(animals = [], profile = {}, { now = new Date() } = {}) {
  return animals.flatMap((animal) => {
    const rules = resolveCareRules(animal, profile);
    return [feedTask(animal, rules, now), observationTask(animal, rules, now)].filter(Boolean);
  }).sort((left, right) => right.score - left.score
    || left.dueAt.localeCompare(right.dueAt)
    || String(left.animalId).localeCompare(String(right.animalId)));
}

export function careTasksByType(tasks = [], type, { includeUpcoming = true, limit = Infinity } = {}) {
  return tasks.filter((task) => task.type === type && (includeUpcoming || task.bucket !== 'upcoming')).slice(0, limit);
}
