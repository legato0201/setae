export class SetaeApiError extends Error {
  constructor(message, status = 0, code = 'unknown_error', data = null) {
    super(message);
    this.name = 'SetaeApiError';
    this.status = status;
    this.code = code;
    this.data = data;
  }
}

const NONCE_STORAGE_KEY = 'setae.gui.v2.wpRestNonce';

function readStoredNonce() {
  try { return window.localStorage?.getItem(NONCE_STORAGE_KEY) || null; }
  catch { return null; }
}

function storeNonce(nonce) {
  try {
    if (nonce) window.localStorage?.setItem(NONCE_STORAGE_KEY, nonce);
    else window.localStorage?.removeItem(NONCE_STORAGE_KEY);
  } catch {
    // Storage can be unavailable in private browsing; memory storage still works.
  }
}

export class SetaeApiClient {
  constructor(options = {}) {
    const config = window.SETAE_CONFIG || {};
    this.apiRoot = options.apiRoot || config.apiRoot || window.SETAE_API_ROOT || '/wp-json/setae/v1';
    this.followBootstrapApiRoot = options.followBootstrapApiRoot ?? config.followBootstrapApiRoot ?? true;
    this.credentials = options.credentials || config.credentials || 'same-origin';
    this.nonce = readStoredNonce();
    this.apiRoot = String(this.apiRoot).replace(/\/$/, '');
  }

  setApiRoot(root) {
    if (root) this.apiRoot = String(root).replace(/\/$/, '');
  }

  setNonce(nonce) {
    this.nonce = nonce || null;
    storeNonce(this.nonce);
  }

  clearSession() {
    this.nonce = null;
    storeNonce(null);
  }

  async request(path, options = {}) {
    const method = String(options.method || 'GET').toUpperCase();
    const headers = new Headers(options.headers || {});
    const init = {
      method,
      credentials: this.credentials,
      signal: options.signal,
      headers
    };

    headers.set('Accept', 'application/json');

    // WordPress cookie authentication requires the REST nonce on reads too.
    if (this.nonce) {
      headers.set('X-WP-Nonce', this.nonce);
    }

    if (options.body !== undefined) {
      if (options.body instanceof FormData) {
        init.body = options.body;
      } else {
        headers.set('Content-Type', 'application/json');
        init.body = JSON.stringify(options.body);
      }
    }

    let response;
    try {
      response = await fetch(`${this.apiRoot}${path}`, init);
    } catch (error) {
      if (error?.name === 'AbortError') throw error;
      throw new SetaeApiError(
        'SETAEに接続できませんでした。通信環境をご確認のうえ、もう一度お試しください。',
        0,
        'network_error',
        { cause: error?.message || String(error) }
      );
    }
    let payload = null;
    const text = await response.text();
    if (text) {
      try { payload = JSON.parse(text); }
      catch { payload = text; }
    }

    if (!response.ok) {
      const message = payload?.message || payload?.error || `HTTP ${response.status}`;
      const code = payload?.code || 'http_error';
      throw new SetaeApiError(message, response.status, code, payload?.data ?? null);
    }

    return payload;
  }

  get(path, options = {}) {
    return this.request(path, { ...options, method: 'GET' });
  }

  post(path, body, options = {}) {
    return this.request(path, { ...options, method: 'POST', body });
  }

  delete(path, body, options = {}) {
    return this.request(path, { ...options, method: 'DELETE', body });
  }
}
