const values = (value) => Array.isArray(value) ? value : value === null || value === undefined ? [] : [value];

export function normalizeAnimalSearchValue(value = '') {
  return String(value)
    .normalize('NFKC')
    .trim()
    .toLocaleLowerCase('ja-JP');
}

function searchValues(animal = {}) {
  return [
    animal.id,
    animal.individual_code,
    animal.code,
    animal.title,
    animal.name,
    animal.custom_name,
    animal.species_name,
    animal.scientific_name,
    animal.ja_name,
    animal.common_name_ja,
    animal.species?.scientific_name,
    animal.species?.ja_name,
    animal.status,
    animal.gender,
    animal.instar,
    animal.origin,
    animal.enclosure,
    animal.enclosure_record?.code,
    ...values(animal.tags).flatMap((tag) => typeof tag === 'object' ? [tag.name, tag.label, tag.value] : [tag]),
    animal.note,
    animal.notes,
    animal.memo
  ];
}

export function createAnimalSearchIndex(animals = []) {
  const source = Array.isArray(animals) ? animals : [];
  return {
    source,
    entries: source.map((animal) => ({
      id: String(animal?.id ?? ''),
      animal,
      text: normalizeAnimalSearchValue(searchValues(animal).filter((value) => value !== '').join(' '))
    }))
  };
}

export function searchAnimalIndex(index, query = '') {
  const normalized = normalizeAnimalSearchValue(query);
  if (!normalized) return index?.source || [];
  const tokens = normalized.split(/\s+/).filter(Boolean);
  return (index?.entries || [])
    .filter((entry) => tokens.every((token) => entry.text.includes(token)))
    .map((entry) => entry.animal);
}

export function searchAnimalIds(index, query = '') {
  return new Set(searchAnimalIndex(index, query).map((animal) => String(animal?.id ?? '')));
}
