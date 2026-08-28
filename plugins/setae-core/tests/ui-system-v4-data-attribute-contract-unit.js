const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const appRoot = path.join(root, 'assets/app');
const primitivePath = path.join(appRoot, 'components/primitives.js');
const primitiveSource = fs.readFileSync(primitivePath, 'utf8')
  .replace(/^import .*;\n/gm, '')
  .replace(/\bexport\s+(?=(?:const|function|class)\b)/g, '');
const escapeHtml = (value) => String(value ?? '')
  .replaceAll('&', '&amp;')
  .replaceAll('"', '&quot;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;');
const context = {
  console,
  escapeHtml,
  icon: () => '',
  formatDateFieldValue: (value) => String(value || ''),
  safeHttpUrl: (value, fallback = '') => value || fallback
};
vm.createContext(context);
vm.runInContext(`${primitiveSource}\nthis.exports = { canonicalDataAttributeName, dataAttributes, button, iconButton, actionRow, contentAction, menuItem, actionMenu, selectionRow, segmentedControl };`, context);
const primitives = context.exports;

assert.equal(primitives.canonicalDataAttributeName('recordType'), 'record-type');
assert.equal(primitives.canonicalDataAttributeName('row_id'), 'row-id');
assert.equal(primitives.canonicalDataAttributeName('data-animal-id'), 'animal-id');
assert.equal(primitives.dataAttributes({ animalId: 12, recordType: 'pairing', rowId: 'r1' }), 'data-animal-id="12" data-record-type="pairing" data-row-id="r1"');
assert.throws(() => primitives.dataAttributes({ 'bad key': 'x' }), /unsafe/);
assert.throws(() => primitives.dataAttributes({ onClick: 'x' }), /unsafe/);
assert.throws(() => primitives.dataAttributes({ recordType: 'pairing', 'record-type': 'observation' }), /collision/);

const renderers = [
  primitives.button('記録', { data: { animalId: 1, recordType: 'pairing' } }),
  primitives.iconButton('close', { label: '閉じる', data: { rowId: 2 } }),
  primitives.actionRow({ label: '個体', data: { animalId: 3 } }),
  primitives.contentAction({ contentHtml: '個体', data: { animalId: 4 } }),
  primitives.menuItem('項目', { data: { recordType: 'growth' } }),
  primitives.actionMenu('操作', [{ label: '項目', data: { animalId: 5 } }]),
  primitives.selectionRow({ label: '選択', data: { rowId: 6 } }),
  primitives.segmentedControl([{ id: 'pairing', label: 'ペアリング' }], { activeId: 'pairing', dataKey: 'record-type' })
];
assert.ok(renderers.every((html) => /data-(?:animal-id|record-type|row-id)=/.test(html)));

const activitySource = fs.readFileSync(path.join(appRoot, 'components/activity-list.js'), 'utf8');
assert.match(activitySource, /import \{ dataAttributes \} from '\.\/primitives\.js'/);

function javascriptFiles(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) return javascriptFiles(absolute);
    return entry.name.endsWith('.js') ? [absolute] : [];
  });
}

function dataObjectKeys(source) {
  const found = [];
  const matcher = /\bdata\s*:\s*\{/g;
  let match;
  while ((match = matcher.exec(source))) {
    const start = source.indexOf('{', match.index);
    let depth = 1;
    let quote = '';
    let escaped = false;
    let index = start + 1;
    for (; index < source.length && depth; index += 1) {
      const character = source[index];
      if (quote) {
        if (escaped) escaped = false;
        else if (character === '\\') escaped = true;
        else if (character === quote) quote = '';
        continue;
      }
      if (character === '"' || character === "'" || character === '`') { quote = character; continue; }
      if (character === '{') depth += 1;
      else if (character === '}') depth -= 1;
    }
    const body = source.slice(start + 1, index - 1);
    let bodyDepth = 0;
    let bodyQuote = '';
    let bodyEscaped = false;
    for (let cursor = 0; cursor < body.length; cursor += 1) {
      const character = body[cursor];
      if (bodyQuote) {
        if (bodyEscaped) bodyEscaped = false;
        else if (character === '\\') bodyEscaped = true;
        else if (character === bodyQuote) bodyQuote = '';
        continue;
      }
      if (character === '"' || character === "'" || character === '`') { bodyQuote = character; continue; }
      if (character === '{' || character === '[' || character === '(') { bodyDepth += 1; continue; }
      if (character === '}' || character === ']' || character === ')') { bodyDepth -= 1; continue; }
      if (bodyDepth !== 0 || !/[A-Za-z_$]/.test(character)) continue;
      const keyMatch = body.slice(cursor).match(/^([A-Za-z_$][A-Za-z0-9_$]*)\s*:/);
      if (keyMatch) {
        found.push(keyMatch[1]);
        cursor += keyMatch[1].length - 1;
      }
    }
    matcher.lastIndex = index;
  }
  return found;
}

const auditedFiles = javascriptFiles(appRoot).filter((file) => {
  if (path.basename(file) === 'app.js') return false;
  return /from ['"][^'"]*components\/primitives\.js['"]|from ['"]\.\/primitives\.js['"]/.test(fs.readFileSync(file, 'utf8'));
});
const camelCaseKeys = auditedFiles.flatMap((file) => dataObjectKeys(fs.readFileSync(file, 'utf8'))
  .filter((key) => /[A-Z]/.test(key))
  .map((key) => `${path.relative(root, file)}:${key}`));
assert.deepEqual(camelCaseKeys, [], `Primitive data objects must use kebab-case:\n${camelCaseKeys.join('\n')}`);

console.log('Data attribute contract unit checks passed');
