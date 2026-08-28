const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const pluginRoot = path.resolve(__dirname, '..');
const projectRoot = path.resolve(pluginRoot, '../../..');

function jQueryStub() {
    return {
        ready: function () { return this; }
    };
}

global.window = global;
global.document = {};
global.jQuery = jQueryStub;
global.SetaeSettings = {
    guest_mode: true,
    current_user: {
        spider_limit: 8,
        spider_count: 8
    }
};

const addSpiderSource = fs.readFileSync(
    path.join(pluginRoot, 'assets/js/modules/ui/add-spider.js'),
    'utf8'
);
vm.runInThisContext(addSpiderSource, { filename: 'add-spider.js' });

assert.deepEqual(SetaeUIAddSpider._getRegistrationLimitState(), {
    limit: 8,
    count: 8,
    reached: true
});

SetaeSettings.current_user.spider_count = 7;
assert.equal(SetaeUIAddSpider._getRegistrationLimitState().reached, false);

SetaeSettings.current_user.spider_count = 200;
SetaeSettings.current_user.spider_limit = -1;
assert.equal(
    SetaeUIAddSpider._getRegistrationLimitState().reached,
    false,
    'Premium accounts must remain unlimited.'
);

const initStart = addSpiderSource.indexOf('function init()');
const guestPrompt = addSpiderSource.indexOf(
    'promptGuestLimitRegistration(limitState.limit)',
    initStart
);
const modalOpen = addSpiderSource.indexOf(
    "$('#modal-add-spider').fadeIn(200)",
    initStart
);
assert.ok(guestPrompt > initStart && guestPrompt < modalOpen);
assert.match(
    addSpiderSource,
    /if \(isGuestMode\(\)\)[\s\S]*?promptGuestLimitRegistration\(limitState\.limit\);[\s\S]*?return;/
);
assert.match(
    addSpiderSource,
    /登録後に、プレミアムプランやボーナス枠を選べます/
);

const pwaSource = fs.readFileSync(
    path.join(pluginRoot, 'assets/js/modules/pwa-client.js'),
    'utf8'
);
assert.match(pwaSource, /function promptGuestRegistration\(options\)/);
assert.match(pwaSource, /SetaeCore\.confirmAction\(\{/);
assert.match(pwaSource, /promptGuestRegistration: promptGuestRegistration/);

const coreSource = fs.readFileSync(path.join(pluginRoot, 'setae-core.php'), 'utf8');
assert.match(coreSource, /define\('SETAE_DEFAULT_FREE_SPIDER_LIMIT', 8\);/);

const themeSource = fs.readFileSync(
    path.join(projectRoot, 'wp-content/themes/setae-theme/index.php'),
    'utf8'
);
assert.match(
    themeSource,
    /get_option\('setae_free_spider_limit', \$default_free_spider_limit\)/
);
assert.match(themeSource, /登録なしで<\?php echo esc_html\(\$free_spider_limit\); \?>匹まで/);
assert.doesNotMatch(themeSource, /登録なしで5匹|5匹までこの端末に保存/);

console.log('Guest registration limit tests passed');
