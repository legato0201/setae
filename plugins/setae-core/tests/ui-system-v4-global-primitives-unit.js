const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const appRoot = path.join(root, 'assets/app');
const primitivePath = path.join(appRoot, 'components/primitives.js');
const rawControl = /<(?:button|input|select|textarea)\b/i;

function javascriptFiles(directory) {
  const results = [];
  fs.readdirSync(directory, { withFileTypes: true }).forEach((entry) => {
    if (entry.name === 'vendor') return;
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) results.push(...javascriptFiles(absolute));
    else if (entry.name.endsWith('.js')) results.push(absolute);
  });
  return results;
}

const violations = javascriptFiles(appRoot)
  .filter((file) => file !== primitivePath)
  .flatMap((file) => fs.readFileSync(file, 'utf8').split('\n')
    .map((line, index) => ({ file, line, number: index + 1 }))
    .filter(({ line }) => rawControl.test(line)));
assert.deepEqual(violations, [], violations.map(({ file, number, line }) => `${path.relative(root, file)}:${number} ${line.trim()}`).join('\n'));
assert.match(fs.readFileSync(primitivePath, 'utf8'), rawControl, 'The primitive owner must render native controls');

const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const contracts = [
  ['assets/app/pages/auth.js', /textField\(/, /checkboxControl\(/, /button\(/, /textButton\(/],
  ['assets/app/components/modals.js', /selectField\(/, /textareaField\(/, /dateField\(/, /fileField\(/, /button\(/],
  ['assets/app/features/animals/view-editor.js', /textField\(/, /selectField\(/, /checkboxControl\(/, /sheet\(/],
  ['assets/app/features/care/view.js', /contentAction\(/, /button\(/],
  ['assets/app/features/tasks/view.js', /contentAction\(/, /button\(/, /iconButton\(/],
  ['assets/app/widgets/core.js', /actionRow\(/, /contentAction\(/, /textButton\(/],
  ['assets/app/components/content.js', /=> tabs\(/, /=> emptyState\(/],
  ['assets/app/components/patterns.js', /return contentAction\(/]
];
contracts.forEach(([file, ...patterns]) => patterns.forEach((pattern) => assert.match(read(file), pattern, `${file} must delegate to ${pattern}`)));

const modals = read('assets/app/components/modals.js');
assert.doesNotMatch(modals, /function filePicker\b/);
[
  'taskActionForm',
  'qrSettingsForm',
  'feederActionForm',
  'eggBatchForm',
  'finishEggForm',
  'topicForm',
  'reportForm',
  'externalTokenForm',
  'liveSessionForm',
  'confirmDialog'
].forEach((name) => assert.match(modals, new RegExp(`function ${name}\\b`)));

console.log(`Global primitive ownership checks passed (${violations.length} raw controls outside primitives.js)`);
