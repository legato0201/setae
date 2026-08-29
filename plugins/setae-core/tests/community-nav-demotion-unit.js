const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const load = file => import(pathToFileURL(path.resolve(__dirname, '..', file)).href);
const navTargets = html => [...html.matchAll(/data-nav="([^"]+)"/g)].map(match => match[1]);

(async () => {
    const frame = await load('assets/app/components/app-frame.js');
    const { renderSettings } = await load('assets/app/pages/settings.js');
    const { renderCommunity } = await load('assets/app/pages/community.js');
    for (const options of [{ authenticated: true }, { mockMode: true }]) {
        const rail = frame.renderAppRail(options);
        const main = rail.match(/<nav class="app-rail-navigation"[^>]*>([\s\S]*?)<\/nav>/)?.[1];
        assert.ok(main);
        assert.deepEqual(navTargets(main), ['today', 'animals', 'records', 'husbandry']);
        assert.doesNotMatch(main, /data-nav="community"/);
        assert.match(rail, /data-nav="settings"/);
        const mobile = frame.renderMobileNavigation(options);
        assert.equal((mobile.match(/<button\b/g) || []).length, 5, 'Keep five mobile destinations/actions');
        assert.deepEqual(navTargets(mobile), ['today', 'animals', 'records', 'husbandry']);
        assert.match(mobile, /data-action="open-record-sheet"/);
        assert.match(mobile, /aria-label="記録を追加"/);
        assert.doesNotMatch(mobile, /data-nav="community"/);
        const detailBar = frame.renderMobileAppBar({ ...options, page: 'animal-detail', pageTitle: 'TEST-0042' });
        assert.equal((detailBar.match(/data-action="back-animals"/g) || []).length, 1,
            'Detail chrome exposes one existing guarded back action.');
        assert.match(detailBar, /aria-label="前の画面に戻る"/);
        assert.match(detailBar, /<span>戻る<\/span>/);
        assert.match(detailBar, /<h2 class="setae-brand-title">個体詳細<\/h2>/);
        assert.match(detailBar, /title="TEST-0042">TEST-0042<\/span>/);
        assert.match(detailBar, /data-nav="settings"/);
        assert.doesNotMatch(frame.renderMobileAppBar({ ...options, page: 'today' }), /data-action="back-animals"/);
    }
    const escapedDetail = frame.renderMobileAppBar({ authenticated: true, page: 'animal-detail', pageTitle: '<b>TEST</b>' });
    assert.match(escapedDetail, /&lt;b&gt;TEST&lt;\/b&gt;/);
    assert.doesNotMatch(escapedDetail, /<b>TEST<\/b>/);
    const social = renderSettings({ tab: 'social', data: { relationships: {} } });
    assert.match(social, /交流を開く/);
    assert.equal(navTargets(social).filter(target => target === 'community').length, 1);
    assert.match(social, /相談・投稿・通知は引き続き利用できます/);
    assert.match(social, /フォロー中/);
    assert.match(social, /ブロック中/);
    assert.match(renderSettings({ tab: 'notifications' }), /community_messages/);
    const publicMobile = frame.renderMobileNavigation({ authenticated: false, mockMode: false, page: 'community' });
    assert.match(publicMobile, /data-nav="community"/);
    assert.match(publicMobile, /data-action="show-login"/);
    const publicBar = frame.renderMobileAppBar({ page: 'animal-detail', pendingSyncCount: 7, syncStatus: 'error' });
    assert.match(publicBar, /data-action="show-login"/);
    assert.doesNotMatch(publicBar, /back-animals|mobile-app-sync|件未同期/,
        'Public navigation must not expose authenticated back controls or retained queue counts.');
    assert.match(frame.renderAppRail({ page: 'community' }), /data-nav="community"/);
    const discussion = renderCommunity({ tab: 'topics', authenticated: true });
    assert.match(discussion, /data-action="new-topic"/);
    assert.match(discussion, /相談を投稿/);
    for (const tab of ['care', 'topics', 'breeding', 'species']) assert.match(discussion, new RegExp(`data-tab="${tab}"`));
    const guest = renderCommunity({ tab: 'topics', authenticated: false });
    assert.match(guest, /data-action="show-login"/);
    assert.doesNotMatch(guest, /data-action="new-topic"/);
    console.log('community-nav-demotion-unit: PASS (rail, five mobile actions, guarded detail back, public chrome)');
})().catch(error => { console.error(error); process.exitCode = 1; });
