/* Test-only deterministic network/browser fakes. Production assets are unmodified. */
(() => {
  const copied = [];
  const shares = [];
  const requests = [];
  let registrationMode = 'success';
  let completePending = null;
  const originalFetch = window.fetch.bind(window);
  Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async (text) => { copied.push(String(text)); } } });
  function setNativeShare(mode) {
    Object.defineProperty(navigator, 'share', { configurable: true, value: mode === 'none' ? undefined : async (payload) => {
      shares.push(payload);
      if (mode === 'abort') throw new DOMException('Dismissed', 'AbortError');
      if (mode === 'error') throw new Error('Fixture native share error');
    } });
  }
  setNativeShare('none');
  window.fetch = async (input, init = {}) => {
    const url = String(input);
    if (!url.includes('admin-ajax.php')) return originalFetch(input, init);
    const payload = Object.fromEntries(new URLSearchParams(init.body || ''));
    if (payload.action !== 'setae_register_user') return new Response(JSON.stringify({ success: true }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    requests.push({ ...payload });
    const response = (success) => new Response(JSON.stringify(success ? { success: true, data: { message: '仮登録が完了しました。' } } : { success: false, data: 'このメールアドレスは使用できません' }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    if (registrationMode === 'pending') return new Promise((resolve) => { completePending = (success) => resolve(response(success)); });
    if (registrationMode === 'network-error') throw new TypeError('Fixture network error');
    return response(registrationMode !== 'error');
  };
  window.__setaePublic247 = {
    copied: () => copied.slice(), shares: () => shares.slice(), requests: () => requests.slice(),
    setNativeShare, setRegistrationMode: (mode) => { registrationMode = mode; },
    completePending: (success = true) => { if (completePending) completePending(success); }
  };
  document.addEventListener('DOMContentLoaded', () => { document.body.dataset.fixtureReady = 'true'; });
})();
