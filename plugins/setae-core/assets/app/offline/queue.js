export const OFFLINE_QUEUE_STORAGE_PREFIX = 'setae.gui.v2.offlineQueue';
export const OFFLINE_QUEUE_LEGACY_KEY = OFFLINE_QUEUE_STORAGE_PREFIX;
const DEVICE_KEY = 'setae.gui.v2.deviceId';

const normalizeOwnerId = (value) => {
  const ownerId = Number(value || 0);
  return Number.isInteger(ownerId) && ownerId > 0 ? ownerId : null;
};

export function createOfflineQueue({
  storage = globalThis.localStorage,
  cryptoApi = globalThis.crypto,
  now = () => Date.now()
} = {}) {
  let activeOwnerId = null;

  const storageKey = (ownerId = activeOwnerId) => ownerId
    ? `${OFFLINE_QUEUE_STORAGE_PREFIX}.${ownerId}`
    : null;

  const readKey = (key) => {
    if (!key) return [];
    try {
      const value = JSON.parse(storage.getItem(key) || '[]');
      return Array.isArray(value) ? value : [];
    } catch {
      return [];
    }
  };

  const save = (items) => {
    const key = storageKey();
    if (key) storage.setItem(key, JSON.stringify(items));
  };

  const randomId = () => {
    if (typeof cryptoApi?.randomUUID === 'function') return cryptoApi.randomUUID();
    return `${now().toString(36)}-${Math.random().toString(36).slice(2)}`;
  };

  const deviceId = () => {
    let value = storage.getItem(DEVICE_KEY);
    if (!value) {
      value = `web-${randomId().slice(0, 12)}`;
      storage.setItem(DEVICE_KEY, value);
    }
    return value;
  };

  return {
    setOwner(ownerId) {
      activeOwnerId = normalizeOwnerId(ownerId);
      let discardedLegacyCount = 0;
      if (activeOwnerId) {
        discardedLegacyCount = readKey(OFFLINE_QUEUE_LEGACY_KEY).length;
        if (storage.getItem(OFFLINE_QUEUE_LEGACY_KEY) !== null) {
          storage.removeItem(OFFLINE_QUEUE_LEGACY_KEY);
        }
      }
      return { ownerId: activeOwnerId, discardedLegacyCount };
    },

    getOwner() {
      return activeOwnerId;
    },

    list() {
      if (!activeOwnerId) return [];
      return readKey(storageKey()).filter((item) => Number(item?.owner_id) === activeOwnerId);
    },

    enqueue(action, entityId, payload) {
      if (!activeOwnerId) throw new Error('ログインユーザーを確認できないため、オフライン操作を保存できません。');
      const items = this.list();
      const timestamp = now();
      const item = {
        owner_id: activeOwnerId,
        operation_id: `${deviceId()}:${timestamp}:${randomId().slice(0, 8)}`,
        action,
        entity_id: Number(entityId || 0),
        payload,
        created_at: new Date(timestamp).toISOString()
      };
      items.push(item);
      save(items.slice(-120));
      return item;
    },

    remove(operationIds) {
      const ids = new Set(operationIds);
      save(this.list().filter((item) => !ids.has(item.operation_id)));
    },

    clear() {
      save([]);
    }
  };
}

export const offlineQueue = createOfflineQueue();
