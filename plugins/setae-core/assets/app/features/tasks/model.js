import { createAnimalTasks } from './animal-tasks.js';
import { createEnclosureTasks } from './enclosure-tasks.js';
import { createNurseryTasks } from './nursery-tasks.js';
import { resolveTaskCompletion } from './completion.js';

export function buildTaskModel({ animals = [], enclosures = [], nurseries = [], records = [], actions = [], profile = {}, enclosureProfile = {}, nurseryProfile = {}, summary = {}, now = new Date() } = {}) {
  const tasks = [
    ...createAnimalTasks(animals, profile, { now }),
    ...createEnclosureTasks(enclosures, enclosureProfile, { now }),
    ...createNurseryTasks(nurseries, nurseryProfile, { now })
  ].sort((left, right) => right.score - left.score
    || left.dueAt.localeCompare(right.dueAt)
    || String(left.id).localeCompare(String(right.id)));

  const resolved = resolveTaskCompletion({ tasks, records, actions, now });

  return {
    ...resolved,
    allTasks: tasks,
    streak: Number(summary?.streak || 0),
    bestStreak: Number(summary?.best_streak || 0)
  };
}
