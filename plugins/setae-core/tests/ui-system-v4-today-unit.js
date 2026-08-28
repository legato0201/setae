const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');
const today = read('assets/app/pages/today.js');
const editor = read('assets/app/features/dashboard/editor.js');
const taskView = read('assets/app/features/tasks/view.js');
const widgets = read('assets/app/widgets/core.js');
const app = read('assets/app/app.js');
const todayCss = read('assets/app/styles/screens/today.css');
const taskWorkspaceCss = read('assets/app/styles/patterns/task-workspace.css');
const shell = read('includes/frontend/class-setae-app-shell.php');
const fixture = read('tests/fixtures/today-v4.html');

assert.ok(fs.existsSync(path.join(root, 'assets/app/styles/screens/today.css')));
assert.match(todayCss, /^@layer screens\s*\{/);
assert.equal(
  (todayCss.match(/\{/g) || []).length,
  (todayCss.match(/\}/g) || []).length,
  'Today screen CSS braces must be balanced'
);
assert.match(shell, /'setae-gui-today-screen'[\s\S]*?styles\/screens\/today\.css[\s\S]*?'setae-gui-quick-record-screen'/);
assert.match(shell, /'setae-gui-records-screen'[\s\S]*?'setae-gui-today-screen'/);

const rawControl = /<(?:button|input|select|textarea)\b/i;
assert.doesNotMatch(today, rawControl, 'Today must compose controls from primitives');
assert.doesNotMatch(editor, rawControl, 'Dashboard editor must compose controls from primitives');
['button', 'iconButton'].forEach((name) => assert.match(today, new RegExp(`\\b${name}\\b`)));
['actionRow', 'button', 'checkboxControl', 'iconButton', 'selectField', 'sheet', 'textField'].forEach((name) => {
  assert.match(editor, new RegExp(`\\b${name}\\b`));
});

assert.match(today, /FIELD NOTEBOOK/);
assert.match(taskView, /お世話予定/);
assert.match(taskView, /今日の作業/);
assert.ok(today.indexOf('renderTaskWorkQueue') < today.indexOf('dashboard-sections'), 'Task workspace must render before dashboard sections');
assert.match(taskView, /期限超過/);
assert.match(taskView, /未対応/);
assert.match(taskView, /対応済み/);
assert.match(taskView, /task-work-summary/);
assert.match(taskView, /renderHandled\(handled\)[\s\S]*?taskSection\('upcoming'/);
assert.match(widgets, /renderWidgetRecordRow/);
assert.match(widgets, /renderWidgetPhotoButton/);

assert.equal(fs.existsSync(path.join(root, 'assets/app/styles/layouts.css')), false);
assert.match(taskWorkspaceCss, /\.care-workspace\s*\{/, 'Task Workspace pattern must support Today and standalone Care views');
assert.match(todayCss, /\.today-workbench \.task-workspace/);
assert.match(todayCss, /\.dashboard-sections:not\(\.is-editing\)[\s\S]*?\.widget-description/);
assert.match(todayCss, /\.dashboard-sections\.is-editing \.widget\s*\{[^}]*border:[^}]*border-radius:[^}]*background:/s);
assert.doesNotMatch(todayCss, /#[0-9a-f]{3,8}|rgba?\(|hsla?\(/i);
assert.doesNotMatch(todayCss, /font-size:\s*[0-9.]+(?:px|rem|em)/i);
assert.doesNotMatch(todayCss, /box-shadow\s*:/i);
todayCss.split('\n').filter((line) => /(?:margin|padding|gap)(?:-[a-z]+)?:/.test(line)).forEach((line) => {
  assert.doesNotMatch(line, /[1-9][0-9.]*px/i, `Today spacing must use tokens: ${line}`);
});
const breakpoints = [...todayCss.matchAll(/(?:min|max)-width:\s*([0-9]+)px/g)].map((match) => Number(match[1]));
assert.deepEqual([...new Set(breakpoints)].sort((a, b) => a - b), [767, 768, 1200]);

const runnableTaskView = taskView
  .replace(/^import .*;\s*$/gm, '')
  .replace(/export function /g, 'function ');
const sandbox = {};
vm.runInNewContext(`${runnableTaskView}\nthis.compactTaskQueue = compactTaskQueue;`, sandbox);
const items = (count, prefix) => Array.from({ length: count }, (_, index) => `${prefix}-${index}`);

const threeAndTwelve = sandbox.compactTaskQueue(items(3, 'overdue'), items(12, 'today'), { limit: 8, showAll: false });
assert.equal(threeAndTwelve.visibleOverdue.length, 3);
assert.equal(threeAndTwelve.visibleToday.length, 5);
assert.equal(threeAndTwelve.hiddenCount, 7);

const twelveAndFive = sandbox.compactTaskQueue(items(12, 'overdue'), items(5, 'today'), { limit: 8, showAll: false });
assert.equal(twelveAndFive.visibleOverdue.length, 8);
assert.equal(twelveAndFive.visibleToday.length, 0);
assert.equal(twelveAndFive.hiddenCount, 9);

const showAll = sandbox.compactTaskQueue(items(12, 'overdue'), items(5, 'today'), { limit: 8, showAll: true });
assert.equal(showAll.visibleOverdue.length, 12);
assert.equal(showAll.visibleToday.length, 5);
assert.equal(showAll.hiddenCount, 0);

assert.match(taskView, /count: overdue\.length/);
assert.match(taskView, /count: today\.length/);
assert.match(taskView, /残り\$\{compactQueue\.hiddenCount\}件を表示/);
assert.match(app, /showAll:\s*!state\.todayTasks\.showAll/, 'Expand action must also collapse the queue');
assert.match(fixture, /tasks/);
assert.match(fixture, /dashboardEditing: editing/);
assert.match(fixture, /Typhochlaena seladonia living collection specimen with an exceptionally long scientific identification/);

console.log('UI System v4 Today Workbench tests passed');
