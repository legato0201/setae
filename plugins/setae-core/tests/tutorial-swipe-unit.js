const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const pluginRoot = path.resolve(__dirname, '..');

function createClassList() {
    const values = new Set();
    return {
        add: function (...names) { names.forEach(function (name) { values.add(name); }); },
        remove: function (...names) { names.forEach(function (name) { values.delete(name); }); },
        toggle: function (name, force) {
            if (force === undefined) force = !values.has(name);
            if (force) values.add(name);
            else values.delete(name);
        },
        contains: function (name) { return values.has(name); }
    };
}

function createStyle() {
    return {
        setProperty: function (name, value) { this[name] = value; },
        removeProperty: function (name) { delete this[name]; }
    };
}

function createElement() {
    return {
        className: '',
        classList: createClassList(),
        dataset: {},
        style: createStyle(),
        children: [],
        setAttribute: function () {},
        append: function (...children) { this.children.push(...children); },
        replaceChildren: function (...children) { this.children = children; }
    };
}

const documentStub = {
    createElement: createElement,
    activeElement: null
};

function jQueryStub(target) {
    return {
        ready: function () { return this; },
        data: function (name) {
            return target && target.dataset ? target.dataset[name] : undefined;
        },
        find: function () {
            return {
                css: function () { return this; },
                removeClass: function () { return this; }
            };
        }
    };
}

global.window = global;
global.document = documentStub;
global.jQuery = jQueryStub;
global.$ = jQueryStub;
global.navigator = { vibrate: function () {} };
global.SetaeCore = { state: { cachedSpiders: [] } };
global.SetaeSettings = { guest_mode: true };

const content = createElement();
const leftBackground = createElement();
const rightBackground = createElement();
const row = createElement();
row.dataset = {
    id: '-101',
    status: 'normal',
    classification: 'tarantula',
    prey: 'コオロギ'
};
row.querySelector = function (selector) {
    if (selector === '.setae-list-content') return content;
    if (selector === '.swipe-left') return leftBackground;
    if (selector === '.swipe-right') return rightBackground;
    return null;
};

const actionsSource = fs.readFileSync(path.join(pluginRoot, 'assets/js/modules/ui/actions.js'), 'utf8');
vm.runInThisContext(actionsSource, { filename: 'actions.js' });

SetaeUIActions.handleTouchStart.call(row, {
    originalEvent: {
        touches: [{ clientX: 220, clientY: 180 }]
    }
});

let prevented = false;
SetaeUIActions.handleTouchMove({
    touches: [{ clientX: 170, clientY: 182 }],
    preventDefault: function () { prevented = true; }
});

assert.equal(prevented, true, 'A horizontal swipe should prevent native horizontal panning.');
assert.match(
    content.style.transform,
    /translate3d\(-42px, 0, 0\)/,
    'The swipe should start from the jQuery originalEvent coordinate without jumping.'
);
assert.equal(row.classList.contains('is-swipe-active'), true);

const queuedFrames = [];
let nextFrameId = 1;
global.requestAnimationFrame = function (callback) {
    const frame = { id: nextFrameId++, callback: callback, canceled: false };
    queuedFrames.push(frame);
    return frame.id;
};
global.cancelAnimationFrame = function (frameId) {
    const frame = queuedFrames.find(function (item) { return item.id === frameId; });
    if (frame) frame.canceled = true;
};

SetaeUIActions.handleTouchMove({
    touches: [{ clientX: 160, clientY: 183 }],
    preventDefault: function () {}
});
SetaeUIActions.handleTouchMove({
    touches: [{ clientX: 140, clientY: 183 }],
    preventDefault: function () {}
});

assert.equal(queuedFrames.length, 1, 'Multiple touch events should be coalesced into one animation frame.');
assert.match(content.style.transform, /translate3d\(-42px, 0, 0\)/);
queuedFrames[0].callback();
assert.match(
    content.style.transform,
    /translate3d\(-67\.2px, 0, 0\)/,
    'The animation frame should render the latest touch position.'
);

const tutorialSource = fs.readFileSync(path.join(pluginRoot, 'assets/js/modules/app-tutorial.js'), 'utf8');
vm.runInThisContext(tutorialSource, { filename: 'app-tutorial.js' });

const viewport = {
    left: 0,
    top: 0,
    right: 390,
    bottom: 844,
    width: 390,
    height: 844
};
const tooltip = { width: 360, height: 210 };

const nearBottom = SetaeTutorial._calculateTooltipPlacement({
    left: 20,
    right: 370,
    top: 700,
    bottom: 760,
    width: 350,
    height: 60
}, tooltip, viewport, 'bottom');
assert.equal(nearBottom.position, 'top');
assert.ok(nearBottom.top >= 14);
assert.ok(nearBottom.top + tooltip.height <= viewport.bottom - 14);

const nearTop = SetaeTutorial._calculateTooltipPlacement({
    left: 40,
    right: 350,
    top: 18,
    bottom: 70,
    width: 310,
    height: 52
}, tooltip, viewport, 'top');
assert.equal(nearTop.position, 'bottom');
assert.ok(nearTop.left >= 14);
assert.ok(nearTop.left + nearTop.width <= viewport.right - 14);

const centered = SetaeTutorial._calculateCenteredTooltipPosition(viewport);
assert.deepEqual(centered, { left: 195, top: 422 });

const tutorialCss = fs.readFileSync(path.join(pluginRoot, 'assets/css/modules/tutorial.css'), 'utf8');
assert.match(tutorialCss, /#setae-tutorial-tooltip\s*\{[\s\S]*?position:\s*fixed;/);

const mySpidersCss = fs.readFileSync(path.join(pluginRoot, 'assets/css/modules/my-spiders.css'), 'utf8');
assert.match(
    mySpidersCss,
    /\.is-guest-trial #section-my-detail \.setae-fab-record\s*\{[\s\S]*?position:\s*static;/
);
assert.match(mySpidersCss, /touch-action:\s*pan-y pinch-zoom;/);
const listContentRule = mySpidersCss.match(
    /#section-my #setae-spider-list > \.setae-spider-list-row \.setae-list-content\s*\{([\s\S]*?)\n\}/
);
assert.ok(listContentRule, 'The individual card rule should exist.');
assert.doesNotMatch(listContentRule[1], /will-change:\s*transform/);
assert.match(
    mySpidersCss,
    /\.setae-spider-list-row\.is-swipe-active \.setae-list-content\s*\{[\s\S]*?will-change:\s*transform;/
);

const rendererSource = fs.readFileSync(path.join(pluginRoot, 'assets/js/modules/app-ui-renderer.js'), 'utf8');
assert.match(
    rendererSource,
    /document\.addEventListener\('touchmove', SetaeUIActions\.handleTouchMove, \{ passive: false \}\)/
);
assert.doesNotMatch(rendererSource, /\$\(e\.target\)\.closest\('\.setae-spider-list-row'\)/);

const appSource = fs.readFileSync(path.join(pluginRoot, 'assets/js/setae-app.js'), 'utf8');
assert.match(appSource, /let isPullGesture = false;/);
assert.match(appSource, /Math\.abs\(diffY\) <= Math\.abs\(diffX\) \* 1\.2/);

const profileSource = fs.readFileSync(path.join(pluginRoot, 'assets/js/modules/ui/profile.js'), 'utf8');
assert.match(profileSource, /const GPT_LIVE_SETTINGS_VISIBLE = false;/);
assert.match(profileSource, /\$\{GPT_LIVE_SETTINGS_VISIBLE \? `/);

const dashboardSource = fs.readFileSync(path.join(pluginRoot, 'templates/dashboard.php'), 'utf8');
assert.match(
    dashboardSource,
    /id="setae-app"<\?php echo \$is_guest_mode \? ' class="is-guest-trial"' : ''; \?>/
);

console.log('Tutorial placement and swipe gesture tests passed');
