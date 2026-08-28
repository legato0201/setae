import { animalCode, scientificName } from '../../components/ui.js';
import { createCareTasks } from '../care/tasks.js';

export function createAnimalTasks(animals = [], profile = {}, options = {}) {
  return createCareTasks(animals, profile, options).map((task) => ({
    ...task,
    id: `animal:${task.animalId}:${task.type}`,
    targetType: 'animal',
    targetId: task.animalId,
    target: task.animal,
    intervalDays: task.type === 'feed'
      ? task.rules.feedIntervalDays
      : String(task.animal?.status || '').replaceAll('-', '_') === 'pre_molt'
        ? task.rules.preMoltObservationDays
        : task.rules.observationIntervalDays,
    title: animalCode(task.animal),
    subtitle: scientificName(task.animal),
    action: {
      kind: 'animal-record',
      recordType: task.recommendedAction
    }
  }));
}
