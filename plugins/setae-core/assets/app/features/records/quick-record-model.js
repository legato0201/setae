import { recentAnimalActions } from './recent-records.js';

export function quickRecordRecommendations(careTasks = [], { limit = 5 } = {}) {
  const seenAnimals = new Set();
  return careTasks.filter((task) => task.animal && task.animalId).filter((task) => {
    const key = String(task.animalId);
    if (seenAnimals.has(key)) return false;
    seenAnimals.add(key);
    return true;
  }).slice(0, limit).map((task) => ({
    animal: task.animal,
    type: task.recommendedAction,
    reason: task.reason,
    priority: task.score,
    dueAt: task.dueAt
  }));
}

export function buildQuickRecordModel({ animals = [], recent = [], careTasks = [], now = new Date() } = {}) {
  return {
    recommendations: quickRecordRecommendations(careTasks),
    recent: recentAnimalActions(animals, recent, { now: now.getTime() })
  };
}
