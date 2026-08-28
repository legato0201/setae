const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = (relative) => fs.readFileSync(path.join(root, relative), 'utf8');

const media = read('assets/app/components/media.js');
const app = read('assets/app/app.js');
const specimen = read('assets/app/features/specimen/view.js');
const community = read('assets/app/pages/community.js');
const taskView = read('assets/app/features/tasks/view.js');
const tokens = read('assets/app/styles/tokens.css');
const speciesApi = read('includes/api/class-setae-api-species.php');
const publicFoundation = read('assets/css/public-foundation.css');

['specimen', 'spider', 'scorpion', 'insect', 'plant'].forEach((kind) => {
    assert.ok(fs.existsSync(path.join(root, `assets/images/specimen/${kind}.svg`)), `Missing ${kind} placeholder`);
});
assert.match(media, /renderMediaFrame/);
assert.match(media, /registerMediaFallbacks/);
assert.match(media, /MutationObserver/);
assert.match(app, /registerMediaFallbacks\(app\)/);
assert.match(app, /setFormPending\(form, true/);
assert.match(specimen, /data-specimen-tab-content/);
assert.match(specimen, /data-specimen-tab-navigation/);
assert.match(specimen, /export function renderSpecimenTabContent/);
assert.match(specimen, /export function renderSpecimenTabNavigation/);
assert.match(app, /function updateSpecimenTab/);
assert.doesNotMatch(app.match(/if \(action === 'specimen-tab'\)[^\n]+/)?.[0] || '', /render\(\)/);
const updateSpecimenTab = app.slice(app.indexOf('function updateSpecimenTab'), app.indexOf('\nfunction escapeForApp'));
assert.doesNotMatch(updateSpecimenTab, /classList\.toggle|aria-current/);
assert.match(updateSpecimenTab, /renderSpecimenTabNavigation\(state\.specimenTab\)/);
assert.match(taskView, /action:\s*'toggle-task-workspace'/);
assert.match(taskView, /action:\s*'toggle-task-section'/);
assert.match(taskView, /export function compactTaskQueue/);
assert.match(taskView, /safeOverdue\.slice\(0, safeLimit\)/);
assert.match(community, /representative_image/);
assert.match(community, /rel="license noopener noreferrer"/);
assert.match(speciesApi, /get_species_representative_image_data/);
assert.match(speciesApi, /CC BY-NC-SA 4\.0/);
assert.match(tokens, /--favorite:\s*#9a7738/);
assert.match(tokens, /--safe-top:\s*env\(safe-area-inset-top/);
assert.match(publicFoundation, /\.setae-brand-lockup/);
assert.doesNotMatch(publicFoundation, /\.setae-public-brand-mark|\.setae-logo-text::before/);

console.log('GUI v2 unification tests passed');
