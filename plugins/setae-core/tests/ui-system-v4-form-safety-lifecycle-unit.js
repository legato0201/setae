const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'assets/app/components/form-safety-controller.js'), 'utf8');
const app = fs.readFileSync(path.join(root, 'assets/app/app.js'), 'utf8');

assert.match(source, /const activeForms = new Map\(\)/);
assert.match(source, /previous\?\.element === form \|\| previous\?\.dirty/);
assert.match(source, /if \(mountedKeys\.has\(key\)\) return;[\s\S]*activeForms\.delete\(key\)/);
assert.match(source, /dirtyFormsIn\(scope\)/);
assert.match(source, /保存していない入力が\$\{forms\.length\}件あります/);
assert.match(source, /guardedKeys\.forEach\(discardByKey\)/);
assert.match(source, /guardDialog\.dataset\.overlayBackdrop/);
assert.doesNotMatch(source, /guardDialog\.dataset\.action/);
assert.doesNotMatch(source, /findDirtyForm\(/);
assert.match(source, /formDraftHasRestorableChanges\(form, draft\)/);
assert.match(source, /policy === 'persist' && !dirty && !activeForms\.get\(key\)\?\.draftNoticeDismissed/);
assert.match(source, /dismissDraftNotice\(form\);\s*if \(!markDirty\(form\) && formDraftHasRestorableChanges/);
assert.match(source, /data-form-notice-host/);
assert.doesNotMatch(source, /button\('復元', \{[^}]*primary: true/);

assert.match(app, /formSafety\.guard\([\s\S]{0,180}\{ scope, mode: 'overlay' \}/);
assert.match(app, /\{ scope: app, mode: 'navigation' \}/);
assert.match(app, /resolveBackPriority\([\s\S]{0,900}action === 'close-menu'[\s\S]{0,900}mode: 'overlay'/);
assert.match(app, /notifyProgrammaticInput\(input\)/);
assert.match(app, /notifyProgrammaticInput\(dateInput, \{ change: true \}\)/);

console.log('Form Safety lifecycle unit checks passed');
