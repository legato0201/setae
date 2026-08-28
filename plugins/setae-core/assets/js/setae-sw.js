'use strict';

const CACHE_VERSION = '__SETAE_CACHE_VERSION__';
const APP_CACHE = CACHE_VERSION + '-app';
const PUBLIC_CACHE = CACHE_VERSION + '-public';
const OFFLINE_URL = '__SETAE_OFFLINE_URL__';
const ICON_192 = '__SETAE_ICON_192__';
const BADGE_96 = '__SETAE_BADGE_96__';
const CACHE_PREFIX = 'setae-';

function cacheOfflineShell(cache) {
    return fetch(OFFLINE_URL, {
        credentials: 'omit',
        cache: 'reload'
    }).then(function (response) {
        if (!response || !response.ok) {
            throw new Error('Offline shell request failed');
        }
        const responseForCache = response.clone();
        return response.text().then(function (html) {
            return cache.put(OFFLINE_URL, responseForCache).then(function () {
                const assetUrls = [];
                const attributePattern = /(?:src|href)=["']([^"']+)["']/gi;
                let match;
                while ((match = attributePattern.exec(html)) !== null) {
                    try {
                        const url = new URL(match[1], self.location.origin);
                        if (
                            url.origin === self.location.origin
                            && /\.(?:css|js|png|jpe?g|webp|gif|svg|woff2?)(?:\?.*)?$/i.test(url.pathname + url.search)
                        ) {
                            assetUrls.push(url.href);
                        }
                    } catch (error) {}
                }
                const uniqueUrls = Array.from(new Set(assetUrls));
                return Promise.allSettled(uniqueUrls.map(function (url) {
                    return fetch(url, { credentials: 'omit', cache: 'reload' }).then(function (assetResponse) {
                        if (assetResponse && assetResponse.ok) {
                            return cache.put(url, assetResponse);
                        }
                        return null;
                    });
                }));
            });
        });
    });
}

self.addEventListener('install', function (event) {
    event.waitUntil(
        caches.open(APP_CACHE)
            .then(function (cache) {
                return Promise.all([
                    cache.addAll([ICON_192, BADGE_96]),
                    cacheOfflineShell(cache)
                ]);
            })
    );
});

self.addEventListener('activate', function (event) {
    event.waitUntil(
        caches.keys()
            .then(function (keys) {
                return Promise.all(keys.map(function (key) {
                    if (key.indexOf(CACHE_PREFIX) === 0 && key !== APP_CACHE && key !== PUBLIC_CACHE) {
                        return caches.delete(key);
                    }
                    return null;
                }));
            })
            .then(function () {
                return self.clients.claim();
            })
    );
});

function isCodeAsset(request, url) {
    if (request.destination && ['style', 'script'].indexOf(request.destination) !== -1) {
        return true;
    }
    return /\.(?:css|js)$/i.test(url.pathname);
}

function isLongLivedAsset(request, url) {
    if (request.destination && ['image', 'font'].indexOf(request.destination) !== -1) {
        return true;
    }
    return /\.(?:png|jpe?g|webp|gif|svg|woff2?)$/i.test(url.pathname);
}

function isPublicRestGet(request, url) {
    if (request.method !== 'GET' || url.origin !== self.location.origin) {
        return false;
    }
    return /\/wp-json\/setae\/v1\/species(?:\/|$)/.test(url.pathname);
}

function staleWhileRevalidate(request, cacheName) {
    return caches.open(cacheName).then(function (cache) {
        return cache.match(request).then(function (cached) {
            const network = fetch(request).then(function (response) {
                if (response && response.ok && response.type !== 'opaque') {
                    cache.put(request, response.clone());
                }
                return response;
            }).catch(function () {
                return cached;
            });
            return cached || network;
        });
    });
}

function networkFirstAsset(request) {
    return caches.open(APP_CACHE).then(function (cache) {
        return fetch(request, { cache: 'no-cache' }).then(function (response) {
            if (response && response.ok && response.type !== 'opaque') {
                cache.put(request, response.clone());
            }
            return response;
        }).catch(function () {
            return cache.match(request);
        });
    });
}

function networkFirstPublic(request) {
    return caches.open(PUBLIC_CACHE).then(function (cache) {
        return fetch(request).then(function (response) {
            if (response && response.ok) {
                cache.put(request, response.clone());
            }
            return response;
        }).catch(function () {
            return cache.match(request);
        });
    });
}

self.addEventListener('fetch', function (event) {
    const request = event.request;
    if (request.method !== 'GET') {
        return;
    }

    const url = new URL(request.url);
    if (request.mode === 'navigate') {
        event.respondWith(
            fetch(request, { cache: 'no-cache' }).catch(function () {
                return caches.match(OFFLINE_URL);
            })
        );
        return;
    }

    if (isPublicRestGet(request, url)) {
        event.respondWith(networkFirstPublic(request));
        return;
    }

    if (url.origin === self.location.origin && isCodeAsset(request, url)) {
        event.respondWith(networkFirstAsset(request));
        return;
    }

    if (url.origin === self.location.origin && isLongLivedAsset(request, url)) {
        event.respondWith(staleWhileRevalidate(request, APP_CACHE));
    }
});

self.addEventListener('push', function (event) {
    let payload = {};
    try {
        payload = event.data ? event.data.json() : {};
    } catch (error) {
        payload = { body: event.data ? event.data.text() : '' };
    }

    const title = payload.title || 'SETAE';
    const badgeCount = Math.max(0, parseInt(payload.badgeCount, 10) || 0);
    const options = {
        body: payload.body || '新しいお知らせがあります。',
        icon: payload.icon || ICON_192,
        badge: payload.badge || BADGE_96,
        tag: payload.tag || 'setae-update',
        renotify: false,
        data: {
            url: payload.url || '/',
            payload: payload.data || {}
        }
    };

    const tasks = [self.registration.showNotification(title, options)];
    if (badgeCount > 0 && self.navigator && typeof self.navigator.setAppBadge === 'function') {
        tasks.push(self.navigator.setAppBadge(badgeCount));
    }
    event.waitUntil(Promise.all(tasks));
});

self.addEventListener('notificationclick', function (event) {
    event.notification.close();
    const requestedUrl = new URL(
        event.notification && event.notification.data && event.notification.data.url
            ? event.notification.data.url
            : '/',
        self.location.origin
    );
    const targetUrl = requestedUrl.origin === self.location.origin
        ? requestedUrl.href
        : new URL('/', self.location.origin).href;

    event.waitUntil(
        self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (clients) {
            for (let index = 0; index < clients.length; index += 1) {
                const client = clients[index];
                if (new URL(client.url).origin === self.location.origin) {
                    client.postMessage({
                        type: 'SETAE_NOTIFICATION_OPEN',
                        url: targetUrl
                    });
                    return client.focus();
                }
            }
            return self.clients.openWindow(targetUrl);
        })
    );
});

self.addEventListener('sync', function (event) {
    if (event.tag !== 'setae-offline-sync') {
        return;
    }
    event.waitUntil(
        self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (clients) {
            clients.forEach(function (client) {
                client.postMessage({ type: 'SETAE_SYNC_REQUEST' });
            });
        })
    );
});

self.addEventListener('message', function (event) {
    if (!event.data) {
        return;
    }
    if (event.data.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }
    if (event.data.type === 'CLEAR_BADGE' && self.navigator && typeof self.navigator.clearAppBadge === 'function') {
        self.navigator.clearAppBadge();
    }
});
