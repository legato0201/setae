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

const renderer = read('assets/js/modules/app-ui-renderer.js');
const apiClient = read('assets/js/modules/app-api.js');
const topicApi = read('includes/api/class-setae-api-topics.php');
const spiderApi = read('includes/api/class-setae-api-spiders.php');
const socialApi = read('includes/api/class-setae-api-social.php');
const publicIdentity = read('includes/class-setae-public-identity.php');
const core = read('includes/class-setae-core.php');
const dashboard = read('includes/frontend/class-setae-dashboard.php');
const publicProfile = read('includes/frontend/class-setae-public-profile.php');
const careTemplate = read('templates/partials/section-care-feed.php');
const communityTemplate = read('templates/partials/section-community.php');
const unifiedCss = read('assets/css/modules/unified-design.css');
const darkCss = read('assets/css/modules/dark-mode.css');

assert.match(renderer, /const PRIMARY_SECTION_STORAGE_KEY = 'setae_last_primary_section_v1';/);
[
    'section-enc',
    'section-my',
    'section-baby',
    'section-care-feed',
    'section-com'
].forEach(function (sectionId) {
    assert.match(renderer, new RegExp("'" + sectionId + "'"));
});
assert.match(renderer, /const initialSection = resolveInitialPrimarySection\(\);[\s\S]*?activateInitialPrimarySection\(initialSection\);/);
assert.match(renderer, /function readRememberedPrimarySection\(\)[\s\S]*?localStorage\.getItem\(PRIMARY_SECTION_STORAGE_KEY\)/);
assert.match(renderer, /function rememberPrimarySection\(target\)[\s\S]*?localStorage\.setItem\(PRIMARY_SECTION_STORAGE_KEY, target\)/);
assert.match(renderer, /function showPrimarySection\(target\)[\s\S]*?rememberPrimarySection\(target\);/);
assert.match(
    renderer,
    /const requiresAccountConnection = \[[\s\S]*?'section-baby'[\s\S]*?'section-care-feed'[\s\S]*?'section-com'/
);
assert.doesNotMatch(renderer, /'section-bl'/);

[careTemplate, communityTemplate].forEach(function (template) {
    assert.match(template, /class="social-quick-compose"/);
    assert.match(template, /class="social-quick-compose-form js-social-quick-compose"/);
    assert.match(template, /class="social-quick-compose-input js-social-quick-content"/);
    assert.match(template, /class="social-quick-compose-type"/);
    assert.match(template, /class="social-compose-detail js-open-topic-modal"/);
    assert.match(template, /class="social-compose-identity"/);
    assert.match(template, /class="social-compose-subject js-social-compose-subject"/);
    assert.match(template, /class="social-compose-media-preview js-social-compose-media-preview"/);
    assert.match(template, /class="js-social-compose-media-alt"/);
    assert.match(template, /class="social-compose-tool js-social-compose-image"/);
    assert.match(template, /class="social-compose-tool social-compose-cw js-social-compose-subject-toggle"/);
    assert.match(template, /class="social-compose-audience"/);
    assert.match(template, /dashicons-format-image/);
    assert.match(template, /role="feed" aria-live="polite"/);
    assert.match(template, /enctype="multipart\/form-data"/);
    assert.match(template, /class="social-live-status"/);
    assert.match(template, /data-social-live-status="(?:care|community)"/);
    assert.match(template, /class="social-live-dot"/);
    assert.match(template, /class="social-compose-nav"/);
    assert.match(template, /class="social-compose-nav-item [^"]*-scope-btn/);
    assert.match(template, /class="social-new-posts-banner js-social-new-posts-jump"/);
    assert.match(template, /class="js-social-new-posts-count"/);
    assert.doesNotMatch(template, /js-social-timeline-refresh/);
    assert.match(template, /class="social-filter-toggle js-social-filter-toggle"/);
    assert.match(template, /class="[^"]*social-filter-panel/);
    assert.match(template, /dashicons-groups/);
    assert.match(template, /dashicons-heart/);
    assert.match(template, /dashicons-format-chat/);
});

assert.match(renderer, /\.js-social-filter-toggle', handleSocialFilterToggle/);
assert.match(renderer, /\.js-social-new-posts-jump', handleSocialNewPostsJump/);
assert.match(renderer, /\.com-scope-btn', handleCommunityScopeClick/);
assert.match(renderer, /\.js-social-quick-content', handleSocialQuickComposeInput/);
assert.match(renderer, /\.js-social-quick-compose', handleSocialQuickComposeSubmit/);
assert.match(renderer, /\.js-social-cw-toggle', handleSocialContentWarningToggle/);
assert.match(renderer, /\.js-social-reaction-picker-toggle', handleSocialReactionPickerToggle/);
assert.match(renderer, /\.js-social-share-post', handleSocialPostShare/);
assert.match(renderer, /\.social-timeline-post\[tabindex="0"\]', handleSocialTimelinePostKeydown/);
assert.match(renderer, /function buildSocialQuickTitle\(content, type\)/);
assert.match(
    renderer,
    /function handleSocialQuickComposeSubmit\(e\)[\s\S]*?const payload = new FormData\(\);[\s\S]*?payload\.append\('title'[\s\S]*?payload\.append\('content', content\);[\s\S]*?payload\.append\('has_cw'[\s\S]*?payload\.append\('image'[\s\S]*?payload\.append\('image_alt'/
);
assert.match(renderer, /openSocialHubView\('community'\);/);
assert.match(renderer, /class="setae-care-feed-item social-timeline-post"/);
assert.match(renderer, /class="setae-topic-row social-timeline-post/);
assert.match(renderer, /class="social-author-handle"[^>]*>@/);
assert.match(renderer, /class="social-post-edited"/);
assert.match(renderer, /class="social-post-activity-note"/);
assert.match(renderer, /class="social-content-warning"/);
assert.match(renderer, /class="social-unread-divider"/);
assert.match(renderer, /function renderSocialTopicMedia\(topic, context\)/);
assert.match(renderer, /function renderTopicListReactionControl\(topic\)/);
assert.match(renderer, /function renderTopicActions\(topic\)/);
assert.match(renderer, /const SOCIAL_LIVE_POLL_INTERVAL_MS = 20000;/);
assert.match(renderer, /startSocialLiveUpdates\(\);/);
assert.match(
    renderer,
    /function checkSocialLiveUpdates\(\)[\s\S]*?document\.hidden[\s\S]*?navigator\.onLine === false[\s\S]*?getSocialLivePollParams\(view\)/
);
assert.match(
    renderer,
    /function captureSocialTimelineAnchor\(view\)[\s\S]*?getBoundingClientRect\(\)[\s\S]*?function restoreSocialTimelineAnchor\(view, anchor\)[\s\S]*?window\.scrollTo/
);
assert.match(
    renderer,
    /function showSocialNewPostsBanner\(view, addedCount\)[\s\S]*?data-new-count[\s\S]*?function handleSocialNewPostsJump\(e\)[\s\S]*?behavior:\s*prefersReducedMotion \? 'auto' : 'smooth'/
);
assert.match(
    renderer,
    /function finishSocialLiveMerge\(view, newIds, updateCount, anchor\)[\s\S]*?showSocialNewPostsBanner\(view, ids\.size\)[\s\S]*?restoreSocialTimelineAnchor\(view, anchor\)/
);
assert.match(
    renderer,
    /function mergeSocialTimelineItems\(incomingItems, existingItems\)[\s\S]*?new Set\(\)[\s\S]*?seenIds\.has\(id\)/
);
assert.match(
    renderer,
    /function applySocialLiveItems\(view, liveSnapshot, newIds, updateCount\)[\s\S]*?silent:\s*true[\s\S]*?liveMerge:\s*true[\s\S]*?refreshCommunityUnread\(\)[\s\S]*?refreshCareFeedUnread\(\)/
);
assert.match(
    renderer,
    /function getSocialTimelineItemRevision\(view, item\)[\s\S]*?item\.updated_at[\s\S]*?item\.last_activity_at/
);
assert.match(renderer, /function loadCareFeed\(isLoadMore = false, options\)/);
assert.match(renderer, /function loadTopics\(type = null, isLoadMore = false, options\)/);
assert.match(renderer, /let currentTopicScope = localStorage\.getItem\('setae_topic_scope'\) \|\| 'all';/);
assert.match(renderer, /function handleCommunityScopeClick\(e\)[\s\S]*?localStorage\.setItem\('setae_topic_scope', currentTopicScope\)[\s\S]*?loadTopics\(currentTopicListType, false\)/);
assert.match(renderer, /function getSocialLivePollParams\(view\)[\s\S]*?scope:\s*currentTopicScope \|\| 'all'/);
assert.match(renderer, /visibilitychange', handleSocialLiveEnvironmentChange/);
assert.match(renderer, /online offline', handleSocialLiveEnvironmentChange/);
assert.doesNotMatch(renderer, /handleSocialTimelineRefresh|syncPrimaryWorkspaceMode/);
assert.match(
    renderer,
    /function positionCareFeedActionMenu\(\$actions\)[\s\S]*?window\.visualViewport[\s\S]*?document\.documentElement\.clientWidth[\s\S]*?getBoundingClientRect\(\)[\s\S]*?addClass\('is-viewport-positioned'\)[\s\S]*?Math\.max\(minLeft, Math\.min\(left, maxLeft\)\)/
);
assert.match(renderer, /resize\.setaeCareFeedActionMenu scroll\.setaeCareFeedActionMenu/);
assert.match(renderer, /\['ArrowDown', 'ArrowUp', 'Home', 'End'\]/);
assert.match(
    renderer,
    /removeClass\('is-viewport-positioned'\)[\s\S]*?visibility:\s*''/
);
assert.match(renderer, /const excerptText = decodeDisplayText\(topic\.excerpt \|\| ''\);/);
assert.match(renderer, /<p class="setae-topic-excerpt social-post-text">/);
assert.doesNotMatch(communityTemplate, /id="btn-create-topic"/);

assert.match(
    apiClient,
    /function createTopic\(data, callback\)[\s\S]*?data instanceof FormData[\s\S]*?options\.processData = false;[\s\S]*?options\.contentType = false;/
);
assert.match(apiClient, /function fetchCareFeed\(params, callback, errorCallback\)[\s\S]*?cache:\s*false/);
assert.match(apiClient, /function fetchTopics\(params, callback, errorCallback\)[\s\S]*?cache:\s*false/);
assert.match(topicApi, /'image'\s*=>\s*\$this->get_topic_image_url\(\$id\)/);
assert.match(topicApi, /'image_alt'\s*=>\s*sanitize_text_field/);
assert.match(topicApi, /'has_cw'\s*=>\s*\(bool\) get_post_meta\(\$id, '_setae_topic_has_cw'/);
assert.match(topicApi, /'author_handle'\s*=>\s*\$author_handle/);
assert.match(topicApi, /Setae_Public_Identity::get_handle\(\$author_id\)/);
assert.match(topicApi, /'is_edited'\s*=>\s*\$is_edited/);
assert.match(topicApi, /'viewer_relationship'\s*=>\s*Setae_API_Social::get_relationship/);
assert.match(topicApi, /\$scope = sanitize_key\(\(string\) \$request->get_param\('scope'\)\)/);
assert.match(topicApi, /\$scope === 'mine'[\s\S]*?\$args\['author'\] = \$viewer_id/);
assert.match(topicApi, /\$scope === 'following'[\s\S]*?get_followed_user_ids\(get_current_user_id\(\)\)[\s\S]*?\$args\['author__in'\] = \$followed_user_ids/);
assert.match(topicApi, /validate_topic_image_upload/);
assert.match(topicApi, /handle_topic_image_upload/);
assert.match(topicApi, /media_handle_upload/);
assert.match(
    topicApi,
    /\$per_page = \$request->get_param\('per_page'\)[\s\S]*?max\(1, min\(20, \$per_page\)\)/
);
assert.match(spiderApi, /'handle'\s*=>\s*\$author \? Setae_Public_Identity::get_handle\(\$author_id\) : ''/);
assert.match(spiderApi, /'handle'\s*=>\s*\$author_id \? Setae_Public_Identity::get_handle\(\$author_id\) : ''/);
assert.match(socialApi, /'handle'\s*=>\s*Setae_Public_Identity::get_handle\(\$user_id\)/);
assert.doesNotMatch(
    [topicApi, spiderApi, socialApi, careTemplate, communityTemplate].join('\n'),
    /user_nicename/
);

assert.match(publicIdentity, /const META_KEY = '_setae_public_handle';/);
assert.match(publicIdentity, /const PREFIX = 'st_';/);
assert.match(publicIdentity, /const BODY_LENGTH = 10;/);
assert.match(publicIdentity, /random_int\(0, \$alphabet_length - 1\)/);
assert.doesNotMatch(publicIdentity, /user_login|user_email/);
assert.match(core, /require_once[\s\S]*?class-setae-public-identity\.php/);
assert.match(core, /add_action\('user_register', \$public_identity, 'ensure_for_user'\)/);
assert.match(dashboard, /wp_enqueue_style\('setae-global'[\s\S]*?array\('dashicons'\)/);
assert.match(dashboard, /'public_handle'\s*=>\s*\$public_handle/);
assert.match(publicProfile, /'public_handle'\s*=>\s*\$public_handle/);
assert.doesNotMatch(publicProfile, /\$user->user_login/);

assert.match(
    unifiedCss,
    /@media \(min-width: 1320px\)[\s\S]*?#section-care-feed \.care-feed-workspace,[\s\S]*?grid-template-columns:\s*minmax\(0, 680px\) minmax\(270px, 320px\) !important;/
);
assert.match(
    unifiedCss,
    /#section-care-feed #setae-care-feed-list,[\s\S]*?grid-template-columns:\s*minmax\(0, 1fr\) !important;[\s\S]*?gap:\s*0 !important;/
);
assert.match(
    unifiedCss,
    /\.social-timeline-post\s*\{[\s\S]*?grid-template-columns:\s*44px minmax\(0, 1fr\);[\s\S]*?border-bottom:\s*1px solid var\(--social-line\) !important;/
);
assert.match(
    unifiedCss,
    /@media \(max-width: 1319px\)[\s\S]*?\.social-filter-panel\.is-mobile-open[\s\S]*?display:\s*grid;/
);
assert.match(
    unifiedCss,
    /#section-care-feed \.social-timeline-post \.care-feed-media\.is-expandable\s*\{[\s\S]*?aspect-ratio:\s*16 \/ 10;/
);
assert.match(unifiedCss, /\.social-reaction-picker\s*\{[\s\S]*?z-index:\s*120;/);
assert.match(unifiedCss, /\.social-topic-media\s*\{[\s\S]*?aspect-ratio:\s*16 \/ 10;/);
assert.match(unifiedCss, /\.social-content-warning\s*\{/);
assert.match(unifiedCss, /\.social-quick-compose-count\s*\{[\s\S]*?conic-gradient/);
assert.match(unifiedCss, /\.social-compose-media-copy input\s*\{/);
assert.match(unifiedCss, /\.social-post-activity-note\s*\{/);
assert.match(
    unifiedCss,
    /@media \(min-width: 1600px\)[\s\S]*?grid-template-columns:\s*minmax\(280px, 300px\) minmax\(0, 638px\);/
);
assert.match(
    unifiedCss,
    /\.care-feed-action-menu\.is-viewport-positioned\s*\{[\s\S]*?position:\s*fixed !important;[\s\S]*?z-index:\s*2600 !important;[\s\S]*?max-width:\s*calc\(100vw - 24px\);/
);
assert.match(
    unifiedCss,
    /\.setae-content\s*\{[\s\S]*?border-radius:\s*16px !important;[\s\S]*?background:\s*#ffffff !important;/
);
assert.doesNotMatch(unifiedCss, /setae-social-mode|is-social-main/);
assert.match(
    unifiedCss,
    /@media \(min-width: 768px\) and \(max-width: 1319px\)[\s\S]*?max-width:\s*680px;/
);
assert.match(
    unifiedCss,
    /@media \(min-width: 1320px\)[\s\S]*?#section-care-feed \.social-hub-header,[\s\S]*?grid-template-columns:\s*minmax\(0, 680px\) minmax\(270px, 320px\);/
);
assert.match(
    unifiedCss,
    /@media \(min-width: 1600px\)[\s\S]*?#section-care-feed \.social-hub-header,[\s\S]*?grid-template-columns:\s*minmax\(280px, 300px\) minmax\(0, 638px\) minmax\(280px, 302px\);/
);
assert.match(
    unifiedCss,
    /\.social-live-status\s*\{[\s\S]*?border-radius:\s*10px;[\s\S]*?background:\s*var\(--social-surface-soft\);/
);
assert.match(unifiedCss, /\.social-live-status\[data-state="checking"\] \.social-live-dot/);
assert.match(unifiedCss, /\.social-timeline-post\.is-live-new\s*\{[\s\S]*?social-live-arrival/);
assert.match(unifiedCss, /\.social-new-posts-banner\s*\{[\s\S]*?position:\s*sticky;[\s\S]*?z-index:\s*32;/);
assert.match(unifiedCss, /\.social-compose-nav\s*\{[\s\S]*?display:\s*none;/);
assert.match(unifiedCss, /@media \(min-width: 1600px\)[\s\S]*?\.social-compose-nav\s*\{[\s\S]*?display:\s*grid;/);
assert.match(unifiedCss, /\.social-new-posts-banner\.is-visible \+ #setae-topic-list\s*\{[\s\S]*?padding-top:\s*48px;/);
assert.match(unifiedCss, /#section-com \.community-scope-row\s*\{[\s\S]*?grid-template-columns:\s*repeat\(3, minmax\(0, 1fr\)\)/);
assert.match(unifiedCss, /\.social-following-mark\s*\{/);
assert.match(unifiedCss, /\.social-reaction-toggle:hover[\s\S]*?color:\s*#a54851 !important;/);
assert.match(unifiedCss, /\.social-rail-trends\s*\{/);
assert.match(unifiedCss, /@media \(prefers-reduced-motion: reduce\)/);

assert.match(
    darkCss,
    /html\[data-setae-theme="dark"\] #section-care-feed,[\s\S]*?--social-surface:\s*#171e1a;/
);
assert.match(
    darkCss,
    /#setae-app \.social-timeline-post:hover\s*\{[\s\S]*?background:\s*var\(--social-surface-soft\) !important;/
);
assert.match(
    darkCss,
    /#setae-app \.social-quick-compose-input,[\s\S]*?background:\s*transparent !important;[\s\S]*?color:\s*var\(--social-ink\) !important;/
);
assert.match(darkCss, /\.social-reaction-picker[\s\S]*?background:\s*var\(--setae-surface-raised\) !important;/);
assert.match(darkCss, /\.social-content-warning,[\s\S]*?background:\s*var\(--social-accent-soft\) !important;/);
assert.match(darkCss, /\.social-compose-media-copy input,[\s\S]*?background:\s*#111814 !important;/);
assert.match(darkCss, /\.social-post-activity-note[\s\S]*?color:\s*var\(--social-muted\) !important;/);
assert.match(
    darkCss,
    /\.social-live-status\[data-state="syncing"\][\s\S]*?background:\s*var\(--social-accent-soft\) !important;/
);
assert.match(
    darkCss,
    /\.care-feed-action-menu\.is-viewport-positioned[\s\S]*?background:\s*var\(--setae-surface-raised\) !important;/
);
assert.match(darkCss, /#section-com \.community-scope-row[\s\S]*?background:\s*#101713 !important;/);
assert.match(darkCss, /\.social-compose-nav-item\.active[\s\S]*?background:\s*var\(--social-accent-soft\) !important;/);
assert.match(darkCss, /\.social-new-posts-banner[\s\S]*?background:\s*#2f8d5f !important;/);

assertBalancedCss(unifiedCss, 'Unified design CSS');
assertBalancedCss(darkCss, 'Dark mode CSS');

console.log('Navigation and social timeline tests passed');
