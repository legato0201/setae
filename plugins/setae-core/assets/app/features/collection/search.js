export function clearCollectionSearchInput(root, controller) {
  const input = root.querySelector('[data-role="animal-search"]');
  if (input) input.value = '';
  controller.reset();
  input?.focus({ preventScroll: true });
}

export function createCollectionSearchController(onCommit) {
  let composing = false;
  let lastCommittedValue = null;

  const commit = (value) => {
    const normalized = String(value || '');
    if (normalized === lastCommittedValue) return false;
    lastCommittedValue = normalized;
    onCommit(normalized);
    return true;
  };

  return {
    adopt(value = '') {
      composing = false;
      lastCommittedValue = String(value || '');
    },

    reset(value = '') {
      composing = false;
      lastCommittedValue = null;
      return commit(value);
    },

    compositionStart() {
      composing = true;
    },

    compositionEnd(value) {
      composing = false;
      return commit(value);
    },

    input(value, { isComposing = false } = {}) {
      if (composing || isComposing) return false;
      return commit(value);
    },

    isComposing() {
      return composing;
    }
  };
}
