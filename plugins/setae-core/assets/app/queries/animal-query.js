const DAY_MS = 86400000;

const dateOnly = (value) => {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  date.setHours(0, 0, 0, 0);
  return date;
};

export function daysSince(value, now = new Date()) {
  const date = dateOnly(value);
  const today = dateOnly(now);
  if (!date || !today) return null;
  return Math.floor((today.getTime() - date.getTime()) / DAY_MS);
}

export function animalFieldValue(animal, field, now = new Date()) {
  const values = {
    id: animal?.id,
    code: animal?.individual_code ?? animal?.code ?? animal?.name ?? animal?.title,
    species_id: animal?.species_id ?? animal?.species?.id,
    species_name: animal?.species_name ?? animal?.species?.scientific_name ?? animal?.custom_species,
    classification: animal?.classification ?? animal?.species?.classification,
    status: String(animal?.status || 'unknown').toLowerCase().replaceAll('-', '_'),
    gender: String(animal?.gender || 'unknown').toLowerCase(),
    instar: Number(animal?.instar),
    is_favorite: Boolean(animal?.is_favorite ?? animal?.favorite),
    days_since_feed: daysSince(animal?.last_feed ?? animal?.last_feed_date, now),
    days_since_molt: daysSince(animal?.last_molt ?? animal?.last_molt_date, now),
    acquired_date: animal?.acquired_date ?? null
  };
  return values[field] ?? animal?.[field] ?? null;
}

const comparable = (value) => typeof value === 'string' ? value.toLowerCase() : value;

export function matchesAnimalFilter(animal, filter, now = new Date()) {
  if (!filter?.field) return true;
  const actual = comparable(animalFieldValue(animal, filter.field, now));
  const expected = comparable(filter.value);

  switch (filter.operator || '=') {
    case '=': return actual === expected;
    case '!=': return actual !== expected;
    case '>': return actual !== null && Number(actual) > Number(expected);
    case '>=': return actual !== null && Number(actual) >= Number(expected);
    case '<': return actual !== null && Number(actual) < Number(expected);
    case '<=': return actual !== null && Number(actual) <= Number(expected);
    case 'contains': return String(actual ?? '').includes(String(expected ?? ''));
    case 'not_contains': return !String(actual ?? '').includes(String(expected ?? ''));
    case 'in': return Array.isArray(filter.value) && filter.value.map(comparable).includes(actual);
    case 'exists': return filter.value === false ? actual === null || actual === '' : actual !== null && actual !== '';
    default: return true;
  }
}

export function queryAnimals(animals = [], query = {}, options = {}) {
  const now = options.now || new Date();
  const filters = Array.isArray(query?.filters) ? query.filters : [];
  const filtered = animals.filter((animal) => filters.every((filter) => matchesAnimalFilter(animal, filter, now)));
  const field = query?.sort?.field;

  if (field) {
    const direction = query.sort.direction === 'desc' ? -1 : 1;
    filtered.sort((left, right) => {
      const a = animalFieldValue(left, field, now);
      const b = animalFieldValue(right, field, now);
      if (a === null || a === undefined || a === '') return 1;
      if (b === null || b === undefined || b === '') return -1;
      return String(a).localeCompare(String(b), 'ja', { numeric: true, sensitivity: 'base' }) * direction;
    });
  }

  const limit = Number(query?.limit || 0);
  return limit > 0 ? filtered.slice(0, limit) : filtered;
}

export function animalQueryFromSettings(settings = {}) {
  const filters = [];
  if (settings.status) filters.push({ field: 'status', operator: '=', value: settings.status });
  if (settings.excludePreMolt) filters.push({ field: 'status', operator: '!=', value: 'pre_molt' });
  if (settings.feedDays !== '' && settings.feedDays !== null && settings.feedDays !== undefined) {
    filters.push({ field: 'days_since_feed', operator: '>=', value: Number(settings.feedDays) });
  }
  if (settings.favorite) filters.push({ field: 'is_favorite', operator: '=', value: true });
  if (settings.species) filters.push({ field: 'species_name', operator: 'contains', value: settings.species });
  if (settings.classification) filters.push({ field: 'classification', operator: '=', value: settings.classification });

  return {
    filters,
    sort: {
      field: settings.sortField || 'code',
      direction: settings.sortDirection === 'desc' ? 'desc' : 'asc'
    },
    limit: Number(settings.limit || 0)
  };
}
