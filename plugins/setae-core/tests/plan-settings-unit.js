const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const load = file => import(pathToFileURL(path.resolve(__dirname, '..', file)).href);
const buttonTag = (html, action) => html.match(new RegExp(`<button\\b[^>]*data-action="${action}"[^>]*>`))?.[0] || '';
const dataKey = selector => selector.match(/^\[data-([a-z-]+)\]$/)?.[1].replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());

// Small observable DOM contract double; actual focus/selection is tested in the browser suite.
class Element {
    constructor(document) { this.ownerDocument = document; this.dataset = {}; this.children = []; this.attributes = {}; this.isConnected = true; this.disabled = false; this.hidden = false; this.writes = 0; }
    append(node) { this.children.push(node); node.parentElement = this; node.isConnected = true; }
    setAttribute(name, value) { this.attributes[name] = value; }
    getAttribute(name) { return this.attributes[name] ?? null; }
    querySelector(selector) {
        const key = dataKey(selector);
        for (const node of this.children) {
            if (key && key in node.dataset) return node;
            const nested = node.querySelector?.(selector); if (nested) return nested;
        }
        return null;
    }
    closest(selector) { const key = dataKey(selector); return key && key in this.dataset ? this : this.parentElement?.closest(selector) || null; }
    get innerHTML() { return this.html || ''; }
    set innerHTML(value) { this.writes++; this.html = value; this.children.forEach(node => { node.isConnected = false; }); this.children = []; }
    insertAdjacentHTML(position, value) {
        assert.equal(position, 'beforeend'); this.html = (this.html || '') + value;
        if (value.includes('data-plan-pricing')) { const node = new Element(this.ownerDocument); node.dataset.planPricing = ''; this.append(node); }
    }
    remove() { this.isConnected = false; if (this.parentElement) this.parentElement.children = this.parentElement.children.filter(node => node !== this); }
}
const makeButton = gate => { const button = new Element(gate.ownerDocument); gate.append(button); return button; };
const profileFor = (id, extra = {}) => ({
    plan: { id, status: id === 'breeder_trial' ? 'trialing' : 'active', trial_available: id === 'keeper_free',
        billing_available: false, trial_ends_at: '2026-09-20T00:00:00Z', price_label: '月額1,480円', ...extra },
    inventory: { active_slot_bearing: 8, received_exempt: 12, limit: id === 'legacy_premium' ? -1 : id === 'breeder_starter' ? 100 : id === 'breeder_trial' ? 20 : 8,
        remaining: id === 'legacy_premium' ? -1 : 0 },
    nursery: { active_groups: 1, limit: id === 'legacy_premium' ? -1 : id === 'breeder_starter' ? 10 : 1 },
    entitlements: { label_batch_limit: id === 'legacy_premium' ? -1 : id === 'breeder_starter' ? 100 : 20 },
    trial: { promoted_count: 3 },
});

(async () => {
    const { renderPlanSettings, trialDaysRemaining } = await load('assets/app/features/settings/plan.js');
    const { createPlanController, isPlanError, planErrorMessage } = await load('assets/app/features/settings/plan-controller.js');
    assert.equal(trialDaysRemaining('2026-08-30T00:00:00Z', Date.parse('2026-08-28T00:00:00Z')), 2);
    assert.equal(trialDaysRemaining('2026-08-01T00:00:00Z', Date.parse('2026-08-28T00:00:00Z')), 0);
    assert.match(renderPlanSettings({}), /role="status"/);
    for (const id of ['keeper_free', 'breeder_trial', 'breeder_starter', 'legacy_premium']) {
        const html = renderPlanSettings(profileFor(id));
        assert.match(html, /QRで受け取った個体/);
        assert.match(html, /12匹（登録枠の対象外）/);
        assert.match(html, /ベビー群/);
        assert.match(html, /1回のラベル出力/);
        assert.doesNotMatch(html, /NaN|undefined|>\s*-1(?:匹|件|群)/);
        assert.match(buttonTag(html, 'billing-checkout'), /\bdisabled\b/);
        assert.match(html, /現在準備中/);
        assert.equal(Boolean(buttonTag(html, 'start-breeder-trial')), id === 'keeper_free');
        if (id === 'breeder_trial') assert.match(html, /累計3 \/ 20匹/);
        if (id === 'legacy_premium') { assert.match(html, /無制限/); assert.doesNotMatch(html, /無制限(?:匹|件|群)/); }
    }
    assert.doesNotMatch(buttonTag(renderPlanSettings(profileFor('keeper_free', { billing_available: true })), 'billing-checkout'), /\bdisabled\b/);
    const configured = profileFor('breeder_trial', { starter_limits: { specimens: 150, nursery_groups: 12, label_batch: 80 }, trial_limits: { promotions: 25 } });
    const configuredHtml = renderPlanSettings(configured);
    assert.match(configuredHtml, /手動登録・個体化150匹、ベビー群12群、1回のラベル出力80件/);
    assert.match(configuredHtml, /累計3 \/ 25匹/, 'Displayed trial totals must follow the server limit configuration');
    assert.match(renderPlanSettings(profileFor('breeder_starter', { status: 'past_due', grace_until: '2026-09-01T00:00:00Z' })), /支払い猶予|既存データは削除されません/);
    const over = profileFor('keeper_free'); over.inventory.over_limit = true;
    assert.match(renderPlanSettings(over), /閲覧・編集・記録・エクスポート/);
    const unsafe = profileFor('keeper_free', { price_label: '<img src=x onerror=alert(1)>' });
    assert.doesNotMatch(renderPlanSettings(unsafe), /<img src=x/);

    for (const code of ['manual_specimen_limit', 'nursery_group_limit', 'trial_required', 'trial_expired', 'trial_promotion_limit', 'trial_unavailable', 'label_batch_limit', 'plan_required', 'billing_past_due', 'qr_label_resource_limit']) {
        assert.equal(isPlanError({ code: `setae_${code}` }), true, 'Use real REST prefixed codes');
        assert.equal(isPlanError({ code }), true, 'Keep the pre-existing normalized caller contract');
        assert.ok(planErrorMessage({ code: `setae_${code}` }).length > 10);
    }
    assert.equal(isPlanError({ code: 'setae_field_validation' }), false);
    const document = { activeElement: null, createElement() { return new Element(document); } };
    const root = new Element(document), form = new Element(document);
    form.dataset.role = 'animal-form'; root.append(form);
    const input = { value: '編集中の個体名', selectionStart: 2, selectionEnd: 4, files: [{ name: 'local-photo.png' }], isConnected: true,
        focus(options) { assert.equal(options.preventScroll, true); document.activeElement = input; } };
    document.activeElement = input;
    let profile = profileFor('keeper_free'), mock = false, renders = 0, trials = 0, releaseTrial;
    const notices = [], metrics = [], redirects = [];
    let billingUrl = 'https://checkout.stripe.com/c/pay/synthetic-fixture';
    globalThis.location = { pathname: '/app/', assign: value => redirects.push(value) };
    const services = {
        app: { metric: async (...args) => metrics.push(args) },
        account: { get: async () => profileFor('breeder_trial') },
        integrations: {
            startTrial: () => { trials++; return new Promise(resolve => { releaseTrial = resolve; }); },
            checkout: async () => ({ url: billingUrl }), portal: async () => ({ url: billingUrl }),
        },
    };
    const controller = createPlanController({ root, services, getProfile: () => profile, setProfile: value => { profile = value; },
        render: () => { renders++; }, notify: (...args) => notices.push(args), mock: () => mock });
    const original = JSON.stringify(input);
    assert.equal(controller.showError({ code: 'setae_manual_specimen_limit', data: { trial_available: true } }, form, { returnFocus: input }), true);
    const gate = form.querySelector('[data-plan-gate]');
    assert.ok(gate);
    assert.equal(gate.getAttribute('role'), 'alert');
    assert.match(gate.innerHTML, /QRからの受領は登録枠を使いません/);
    assert.match(gate.innerHTML, /入力内容と選択は保持/);
    assert.match(gate.innerHTML, /start-breeder-trial/);
    assert.equal(form.writes, 0);
    assert.equal(document.activeElement, input);
    assert.equal(JSON.stringify(input), original, 'A plan error must not mutate draft values, photo or selection');
    assert.equal(controller.showError({ code: 'setae_label_batch_limit', data: {} }, form), true);
    assert.equal(form.querySelector('[data-plan-gate]'), gate, 'Reuse the same gate, not a second form or duplicate notice');
    assert.match(gate.innerHTML, /選択数を減らす/);
    assert.equal(await controller.handleAction('view-breeder-starter', makeButton(gate)), true);
    assert.equal(gate.querySelector('[data-plan-pricing]').hidden, false);
    assert.equal(metrics[0][0], 'pricing_viewed');
    assert.equal(document.activeElement, input);
    const start = makeButton(gate);
    const pending = controller.handleAction('start-breeder-trial', start);
    assert.equal(start.disabled, true);
    await controller.handleAction('start-breeder-trial', start);
    assert.equal(trials, 1, 'Repeated clicks must not start multiple trial requests');
    releaseTrial(); await pending;
    assert.equal(profile.plan.id, 'breeder_trial');
    assert.equal(gate.getAttribute('role'), 'status');
    assert.match(gate.innerHTML, /もう一度操作を実行してください/);
    assert.equal(renders, 0, 'An active editing form must not be rerendered after trial start');
    assert.equal(JSON.stringify(input), original);
    assert.equal(document.activeElement, input);
    await controller.handleAction('dismiss-plan-gate', makeButton(gate));
    assert.equal(form.querySelector('[data-plan-gate]'), null);
    mock = true;
    await controller.handleAction('start-breeder-trial', new Element(document));
    await controller.handleAction('billing-checkout', new Element(document));
    assert.equal(trials, 1);
    assert.equal(redirects.length, 0, 'Mock mode may never initiate checkout');
    mock = false;
    billingUrl = 'http://checkout.stripe.com/insecure';
    await controller.handleAction('billing-checkout', new Element(document));
    assert.equal(redirects.length, 0);
    assert.equal(notices.at(-1)[1], 'error');
    billingUrl = 'https://checkout.stripe.com/c/pay/synthetic-fixture';
    await controller.handleAction('billing-checkout', new Element(document));
    assert.deepEqual(redirects, [billingUrl]);
    assert.equal(await controller.handleAction('not-a-plan-action', new Element(document)), false);
    console.log('plan-settings-unit: PASS (production plan render/controller; real REST codes and preserved editing contract)');
})().catch(error => { console.error(error); process.exitCode = 1; });
