const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const pluginRoot = path.resolve(__dirname, '..');
const read = (relativePath) => fs.readFileSync(path.join(pluginRoot, relativePath), 'utf8');

const appApi = read('includes/api/class-setae-api-app.php');
const spidersApi = read('includes/api/class-setae-api-spiders.php');
const enclosuresApi = read('includes/api/class-setae-api-enclosures.php');
const enclosuresDb = read('includes/db/class-setae-enclosures.php');
const tasksApi = read('includes/api/class-setae-api-tasks.php');
const babyGroupsApi = read('includes/api/class-setae-api-baby-groups.php');
const offlineApi = read('includes/api/class-setae-api-offline.php');
const qrApi = read('includes/api/class-setae-api-qr.php');
const qrManager = read('includes/class-setae-qr-manager.php');
const publicQr = read('includes/frontend/class-setae-public-qr.php');
const manager = read('includes/api/class-setae-api-manager.php');
const operations = read('includes/class-setae-app-operations.php');
const ajax = read('includes/class-setae-ajax.php');
const client = read('assets/js/modules/app-api.js');
const qrPrint = read('assets/js/modules/qr-print.js');
const offlineStore = read('assets/js/modules/offline-store.js');
const plugin = read('setae-core.php');

[
    '/app/bootstrap',
    '/operations',
    '/registration',
    '/session',
    '/password-reset',
    '/email-verification',
    '/me',
    '/ui/preferences',
    '/species/(?P<id>\\d+)/suggestions',
    '/metrics/events',
    '/admin/best-shots/(?P<id>\\d+)',
].forEach((route) => {
    assert.ok(appApi.includes(`'${route}'`), `Missing REST route: ${route}`);
});

assert.match(manager, /class-setae-api-app\.php/);
assert.match(manager, /new Setae_API_App\(\)/);
assert.match(manager, /app_controller->register_routes\(\)/);
assert.match(manager, /class-setae-api-enclosures\.php/);
assert.match(manager, /new Setae_API_Enclosures\(\)/);
assert.match(manager, /enclosures_controller->register_routes\(\)/);
assert.match(manager, /class-setae-api-tasks\.php/);
assert.match(manager, /tasks_controller->register_routes\(\)/);
assert.match(appApi, /'dashboard_sections'\s*=>\s*array\('type'\s*=>\s*'array'\)/);
assert.match(appApi, /'animal_saved_views'\s*=>\s*array\('type'\s*=>\s*'array'\)/);
assert.match(appApi, /'animal_card'\s*=>\s*array\('type'\s*=>\s*'object'\)/);
assert.match(appApi, /'personalization'\s*=>\s*array\('type'\s*=>\s*'object'\)/);
assert.match(appApi, /'care_profile'\s*=>\s*array\('type'\s*=>\s*'object'\)/);
assert.match(appApi, /'enclosure_care_profile'\s*=>\s*array\('type'\s*=>\s*'object'\)/);
assert.match(appApi, /'nursery_care_profile'\s*=>\s*array\('type'\s*=>\s*'object'\)/);
assert.match(appApi, /'husbandry_tab'\s*=>\s*array/);
assert.match(appApi, /function sanitize_animal_query\(/);
assert.match(appApi, /function sanitize_animal_card_config\(/);
assert.match(appApi, /function sanitize_personalization\(/);
assert.match(appApi, /function sanitize_care_profile\(/);
assert.match(appApi, /function sanitize_enclosure_care_profile\(/);
assert.match(appApi, /function sanitize_nursery_care_profile\(/);
assert.ok(tasksApi.includes("'/task-actions'"), 'Missing task lifecycle route');
assert.ok(tasksApi.includes("'/task-actions/batch'"), 'Missing task lifecycle batch route');
assert.match(tasksApi, /completed.*attempted.*deferred.*skipped/s);
assert.match(tasksApi, /\$target_type === 'nursery'/);
assert.match(tasksApi, /'was_required'/);
assert.match(offlineApi, /case 'save_task_action'/);
assert.match(offlineApi, /case 'save_task_actions_batch'/);
assert.match(offlineApi, /offline_owner_mismatch/);
assert.match(offlineApi, /\$owner_id !== \$user_id/);
assert.match(offlineStore, /owner_id: currentOwnerId\(\)/);
assert.match(offlineStore, /Object\.assign\(\{\}, mutation, \{ owner_id: ownerId \}\)/);
assert.ok(babyGroupsApi.includes("'/baby-groups/(?P<id>\\d+)/events'"), 'Missing Nursery event route');
assert.match(babyGroupsApi, /function recent_events_for_user\(/);
assert.match(babyGroupsApi, /count_check/);
assert.match(spidersApi, /Setae_API_Baby_Groups::recent_events_for_user/);
assert.match(spidersApi, /'\/care-events'/);
assert.match(spidersApi, /function get_recent_care_events\(/);
assert.match(spidersApi, /'\/journal-events'/);
assert.match(spidersApi, /function get_journal_events\(/);
assert.match(spidersApi, /'housing'/);
[
    '/enclosures',
    '/enclosures/(?P<id>\\d+)',
    '/enclosures/(?P<id>\\d+)/events',
    '/enclosures/(?P<id>\\d+)/occupancies',
    '/enclosures/(?P<id>\\d+)/occupancies/(?P<animal_id>\\d+)',
].forEach((route) => assert.ok(enclosuresApi.includes(`'${route}'`), `Missing enclosure route: ${route}`));
assert.match(enclosuresDb, /setae_enclosure_occupancies/);
assert.match(enclosuresDb, /setae_enclosure_events/);
assert.match(enclosuresDb, /function migrate_legacy_for_user\(/);
assert.match(enclosuresDb, /function get_animal_housing\(/);
assert.match(enclosuresDb, /function recent_events_for_user\(/);
assert.match(spidersApi, /'enclosure_id'/);
assert.match(qrApi, /\$source === 'enclosure'/);
assert.match(qrManager, /function ensure_enclosure_target\(/);
assert.match(qrManager, /\$type === 'enclosure'/);
assert.match(qrManager, /qr_enclosure_record_unsupported/);
assert.match(qrPrint, /SETAE · LIVING/);
assert.ok(qrApi.includes("'/qr/passport/(?P<code>"), 'Missing public QR passport route');
assert.match(qrApi, /\{4,8\}/);
assert.match(qrApi, /'permission_callback'\s*=>\s*'__return_true'/);
assert.match(qrApi, /consume_request_limit\('qr_passport'/);
assert.match(qrApi, /consume_request_limit\('qr_passport_missing'/);
assert.match(qrApi, /record_target_entries\(\$entries, get_current_user_id\(\)\)/);
assert.match(qrManager, /PUBLIC_MODE_META/);
assert.match(qrManager, /\$attempt < 64 \? 6/);
assert.match(qrManager, /\{4,8\}/);
assert.match(qrManager, /function get_public_passport_data\(/);
assert.match(qrManager, /'visibility'\s*=>\s*\$effective_visibility/);
assert.match(qrManager, /'life_history'\s*=>/);
assert.doesNotMatch(qrManager.match(/public static function get_public_passport_data[\s\S]*?^    }/m)?.[0] || '', /user_id|email|private_notes|location|enclosure_id|purchase/);
assert.match(publicQr.replaceAll('\\"', '"'), /meta name="robots" content="noindex,follow"/);
// The owner toolbar now opens management; the native claim contract is unchanged.
assert.match(publicQr, /\$_POST\['setae_qr_claim'\]/);
assert.match(publicQr, /\$_POST\['setae_qr_claim_nonce'\]/);
assert.match(publicQr, /Setae_QR_Manager::create_transfer_request\(\$target, get_current_user_id\(\)\)/);
assert.match(publicQr, /setae_qr_action.*open/);
assert.match(publicQr, /consume_request_limit\('qr_passport_page'/);
assert.match(offlineApi, /case 'create_qr_records'/);

[
    'track_event',
    'register_user',
    'get_profile',
    'update_profile',
    'submit_species_suggestion',
    'moderate_best_shot',
].forEach((method) => {
    assert.match(operations, new RegExp(`function ${method}\\(`));
});

[
    'Setae_App_Operations::track_event',
    'Setae_App_Operations::register_user',
    'Setae_App_Operations::update_profile',
    'Setae_App_Operations::submit_species_suggestion',
    'Setae_App_Operations::moderate_best_shot',
].forEach((call) => assert.ok(ajax.includes(call), `Legacy Ajax does not use ${call}`));

[
    'fetchAppBootstrap',
    'fetchOperations',
    'registerUser',
    'fetchSession',
    'createSession',
    'deleteSession',
    'requestPasswordReset',
    'verifyEmail',
    'fetchCurrentUser',
    'updateCurrentUser',
    'submitSpeciesSuggestion',
    'trackMetricEvent',
].forEach((name) => {
    assert.match(client, new RegExp(`${name}: ${name}`));
});

[
    'docs/api/README.md',
    'docs/api/app-and-account.md',
    'docs/api/animals-and-care.md',
    'docs/api/qr-and-passport.md',
    'docs/api/enclosures.md',
    'docs/api/tasks.md',
    'docs/api/community-and-catalog.md',
    'docs/api/integrations.md',
    'docs/api/legacy-migration.md',
    'docs/api/gui-rebuild.md',
    'docs/api/frontend-shell.md',
].forEach((file) => assert.ok(fs.existsSync(path.join(pluginRoot, file)), `Missing API document: ${file}`));

assert.match(plugin, /Version: 1\.0\.251/);
assert.match(plugin, /define\('SETAE_VERSION', '1\.0\.251\.1'\)/);

console.log('Application API contract tests passed');
