var SetaeOffline = (function ($) {
    'use strict';

    const DB_NAME = 'setae-care-offline';
    const DB_VERSION = 1;
    const STORE_SPIDERS = 'spiders';
    const STORE_LOGS = 'logs';
    const STORE_MUTATIONS = 'mutations';
    const STORE_META = 'meta';
    const GUEST_OWNER = 'guest';
    let dbPromise = null;
    let syncingPromise = null;

    function isGuest() {
        return !!(window.SetaeSettings && SetaeSettings.guest_mode);
    }

    function currentOwner() {
        if (isGuest()) return GUEST_OWNER;
        const userId = currentOwnerId();
        return userId ? 'user:' + userId : GUEST_OWNER;
    }

    function currentOwnerId() {
        return parseInt(window.SetaeSettings && SetaeSettings.current_user_id, 10) || 0;
    }

    function supportsStorage() {
        return typeof window.indexedDB !== 'undefined';
    }

    function openDatabase() {
        if (dbPromise) return dbPromise;
        if (!supportsStorage()) {
            return Promise.reject(new Error('このブラウザではオフライン保存を利用できません。'));
        }

        dbPromise = new Promise(function (resolve, reject) {
            const request = window.indexedDB.open(DB_NAME, DB_VERSION);
            request.onupgradeneeded = function () {
                const db = request.result;
                if (!db.objectStoreNames.contains(STORE_SPIDERS)) {
                    const spiders = db.createObjectStore(STORE_SPIDERS, { keyPath: 'id' });
                    spiders.createIndex('owner', 'owner', { unique: false });
                }
                if (!db.objectStoreNames.contains(STORE_LOGS)) {
                    const logs = db.createObjectStore(STORE_LOGS, { keyPath: 'id' });
                    logs.createIndex('owner', 'owner', { unique: false });
                    logs.createIndex('spider_id', 'spider_id', { unique: false });
                }
                if (!db.objectStoreNames.contains(STORE_MUTATIONS)) {
                    const mutations = db.createObjectStore(STORE_MUTATIONS, { keyPath: 'operation_id' });
                    mutations.createIndex('owner', 'owner', { unique: false });
                    mutations.createIndex('created_at', 'created_at', { unique: false });
                }
                if (!db.objectStoreNames.contains(STORE_META)) {
                    db.createObjectStore(STORE_META, { keyPath: 'key' });
                }
            };
            request.onsuccess = function () { resolve(request.result); };
            request.onerror = function () { reject(request.error || new Error('オフラインDBを開けませんでした。')); };
            request.onblocked = function () {
                reject(new Error('古いSETAE画面を閉じてから、もう一度お試しください。'));
            };
        });
        return dbPromise;
    }

    function requestPromise(request) {
        return new Promise(function (resolve, reject) {
            request.onsuccess = function () { resolve(request.result); };
            request.onerror = function () { reject(request.error); };
        });
    }

    function storeRequest(storeName, mode, callback) {
        return openDatabase().then(function (db) {
            return new Promise(function (resolve, reject) {
                const transaction = db.transaction(storeName, mode);
                const store = transaction.objectStore(storeName);
                let request;
                try {
                    request = callback(store);
                } catch (error) {
                    reject(error);
                    return;
                }
                transaction.oncomplete = function () {
                    resolve(request && Object.prototype.hasOwnProperty.call(request, 'result') ? request.result : undefined);
                };
                transaction.onerror = function () { reject(transaction.error); };
                transaction.onabort = function () { reject(transaction.error || new Error('オフライン保存を中断しました。')); };
            });
        });
    }

    function getAll(storeName) {
        return openDatabase().then(function (db) {
            const transaction = db.transaction(storeName, 'readonly');
            return requestPromise(transaction.objectStore(storeName).getAll());
        });
    }

    function getOne(storeName, id) {
        return openDatabase().then(function (db) {
            const transaction = db.transaction(storeName, 'readonly');
            return requestPromise(transaction.objectStore(storeName).get(id));
        });
    }

    function putOne(storeName, value) {
        return storeRequest(storeName, 'readwrite', function (store) {
            return store.put(value);
        }).then(function () { return value; });
    }

    function deleteOne(storeName, id) {
        return storeRequest(storeName, 'readwrite', function (store) {
            return store.delete(id);
        });
    }

    function makeLocalId() {
        return -((Date.now() * 1000) + Math.floor(Math.random() * 1000));
    }

    function makeOperationId(prefix) {
        const uuid = window.crypto && typeof window.crypto.randomUUID === 'function'
            ? window.crypto.randomUUID()
            : Date.now().toString(36) + '-' + Math.random().toString(36).slice(2);
        return 'setae-' + prefix + '-' + uuid;
    }

    function localDate(date) {
        const value = date || new Date();
        const year = value.getFullYear();
        const month = String(value.getMonth() + 1).padStart(2, '0');
        const day = String(value.getDate()).padStart(2, '0');
        return year + '-' + month + '-' + day;
    }

    function normalizeBoolean(value) {
        return value === true || value === 1 || value === '1' || value === 'true';
    }

    function fileToDataUrl(file) {
        if (!file || typeof File === 'undefined' || !(file instanceof File) || !file.size) {
            return Promise.resolve('');
        }
        if (file.size > 6 * 1024 * 1024) {
            return Promise.reject(new Error('オフライン保存する写真は6MB以下にしてください。'));
        }
        return new Promise(function (resolve, reject) {
            const reader = new FileReader();
            reader.onload = function () {
                const originalDataUrl = String(reader.result || '');
                if (file.size <= 2 * 1024 * 1024 || !/^image\/(?:jpeg|png|webp)$/i.test(file.type || '')) {
                    resolve(originalDataUrl);
                    return;
                }

                const image = new Image();
                image.onload = function () {
                    const maxDimension = 2000;
                    const scale = Math.min(1, maxDimension / Math.max(image.naturalWidth, image.naturalHeight));
                    const canvas = document.createElement('canvas');
                    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
                    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
                    const context = canvas.getContext('2d', { alpha: false });
                    if (!context) {
                        resolve(originalDataUrl);
                        return;
                    }
                    context.fillStyle = '#ffffff';
                    context.fillRect(0, 0, canvas.width, canvas.height);
                    context.drawImage(image, 0, 0, canvas.width, canvas.height);
                    resolve(canvas.toDataURL('image/jpeg', 0.84));
                };
                image.onerror = function () { resolve(originalDataUrl); };
                image.src = originalDataUrl;
            };
            reader.onerror = function () { reject(new Error('写真を端末に保存できませんでした。')); };
            reader.readAsDataURL(file);
        });
    }

    function inputToPayload(input) {
        if (!(input instanceof FormData)) {
            return Promise.resolve(Object.assign({}, input || {}));
        }

        const payload = {};
        let imageFile = null;
        input.forEach(function (value, key) {
            if (typeof File !== 'undefined' && value instanceof File) {
                if (key === 'image' && value.size) imageFile = value;
                return;
            }
            payload[key] = value;
        });

        return fileToDataUrl(imageFile).then(function (dataUrl) {
            if (dataUrl) payload.image_data = dataUrl;
            return payload;
        });
    }

    function queueMutation(action, entityId, payload, options) {
        if (isGuest() && !(options && options.force)) {
            return Promise.resolve(null);
        }
        const mutation = {
            operation_id: options && options.operationId ? options.operationId : makeOperationId(action),
            owner: options && options.owner ? options.owner : currentOwner(),
            owner_id: currentOwnerId(),
            action: action,
            entity_id: Number(entityId) || 0,
            payload: payload || {},
            created_at: new Date().toISOString(),
            attempts: 0,
            last_error: ''
        };
        return putOne(STORE_MUTATIONS, mutation).then(function () {
            requestBackgroundSync();
            dispatchStateChange();
            return mutation;
        });
    }

    function requestBackgroundSync() {
        if (!('serviceWorker' in navigator)) return;
        navigator.serviceWorker.ready.then(function (registration) {
            if (registration.sync && typeof registration.sync.register === 'function') {
                return registration.sync.register('setae-offline-sync');
            }
            return null;
        }).catch(function () {});
    }

    function dispatchStateChange(detail) {
        document.dispatchEvent(new CustomEvent('setae:offline-state', {
            detail: detail || {}
        }));
    }

    function getOwnerItems(storeName, owner) {
        const targetOwner = owner || currentOwner();
        return getAll(storeName).then(function (items) {
            return items.filter(function (item) { return item && item.owner === targetOwner; });
        });
    }

    function decorateSpiders(spiders, owner) {
        return getOwnerItems(STORE_LOGS, owner).then(function (logs) {
            const bySpider = {};
            logs.forEach(function (log) {
                const key = String(log.spider_id);
                if (!bySpider[key]) bySpider[key] = [];
                bySpider[key].push(log);
            });

            return spiders.map(function (spider) {
                const spiderLogs = bySpider[String(spider.id)] || [];
                const recentEvents = spiderLogs
                    .slice()
                    .sort(function (a, b) { return String(b.date || '').localeCompare(String(a.date || '')); })
                    .slice(0, 18)
                    .map(function (log) {
                        return {
                            type: log.type,
                            date: log.date,
                            refused: !!(log.data && log.data.refused),
                            count: 1
                        };
                    });
                return Object.assign({}, spider, {
                    activity_90d: recentEvents.length ? {
                        window_days: 90,
                        events: recentEvents
                    } : (spider.activity_90d || null)
                });
            });
        });
    }

    function getSpiders(options) {
        const scope = options && options.scope ? options.scope : 'active';
        const owner = options && options.owner ? options.owner : currentOwner();
        return getOwnerItems(STORE_SPIDERS, owner).then(function (items) {
            const filtered = items.filter(function (spider) {
                if (scope === 'all') return true;
                return scope === 'archived' ? !!spider.archived : !spider.archived;
            });
            filtered.sort(function (a, b) {
                if (!!a.is_favorite !== !!b.is_favorite) return a.is_favorite ? -1 : 1;
                return Math.abs(Number(b.id) || 0) - Math.abs(Number(a.id) || 0);
            });
            return decorateSpiders(filtered, owner);
        });
    }

    function cacheServerSpiders(spiders, options) {
        if (isGuest()) return Promise.resolve(spiders || []);
        const owner = currentOwner();
        const scope = options && options.scope ? options.scope : 'active';
        const normalized = Array.isArray(spiders) ? spiders : [];
        return getOwnerItems(STORE_SPIDERS, owner).then(function (existing) {
            const pendingById = {};
            existing.forEach(function (spider) {
                if (spider.sync_state === 'pending') pendingById[String(spider.id)] = spider;
            });
            const deletes = existing.filter(function (spider) {
                if (spider.source !== 'server' || spider.sync_state === 'pending') return false;
                if (scope === 'all') return true;
                return scope === 'archived' ? !!spider.archived : !spider.archived;
            }).map(function (spider) {
                return deleteOne(STORE_SPIDERS, spider.id);
            });
            return Promise.all(deletes).then(function () {
                return Promise.all(normalized.map(function (spider) {
                    if (pendingById[String(spider.id)]) return pendingById[String(spider.id)];
                    return putOne(STORE_SPIDERS, Object.assign({}, spider, {
                        owner: owner,
                        source: 'server',
                        sync_state: 'synced',
                        cached_at: new Date().toISOString()
                    }));
                }));
            });
        }).then(function () {
            return normalized;
        });
    }

    function cacheSpiderDetail(detail) {
        if (isGuest() || !detail || !detail.id) return Promise.resolve(detail);
        const owner = currentOwner();
        const id = Number(detail.id);
        return getOne(STORE_SPIDERS, id).then(function (existing) {
            if (existing && existing.sync_state === 'pending') return existing;
            return putOne(STORE_SPIDERS, Object.assign({}, existing || {}, detail, {
                id: id,
                owner: owner,
                source: 'server',
                sync_state: 'synced',
                cached_at: new Date().toISOString()
            }));
        }).then(function () { return detail; });
    }

    function cacheServerLogs(spiderId, events) {
        if (isGuest()) return Promise.resolve(events || []);
        const owner = currentOwner();
        const id = Number(spiderId);
        const normalized = Array.isArray(events) ? events : [];
        return getOwnerItems(STORE_LOGS, owner).then(function (existing) {
            const deletes = existing.filter(function (log) {
                return Number(log.spider_id) === id
                    && log.source === 'server'
                    && log.sync_state !== 'pending';
            }).map(function (log) {
                return deleteOne(STORE_LOGS, log.id);
            });
            return Promise.all(deletes);
        }).then(function () {
            return Promise.all(normalized.map(function (event) {
                let data = event.data || {};
                if (typeof data === 'string') {
                    try { data = JSON.parse(data || '{}'); } catch (error) { data = {}; }
                }
                return putOne(STORE_LOGS, {
                    id: Number(event.id),
                    owner: owner,
                    source: 'server',
                    sync_state: 'synced',
                    spider_id: id,
                    type: event.type || 'observation',
                    date: event.date || '',
                    data: data,
                    note: event.note || '',
                    image: event.image || '',
                    image_data: '',
                    cached_at: new Date().toISOString()
                });
            }));
        }).then(function () { return normalized; });
    }

    function createSpider(input) {
        const owner = currentOwner();
        return inputToPayload(input).then(function (payload) {
            return getOwnerItems(STORE_SPIDERS, owner).then(function (existing) {
                const limit = parseInt(
                    window.SetaeSettings && SetaeSettings.current_user
                        ? SetaeSettings.current_user.spider_limit
                        : 8,
                    10
                );
                if (limit !== -1 && existing.length >= limit) {
                    throw new Error('無料プランの登録上限（' + limit + '匹）に達しています。');
                }

                const id = makeLocalId();
                const classification = String(payload.classification || 'tarantula');
                const speciesName = classification === 'tarantula'
                    ? String(payload.species_name || $('#spider-species-search').val() || '種類不明')
                    : String(payload.custom_species || payload.species_name || '種類不明');
                const title = String(payload.name || speciesName);
                const spider = {
                    id: id,
                    owner: owner,
                    source: 'local',
                    sync_state: isGuest() ? 'local-only' : 'pending',
                    title: title,
                    name: title,
                    species_id: parseInt(payload.species_id, 10) || 0,
                    species_name: speciesName,
                    custom_species: classification === 'tarantula' ? '' : speciesName,
                    classification: classification,
                    gender: 'unknown',
                    status: 'normal',
                    last_molt: payload.last_molt || '',
                    last_feed: payload.last_feed || '',
                    last_pairing: '',
                    last_observation: '',
                    last_observation_label: '',
                    last_prey: '',
                    is_favorite: false,
                    is_hungry: false,
                    archived: false,
                    archived_at: '',
                    thumb: payload.image_data || '',
                    image_data: payload.image_data || '',
                    has_own_image: !!payload.image_data,
                    image_source: payload.image_data ? 'spider' : 'none',
                    qr_code: '',
                    qr_url: '',
                    created_at: new Date().toISOString(),
                    updated_at: new Date().toISOString()
                };
                return putOne(STORE_SPIDERS, spider).then(function () {
                    return queueMutation('create_spider', id, {
                        classification: spider.classification,
                        species_id: spider.species_id,
                        species_name: spider.species_name,
                        custom_species: spider.custom_species,
                        name: spider.title,
                        last_molt: spider.last_molt,
                        last_feed: spider.last_feed,
                        image_data: spider.image_data
                    }).then(function () {
                        dispatchStateChange({ pending: !isGuest() });
                        return { success: true, id: id, offline: true };
                    });
                });
            });
        });
    }

    function updateSpider(id, input) {
        const spiderId = Number(id);
        return Promise.all([getOne(STORE_SPIDERS, spiderId), inputToPayload(input)]).then(function (values) {
            const spider = values[0];
            const changes = values[1];
            if (!spider || spider.owner !== currentOwner()) {
                throw new Error('個体が端末内に見つかりません。');
            }

            if (changes.name || changes.title) {
                spider.title = String(changes.name || changes.title);
                spider.name = spider.title;
            }
            if (Object.prototype.hasOwnProperty.call(changes, 'status')) spider.status = String(changes.status || 'normal');
            if (Object.prototype.hasOwnProperty.call(changes, 'gender')) spider.gender = String(changes.gender || 'unknown');
            if (Object.prototype.hasOwnProperty.call(changes, 'is_favorite')) spider.is_favorite = normalizeBoolean(changes.is_favorite);
            if (Object.prototype.hasOwnProperty.call(changes, 'archived')) {
                spider.archived = normalizeBoolean(changes.archived);
                spider.archived_at = spider.archived ? new Date().toISOString() : '';
            }
            if (changes.species_id) spider.species_id = parseInt(changes.species_id, 10) || 0;
            if (changes.species_name || changes.custom_species) {
                spider.species_name = String(changes.species_name || changes.custom_species);
            }
            ['last_molt', 'last_feed', 'last_pairing', 'last_observation'].forEach(function (field) {
                if (Object.prototype.hasOwnProperty.call(changes, field)) spider[field] = changes[field] || '';
            });
            [
                'temperature', 'humidity', 'recommended_temperature', 'recommended_humidity',
                'substrate', 'origin', 'enclosure', 'acquired_date', 'instar', 'notes'
            ].forEach(function (field) {
                if (Object.prototype.hasOwnProperty.call(changes, field)) spider[field] = changes[field] || '';
            });
            if (changes.image_data) {
                spider.image_data = changes.image_data;
                spider.thumb = changes.image_data;
                spider.has_own_image = true;
                spider.image_source = 'spider';
            }
            spider.updated_at = new Date().toISOString();
            spider.sync_state = isGuest() ? 'local-only' : 'pending';

            return putOne(STORE_SPIDERS, spider).then(function () {
                return queueMutation('update_spider', spiderId, { changes: changes });
            }).then(function () {
                dispatchStateChange({ pending: !isGuest() });
                return getSpiderDetail(spiderId).then(function (detail) {
                    return { success: true, data: detail, offline: true };
                });
            });
        });
    }

    function deleteSpider(id) {
        const spiderId = Number(id);
        return getOne(STORE_SPIDERS, spiderId).then(function (spider) {
            if (!spider || spider.owner !== currentOwner()) {
                throw new Error('個体が端末内に見つかりません。');
            }
            return getOwnerItems(STORE_LOGS, currentOwner()).then(function (logs) {
                const deletes = logs.filter(function (log) {
                    return Number(log.spider_id) === spiderId;
                }).map(function (log) {
                    return deleteOne(STORE_LOGS, log.id);
                });
                deletes.push(deleteOne(STORE_SPIDERS, spiderId));
                return Promise.all(deletes);
            }).then(function () {
                if (spiderId < 0 && !isGuest()) {
                    return removeQueuedEntity(spiderId);
                }
                return queueMutation('delete_spider', spiderId, {});
            }).then(function () {
                dispatchStateChange({ pending: !isGuest() });
                return { success: true, offline: true };
            });
        });
    }

    function createLog(spiderId, type, date, data, file) {
        const numericSpiderId = Number(spiderId);
        const owner = currentOwner();
        return Promise.all([getOne(STORE_SPIDERS, numericSpiderId), fileToDataUrl(file)]).then(function (values) {
            const spider = values[0];
            const imageData = values[1];
            if (!spider || spider.owner !== owner) {
                throw new Error('記録する個体が端末内に見つかりません。');
            }

            const normalizedType = type === 'note' || type === 'memo' ? 'observation' : String(type || '');
            const logId = makeLocalId();
            const logData = Object.assign({}, data || {});
            delete logData.share_to_feed;
            delete logData.is_best_shot;
            const log = {
                id: logId,
                owner: owner,
                source: 'local',
                sync_state: isGuest() ? 'local-only' : 'pending',
                spider_id: numericSpiderId,
                type: normalizedType,
                date: date,
                data: logData,
                note: logData.note || '',
                image: imageData || '',
                image_data: imageData || '',
                created_at: new Date().toISOString()
            };

            applyLogToLocalSpider(spider, log);
            return Promise.all([
                putOne(STORE_LOGS, log),
                putOne(STORE_SPIDERS, spider)
            ]).then(function () {
                return queueMutation('create_log', logId, {
                    spider_id: numericSpiderId,
                    type: normalizedType,
                    date: date,
                    data: logData,
                    image_data: imageData
                });
            }).then(function () {
                return getCareSummary();
            }).then(function (summary) {
                dispatchStateChange({ pending: !isGuest() });
                return {
                    success: true,
                    id: logId,
                    offline: true,
                    spider: spider,
                    care_summary: summary
                };
            });
        });
    }

    function applyLogToLocalSpider(spider, log) {
        const data = log.data || {};
        if (log.type === 'feed') {
            if (data.refused) {
                spider.status = 'fasting';
            } else {
                spider.last_feed = log.date;
                spider.status = 'normal';
                spider.last_prey = data.prey_type || spider.last_prey || '';
            }
        } else if (log.type === 'molt') {
            spider.last_molt = log.date;
            spider.status = 'post_molt';
        } else if (log.type === 'pairing') {
            spider.last_pairing = log.date;
        } else if (log.type === 'observation') {
            spider.last_observation = log.date;
            spider.last_observation_label = data.label || '異常なし';
        }
        spider.updated_at = new Date().toISOString();
        spider.sync_state = isGuest() ? 'local-only' : 'pending';
    }

    function getSpiderEvents(spiderId) {
        const id = Number(spiderId);
        return getOwnerItems(STORE_LOGS, currentOwner()).then(function (logs) {
            return logs.filter(function (log) {
                return Number(log.spider_id) === id;
            }).sort(function (a, b) {
                const dateOrder = String(b.date || '').localeCompare(String(a.date || ''));
                return dateOrder || (Math.abs(Number(b.id)) - Math.abs(Number(a.id)));
            }).map(function (log) {
                return {
                    id: log.id,
                    type: log.type,
                    date: log.date,
                    data: typeof log.data === 'string' ? log.data : JSON.stringify(log.data || {}),
                    note: log.note || '',
                    image: log.image || log.image_data || '',
                    sync_state: log.sync_state
                };
            });
        });
    }

    function getSpiderDetail(id) {
        const spiderId = Number(id);
        return Promise.all([getOne(STORE_SPIDERS, spiderId), getSpiderEvents(spiderId)]).then(function (values) {
            const spider = values[0];
            const events = values[1];
            if (!spider || spider.owner !== currentOwner()) {
                throw new Error('個体が端末内に見つかりません。');
            }
            return Object.assign({}, spider, {
                history: events.slice(0, 10).map(function (event) {
                    let parsed = {};
                    try { parsed = JSON.parse(event.data || '{}'); } catch (error) {}
                    return {
                        id: event.id,
                        type: event.type,
                        date: event.date,
                        refused: !!parsed.refused,
                        data: parsed,
                        image: event.image
                    };
                })
            });
        });
    }

    function updateLog(logId, changes) {
        const id = Number(logId);
        return getOne(STORE_LOGS, id).then(function (log) {
            if (!log || log.owner !== currentOwner()) {
                throw new Error('記録が端末内に見つかりません。');
            }
            log.data = Object.assign({}, log.data || {}, changes || {});
            log.sync_state = isGuest() ? 'local-only' : 'pending';
            return putOne(STORE_LOGS, log).then(function () {
                return queueMutation('update_log', id, changes || {});
            }).then(function () {
                dispatchStateChange({ pending: !isGuest() });
                return { success: true, data: log.data, offline: true };
            });
        });
    }

    function deleteLog(logId) {
        const id = Number(logId);
        return getOne(STORE_LOGS, id).then(function (log) {
            if (!log || log.owner !== currentOwner()) {
                throw new Error('記録が端末内に見つかりません。');
            }
            return deleteOne(STORE_LOGS, id).then(function () {
                return recalculateSpider(log.spider_id, log.type);
            }).then(function () {
                if (id < 0 && !isGuest()) {
                    return removeQueuedEntity(id);
                }
                return queueMutation('delete_log', id, {});
            }).then(function () {
                dispatchStateChange({ pending: !isGuest() });
                return { success: true, offline: true };
            });
        });
    }

    function recalculateSpider(spiderId, type) {
        return Promise.all([getOne(STORE_SPIDERS, Number(spiderId)), getSpiderEvents(spiderId)]).then(function (values) {
            const spider = values[0];
            const events = values[1];
            if (!spider) return null;
            const target = events.filter(function (event) { return event.type === type; });
            if (type === 'feed') {
                spider.last_feed = '';
                spider.status = 'normal';
                for (let index = 0; index < target.length; index += 1) {
                    let data = {};
                    try { data = JSON.parse(target[index].data || '{}'); } catch (error) {}
                    if (index === 0 && data.refused) spider.status = 'fasting';
                    if (!data.refused && !spider.last_feed) spider.last_feed = target[index].date;
                }
            } else if (type === 'molt') {
                spider.last_molt = target.length ? target[0].date : '';
            } else if (type === 'pairing') {
                spider.last_pairing = target.length ? target[0].date : '';
            } else if (type === 'observation') {
                spider.last_observation = target.length ? target[0].date : '';
            }
            return putOne(STORE_SPIDERS, spider);
        });
    }

    function getCareSummary() {
        const owner = currentOwner();
        return Promise.all([getSpiders({ scope: 'active', owner: owner }), getOwnerItems(STORE_LOGS, owner)]).then(function (values) {
            const spiders = values[0];
            const logs = values[1];
            const today = localDate();
            const checked = {};
            const logsByDate = {};
            logs.forEach(function (log) {
                if (!logsByDate[log.date]) logsByDate[log.date] = [];
                logsByDate[log.date].push(log);
                if (log.date === today) checked[String(log.spider_id)] = true;
            });
            const observed = Object.keys(checked).filter(function (id) {
                return spiders.some(function (spider) { return String(spider.id) === id; });
            }).length;

            const week = [];
            for (let offset = -6; offset <= 0; offset += 1) {
                const date = new Date();
                date.setDate(date.getDate() + offset);
                const key = localDate(date);
                const dayLogs = logsByDate[key] || [];
                week.push({
                    date: key,
                    label: (date.getMonth() + 1) + '/' + date.getDate(),
                    weekday: ['日', '月', '火', '水', '木', '金', '土'][date.getDay()],
                    checked: dayLogs.length > 0,
                    log_count: dayLogs.length
                });
            }

            return {
                today: today,
                total_spiders: spiders.length,
                observed_today: observed,
                pending_today: Math.max(0, spiders.length - observed),
                checked_spider_ids: Object.keys(checked),
                streak: calculateStreak(logsByDate, today),
                best_streak: calculateBestStreak(logsByDate),
                last_check_date: logsByDate[today] && logsByDate[today].length ? today : '',
                week: week,
                month: { days: [] },
                logs_by_date: logsByDate
            };
        });
    }

    function calculateStreak(logsByDate, today) {
        let streak = 0;
        const date = new Date(today.replace(/-/g, '/'));
        while (streak < 366) {
            const key = localDate(date);
            if (!logsByDate[key] || !logsByDate[key].length) break;
            streak += 1;
            date.setDate(date.getDate() - 1);
        }
        return streak;
    }

    function calculateBestStreak(logsByDate) {
        const dates = Object.keys(logsByDate).filter(function (date) {
            return logsByDate[date] && logsByDate[date].length;
        }).sort();
        let best = 0;
        let current = 0;
        let previous = null;
        dates.forEach(function (dateString) {
            const date = new Date(dateString.replace(/-/g, '/'));
            if (previous && Math.round((date - previous) / 86400000) === 1) current += 1;
            else current = 1;
            best = Math.max(best, current);
            previous = date;
        });
        return best;
    }

    function removeQueuedEntity(entityId) {
        return getOwnerItems(STORE_MUTATIONS, currentOwner()).then(function (mutations) {
            const deletes = mutations.filter(function (mutation) {
                return Number(mutation.entity_id) === Number(entityId)
                    || Number(mutation.payload && mutation.payload.spider_id) === Number(entityId);
            }).map(function (mutation) {
                return deleteOne(STORE_MUTATIONS, mutation.operation_id);
            });
            return Promise.all(deletes);
        });
    }

    function getPendingCount(owner) {
        return getOwnerItems(STORE_MUTATIONS, owner || currentOwner()).then(function (items) {
            return items.length;
        });
    }

    function postOperations(operations, attempt) {
        const retryAttempt = parseInt(attempt, 10) || 0;
        const request = $.ajax({
            url: SetaeCore.state.apiRoot + '/offline/sync',
            method: 'POST',
            data: JSON.stringify({ operations: operations }),
            contentType: 'application/json; charset=UTF-8',
            dataType: 'json',
            timeout: 90000,
            beforeSend: function (xhr) {
                xhr.setRequestHeader('X-WP-Nonce', SetaeCore.state.nonce);
            }
        });
        return Promise.resolve(request).catch(function (xhr) {
            if (xhr && xhr.status === 409 && retryAttempt < 4) {
                return new Promise(function (resolve) {
                    window.setTimeout(resolve, (retryAttempt + 1) * 1500);
                }).then(function () {
                    return postOperations(operations, retryAttempt + 1);
                });
            }
            throw xhr;
        });
    }

    function postOperationsBatched(operations) {
        const batches = [];
        let batch = [];
        let batchBytes = 0;
        (operations || []).forEach(function (operation) {
            const bytes = JSON.stringify(operation).length;
            if (batch.length && (batch.length >= 25 || batchBytes + bytes > 3500000)) {
                batches.push(batch);
                batch = [];
                batchBytes = 0;
            }
            batch.push(operation);
            batchBytes += bytes;
        });
        if (batch.length) batches.push(batch);

        const combined = {
            success: true,
            results: [],
            mapping: {},
            failed: 0
        };
        return batches.reduce(function (promise, currentBatch) {
            return promise.then(function () {
                return Promise.resolve(postOperations(currentBatch)).then(function (response) {
                    combined.results = combined.results.concat(response.results || []);
                    combined.mapping = Object.assign(combined.mapping, response.mapping || {});
                    combined.failed += parseInt(response.failed, 10) || 0;
                    combined.success = combined.success && response.success !== false;
                });
            });
        }, Promise.resolve()).then(function () { return combined; });
    }

    function syncPending() {
        if (isGuest() || !currentOwnerId() || !navigator.onLine) {
            return Promise.resolve({ success: false, offline: true });
        }
        if (syncingPromise) return syncingPromise;

        const owner = currentOwner();
        const ownerId = currentOwnerId();
        syncingPromise = getOwnerItems(STORE_MUTATIONS, owner).then(function (mutations) {
            if (!mutations.length) return { success: true, results: [], mapping: {} };
            mutations.sort(function (a, b) {
                const order = { create_spider: 0, update_spider: 1, create_log: 2, update_log: 3, delete_log: 4, delete_spider: 5 };
                const actionOrder = (order[a.action] || 0) - (order[b.action] || 0);
                return actionOrder || String(a.created_at).localeCompare(String(b.created_at));
            });
            dispatchStateChange({ syncing: true, pending: mutations.length });
            const ownedMutations = mutations.map(function (mutation) {
                return Object.assign({}, mutation, { owner_id: ownerId });
            });
            return postOperationsBatched(ownedMutations).then(function (response) {
                return applySyncResponse(response, mutations, owner).then(function () {
                    return response;
                });
            });
        }).finally(function () {
            syncingPromise = null;
            getPendingCount(owner).then(function (count) {
                dispatchStateChange({ syncing: false, pending: count });
            });
        });
        return syncingPromise;
    }

    function applySyncResponse(response, mutations, owner) {
        const results = response && Array.isArray(response.results) ? response.results : [];
        const mapping = response && response.mapping ? response.mapping : {};
        return applyIdMapping(mapping, owner).then(function () {
            return Promise.all(results.map(function (result) {
                const operationId = result.operation_id;
                if (result.success) {
                    return deleteOne(STORE_MUTATIONS, operationId);
                }
                return getOne(STORE_MUTATIONS, operationId).then(function (mutation) {
                    if (!mutation) return null;
                    mutation.attempts = (parseInt(mutation.attempts, 10) || 0) + 1;
                    mutation.last_error = result.message || '同期できませんでした。';
                    return putOne(STORE_MUTATIONS, mutation);
                });
            }));
        });
    }

    function applyIdMapping(mapping, owner) {
        const pairs = Object.keys(mapping || {}).map(function (clientId) {
            return [Number(clientId), Number(mapping[clientId])];
        }).filter(function (pair) {
            return pair[0] < 0 && pair[1] > 0;
        });
        if (!pairs.length) return Promise.resolve();

        return Promise.all([getOwnerItems(STORE_SPIDERS, owner), getOwnerItems(STORE_LOGS, owner), getOwnerItems(STORE_MUTATIONS, owner)]).then(function (values) {
            const spiders = values[0];
            const logs = values[1];
            const mutations = values[2];
            const tasks = [];

            pairs.forEach(function (pair) {
                const clientId = pair[0];
                const serverId = pair[1];
                const spider = spiders.find(function (item) { return Number(item.id) === clientId; });
                if (spider) {
                    tasks.push(deleteOne(STORE_SPIDERS, clientId));
                    spider.id = serverId;
                    spider.source = 'server';
                    spider.sync_state = 'synced';
                    spider.updated_at = new Date().toISOString();
                    tasks.push(putOne(STORE_SPIDERS, spider));
                    logs.forEach(function (log) {
                        if (Number(log.spider_id) === clientId) {
                            log.spider_id = serverId;
                            tasks.push(putOne(STORE_LOGS, log));
                        }
                    });
                }

                const log = logs.find(function (item) { return Number(item.id) === clientId; });
                if (log) {
                    tasks.push(deleteOne(STORE_LOGS, clientId));
                    log.id = serverId;
                    log.source = 'server';
                    log.sync_state = 'synced';
                    tasks.push(putOne(STORE_LOGS, log));
                }

                mutations.forEach(function (mutation) {
                    let changed = false;
                    if (Number(mutation.entity_id) === clientId) {
                        mutation.entity_id = serverId;
                        changed = true;
                    }
                    if (mutation.payload && Number(mutation.payload.spider_id) === clientId) {
                        mutation.payload.spider_id = serverId;
                        changed = true;
                    }
                    if (changed) tasks.push(putOne(STORE_MUTATIONS, mutation));
                });
            });
            return Promise.all(tasks);
        });
    }

    function hasGuestData() {
        return getOwnerItems(STORE_SPIDERS, GUEST_OWNER).then(function (spiders) {
            return { count: spiders.length, spiders: spiders };
        });
    }

    function migrateGuestData() {
        if (isGuest() || !navigator.onLine) {
            return Promise.reject(new Error('登録後、オンラインの状態で同期してください。'));
        }
        return Promise.all([
            getOwnerItems(STORE_SPIDERS, GUEST_OWNER),
            getOwnerItems(STORE_LOGS, GUEST_OWNER)
        ]).then(function (values) {
            const spiders = values[0];
            const logs = values[1];
            if (!spiders.length) return { success: true, migrated: 0 };

            const operations = [];
            spiders.forEach(function (spider) {
                operations.push({
                    operation_id: 'setae-migrate-spider-' + Math.abs(Number(spider.id)),
                    owner_id: currentOwnerId(),
                    action: 'create_spider',
                    entity_id: spider.id,
                    payload: {
                        classification: spider.classification,
                        species_id: spider.species_id,
                        species_name: spider.species_name,
                        custom_species: spider.custom_species,
                        name: spider.title,
                        last_molt: spider.last_molt,
                        last_feed: spider.last_feed,
                        image_data: spider.image_data || (String(spider.thumb || '').indexOf('data:') === 0 ? spider.thumb : '')
                    }
                });
            });
            logs.forEach(function (log) {
                operations.push({
                    operation_id: 'setae-migrate-log-' + Math.abs(Number(log.id)),
                    owner_id: currentOwnerId(),
                    action: 'create_log',
                    entity_id: log.id,
                    payload: {
                        spider_id: log.spider_id,
                        type: log.type,
                        date: log.date,
                        data: log.data || {},
                        image_data: log.image_data || (String(log.image || '').indexOf('data:') === 0 ? log.image : '')
                    }
                });
            });
            return postOperationsBatched(operations).then(function (response) {
                if (!response || response.failed) {
                    const failure = response && response.results
                        ? response.results.find(function (result) { return !result.success; })
                        : null;
                    throw new Error(failure && failure.message ? failure.message : '一部のデータを同期できませんでした。');
                }
                return clearOwnerData(GUEST_OWNER).then(function () {
                    dispatchStateChange({ migrated: spiders.length, pending: 0 });
                    return { success: true, migrated: spiders.length, response: response };
                });
            });
        });
    }

    function clearOwnerData(owner) {
        return Promise.all([
            getOwnerItems(STORE_SPIDERS, owner),
            getOwnerItems(STORE_LOGS, owner),
            getOwnerItems(STORE_MUTATIONS, owner)
        ]).then(function (values) {
            const tasks = [];
            values[0].forEach(function (item) { tasks.push(deleteOne(STORE_SPIDERS, item.id)); });
            values[1].forEach(function (item) { tasks.push(deleteOne(STORE_LOGS, item.id)); });
            values[2].forEach(function (item) { tasks.push(deleteOne(STORE_MUTATIONS, item.operation_id)); });
            return Promise.all(tasks);
        });
    }

    function shouldUseLocal() {
        return isGuest() || !navigator.onLine;
    }

    return {
        isSupported: supportsStorage,
        isGuest: isGuest,
        shouldUseLocal: shouldUseLocal,
        getSpiders: getSpiders,
        cacheServerSpiders: cacheServerSpiders,
        cacheSpiderDetail: cacheSpiderDetail,
        cacheServerLogs: cacheServerLogs,
        createSpider: createSpider,
        updateSpider: updateSpider,
        deleteSpider: deleteSpider,
        createLog: createLog,
        updateLog: updateLog,
        deleteLog: deleteLog,
        getSpiderDetail: getSpiderDetail,
        getSpiderEvents: getSpiderEvents,
        getCareSummary: getCareSummary,
        getPendingCount: getPendingCount,
        syncPending: syncPending,
        hasGuestData: hasGuestData,
        migrateGuestData: migrateGuestData,
        clearGuestData: function () { return clearOwnerData(GUEST_OWNER); }
    };

})(jQuery);
