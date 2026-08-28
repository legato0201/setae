const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '../assets/js/public-product-events.js'), 'utf8');
const uuidPattern = /^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
let sequence = 0;
function fixture(options = {}) {
    const cookies = options.cookies || new Map();
    const storage = options.storage || new Map();
    const calls = [], writes = [], timers = [];
    const listeners = new Map(), dialogs = new Map();
    const clock = { now: options.now || Date.parse('2026-08-28T08:00:00Z') };
    const replies = [...(options.replies || [])];
    const document = {
        readyState: options.loading ? 'loading' : 'complete',
        addEventListener(type, callback, settings) {
            const entries = listeners.get(type) || [];
            entries.push({ callback, once: Boolean(settings?.once) });
            listeners.set(type, entries);
        },
        getElementById(id) { return dialogs.get(id) || null; },
        querySelector() { return [...dialogs.values()][0] || null; },
        get cookie() {
            if (options.blockCookies) throw new Error('Cookies disabled');
            return [...cookies].map(([name, value]) => `${name}=${value}`).join('; ');
        },
        set cookie(value) {
            if (options.blockCookies) throw new Error('Cookies disabled');
            writes.push(value);
            const first = value.split(';')[0], split = first.indexOf('=');
            cookies.set(first.slice(0, split), first.slice(split + 1));
        },
    };
    class ClockDate extends Date {
        constructor(...args) { super(...(args.length ? args : [clock.now])); }
        static now() { return clock.now; }
    }
    const config = { endpoint: 'https://setae.example/wp-json/setae/v1/metrics/events', surface: 'partner',
        nonce: 'synthetic-nonce', path: '/partner/', context_token: 'signed-public-context', ...options.config };
    const window = {
        SetaeProductEventsConfig: config,
        crypto: options.noCrypto ? undefined : {
            randomUUID: options.noRandomUUID ? undefined : () => `00000000-0000-4000-8000-${String(++sequence).padStart(12, '0')}`,
            getRandomValues(bytes) { bytes.forEach((_, index) => { bytes[index] = (index + ++sequence) % 256; }); return bytes; },
        },
        setTimeout(callback, delay) { timers.push({ callback, delay }); return timers.length; },
        fetch: options.noFetch ? undefined : (url, request) => {
            calls.push({ url, request, body: JSON.parse(request.body) });
            const next = replies.length ? replies.shift() : { ok: true, status: 202 };
            return next instanceof Error ? Promise.reject(next) : Promise.resolve(next);
        },
    };
    const context = vm.createContext({
        window, document, URL, Uint8Array, Promise, Date: ClockDate,
        location: { href: 'https://setae.example/partner/?email=private@example.test#secret', origin: 'https://setae.example', protocol: 'https:' },
        navigator: { doNotTrack: options.dnt ? '1' : '0', globalPrivacyControl: Boolean(options.gpc) },
        sessionStorage: {
            getItem(key) { if (options.blockStorage) throw new Error('Storage disabled'); return storage.get(key) || null; },
            setItem(key, value) { if (options.blockStorage) throw new Error('Storage disabled'); storage.set(key, value); },
        },
    });
    vm.runInContext(source, context);
    return {
        api: window.SetaeProductEvents, calls, writes, timers, cookies, storage, clock, config, dialogs, listeners,
        runAgain() { vm.runInContext(source, context); },
        emit(type, event) {
            const entries = listeners.get(type) || [];
            listeners.set(type, entries.filter(entry => !entry.once));
            entries.forEach(entry => entry.callback(event));
        },
        timer() { const timer = timers.shift(); assert.ok(timer, 'Expected a scheduled retry'); timer.callback(); return timer.delay; },
    };
}
const settle = async () => { for (let i = 0; i < 8; i += 1) await Promise.resolve(); };
const plain = value => JSON.parse(JSON.stringify(value));

(async () => {
    const page = fixture();
    assert.equal(page.calls.length, 1);
    assert.equal(page.calls[0].body.event, 'public_partner_viewed');
    for (const key of ['event_id', 'anonymous_id', 'session_id']) assert.match(page.calls[0].body[key], uuidPattern);
    assert.equal(page.calls[0].request.credentials, 'same-origin');
    assert.equal(page.calls[0].request.keepalive, true);
    assert.equal(page.calls[0].request.headers['X-WP-Nonce'], 'synthetic-nonce');
    assert.equal(page.calls[0].body.path, '/partner/');
    assert.deepEqual(page.calls[0].body.payload, { surface: 'partner', context_token: 'signed-public-context' });
    assert.ok(!page.calls[0].request.body.includes('private@example.test'));
    assert.ok(page.writes.every(value => value.includes('; Path=/; SameSite=Lax; Max-Age=') && value.endsWith('; Secure')));
    assert.ok(page.writes.some(value => value.startsWith('setae_product_anonymous_id=') && value.includes('Max-Age=7776000')));
    assert.ok(page.writes.some(value => value.startsWith('setae_product_session_id=') && value.includes('Max-Age=1800')));
    page.runAgain();
    assert.equal(page.calls.length, 1, 'Double script evaluation must not register another view event');
    assert.equal(page.listeners.get('click').length, 1);

    await page.api.track('registration_started', { claim_intent: true, email: 'never-store@example.test',
        password: 'private-password', memo: 'private note', source: 'invented', qr_code: 'manage-secret',
        partner_user_id: 99, user_id: 99, plan_id: 'legacy_premium' });
    const registration = page.calls.at(-1).body;
    assert.deepEqual(registration.payload, { surface: 'partner', claim_intent: true, context_token: 'signed-public-context' });
    assert.ok(!JSON.stringify(registration).includes('never-store@'));
    assert.ok(!JSON.stringify(registration).includes('manage-secret'));
    assert.ok(!('user_id' in registration) && !('partner_user_id' in registration) && !('plan_id' in registration));
    const before = page.calls.length;
    assert.equal(await page.api.track('subscription_started', {}), false, 'Public helper may not emit authoritative business events');
    assert.equal(await page.api.track('D1', {}), false, 'Retention is computed, never client-supplied');
    assert.equal(page.calls.length, before);

    const initial = plain(page.api.context());
    const persisted = JSON.parse(page.storage.get('setae.product.session'));
    assert.deepEqual(Object.keys(persisted).sort(), ['day', 'id', 'last_seen', 'started_at']);
    assert.equal(persisted.day, '2026-08-28');
    page.clock.now += 20 * 60 * 1000;
    assert.deepEqual(plain(page.api.context()), initial, 'Normal interaction preserves the current session');
    const reload = fixture({ cookies: page.cookies, storage: page.storage, now: page.clock.now, config: { surface: 'home', path: '/' } });
    assert.deepEqual(plain(reload.api.context()), initial, 'Reload preserves the anonymous and session identities');
    assert.equal(reload.calls[0].body.event, 'public_home_viewed');
    reload.clock.now += 31 * 60 * 1000;
    const resumed = plain(reload.api.context());
    assert.equal(resumed.anonymous_id, initial.anonymous_id);
    assert.notEqual(resumed.session_id, initial.session_id, 'Thirty minutes of inactivity starts a new session');
    reload.clock.now = Date.parse('2026-08-29T00:00:01Z');
    assert.notEqual(reload.api.context().session_id, resumed.session_id, 'A new UTC day must be independently measurable');
    const blocked = fixture({ blockStorage: true, blockCookies: true });
    const fallback = plain(blocked.api.context());
    assert.match(fallback.anonymous_id, uuidPattern);
    assert.deepEqual(plain(blocked.api.context()), fallback, 'Storage denial degrades to stable in-memory identity');
    assert.equal(blocked.calls.length, 1);
    const corrupt = fixture({ cookies: new Map([['setae_product_anonymous_id', 'email%40example.test']]),
        storage: new Map([['setae.product.session', '{malformed']]) });
    assert.match(corrupt.api.context().anonymous_id, uuidPattern);
    assert.ok(!corrupt.calls[0].request.body.includes('email@example.test'));
    assert.match(fixture({ noRandomUUID: true }).calls[0].body.event_id, uuidPattern, 'Secure getRandomValues supplies a UUID fallback');
    assert.equal(fixture({ noCrypto: true }).calls.length, 0, 'Do not invent an insecure random fallback');
    for (const privacy of [{ dnt: true }, { gpc: true }]) {
        const optedOut = fixture(privacy);
        assert.equal(optedOut.calls.length, 0);
        assert.equal(optedOut.writes.length, 0);
        assert.equal(optedOut.storage.size, 0);
        assert.deepEqual(plain(optedOut.api.context()), { anonymous_id: '', session_id: '' });
        assert.equal(await optedOut.api.track('public_home_viewed'), false);
    }
    for (const endpoint of ['https://external.example/collect', 'javascript:alert(1)', 'data:text/plain,private', '']) {
        const external = fixture({ config: { endpoint } });
        assert.equal(external.calls.length, 0, 'Only the configured same-origin HTTP endpoint may receive data');
        assert.equal(external.writes.length, 0, 'A disabled endpoint should not allocate tracking identifiers');
    }
    assert.equal(fixture({ noFetch: true }).calls.length, 0);

    const retry = fixture({ config: { surface: 'none' }, replies: [{ ok: false, status: 503 }, { ok: true, status: 202 }] });
    const retryResult = retry.api.track('pricing_viewed', { plan: 'breeder_starter' });
    await settle();
    assert.equal(retry.calls.length, 1);
    assert.equal(retry.timer(), 1000);
    assert.equal(await retryResult, true);
    assert.equal(retry.calls.length, 2);
    assert.equal(retry.calls[0].request.body, retry.calls[1].request.body, 'A retry must keep the exact original event ID and body');
    assert.equal(retry.timers.length, 0);
    const network = fixture({ config: { surface: 'none' }, replies: [new Error('offline'), new Error('offline again')] });
    const failure = network.api.track('passport_viewed');
    await settle(); network.timer();
    assert.equal(await failure, false);
    assert.equal(network.calls.length, 2);
    assert.equal(network.timers.length, 0, 'Network failure cannot produce an unbounded retry loop');
    const throttled = fixture({ config: { surface: 'none' }, replies: [{ ok: false, status: 429 }] });
    assert.equal(await throttled.api.track('public_home_viewed'), false);
    assert.equal(throttled.calls.length, 1);
    assert.equal(throttled.timers.length, 0, 'Do not retry an abuse throttle response');

    const delayed = fixture({ loading: true, config: { surface: 'passport', path: '/s/:code/' } });
    assert.equal(delayed.calls.length, 0);
    delayed.emit('DOMContentLoaded', {});
    delayed.emit('DOMContentLoaded', {});
    assert.equal(delayed.calls.length, 1, 'DOMContentLoaded can produce only one view measurement');
    assert.equal(delayed.calls[0].body.event, 'passport_viewed');
    assert.equal(delayed.calls[0].body.path, '/s/:code/');
    const dialog = { querySelector(selector) {
        assert.equal(selector, '[name="qr_claim_intent"]', 'The tracker may inspect intent only, never registration values');
        return { value: 'request_after_verification' };
    } };
    delayed.dialogs.set('claim-registration', dialog);
    const trigger = { disabled: false, getAttribute(name) { return name === 'aria-controls' ? 'claim-registration' : null; } };
    const click = { target: { closest(selector) { assert.equal(selector, '[data-public-register]'); return trigger; } } };
    delayed.emit('click', click);
    assert.deepEqual(delayed.calls.slice(1).map(call => call.body.event), ['claim_cta_clicked', 'registration_started']);
    assert.equal(delayed.calls.at(-1).body.payload.claim_intent, true);
    trigger.disabled = true;
    delayed.emit('click', click);
    assert.equal(delayed.calls.length, 3, 'Disabled registration triggers must not be counted');
    delayed.emit('submit', { target: { matches(selector) { return selector === '[data-setae-public-claim]'; } } });
    assert.equal(delayed.calls.at(-1).body.event, 'claim_cta_clicked', 'Logged-in claim forms retain CTA measurement');
    delayed.emit('submit', { target: { matches() { return false; } } });
    assert.equal(delayed.calls.length, 4);
    const regular = fixture({ config: { surface: 'none' } });
    regular.dialogs.set('normal', { querySelector() { return null; } });
    regular.emit('click', { target: { closest() { return { getAttribute() { return null; } }; } } });
    assert.deepEqual(regular.calls.map(call => call.body.event), ['registration_started'], 'A normal registration is not a claim CTA');
    assert.equal(regular.calls[0].body.payload.claim_intent, false);
    assert.ok(!page.calls.some(call => call.body.event === 'app_session_started'), 'SPA session startup belongs to the SPA controller');
    console.log('product-events-client-unit: PASS (real public helper executed in VM; identity/privacy/retry/CTA cases)');
})().catch(error => { console.error(error); process.exitCode = 1; });
