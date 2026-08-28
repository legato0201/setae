const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const root = path.resolve(__dirname, '..');
const load = file => import(pathToFileURL(path.join(root, file)).href);
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const plain = value => JSON.parse(JSON.stringify(value));
const actionCount = (html, action) => html.split(`data-action="${action}"`).length - 1;

(async () => {
    const model = await load('assets/app/features/onboarding/model.js');
    const view = await load('assets/app/features/onboarding/view.js');
    const arrival = await load('assets/app/features/onboarding/arrival.js');
    const { renderToday } = await load('assets/app/pages/today.js');
    const { renderCollection } = await load('assets/app/pages/collection.js');
    const empty = model.deriveOnboardingProgress();
    assert.deepEqual(plain(empty), { collectionRegistered: false, firstRecordAdded: false, completed: 0, required: 2, complete: false });
    assert.equal(model.shouldShowGettingStarted({ setupCompleted: false, progress: empty }), true, 'Style setup cannot gate the first action');
    const emptySurfaces = [
        view.renderStartChoices(),
        renderToday({ animals: [], records: [], summary: {}, dashboard: { sections: [] }, taskQueueVisible: false, onboardingProgress: empty }),
        renderCollection({ animals: [], babyGroups: { items: [] } }),
    ];
    for (const html of emptySurfaces) {
        assert.equal(actionCount(html, 'start-qr-acquisition'), 1, 'The empty surface must offer the real QR route once');
        assert.equal(actionCount(html, 'add-animal'), 1, 'The empty surface must offer the real manual route once');
        assert.match(html, /QRから個体を引き継ぐ/);
        assert.match(html, /自分で個体を登録する/);
        assert.match(html, /後からMy SETAE/);
        assert.doesNotMatch(html, /data-action="finish-setae-setup"|data-action="setae-setup-next"/);
    }
    assert.doesNotMatch(renderCollection({ loading: true }), /data-acquisition-start/, 'Do not replace loading with a false empty state');
    assert.doesNotMatch(renderCollection({ animals: [{ id: 1, title: 'T001' }] }), /data-acquisition-start/);
    const owned = { targetType: 'animal', animal: { id: 1 }, event: { recorded_by_current_user: true } };
    const inherited = { targetType: 'animal', animal: { id: 1 }, event: { recorded_by_current_user: false } };
    assert.equal(model.deriveOnboardingProgress({ animals: [{ id: 1 }], records: [inherited] }).complete, false, 'Inherited history is not the recipient\'s first record');
    assert.equal(model.deriveOnboardingProgress({ animals: [{ id: 1 }], records: [{ targetType: 'enclosure', event: { recorded_by_current_user: true } }] }).complete, false, 'Enclosure history alone cannot satisfy the managed-animal activation rule');
    assert.equal(model.deriveOnboardingProgress({ animals: [{ id: 1 }], records: [{ id: 999 }] }).complete, false, 'Unknown recorder provenance cannot establish a first personal record');
    assert.equal(model.deriveOnboardingProgress({ animals: [{ id: 1 }], records: [owned] }).complete, true);
    assert.equal(model.deriveOnboardingProgress({ animals: [{ id: 1 }], firstRecordAt: '2026-08-28T00:00:00Z' }).complete, true, 'Server first-record metadata survives truncated recent-history lists');
    assert.equal(model.deriveOnboardingProgress({ babyGroups: { items: [{ id: 4, events: [{ recorded_by_current_user: true }] }] } }).complete, true);
    assert.equal(model.deriveOnboardingProgress({ babyGroups: { items: [{ id: 4, archived: true, events: [{ recorded_by_current_user: true }] }] } }).complete, false);
    const complete = model.deriveOnboardingProgress({ animals: [{ id: 1 }], records: [owned] });
    const completion = model.completeOnboardingIfNeeded({}, complete);
    assert.equal(completion.announced, true);
    assert.equal(model.completeOnboardingIfNeeded(completion.state, complete).announced, false);
    assert.equal(model.shouldShowGettingStarted({ progress: complete }), false);

    const now = Date.parse('2026-08-28T12:00:00Z');
    const recent = { id: 10, title: '受領した個体', acquisition_source: 'transfer_received', received_at: '2026-08-27T12:00:00Z' };
    const stored = new Map();
    const storage = { getItem: key => stored.get(key) || null, setItem: (key, value) => stored.set(key, value) };
    const base = { animals: [recent], ownerId: 7, records: [], now, storage };
    let checklist = arrival.deriveArrivalChecklist(base);
    assert.equal(checklist.animal, recent);
    assert.equal(checklist.viewed, false);
    assert.equal(checklist.recorded, false);
    arrival.markArrivalViewed(10, 7, storage);
    assert.equal(arrival.deriveArrivalChecklist(base).viewed, true);
    assert.equal(arrival.deriveArrivalChecklist({ ...base, ownerId: 8 }).viewed, false, 'Arrival progress must be scoped to the recipient');
    const records = [
        { animal: { id: 10 }, event: { recorded_by_current_user: false, created_at: '2026-08-28T01:00:00Z', image: 'inherited.jpg' } },
        { animal: { id: 10 }, event: { recorded_by_current_user: true, created_at: '2026-08-20T01:00:00Z', image: 'before-receipt.jpg' } },
        { animal: { id: 11 }, event: { recorded_by_current_user: true, created_at: '2026-08-28T01:00:00Z', image: 'other.jpg' } },
    ];
    checklist = arrival.deriveArrivalChecklist({ ...base, records });
    assert.equal(checklist.recorded, false);
    assert.equal(checklist.photographed, false);
    records.push({ animal: { id: 10 }, event: { recorded_by_current_user: true, created_at: '2026-08-28T02:00:00Z' } });
    checklist = arrival.deriveArrivalChecklist({ ...base, records, notifications: true });
    assert.equal(checklist.recorded, true);
    assert.equal(checklist.photographed, false);
    assert.equal(checklist.scheduled, true);
    records.push({ animal: { id: 10 }, event: { recorded_by_current_user: true, created_at: '2026-08-28T03:00:00Z', data: { image_url: 'local-photo.jpg' } } });
    assert.equal(arrival.deriveArrivalChecklist({ ...base, records }).photographed, true);
    assert.equal(arrival.deriveArrivalChecklist({ ...base, now: Date.parse('2026-09-03T12:00:00Z') }), null, 'Seven elapsed days end the arrival checklist');
    assert.equal(arrival.deriveArrivalChecklist({ ...base, animals: [{ ...recent, received_at: '2026-09-01T00:00:00Z' }] }), null, 'Future receipts are not an arrival');
    assert.equal(arrival.deriveArrivalChecklist({ ...base, animals: [{ ...recent, acquisition_source: 'manual' }] }), null);
    assert.doesNotThrow(() => arrival.markArrivalViewed(10, 7, { setItem() { throw new Error('blocked'); } }));
    const rendered = arrival.renderArrivalChecklist({ ...base, animals: [{ ...recent, title: '<script>bad</script>' }], records });
    assert.equal(actionCount(rendered, 'open-arrival-animal'), 1);
    assert.equal(actionCount(rendered, 'smart-quick-record'), 2);
    assert.equal(actionCount(rendered, 'open-onboarding-notifications'), 1);
    assert.match(rendered, /受け取ってから7日間/);
    assert.doesNotMatch(rendered, /<script>bad<\/script>/);
    assert.match(rendered, /&lt;script&gt;/);
    const app = read('assets/app/app.js');
    assert.match(app, /firstRecordAt:\s*state\.settings\.profile\?\.onboarding\?\.first_record_at/);
    assert.doesNotMatch(app, /state\.setupOpen\s*=\s*!state\.personalization\.setupCompleted/);
    assert.match(app, /action === 'start-qr-acquisition'/);
    assert.match(app, /action === 'open-arrival-animal'/);
    console.log('monetization-onboarding-unit: PASS (production model/views; two choices, optional setup, provenance, arrival)');
})().catch(error => { console.error(error); process.exitCode = 1; });
