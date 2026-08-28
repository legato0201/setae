/* Test-only APIs and actual lab layout-shift collection. Never loaded in production. */
(() => {
  const query = new URLSearchParams(location.search);
  const copied = [], shares = [], events = [], shifts = [], priorLayoutPhases = [];
  let layoutPhase = 'initial_load';
  let copyMode = query.get('clipboard') || 'success';
  let fallbackMode = true;
  let shareMode = query.get('native') || 'success';
  const collect = (entries) => { for (const entry of entries) if (!entry.hadRecentInput) shifts.push({ value: entry.value, startTime: entry.startTime }); };
  const observer = typeof PerformanceObserver !== 'undefined' && PerformanceObserver.supportedEntryTypes.includes('layout-shift') ? new PerformanceObserver((list) => collect(list.getEntries())) : null;
  if (observer) observer.observe({ type: 'layout-shift', buffered: true });
  function setClipboard(mode) {
    copyMode = mode;
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: mode === 'none' ? undefined : { writeText: async (text) => {
      if (copyMode === 'error') throw new DOMException('Fixture permission denial', 'NotAllowedError');
      copied.push({ text: String(text), method: 'clipboard' });
    } } });
  }
  function setNative(mode) {
    shareMode = mode;
    Object.defineProperty(navigator, 'share', { configurable: true, value: mode === 'none' ? undefined : async (data) => {
      shares.push(data);
      if (shareMode === 'abort') throw new DOMException('Fixture canceled', 'AbortError');
      if (shareMode === 'error') throw new Error('Fixture native error');
    } });
  }
  setClipboard(copyMode); setNative(shareMode);
  document.execCommand = (command) => {
    if (command !== 'copy' || !fallbackMode) return false;
    copied.push({ text: document.activeElement?.value || '', method: 'execCommand' }); return true;
  };
  window.prompt = () => { throw new Error('Forbidden prompt fallback called'); };
  if (query.get('analytics') !== 'none') window.SetaeCore = { track: (name, data) => events.push({ name, data }) };
  window.__setaePublic248 = {
    copied: () => copied.slice(), shares: () => shares.slice(), events: () => events.slice(),
    setClipboard, setNative, setFallback: (success) => { fallbackMode = success; },
    layout: () => { if (observer) collect(observer.takeRecords()); return { supported: !!observer, phase: layoutPhase, value: shifts.reduce((sum, entry) => sum + entry.value, 0), entries: shifts.slice(), priorPhases: priorLayoutPhases.slice() }; },
    beginLayoutPhase: (name) => {
      if (observer) collect(observer.takeRecords());
      priorLayoutPhases.push({ phase: layoutPhase, value: shifts.reduce((sum, entry) => sum + entry.value, 0), entries: shifts.slice() });
      shifts.length = 0; layoutPhase = name;
    }
  };
})();
