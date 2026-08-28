const sessionKey = 'setae.product.session';
const cookieKey = 'setae_product_anonymous_id';
const validId = (value) => /^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(String(value || ''));
let memoryAnonymous = '';
let memorySession = null;
export const productEventsDisabled = () => globalThis.navigator?.doNotTrack === '1' || globalThis.navigator?.globalPrivacyControl === true;
export function newProductEventId() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  if (!globalThis.crypto?.getRandomValues) return '';
  const bytes = globalThis.crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 15) | 64; bytes[8] = (bytes[8] & 63) | 128;
  const hex = [...bytes].map((value) => value.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export function productEventContext({ doc = globalThis.document, storage, now = Date.now() } = {}) {
  if (productEventsDisabled()) return null;
  if (!storage) { try { storage = globalThis.sessionStorage; } catch { /* Use memory when storage is denied. */ } }
  const writeCookie = (name, value, seconds) => {
    try { if (doc) doc.cookie = `${name}=${value}; Path=/; Max-Age=${seconds}; SameSite=Lax${globalThis.location?.protocol === 'https:' ? '; Secure' : ''}`; } catch { /* Optional identifiers. */ }
  };
  let anonymousId = memoryAnonymous;
  try {
    const stored = doc?.cookie?.split(';').map((part) => part.trim()).find((part) => part.startsWith(`${cookieKey}=`))?.slice(cookieKey.length + 1) || '';
    if (validId(stored)) anonymousId = stored;
  } catch { /* Optional identifiers. */ }
  if (!validId(anonymousId)) {
    anonymousId = newProductEventId();
  }
  if (!anonymousId) return null;
  memoryAnonymous = anonymousId;
  writeCookie(cookieKey, anonymousId, 90 * 86400);
  let session = memorySession;
  try { session = JSON.parse(storage?.getItem(sessionKey) || 'null') || session; } catch { /* Keep the memory session. */ }
  const day = new Date(now).toISOString().slice(0, 10);
  if (!validId(session?.id) || session.day !== day || !Number.isFinite(session.last_seen)
    || session.last_seen > now + 60000 || now - session.last_seen > 30 * 60 * 1000) {
    session = { id: newProductEventId(), started_at: now, day };
  }
  session.last_seen = now;
  memorySession = session;
  try { storage?.setItem(sessionKey, JSON.stringify(session)); } catch { /* Memory context still works. */ }
  writeCookie('setae_product_session_id', session.id, 30 * 60);
  return { event_id: newProductEventId(), anonymous_id: anonymousId, session_id: session.id };
}

export function createAppSessionTracker(services, getUserId) {
  const sent = new Set();
  const pending = new Set();
  const track = async () => {
    const userId = getUserId();
    if (!userId || globalThis.document?.visibilityState === 'hidden') return;
    const context = productEventContext();
    if (!context) return;
    const key = `${userId}:${context.session_id}`;
    if (sent.has(key) || pending.has(key)) return;
    pending.add(key);
    try { await services.app.metric('app_session_started', location.pathname, {}, context); sent.add(key); }
    catch { /* Telemetry never prevents use; a later focus retries. */ }
    finally { pending.delete(key); }
  };
  globalThis.document?.addEventListener('visibilitychange', track);
  globalThis.addEventListener?.('focus', track);
  return track;
}
