const idOf = (value) => value === null || value === undefined || value === '' ? null : String(value);

export function createCollectionSelection(value = {}) {
  return {
    selectedId: idOf(value.selectedId),
    selectedIds: [...new Set((value.selectedIds || []).map(idOf).filter(Boolean))],
    selectionMode: Boolean(value.selectionMode)
  };
}

export function selectCollectionAnimal(selection, id) {
  return {
    ...createCollectionSelection(selection),
    selectedId: idOf(id)
  };
}

export function toggleCollectionAnimal(selection, id) {
  const current = createCollectionSelection(selection);
  const normalized = idOf(id);
  if (!normalized) return current;
  const selectedIds = current.selectedIds.includes(normalized)
    ? current.selectedIds.filter((item) => item !== normalized)
    : [...current.selectedIds, normalized];
  return { ...current, selectedId: normalized, selectedIds };
}

export function setCollectionSelectedIds(selection, ids) {
  const current = createCollectionSelection(selection);
  const selectedIds = [...new Set((ids || []).map(idOf).filter(Boolean))];
  return {
    ...current,
    selectedId: selectedIds.at(-1) || current.selectedId,
    selectedIds
  };
}

export function setCollectionSelectionMode(selection, enabled) {
  const current = createCollectionSelection(selection);
  return {
    ...current,
    selectionMode: Boolean(enabled),
    selectedIds: enabled ? current.selectedIds : []
  };
}

export function clearCollectionSelection(selection, { keepMode = false } = {}) {
  const current = createCollectionSelection(selection);
  return {
    ...current,
    selectedIds: [],
    selectionMode: keepMode ? current.selectionMode : false
  };
}

export function reconcileCollectionSelection(selection, animals = []) {
  const current = createCollectionSelection(selection);
  const available = new Set(animals.map((animal) => idOf(animal?.id)).filter(Boolean));
  return {
    ...current,
    selectedId: available.has(current.selectedId) ? current.selectedId : null,
    selectedIds: current.selectedIds.filter((id) => available.has(id))
  };
}

