export function collectionItemIntent({
  collectionItem = false,
  selectionMode = false,
  wide = false,
  activation = 'primary'
} = {}) {
  if (!collectionItem) return 'open-detail';
  if (selectionMode) return 'toggle-selection';
  if (!wide) return 'open-detail';
  return activation === 'explicit' || activation === 'double'
    ? 'open-detail'
    : 'select-inspector';
}

export function isAnimalNavigationId(value) {
  return /^[1-9]\d*$/.test(String(value ?? ''));
}

export function resolveAnimalNavigationTarget(target) {
  if (!target?.closest || target.closest('[data-action]')) return null;
  // Forms also carry data-animal-id as submission context. Neither their
  // controls nor a dialog's content is a background animal navigation target.
  if (target.closest('form, .modal, .sheet, [data-modal], [data-sheet], [data-overlay-backdrop], [role="dialog"], [inert], input, select, textarea, label, [contenteditable]:not([contenteditable="false"])')) return null;
  const animal = target.closest('[data-collection-animal][data-animal-id], .animal-card[data-animal-id], .widget-animal-row[data-animal-id], button[data-animal-id], a[data-animal-id], [role="button"][data-animal-id]');
  if (!animal || !isAnimalNavigationId(animal.dataset.animalId) || animal.matches('[disabled], [aria-disabled="true"]')) return null;
  const control = target.closest('button, a, summary, [role="button"]');
  return control && control !== animal ? null : animal;
}
