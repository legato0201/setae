import { productEventContext, newProductEventId } from '../features/analytics/client-context.js';

const asArray = (value) => {
  if (Array.isArray(value)) return value;
  if (Array.isArray(value?.items)) return value.items;
  if (Array.isArray(value?.spiders)) return value.spiders;
  if (Array.isArray(value?.events)) return value.events;
  if (Array.isArray(value?.data)) return value.data;
  return [];
};

const query = (values = {}) => {
  const params = new URLSearchParams();
  Object.entries(values).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') return;
    if (Array.isArray(value)) value.forEach((item) => params.append(key, String(item)));
    else params.set(key, String(value));
  });
  const text = params.toString();
  return text ? `?${text}` : '';
};

export class AppService {
  constructor(api) { this.api = api; }

  async bootstrap() {
    let data;
    try {
      data = await this.api.get('/app/bootstrap');
    } catch (error) {
      if (error?.code !== 'rest_cookie_invalid_nonce') throw error;

      // A persisted nonce can outlive the WordPress session or the local proxy.
      this.api.clearSession();
      data = await this.api.get('/app/bootstrap');
    }
    const apiRoot = data?.links?.api_root || data?.links?.api || null;
    if (apiRoot && this.api.followBootstrapApiRoot) this.api.setApiRoot(apiRoot);
    if (data?.nonce) this.api.setNonce(data.nonce);
    else if (data?.authenticated === false) this.api.clearSession();
    return data;
  }

  operations() { return this.api.get('/operations'); }
  metric(event, path = '', payload = {}, context = productEventContext()) {
    if (!context) return Promise.resolve({ accepted: false, disabled: true });
    return this.api.post('/metrics/events', { event, path, payload, ...context });
  }
}

export class SessionService {
  constructor(api) { this.api = api; }

  async get({ signal } = {}) {
    const data = await this.api.get('/session', { signal });
    if (data?.nonce) this.api.setNonce(data.nonce);
    return data;
  }

  async login({ login, password, remember = true }) {
    const data = await this.api.post('/session', { login, password, remember });
    if (data?.nonce) this.api.setNonce(data.nonce);
    return data;
  }

  async logout() {
    const data = await this.api.delete('/session');
    this.api.clearSession();
    return data;
  }
}

export class AccountService {
  constructor(api) { this.api = api; }
  register(payload) { return this.api.post('/registration', payload); }
  passwordReset(login) { return this.api.post('/password-reset', { login }); }
  verifyEmail(userId, token) {
    return this.api.post('/email-verification', { user_id: Number(userId), token });
  }
  get() { return this.api.get('/me'); }
  uiPreferences() { return this.api.get('/ui/preferences'); }
  saveUiPreferences(payload) { return this.api.post('/ui/preferences', payload); }
  async update(payload) {
    const data = await this.api.post('/me', payload);
    if (data?.nonce) this.api.setNonce(data.nonce);
    return data;
  }
}

export class AnimalService {
  constructor(api) { this.api = api; }

  async list({ scope = 'active', sort = 'priority', paged = 1, perPage = 100, signal } = {}) {
    const raw = await this.api.get(`/my-spiders${query({ scope, sort, paged, per_page: perPage })}`, { signal });
    return { raw, items: asArray(raw) };
  }

  async listAll({ scope = 'active', sort = 'priority', perPage = 100, maxPages = 100, signal } = {}) {
    const byId = new Map();
    let lastRaw = null;
    let pages = 0;
    for (let paged = 1; paged <= maxPages; paged += 1) {
      const result = await this.list({ scope, sort, paged, perPage, signal });
      lastRaw = result.raw;
      pages = paged;
      result.items.forEach((animal, index) => {
        const key = animal?.id ?? animal?.ID ?? `${paged}:${index}`;
        if (!byId.has(String(key))) byId.set(String(key), animal);
      });
      const totalPages = Number(result.raw?.total_pages || result.raw?.totalPages || 0);
      if ((totalPages && paged >= totalPages) || result.items.length < perPage) break;
    }
    return { raw: lastRaw, items: [...byId.values()], pages };
  }

  get(id, { signal } = {}) {
    return this.api.get(`/spider/${encodeURIComponent(id)}`, { signal });
  }

  create(payload) { return this.api.post('/spiders', payload); }
  update(id, payload) { return this.api.post(`/spiders/${encodeURIComponent(id)}`, payload); }
  remove(id) { return this.api.delete(`/spiders/${encodeURIComponent(id)}`); }
  favorite(id, favorite) {
    return this.api.post(`/spiders/${encodeURIComponent(id)}/favorite`, { favorite });
  }
}

export class EnclosureService {
  constructor(api) { this.api = api; }

  list({ status = 'active', signal } = {}) {
    return this.api.get(`/enclosures${query({ status })}`, { signal });
  }

  get(id, { signal } = {}) {
    return this.api.get(`/enclosures/${encodeURIComponent(id)}`, { signal });
  }

  create(payload) { return this.api.post('/enclosures', payload); }
  update(id, payload) { return this.api.post(`/enclosures/${encodeURIComponent(id)}`, payload); }
  remove(id) { return this.api.delete(`/enclosures/${encodeURIComponent(id)}`); }
  record(id, payload) { return this.api.post(`/enclosures/${encodeURIComponent(id)}/events`, payload); }
  assign(id, payload) { return this.api.post(`/enclosures/${encodeURIComponent(id)}/occupancies`, payload); }
  endOccupancy(id, animalId, payload = {}) {
    return this.api.delete(
      `/enclosures/${encodeURIComponent(id)}/occupancies/${encodeURIComponent(animalId)}`,
      payload
    );
  }
}

export class CareService {
  constructor(api) { this.api = api; }

  summary({ signal } = {}) { return this.api.get('/care-summary', { signal }); }

  listRecent({ offset = 0, limit = 50, type = '', signal } = {}) {
    return this.api.get(`/care-events${query({ offset, limit, type })}`, { signal });
  }

  listJournal({ offset = 0, limit = 50, type = '', signal } = {}) {
    return this.api.get(`/journal-events${query({ offset, limit, type })}`, { signal });
  }

  listEvents(id, { offset = 0, perPage = 30, signal } = {}) {
    return this.api.get(`/spider/${encodeURIComponent(id)}/events${query({ offset, per_page: perPage })}`, { signal });
  }

  create(id, payload) { return this.api.post(`/spider/${encodeURIComponent(id)}/events`, payload); }
  update(logId, payload) { return this.api.post(`/logs/${encodeURIComponent(logId)}`, payload); }
  remove(logId) { return this.api.delete(`/logs/${encodeURIComponent(logId)}`); }
  share(logId, shared = true) {
    return this.api.post(`/logs/${encodeURIComponent(logId)}/share`, { shared });
  }

  feedList({ page = 1, perPage = 20, classification = '', sort = 'active', scope = 'all', signal } = {}) {
    return this.api.get(`/care-feed${query({ page, per_page: perPage, classification, sort, scope })}`, { signal });
  }
  feedDetail(id, { page = 1, focusComment = '', signal } = {}) {
    return this.api.get(`/care-feed/${encodeURIComponent(id)}${query({ page, focus_comment: focusComment })}`, { signal });
  }
  unshareFeed(id) { return this.api.delete(`/care-feed/${encodeURIComponent(id)}`); }
  reportFeed(id, reason) { return this.api.post(`/care-feed/${encodeURIComponent(id)}/report`, { reason }); }
  reactFeed(id, reaction) { return this.api.post(`/care-feed/${encodeURIComponent(id)}/reaction`, { reaction }); }
  commentFeed(id, content, parentId = 0) {
    return this.api.post(`/care-feed/${encodeURIComponent(id)}/comments`, { content, parent_id: parentId });
  }
  removeFeedComment(id) { return this.api.delete(`/care-feed/comments/${encodeURIComponent(id)}`); }
  reportFeedComment(id, reason) {
    return this.api.post(`/care-feed/comments/${encodeURIComponent(id)}/report`, { reason });
  }
  feedUnread() { return this.api.get('/care-feed/unread'); }
  markFeedRead() { return this.api.post('/care-feed/mark-read', {}); }
}

export class TaskService {
  constructor(api) { this.api = api; }
  list({ since = '', signal } = {}) { return this.api.get(`/task-actions${query({ since })}`, { signal }); }
  save(payload) { return this.api.post('/task-actions', payload); }
  saveMany(items) { return this.api.post('/task-actions/batch', { items }); }
}

export class BabyService {
  constructor(api) { this.api = api; }
  list({ signal } = {}) { return this.api.get('/baby-groups', { signal }); }
  get(id, { signal } = {}) { return this.api.get(`/baby-groups/${encodeURIComponent(id)}`, { signal }); }
  create(payload) { return this.api.post('/baby-groups', payload); }
  update(id, payload) { return this.api.post(`/baby-groups/${encodeURIComponent(id)}`, payload); }
  remove(id) { return this.api.delete(`/baby-groups/${encodeURIComponent(id)}`); }
  bulk(id, payload) { return this.api.post(`/baby-groups/${encodeURIComponent(id)}/bulk`, payload); }
  promote(id, codes) { return this.api.post(`/baby-groups/${encodeURIComponent(id)}/promote`, { codes }); }
  events(id, { signal } = {}) { return this.api.get(`/baby-groups/${encodeURIComponent(id)}/events`, { signal }); }
  record(id, payload) { return this.api.post(`/baby-groups/${encodeURIComponent(id)}/events`, payload); }
}

export class FeederService {
  constructor(api) { this.api = api; }
  dashboard({ signal } = {}) { return this.api.get('/feeders', { signal }); }
  action(payload) { return this.api.post('/feeders/actions', payload); }
  createEgg(payload) { return this.api.post('/feeders/eggs', payload); }
  updateEgg(id, payload) { return this.api.post(`/feeders/eggs/${encodeURIComponent(id)}`, payload); }
}

export class QrService {
  constructor(api) { this.api = api; }
  targets({ source = 'spider', ids = [], groupId = '', codes = [], purpose = '', operationId = '', signal } = {}) {
    const values = source === 'baby'
      ? { source, group_id: groupId, 'codes[]': codes }
      : { source, 'ids[]': ids };
    if (purpose) { values.purpose = purpose; values.operation_id = operationId || newProductEventId(); }
    return this.api.get(`/qr/targets${query(values)}`, { signal });
  }
  resolve(code) { return this.api.post('/qr/resolve', { code }); }
  passport(code) { return this.api.get(`/qr/passport/${encodeURIComponent(code)}`); }
  records(payload) { return this.api.post('/qr/records', payload); }
  settings(id, payload) { return this.api.post(`/qr/spiders/${encodeURIComponent(id)}/settings`, payload); }
  transfers() { return this.api.get('/qr/transfers'); }
  respondTransfer(id, action) { return this.api.post(`/qr/transfers/${encodeURIComponent(id)}`, { action }); }
  markNotificationsRead() { return this.api.post('/qr/notifications/read', {}); }
}

export class TopicService {
  constructor(api) { this.api = api; }
  list({ type = '', page = 1, perPage = 20, search = '', sort = 'updated', scope = 'all', speciesId = '', signal } = {}) {
    return this.api.get(`/topics${query({ type, page, per_page: perPage, s: search, sort, scope, species_id: speciesId })}`, { signal });
  }
  get(id, { page = 1, signal } = {}) { return this.api.get(`/topics/${encodeURIComponent(id)}${query({ page })}`, { signal }); }
  create(payload) { return this.api.post('/topics', payload); }
  comment(id, payload) { return this.api.post(`/topics/${encodeURIComponent(id)}/comments`, payload); }
  react(id, reaction) { return this.api.post(`/topics/${encodeURIComponent(id)}/reactions`, { reaction }); }
  reactComment(id, reaction) { return this.api.post(`/topics/comments/${encodeURIComponent(id)}/reactions`, { reaction }); }
  status(id, status) { return this.api.post(`/topics/${encodeURIComponent(id)}/status`, { status }); }
  bestAnswer(id, commentId) { return this.api.post(`/topics/${encodeURIComponent(id)}/best-answer`, { comment_id: commentId }); }
  unread() { return this.api.get('/topics/unread'); }
  markRead(id) { return this.api.post(`/topics/${encodeURIComponent(id)}/mark-read`, {}); }
  markAllRead() { return this.api.post('/topics/mark-read', {}); }
  speciesPulse(limit = 8) { return this.api.get(`/topics/species-pulse${query({ limit })}`); }
}

export class SpeciesService {
  constructor(api) { this.api = api; }
  suggestions(q, { limit = 8, signal } = {}) {
    return this.api.get(`/species/suggest${query({ q, limit })}`, { signal });
  }
  list({ search = '', page = 1, perPage = 20, offset = '', orderby = 'title', order = 'asc', genus = '', signal } = {}) {
    return this.api.get(`/species${query({ search, page, per_page: perPage, offset, orderby, order, genus })}`, { signal });
  }
  get(id, { signal } = {}) { return this.api.get(`/species/${encodeURIComponent(id)}`, { signal }); }
  stats(id) { return this.api.get(`/species/${encodeURIComponent(id)}/stats`); }
  suggest(id, payload) { return this.api.post(`/species/${encodeURIComponent(id)}/suggestions`, payload); }
  ads(id) { return this.api.get(`/ads/species/${encodeURIComponent(id)}`); }
}

export class SocialService {
  constructor(api) { this.api = api; }
  relationships() { return this.api.get('/social/relationships'); }
  follow(id) { return this.api.post(`/social/users/${encodeURIComponent(id)}/follow`, {}); }
  unfollow(id) { return this.api.delete(`/social/users/${encodeURIComponent(id)}/follow`); }
  block(id) { return this.api.post(`/social/users/${encodeURIComponent(id)}/block`, {}); }
  unblock(id) { return this.api.delete(`/social/users/${encodeURIComponent(id)}/block`); }
}

export class BreedingBoardService {
  constructor(api) { this.api = api; }
  listings() { return this.api.get('/bl-candidates'); }
}

export class NotificationService {
  constructor(api) { this.api = api; }
  config() { return this.api.get('/pwa/config'); }
  preferences() { return this.api.get('/pwa/preferences'); }
  savePreferences(payload) { return this.api.post('/pwa/preferences', payload); }
  subscribe(payload) { return this.api.post('/pwa/subscriptions', payload); }
  unsubscribe(endpoint) { return this.api.delete('/pwa/subscriptions', { endpoint }); }
  test() { return this.api.post('/pwa/test', {}); }
}

export class OfflineService {
  constructor(api) { this.api = api; }
  sync(operations) { return this.api.post('/offline/sync', { operations }); }
}

export class IntegrationService {
  constructor(api) { this.api = api; }
  externalStatus() { return this.api.get('/external-access'); }
  createExternalToken(mode = 'read_write') { return this.api.post('/external-access/token', { mode }); }
  disableExternal() { return this.api.post('/external-access/disable', {}); }
  liveStatus() { return this.api.get('/live/access'); }
  createLiveSession(mode = 'read_write', duration = 86400) {
    return this.api.post('/live/access/session', { mode, duration });
  }
  disableLive() { return this.api.post('/live/access/disable', {}); }
  chatgptStatus() { return this.api.get('/chatgpt/access'); }
  disableChatgpt() { return this.api.post('/chatgpt/access/disable', {}); }
  checkout() { return this.api.post('/stripe/create-checkout-session', { plan: 'breeder_starter' }); }
  startTrial() { return this.api.post('/plans/trial', {}); }
  portal() { return this.api.post('/stripe/create-portal-session', {}); }
}

export { asArray, query };
