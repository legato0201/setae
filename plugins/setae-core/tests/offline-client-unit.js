const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const pluginRoot = path.resolve(__dirname, '..');
let ajaxCalls = 0;
const toastMessages = [];

function jQuery() {
    return {};
}

jQuery.Deferred = function () {
    let resolvePromise;
    let rejectPromise;
    const promise = new Promise(function (resolve, reject) {
        resolvePromise = resolve;
        rejectPromise = reject;
    });
    promise.always = function (callback) {
        promise.then(callback, callback);
        return promise;
    };
    return {
        resolve: resolvePromise,
        reject: rejectPromise,
        promise: function () { return promise; }
    };
};

jQuery.ajax = function () {
    ajaxCalls += 1;
    throw new Error('Offline requests must not reach jQuery.ajax.');
};

global.window = global;
global.jQuery = jQuery;
global.navigator = { onLine: false };
global.SetaeCore = {
    state: {
        apiRoot: 'https://example.test/wp-json/setae/v1',
        nonce: 'test'
    },
    showToast: function (message) {
        toastMessages.push(message);
    }
};
global.SetaeOffline = {
    shouldUseLocal: function () { return true; },
    getSpiderDetail: function (id) {
        return Promise.resolve({ id: Number(id), title: '端末保存の個体' });
    }
};

const apiSource = fs.readFileSync(path.join(pluginRoot, 'assets/js/modules/app-api.js'), 'utf8');
vm.runInThisContext(apiSource, { filename: 'app-api.js' });

async function run() {
    const detail = await SetaeAPI.getSpiderDetail(-101);
    assert.equal(detail.id, -101);
    assert.equal(detail.title, '端末保存の個体');
    assert.equal(ajaxCalls, 0, 'Guest detail must be read without a REST request.');

    await assert.rejects(
        SetaeAPI.shareLogToCareFeed(-202),
        function (error) {
            return !!(
                error
                && error.responseJSON
                && /無料登録後にオンラインで利用できます/.test(error.responseJSON.message)
            );
        }
    );
    assert.equal(ajaxCalls, 0, 'Guest care-feed sharing must not issue a REST request.');
    assert.equal(toastMessages.length, 1);

    const detailSource = fs.readFileSync(path.join(pluginRoot, 'assets/js/modules/ui/detail.js'), 'utf8');
    assert.match(detailSource, /SetaeAPI\.getSpiderDetail\(id,/);
    assert.doesNotMatch(detailSource, /apiRoot \+ '\/spider\/' \+ id/);

    const logModalSource = fs.readFileSync(path.join(pluginRoot, 'assets/js/modules/ui/log-modal.js'), 'utf8');
    assert.match(logModalSource, /\.toggle\(canUseOnlineSharing\(\) && !!dailyStreakLogId\)/);

    const pwaSource = fs.readFileSync(path.join(pluginRoot, 'assets/js/modules/pwa-client.js'), 'utf8');
    assert.match(pwaSource, /\$profileModal\.stop\(true, true\).*\.remove\(\)/);
    assert.match(pwaSource, /通知設定を保存しました[\s\S]*closeNotificationSettings\(\)/);

    console.log('Offline client routing and online-only action tests passed');
}

run().catch(function (error) {
    console.error(error);
    process.exit(1);
});
