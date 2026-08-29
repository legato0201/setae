const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { parseCss, splitSelectors } = require('./ui-system-v4-public-surface-ownership-unit.js');

const pluginRoot = path.resolve(__dirname, '..');

function read(relativePath) {
    return fs.readFileSync(path.join(pluginRoot, relativePath), 'utf8');
}

const darkCss = read('assets/css/modules/dark-mode.css');
const modalCss = read('assets/css/modules/modals.css');
const detailSource = read('assets/js/modules/ui/detail.js');
const appSource = read('assets/js/setae-app.js');
const addSpiderSource = read('assets/js/modules/ui/add-spider.js');
const modalTemplate = read('templates/partials/modals.php');
const appTokens = read('assets/app/styles/tokens.css');
const appComponents = read('assets/app/styles/components.css');
const appFrame = read('assets/app/styles/app-frame.css');
const appWorkbench = read('assets/app/styles/components/workbench.css');

function rgb(hex) {
    return hex.match(/[0-9a-f]{2}/gi).map((part) => parseInt(part, 16));
}

function luminance(hex) {
    const channels = rgb(hex).map((channel) => {
        const value = channel / 255;
        return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
}

function contrast(foreground, background) {
    const first = luminance(foreground);
    const second = luminance(background);
    return (Math.max(first, second) + 0.05) / (Math.min(first, second) + 0.05);
}

function mix(foreground, background, amount) {
    const front = rgb(foreground);
    const back = rgb(background);
    return `#${front.map((channel, index) => Math.round(channel * amount + back[index] * (1 - amount))
        .toString(16).padStart(2, '0')).join('')}`;
}

function themeBlock(selector) {
    const start = selector ? appTokens.indexOf(selector) : appTokens.indexOf(':root');
    const bodyStart = appTokens.indexOf('{', start) + 1;
    const bodyEnd = appTokens.indexOf('\n}', bodyStart);
    return appTokens.slice(bodyStart, bodyEnd);
}

function token(block, name) {
    const match = block.match(new RegExp(`--${name}:\\s*(#[0-9a-f]{6})`, 'i'));
    assert.ok(match, `Missing color token --${name}`);
    return match[1];
}

function selectorAlternatives(selector) {
    const group = selector.match(/:(?:is|where)\(([^()]+)\)/);
    return group
        ? splitSelectors(group[1]).flatMap((part) => selectorAlternatives(selector.replace(group[0], part)))
        : [selector];
}

function declarationValues(css, selector, property) {
    const values = parseCss(css)
        .filter((rule) => rule.selectors.flatMap(selectorAlternatives).includes(selector))
        .flatMap((rule) => [...rule.body.replace(/\/\*[\s\S]*?\*\//g, '')
            .matchAll(new RegExp(`(?:^|;)\\s*${property}:\\s*([^;]+)(?=;)`, 'g'))]
            .map((match) => match[1].trim()));
    return [...new Set(values)];
}

const lightTheme = themeBlock('');
const darkTheme = themeBlock('[data-theme="dark"]');
const lightColors = {
    app: token(lightTheme, 'bg-app'),
    surface: token(lightTheme, 'bg-surface'),
    primary: token(lightTheme, 'text-primary'),
    secondary: token(lightTheme, 'text-secondary'),
    muted: token(lightTheme, 'text-muted'),
    accent: token(lightTheme, 'accent'),
    primaryButton: token(lightTheme, 'button-primary-bg'),
    primaryButtonText: token(lightTheme, 'button-primary-fg'),
    danger: token(lightTheme, 'danger'),
    warning: token(lightTheme, 'warning'),
    success: token(lightTheme, 'success')
};
const darkColors = {
    app: token(darkTheme, 'bg-app'),
    surface: token(darkTheme, 'bg-surface'),
    primary: token(darkTheme, 'text-primary'),
    secondary: token(darkTheme, 'text-secondary'),
    muted: token(darkTheme, 'text-muted'),
    accent: token(darkTheme, 'accent'),
    primaryButton: token(darkTheme, 'button-primary-bg'),
    primaryButtonText: token(darkTheme, 'button-primary-fg'),
    danger: token(darkTheme, 'danger'),
    warning: token(darkTheme, 'warning'),
    success: token(darkTheme, 'success')
};

for (const colors of [lightColors, darkColors]) {
    assert.ok(contrast(colors.primaryButtonText, colors.primaryButton) >= 4.5, 'Primary button contrast must pass');
    assert.ok(contrast(colors.primary, colors.surface) >= 4.5, 'Default button contrast must pass');
    assert.ok(contrast(colors.secondary, colors.surface) >= 4.5, 'Text button/form label contrast must pass');
    assert.ok(contrast(colors.muted, colors.app) >= 4.5, 'Muted metadata contrast must pass');
    assert.ok(contrast(colors.muted, colors.surface) >= 4.5, 'Placeholder contrast must pass');
    assert.ok(contrast(colors.danger, colors.surface) >= 4.5, 'Danger contrast must pass');
    assert.ok(contrast(colors.warning, colors.surface) >= 4.5, 'Warning contrast must pass');
    assert.ok(contrast(colors.success, colors.surface) >= 4.5, 'Success contrast must pass');
    assert.ok(contrast(colors.primary, mix(colors.accent, colors.surface, 0.1)) >= 4.5, 'Selected state contrast must pass');
}

assert.match(appComponents, /\.text-button\s*\{[\s\S]*?color:\s*var\(--text-secondary\)/);
assert.match(appComponents, /\.field > span:first-child,[\s\S]*?color:\s*var\(--text-secondary\)/);
assert.match(appComponents, /::placeholder[\s\S]*?color:\s*var\(--text-placeholder\)/);
for (const selector of ['.app-rail-link.is-active', '.app-rail-sublink.is-active']) {
    assert.deepEqual(declarationValues(appFrame, selector, 'background'), ['var(--bg-selected)'],
        `${selector} must retain the selected background regardless of selector grouping.`);
}
assert.deepEqual(declarationValues(appWorkbench, '.navigation-item.is-active', 'color'), ['var(--text-primary)'],
    'Active rail items retain their foreground through the shared navigation primitive.');

[
    '.species-names',
    '.enc-detail-identity',
    '.setae-feeder-summary',
    '.my-dashboard-care-progress.js-open-streak-calendar',
    '.setae-list-content',
    '.radio-chip',
    '.setae-timeline-section',
    '#setae-detail-qr-settings',
    '.setae-radio-group.segment-control',
    '.edit-suggestion-item',
    '#topic-comments-list',
    '.com-search-box',
    '.setae-pro-badge',
    '.setae-my-tool-switch',
    '.setae-decks-scroll',
    '#btn-add-spider',
    '.enc-mobile-filter-toggle.js-enc-mobile-filter-toggle',
    '#setae-enc-content-filters',
    '.enc-detail-tabs',
    '#enc-research-empty',
    '.enc-related-actions',
    '#enc-related-topics-card',
    '#enc-gallery-empty',
    '#enc-shop-empty',
    '#btn-search-inaturalist',
    '.social-hub-tabs',
    '.care-feed-relationship-toggle.js-care-feed-relationships-toggle',
    '.setae-author-name',
    '.care-feed-reactions',
    '.detail-header-bar',
    '.com-controls',
    '.topic-status-panel.is-open',
    '.community-reaction-row',
    '.setae-actions',
    '.care-queue-reason',
    '.setae-detail-command-bar',
    '#detail-photo-count',
    '.detail-molt-history-scroll',
    '.detail-consult-button.js-open-topic-modal',
    '.baby-dashboard-overview',
    '.baby-dashboard-species',
    '.baby-group-scope-tabs',
    '.baby-group-mini-chart',
    '.baby-group-stats',
    '#baby-toggle-group-settings',
    '.baby-archive-notice',
    '.baby-copy-row',
    '.baby-number-panel.is-readonly',
    '.care-feed-scope-row',
    '.care-feed-comment-templates.community-comment-templates',
    '.enc-mobile-filters',
    '.setae-modal-content.setae-pwa-settings-dialog',
    '#temperament-selector-trigger',
    '.setae-continue-target.js-continue-open',
    '.setae-modal-content.compact-mode.log-entry-modal',
    '.setae-archive-summary',
    '.setae-archive-item',
    '.setae-modal-content.setae-feeder-modal-content',
    '.setae-feeder-egg-button.js-open-egg-modal',
    '.setae-feeder-egg-empty.js-open-egg-modal',
    '.baby-code-cell',
    '.care-feed-desktop-summary',
    '.care-feed-latest-comment.js-care-feed-preview-comment',
    '.care-feed-actions',
    '#setae-qr-modal .setae-qr-dialog',
    '#setae-qr-modal .setae-qr-target-row.is-selected',
    '#setae-qr-modal .setae-qr-record-form',
    '#setae-qr-modal .setae-qr-transfer-row',
    '.baby-detail-counts',
    '.baby-group-detail',
    '.setae-toggle-wrapper.toggle-refused',
    '.setae-toggle-wrapper.toggle-best-shot.is-disabled',
    '.setae-toggle-wrapper.toggle-share-feed',
    '#close-log-modal',
    '.my-dashboard-classification-main',
    '.my-dashboard-priority-main',
    '.my-dashboard-priority-reason.is-alert',
    '#setae-sort-menu-v3',
    '#btn-trigger-comment-image',
    '.community-rail-overview',
    '.baby-create-dialog-header',
    '.baby-create-dialog-footer',
    '.enc-secondary-button.js-open-species-breeding',
    '.enc-related-empty',
    '.setae-public-product-window',
    '.setae-public-feature-symbol',
    '.setae-public-header-actions',
    '#spider-species-suggestions',
    '#setae-register-modal .setae-register-dialog',
    '.streak-day-modal',
    '.setae-card-care-graphic',
    '.setae-care-vital-glyph',
    '.setae-activity-compact-title',
    '.setae-activity-active-weeks'
].forEach(function (selector) {
    assert.ok(
        darkCss.includes(selector),
        `Dark appearance must explicitly cover ${selector}.`
    );
});

assert.match(
    darkCss,
    /:where\(\.setae-encyclopedia, \.enc-detail-view\)\s*\{[\s\S]*?--enc-ink:\s*#edf3ef;[\s\S]*?--enc-muted:/
);
assert.match(
    darkCss,
    /\.my-dashboard-care-progress\.js-open-streak-calendar\s*\{[\s\S]*?background:\s*linear-gradient/
);
assert.match(
    darkCss,
    /#setae-spider-list > \.setae-spider-list-row\s*\{[\s\S]*?--card-ink:\s*#eef4f0;/
);
assert.match(
    darkCss,
    /\.setae-radio-group\.segment-control[\s\S]*?input\[type="radio"\]:checked \+ span/
);
assert.match(
    darkCss,
    /#section-com \.com-search-box input\[type="search"\]\s*\{[\s\S]*?background:\s*transparent !important;/
);
assert.match(
    darkCss,
    /\.setae-pro-badge\s*\{[\s\S]*?-webkit-text-fill-color:\s*#a6e6c1 !important;/
);
assert.match(
    darkCss,
    /#section-my #btn-add-spider\s*\{[\s\S]*?background:\s*#75d4a0 !important;[\s\S]*?color:\s*#102218 !important;/
);
assert.match(
    darkCss,
    /#section-enc-detail \.enc-detail-tabs\s*\{[\s\S]*?background:\s*rgba\(23, 30, 26, 0\.97\) !important;/
);
assert.match(
    darkCss,
    /\.community-reaction-row \.community-reaction-btn\.active\s*\{[\s\S]*?color:\s*#102218 !important;/
);
assert.match(
    darkCss,
    /\.setae-feeder-modal\s*\{[\s\S]*?--my-ink:\s*#edf3ef;[\s\S]*?--my-surface:\s*#171e1a;/
);
assert.match(
    darkCss,
    /\.baby-code-cell\.is-selected,[\s\S]*?box-shadow:\s*inset 0 0 0 2px #79acd6/
);
assert.match(
    darkCss,
    /\.care-feed-actions \.care-feed-action-menu\s*\{[\s\S]*?background:\s*var\(--setae-surface-raised\) !important;/
);
assert.match(
    darkCss,
    /#setae-qr-modal \.setae-qr-dialog\s*\{[\s\S]*?background:\s*var\(--setae-surface-raised\) !important;/
);
assert.match(
    darkCss,
    /#setae-qr-modal \.setae-qr-strip-label,[\s\S]*?color:\s*#000000 !important;/
);
assert.match(
    darkCss,
    /#section-baby :where\([\s\S]*?\.baby-detail-counts span[\s\S]*?background:\s*var\(--setae-surface-raised\) !important;/
);
assert.match(
    darkCss,
    /\.setae-toggle-wrapper\.toggle-best-shot\.is-disabled\s*\{[\s\S]*?opacity:\s*1 !important;/
);
assert.match(
    darkCss,
    /#setae-sort-menu-v3\s*\{[\s\S]*?background:\s*var\(--setae-surface-raised\) !important;/
);
assert.match(
    darkCss,
    /\.my-dashboard-priority-reason\.is-alert\s*\{[\s\S]*?color:\s*#f2a09b !important;/
);
assert.match(
    darkCss,
    /\.baby-create-dialog-footer\s*\{[\s\S]*?background:\s*rgba\(23, 30, 26, 0\.98\) !important;/
);
assert.match(
    darkCss,
    /\.setae-public-product-window\s*\{[\s\S]*?background:\s*var\(--setae-surface-raised\) !important;/
);
assert.match(
    darkCss,
    /\.setae-public-feature-symbol\.is-photo\s*\{[\s\S]*?color:\s*#f0a18e !important;/
);
assert.match(
    darkCss,
    /\.setae-public-header-actions \.setae-public-trial-link\s*\{[\s\S]*?color:\s*#a9dfc0 !important;/
);
assert.match(
    darkCss,
    /#spider-species-suggestions \.setae-species-suggestion\s*\{[\s\S]*?color:\s*var\(--setae-ink\) !important;/
);
assert.match(
    darkCss,
    /#setae-register-modal \.setae-register-workspace\s*\{[\s\S]*?background:\s*var\(--setae-surface-raised\) !important;/
);
assert.match(
    darkCss,
    /#setae-date-detail-modal \.streak-month-day\s*\{[\s\S]*?background:\s*#19211d !important;[\s\S]*?color:\s*#aebbb3 !important;/
);
assert.match(
    darkCss,
    /#setae-date-detail-modal \.streak-day-action\s*\{[\s\S]*?background:\s*#1a2c23 !important;/
);
assert.match(
    darkCss,
    /#setae-today-check \.care-rhythm-orbit\s*\{[\s\S]*?conic-gradient\(#75d4a0 var\(--care-progress\), #3b4740 0\)/
);
assert.match(
    darkCss,
    /#section-my #setae-spider-list\s*\{[\s\S]*?background:\s*#111713 !important;/
);
assert.match(
    darkCss,
    /\.setae-card-care-graphic\s*\{[\s\S]*?--care-feed:\s*#79d6a7;[\s\S]*?--care-molt:\s*#a9c3ed;/
);
assert.match(
    darkCss,
    /\.setae-activity-chart\s*\{[\s\S]*?linear-gradient\(var\(--care-grid\), var\(--care-grid\)\)[\s\S]*?!important;/
);

assert.match(modalCss, /\.setae-edit-species-suggestions\s*\{/);
assert.match(modalCss, /\.edit-suggestion-item\s*\{/);
assert.match(modalCss, /\.setae-species-suggestions\s*\{/);
assert.match(modalCss, /\.setae-species-suggestion\s*\{/);
assert.match(modalTemplate, /class="setae-edit-species-suggestions"/);
assert.match(modalTemplate, /role="listbox"/);
assert.match(modalTemplate, /id="spider-species-suggestions" class="setae-species-suggestions" role="listbox"/);
assert.doesNotMatch(
    modalTemplate,
    /id="spider-species-suggestions"[\s\S]{0,260}style=/
);
assert.match(detailSource, /class="edit-suggestion-item" role="option"/);
assert.match(detailSource, /class="edit-suggestion-ja"/);
assert.match(detailSource, /class="edit-suggestion-genus"/);
assert.doesNotMatch(
    detailSource,
    /class="edit-suggestion-item"[^>]*style=/
);
assert.match(modalCss, /#temperament-selector-trigger \.temperament-placeholder\s*\{/);
assert.match(modalCss, /#temperament-selector-trigger \.temp-chip\s*\{/);
assert.match(modalTemplate, /class="temperament-placeholder"/);
assert.doesNotMatch(modalTemplate, /id="temperament-selector-trigger"[\s\S]{0,240}color:\s*#999/);
assert.doesNotMatch(appSource, /temperament-selector-trigger'\)\.html\('<span style=/);
assert.equal(
    (appSource.match(/class="temperament-placeholder"/g) || []).length,
    3,
    'Every JavaScript-rendered temperament placeholder must use the semantic class.'
);
assert.match(addSpiderSource, /function escapeHtml\(value\)/);
assert.match(addSpiderSource, /class="suggestion-item setae-species-suggestion" role="option"/);
assert.match(addSpiderSource, /class="setae-species-suggestion-ja"/);
assert.match(addSpiderSource, /class="setae-species-suggestion-genus"/);
assert.doesNotMatch(
    addSpiderSource,
    /class="suggestion-item"[^>]*style=/
);

const withoutComments = darkCss.replace(/\/\*[\s\S]*?\*\//g, '');
assert.equal(
    (withoutComments.match(/\{/g) || []).length,
    (withoutComments.match(/\}/g) || []).length,
    'Dark appearance CSS must have balanced braces.'
);

console.log('Dark component contrast tests passed');
