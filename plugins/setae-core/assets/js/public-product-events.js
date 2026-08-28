(function () {
    'use strict';
    if (window.SetaeProductEvents) return;
    var config = window.SetaeProductEventsConfig || {};
    var sessionKey = 'setae.product.session';
    var anonymousCookie = 'setae_product_anonymous_id';
    var sessionCookie = 'setae_product_session_id';
    var anonymousId = '';
    var memorySession = null;
    var uuidPattern = /^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
    var events = ['public_home_viewed', 'public_partner_viewed', 'passport_viewed',
        'claim_cta_clicked', 'registration_started', 'pricing_viewed', 'app_session_started'];
    var optedOut = function () { return navigator.doNotTrack === '1' || navigator.globalPrivacyControl === true; };

    function uuid() {
        if (!window.crypto) return '';
        if (window.crypto.randomUUID) return window.crypto.randomUUID();
        if (!window.crypto.getRandomValues) return '';
        var bytes = new Uint8Array(16);
        window.crypto.getRandomValues(bytes);
        bytes[6] = (bytes[6] & 15) | 64;
        bytes[8] = (bytes[8] & 63) | 128;
        var hex = Array.from(bytes, function (value) { return value.toString(16).padStart(2, '0'); }).join('');
        return hex.slice(0, 8) + '-' + hex.slice(8, 12) + '-' + hex.slice(12, 16) + '-' + hex.slice(16, 20) + '-' + hex.slice(20);
    }

    function cookie(name) {
        try {
            var item = document.cookie.split(';').map(function (value) { return value.trim(); })
                .find(function (value) { return value.indexOf(name + '=') === 0; });
            var value = item ? decodeURIComponent(item.slice(name.length + 1)) : '';
            return uuidPattern.test(value) ? value.toLowerCase() : '';
        } catch (_) { return ''; }
    }

    function writeCookie(name, value, seconds) {
        if (!value) return;
        try {
            document.cookie = name + '=' + encodeURIComponent(value) + '; Path=/; SameSite=Lax; Max-Age=' + seconds
                + (location.protocol === 'https:' ? '; Secure' : '');
        } catch (_) { /* Tracking must not interrupt a public interaction. */ }
    }

    function context() {
        if (optedOut()) return { anonymous_id: '', session_id: '' };
        anonymousId = anonymousId || cookie(anonymousCookie) || uuid();
        writeCookie(anonymousCookie, anonymousId, 90 * 24 * 60 * 60);
        var now = Date.now();
        var day = new Date(now).toISOString().slice(0, 10);
        var session = memorySession;
        try { session = JSON.parse(sessionStorage.getItem(sessionKey) || 'null') || session; } catch (_) {}
        if (!session || !uuidPattern.test(session.id || '') || session.day !== day
            || !Number.isFinite(session.last_seen) || now - session.last_seen > 30 * 60 * 1000 || session.last_seen > now + 60000) {
            session = { id: uuid(), started_at: now, last_seen: now, day: day };
        }
        session.last_seen = now;
        memorySession = session;
        try { sessionStorage.setItem(sessionKey, JSON.stringify(session)); } catch (_) {}
        writeCookie(sessionCookie, session.id, 30 * 60);
        return { anonymous_id: anonymousId, session_id: session.id };
    }

    function endpoint() {
        try {
            var url = new URL(config.endpoint, location.href);
            return url.origin === location.origin && /^https?:$/.test(url.protocol) ? url.href : '';
        } catch (_) { return ''; }
    }

    function track(event, payload) {
        if (optedOut() || events.indexOf(event) === -1 || !config.endpoint || !endpoint() || !window.fetch) return Promise.resolve(false);
        var identity = context();
        var id = uuid();
        if (!id || !identity.anonymous_id || !identity.session_id) return Promise.resolve(false);
        var properties = { surface: config.surface || 'home' };
        payload = payload || {};
        if (typeof payload.claim_intent === 'boolean') properties.claim_intent = payload.claim_intent;
        if (typeof payload.claim_available === 'boolean') properties.claim_available = payload.claim_available;
        if (['keeper_free', 'breeder_trial', 'breeder_starter', 'legacy_premium'].indexOf(payload.plan) !== -1) properties.plan = payload.plan;
        if (config.context_token) properties.context_token = config.context_token;
        var body = JSON.stringify({ event: event, event_id: id, anonymous_id: identity.anonymous_id,
            session_id: identity.session_id, path: config.path || '', payload: properties });
        var headers = { 'Content-Type': 'application/json' };
        if (config.nonce) headers['X-WP-Nonce'] = config.nonce;
        function send(retried) {
            return window.fetch(endpoint(), { method: 'POST', credentials: 'same-origin', keepalive: true, headers: headers, body: body })
                .then(function (response) {
                    if (!response.ok && response.status >= 500 && !retried) return retry();
                    return response.ok;
                }).catch(function () { return retried ? false : retry(); });
        }
        function retry() {
            return new Promise(function (resolve) { window.setTimeout(resolve, 1000); }).then(function () { return send(true); });
        }
        // A bounded network retry sends the exact same UUID/body, never a new event.
        return send(false);
    }

    function boot() {
        var viewEvent = { home: 'public_home_viewed', partner: 'public_partner_viewed', passport: 'passport_viewed' }[config.surface];
        if (viewEvent) track(viewEvent);
        document.addEventListener('click', function (event) {
            var trigger = event.target && event.target.closest ? event.target.closest('[data-public-register]') : null;
            if (!trigger || trigger.disabled || trigger.getAttribute('aria-disabled') === 'true') return;
            var dialogId = trigger.getAttribute('aria-controls');
            var dialog = dialogId ? document.getElementById(dialogId) : document.querySelector('.setae-public-register-dialog');
            var intent = dialog && dialog.querySelector('[name="qr_claim_intent"]');
            var claim = Boolean(intent && intent.value === 'request_after_verification');
            if (claim) track('claim_cta_clicked');
            track('registration_started', { claim_intent: claim });
        });
        document.addEventListener('submit', function (event) {
            if (event.target && event.target.matches && event.target.matches('[data-setae-public-claim]')) track('claim_cta_clicked');
        });
    }

    window.SetaeProductEvents = { track: track, context: context };
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
    else boot();
}());
