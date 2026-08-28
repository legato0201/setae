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
    }
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
    assert.match(frame.renderAppRail({ page: 'community' }), /data-nav="community"/);
    const discussion = renderCommunity({ tab: 'topics', authenticated: true });
    assert.match(discussion, /data-action="new-topic"/);
    assert.match(discussion, /相談を投稿/);
    for (const tab of ['care', 'topics', 'breeding', 'species']) assert.match(discussion, new RegExp(`data-tab="${tab}"`));
    const guest = renderCommunity({ tab: 'topics', authenticated: false });
    assert.match(guest, /data-action="show-login"/);
    assert.doesNotMatch(guest, /data-action="new-topic"/);
    console.log('community-nav-demotion-unit: PASS (production rail/mobile/settings/community renderers)');
})().catch(error => { console.error(error); process.exitCode = 1; });
