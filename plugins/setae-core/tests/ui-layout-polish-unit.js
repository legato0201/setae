const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const pluginRoot = path.resolve(__dirname, '..');

function read(relativePath) {
    return fs.readFileSync(path.join(pluginRoot, relativePath), 'utf8');
}

function assertBalancedCss(source, label) {
    const withoutComments = source.replace(/\/\*[\s\S]*?\*\//g, '');
    const openingBraces = (withoutComments.match(/\{/g) || []).length;
    const closingBraces = (withoutComments.match(/\}/g) || []).length;
    assert.equal(openingBraces, closingBraces, `${label} must have balanced braces.`);
}

const feedersCss = read('assets/css/modules/feeders.css');
const globalCss = read('assets/css/setae-global.css');
const spidersCss = read('assets/css/modules/my-spiders.css');
const unifiedCss = read('assets/css/modules/unified-design.css');
const darkCss = read('assets/css/modules/dark-mode.css');
const specimenCss = read('assets/css/modules/specimen-dashboard.css');
const listSource = read('assets/js/modules/ui/list.js');
const detailSource = read('assets/js/modules/ui/detail.js');
const appApiSource = read('assets/js/modules/app-api.js');
const offlineSource = read('assets/js/modules/offline-store.js');
const rendererSource = read('assets/js/modules/app-ui-renderer.js');
const spiderApiSource = read('includes/api/class-setae-api-spiders.php');
const modalsTemplate = read('templates/partials/modals.php');
const encyclopediaDetailTemplate = read('templates/partials/view-detail.php');
const careFeedDetailTemplate = read('templates/partials/section-care-feed-detail.php');
const compactCareCss = spidersCss.slice(spidersCss.lastIndexOf('/* Compact care strip'));

assert.match(feedersCss, /\.setae-archive-stat\s*\{[\s\S]*?padding:\s*13px 20px;/);
assert.match(feedersCss, /\.setae-archive-stat:first-child\s*\{[\s\S]*?padding-left:\s*20px;/);

assert.match(unifiedCss, /#section-my \.my-dashboard-section\s*\{[\s\S]*?padding:\s*14px;[\s\S]*?border:\s*1px solid/);
assert.match(unifiedCss, /#section-baby \.baby-list-panel\s*\{[\s\S]*?padding:\s*16px;/);

['fasting', 'pre_molt', 'post_molt', 'refused'].forEach(function (status) {
    assert.match(
        spidersCss,
        new RegExp('data-status="' + status + '"\\][\\s\\S]*?--card-surface:[\\s\\S]*?--card-border:')
    );
});
assert.match(spidersCss, /0 16px 34px var\(--card-shadow-tint\)/);
assert.match(listSource, /function renderCareInfographic\(spider, status, labelFeed, labelMolt\)/);
assert.doesNotMatch(listSource, /--care-recency/);
assert.match(listSource, /class="setae-care-vital-count"/);
assert.match(listSource, /class="setae-care-vital-main"/);
assert.match(listSource, /class="setae-activity-compact-head"/);
assert.match(listSource, /class="setae-activity-compact-title"/);
assert.match(listSource, /class="setae-activity-active-weeks"/);
assert.match(listSource, /const highlightedEvents = activity\.events\.filter/);
assert.match(listSource, /Math\.min\(index, 4\)/);
assert.match(listSource, /const height = count > 0 \? \(count \/ maximumWeekly\) \* 100 : 0;/);
assert.match(listSource, /週別棒グラフ/);
assert.match(listSource, /renderCareInfographic\(spider, status, labelFeed, labelMolt\)/);
assert.match(
    spidersCss,
    /\.setae-list-content\s*\{[\s\S]*?container-name:\s*specimen-card;[\s\S]*?container-type:\s*inline-size;/
);
assert.match(
    compactCareCss,
    /\.setae-list-content\s*\{[\s\S]*?min-height:\s*218px;/
);
assert.match(
    compactCareCss,
    /\.setae-care-vitals\s*\{[\s\S]*?grid-template-columns:\s*repeat\(2, minmax\(0, 1fr\)\);/
);
assert.match(
    compactCareCss,
    /\.setae-care-vital\s*\{[\s\S]*?grid-template-columns:\s*22px minmax\(0, 1fr\);[\s\S]*?min-height:\s*39px;/
);
assert.match(
    compactCareCss,
    /\.setae-activity-compact-head\s*\{[\s\S]*?grid-template-columns:\s*auto minmax\(0, 1fr\) auto;/
);
assert.match(
    compactCareCss,
    /\.setae-activity-legend\s*\{[\s\S]*?flex-wrap:\s*nowrap;/
);
assert.match(
    compactCareCss,
    /\.setae-activity-chart\s*\{[\s\S]*?height:\s*27px;/
);
assert.match(
    compactCareCss,
    /@container specimen-card \(max-width: 280px\)[\s\S]*?grid-template-columns:\s*20px minmax\(0, 1fr\);/
);
assert.match(
    compactCareCss,
    /@container specimen-card \(max-width: 280px\)[\s\S]*?\.setae-activity-legend-item\.is-feed,[\s\S]*?display:\s*none;/
);
assert.match(
    unifiedCss,
    /#section-my #setae-spider-list\s*\{[\s\S]*?background:\s*#f0f2f1;/
);
assert.match(
    unifiedCss,
    /#section-my #setae-spider-list > \.specimen-card \.setae-row-command\s*\{[\s\S]*?grid-area:\s*command !important;[\s\S]*?grid-column:\s*auto !important;[\s\S]*?grid-row:\s*auto !important;/
);
assert.match(
    unifiedCss,
    /\.care-rhythm-orbit\s*\{[\s\S]*?background:\s*conic-gradient\(#167c65 var\(--care-progress\), #d9dfdc 0\);/
);
assert.match(
    unifiedCss,
    /\.care-rhythm-day > i > b\s*\{[\s\S]*?height:\s*var\(--care-day-level\);/
);
assert.match(unifiedCss, /\.care-queue-avatar \.setae-avatar-img\s*\{/);
assert.match(listSource, /class="care-signal-summary"/);
assert.match(listSource, /class="care-rhythm-orbit"/);
assert.match(listSource, /class="care-queue-avatar">\$\{renderSpiderThumbnail\(spider\)\}/);
assert.match(listSource, /style="--care-day-level:\$\{level\}%/);
assert.match(listSource, /class="my-dashboard-priority-avatar">\$\{renderSpiderThumbnail\(spider\)\}/);
assert.match(listSource, /title:\s*'今日見る個体'/);
assert.match(listSource, /class="my-collection-kpis"/);
assert.match(listSource, /label:\s*'総個体数'/);
assert.match(listSource, /label:\s*'通常管理'/);
assert.match(listSource, /label:\s*'脱皮が近い'/);
assert.match(listSource, /label:\s*'給餌が近い'/);
assert.match(listSource, /class="my-collection-kpi-progress"/);
assert.match(listSource, /class="setae-spider-list-row specimen-card specimen-card-v5/);
assert.match(listSource, /class="specimen-card-metrics specimen-v5-metrics"/);
assert.match(listSource, /class="specimen-next-care specimen-v5-care"/);
assert.match(listSource, /function renderSpecimenStageTrack\(spider, activity\)/);
assert.match(listSource, /function renderSpecimenSparkline\(activity, tone\)/);
assert.match(
    specimenCss,
    /#section-my #setae-spider-list\s*\{[\s\S]*?grid-template-columns:\s*repeat\(4, minmax\(0, 1fr\)\)/
);
assert.match(specimenCss, /height:\s*116px !important;[\s\S]*?grid-template-areas:[\s\S]*?"photo identity care"/);
assert.match(
    specimenCss,
    /\.specimen-card-v5\.is-swipe-active > \.specimen-v5-shell\s*\{[\s\S]*?transition:\s*none !important;/
);
assert.doesNotMatch(
    unifiedCss,
    /#section-my #setae-spider-list > \.specimen-card \.setae-list-content,\s*#section-my #setae-spider-list > \.specimen-card:hover \.setae-list-content\s*\{[^}]*transform:\s*none !important;/
);
assert.match(specimenCss, /#section-my-detail #detail-condition-slot\s*\{[\s\S]*?grid-column:\s*1 \/ span 3/);
assert.match(specimenCss, /grid-template-columns:\s*302px minmax\(0, 1fr\)/);

assert.match(detailSource, /function buildDetailHeroDate\(value\)/);
assert.match(detailSource, /class="detail-hero-date-main"/);
assert.match(detailSource, /class="detail-hero-date-year"/);
assert.match(detailSource, /renderDetailHeroDate\('#detail-hero-molt', spider\.last_molt\)/);
assert.match(detailSource, /renderDetailHeroDate\('#detail-hero-feed', spider\.last_feed\)/);
assert.match(detailSource, /function buildDetailEnvironmentPanel\(spider\)/);
assert.match(detailSource, /function buildDetailGrowthStagePanel\(spider, events\)/);
assert.match(detailSource, /function buildDetailHeatmapPanel\(events\)/);
assert.match(detailSource, /function buildDetailQuickActions\(spider\)/);
assert.match(detailSource, /function buildDetailConditionPanel\(spider, events\)/);
assert.match(detailSource, /function buildDetailFeedingPanel\(spider, events\)/);
assert.match(detailSource, /function buildDetailWeeklyPanel\(events\)/);
assert.match(detailSource, /function renderDetailOperationalDashboard\(spider, events/);
assert.match(listSource, /deck === 'favorite'/);
assert.match(listSource, /SetaeAPI\.setSpiderFavorite\(id, nextStatus/);
assert.match(detailSource, /SetaeAPI\.setSpiderFavorite\(currentSpiderId, nextStatus/);
assert.match(appApiSource, /function setSpiderFavorite\(id, isFavorite/);
assert.match(offlineSource, /'temperature', 'humidity', 'recommended_temperature', 'recommended_humidity'/);
assert.match(offlineSource, /'substrate', 'origin', 'enclosure', 'acquired_date', 'instar', 'notes'/);
assert.match(spiderApiSource, /\/spiders\/\(\?P<id>\\d\+\)\/favorite/);
assert.match(spiderApiSource, /'_setae_spider_temperature'/);
assert.match(spiderApiSource, /'_setae_spider_acquired_date'/);
assert.match(spiderApiSource, /'_setae_spider_notes'/);
assert.match(modalsTemplate, /id="edit-spider-acquired-date"/);
assert.match(modalsTemplate, /id="edit-spider-temperature"/);
assert.match(modalsTemplate, /id="edit-spider-notes"/);
assert.match(
    unifiedCss,
    /#section-my-detail \.detail-care-focus,[\s\S]*?grid-area:\s*auto !important;[\s\S]*?grid-column:\s*1 \/ -1 !important;/
);
assert.match(
    unifiedCss,
    /#section-my-detail \.detail-care-heatmap\s*\{[\s\S]*?grid-template-columns:\s*repeat\(7, minmax\(16px, 24px\)\);[\s\S]*?justify-content:\s*space-between;/
);
assert.match(
    unifiedCss,
    /@media \(max-width: 1180px\)[\s\S]*?#section-my-detail #detail-stage-slot,[\s\S]*?grid-column:\s*auto !important;/
);

assert.match(unifiedCss, /grid-template-columns:\s*minmax\(150px, 1fr\) minmax\(320px, 1\.618fr\)/);
assert.match(unifiedCss, /\.detail-hero-date-main\s*\{[\s\S]*?font-size:\s*26px;/);
assert.match(unifiedCss, /\.detail-hero-date-year\s*\{[\s\S]*?font-size:\s*9px;/);
assert.match(darkCss, /#section-my-detail \.hero-content\s*\{[\s\S]*?linear-gradient/);

assert.match(
    unifiedCss,
    /#setae-feeder-app \.setae-feeder-main > \.setae-feeder-section,[\s\S]*?padding:\s*20px;/
);
assert.match(
    unifiedCss,
    /#section-enc-detail \.enc-detail-main > \.enc-detail-panel\s*\{[\s\S]*?padding:\s*20px;/
);
assert.match(
    unifiedCss,
    /@media \(max-width: 767px\)[\s\S]*?#section-enc-detail \.enc-detail-main\s*\{[\s\S]*?order:\s*1;[\s\S]*?#section-enc-detail \.enc-detail-aside\s*\{[\s\S]*?order:\s*2;/
);
assert.match(rendererSource, /function revealEncyclopediaDetailPanel\(\$panel\)/);
assert.match(rendererSource, /panelElement\.getBoundingClientRect\(\)\.top[\s\S]*?tabsElement\.offsetHeight/);
assert.match(rendererSource, /revealEncyclopediaDetailPanel\(\$targetPanel\)/);
assert.match(encyclopediaDetailTemplate, /aria-controls="enc-panel-care"/);
assert.match(encyclopediaDetailTemplate, /id="enc-panel-care"[\s\S]*?role="tabpanel"/);

assert.match(globalCss, /#setae-ptr-spinner\s*\{[\s\S]*?background:\s*transparent;[\s\S]*?box-shadow:\s*none;/);
assert.match(globalCss, /#setae-ptr-icon\s*\{[\s\S]*?width:\s*17px;[\s\S]*?border-top-color:\s*#257c53;/);
assert.match(
    unifiedCss,
    /#section-my #btn-add-spider\s*\{[\s\S]*?display:\s*inline-grid !important;[\s\S]*?grid-template-columns:\s*18px max-content;[\s\S]*?column-gap:\s*7px !important;[\s\S]*?width:\s*126px !important;/
);
assert.match(
    unifiedCss,
    /#section-my #btn-add-spider svg\s*\{[\s\S]*?position:\s*static !important;[\s\S]*?margin:\s*0 !important;/
);
assert.match(
    unifiedCss,
    /#section-my #btn-add-spider span\s*\{[\s\S]*?width:\s*auto;[\s\S]*?text-align:\s*left;/
);
assert.match(careFeedDetailTemplate, /id="btn-back-to-care-feed"[\s\S]*?<svg[\s\S]*?<path d="m15 18-6-6 6-6"/);
assert.doesNotMatch(careFeedDetailTemplate, /←\s*戻る/);
assert.doesNotMatch(rendererSource, /community-comment-tools-row/);
assert.doesNotMatch(rendererSource, /js-topic-comment-reply/);
assert.doesNotMatch(rendererSource, /best-answer-action|js-topic-best-answer/);
assert.match(rendererSource, /renderReactionButtons\(comment\.reactions, 'comment', comment\.id\)/);

assertBalancedCss(feedersCss, 'Feeders CSS');
assertBalancedCss(globalCss, 'Global CSS');
assertBalancedCss(spidersCss, 'My spiders CSS');
assertBalancedCss(unifiedCss, 'Unified design CSS');
assertBalancedCss(darkCss, 'Dark mode CSS');
assertBalancedCss(specimenCss, 'Specimen dashboard CSS');

console.log('UI layout polish tests passed');
