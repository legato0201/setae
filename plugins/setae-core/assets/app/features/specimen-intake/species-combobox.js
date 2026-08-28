export function normalizeSpeciesSuggestion(item = {}) {
  return {
    id: Number(item.id || 0),
    ja_name: String(item.ja_name || item.common_name_ja || '').trim(),
    scientific_name: String(item.scientific_name || item.title || '').trim(),
    genus: String(item.genus || '').trim()
  };
}

export function createSpeciesComboboxController({
  search,
  update = () => {},
  onSelect = () => {},
  debounceMs = 180,
  schedule = globalThis.setTimeout,
  cancelSchedule = globalThis.clearTimeout,
  createAbortController = () => new AbortController()
} = {}) {
  let composing = false;
  let timer = null;
  let request = null;
  let requestId = 0;
  let query = '';
  let items = [];
  let activeIndex = -1;
  let open = false;
  let loading = false;
  let error = '';

  const snapshot = () => ({ query, items: [...items], activeIndex, open, loading, error });
  const emit = () => update(snapshot());

  function abortPending() {
    if (timer !== null) cancelSchedule(timer);
    timer = null;
    if (request) request.abort();
    request = null;
    requestId += 1;
  }

  function clear({ notify = true } = {}) {
    abortPending();
    query = '';
    items = [];
    activeIndex = -1;
    open = false;
    loading = false;
    error = '';
    if (notify) emit();
  }

  async function run(nextQuery, id) {
    request = createAbortController();
    try {
      const response = await search(nextQuery, { signal: request.signal, limit: 8 });
      if (id !== requestId || request.signal.aborted) return;
      const values = Array.isArray(response) ? response : response?.items || [];
      items = values.map(normalizeSpeciesSuggestion).filter((item) => item.id && item.scientific_name);
      activeIndex = items.length ? 0 : -1;
      loading = false;
      error = '';
      open = true;
      emit();
    } catch (reason) {
      if (id !== requestId || request?.signal.aborted || reason?.name === 'AbortError') return;
      items = [];
      activeIndex = -1;
      loading = false;
      open = true;
      error = reason?.message || '候補を取得できませんでした。';
      emit();
    } finally {
      if (id === requestId) request = null;
    }
  }

  function input(value, { isComposing = false } = {}) {
    query = String(value || '').trim();
    if (composing || isComposing) return false;
    abortPending();
    items = [];
    activeIndex = -1;
    error = '';
    if (!query) {
      open = false;
      loading = false;
      emit();
      return true;
    }
    open = true;
    loading = true;
    emit();
    const id = requestId;
    timer = schedule(() => {
      timer = null;
      run(query, id);
    }, Math.max(0, Number(debounceMs) || 0));
    return true;
  }

  function compositionStart() {
    composing = true;
    abortPending();
    loading = false;
    open = false;
    activeIndex = -1;
    emit();
  }

  function compositionEnd(value) {
    composing = false;
    input(value);
  }

  function select(index = activeIndex) {
    const item = items[Number(index)];
    if (!item) return false;
    abortPending();
    open = false;
    loading = false;
    onSelect(item);
    return true;
  }

  function keydown(key) {
    if (key === 'Escape' && open) {
      open = false;
      activeIndex = -1;
      emit();
      return true;
    }
    if (key === 'Tab') {
      if (open) {
        open = false;
        emit();
      }
      return false;
    }
    if (!open || !items.length) return false;
    if (key === 'ArrowDown') {
      activeIndex = (activeIndex + 1) % items.length;
      emit();
      return true;
    }
    if (key === 'ArrowUp') {
      activeIndex = activeIndex <= 0 ? items.length - 1 : activeIndex - 1;
      emit();
      return true;
    }
    if (key === 'Enter') return select();
    return false;
  }

  return {
    clear,
    compositionStart,
    compositionEnd,
    getSnapshot: snapshot,
    input,
    keydown,
    select,
    destroy: abortPending
  };
}
