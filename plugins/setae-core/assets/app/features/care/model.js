import { careDateKey, createCareTasks } from './tasks.js';

const recordAnimalId = (item) => item?.animal?.id ?? item?.animal_id ?? item?.spider_id ?? item?.event?.animal_id ?? item?.event?.spider_id;

export function buildCareModel({ animals = [], records = [], profile = {}, summary = {}, now = new Date() } = {}) {
  const tasks = createCareTasks(animals, profile, { now });
  const today = careDateKey(now);
  const completedKeys = new Set();
  const completed = [];

  records.forEach((item) => {
    const event = item?.event || item;
    const type = event?.type;
    const animalId = recordAnimalId(item);
    if (!animalId || !event?.date || !['feed', 'observation'].includes(type) || careDateKey(event.date) !== today) return;
    const key = `${animalId}:${type}`;
    if (completedKeys.has(key)) return;
    completedKeys.add(key);
    completed.push({ id: key, animalId, type, event, animal: item?.animal || animals.find((animal) => String(animal.id) === String(animalId)) });
  });

  const overdue = tasks.filter((task) => task.bucket === 'overdue');
  const dueToday = tasks.filter((task) => task.bucket === 'today');
  const upcoming = tasks.filter((task) => task.bucket === 'upcoming');
  const required = overdue.length + dueToday.length + completed.length;

  return {
    tasks,
    overdue,
    today: dueToday,
    upcoming,
    completed,
    progress: {
      completed: completed.length,
      required,
      percent: required ? Math.round((completed.length / required) * 100) : 100
    },
    streak: Number(summary?.streak || 0),
    bestStreak: Number(summary?.best_streak || 0)
  };
}
