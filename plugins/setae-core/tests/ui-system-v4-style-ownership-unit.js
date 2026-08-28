const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const stylesRoot = path.join(root, 'assets/app/styles');

function cssFiles(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const absolute = path.join(directory, entry.name);
    return entry.isDirectory() ? cssFiles(absolute) : entry.name.endsWith('.css') ? [absolute] : [];
  });
}

function splitSelectors(value) {
  const selectors = [];
  let current = '';
  let depth = 0;
  for (const character of value) {
    if (character === '(' || character === '[') depth += 1;
    if (character === ')' || character === ']') depth -= 1;
    if (character === ',' && depth === 0) {
      if (current.trim()) selectors.push(current.trim().replace(/\s+/g, ' '));
      current = '';
    } else {
      current += character;
    }
  }
  if (current.trim()) selectors.push(current.trim().replace(/\s+/g, ' '));
  return selectors;
}

function collectSelectors(source, file, result) {
  const css = source.replace(/\/\*[\s\S]*?\*\//g, '');
  let index = 0;
  while (index < css.length) {
    while (index < css.length && /\s/.test(css[index])) index += 1;
    const start = index;
    while (index < css.length && css[index] !== '{' && css[index] !== '}') index += 1;
    if (index >= css.length || css[index] === '}') {
      index += 1;
      continue;
    }
    const prelude = css.slice(start, index).trim();
    index += 1;
    let depth = 1;
    let end = index;
    while (end < css.length && depth > 0) {
      if (css[end] === '{') depth += 1;
      else if (css[end] === '}') depth -= 1;
      end += 1;
    }
    assert.equal(depth, 0, `${path.relative(root, file)} has an unbalanced CSS block`);
    const body = css.slice(index, end - 1);
    index = end;
    if (/^@(layer|media|supports|container|document)\b/.test(prelude)) {
      collectSelectors(body, file, result);
    } else if (prelude && !prelude.startsWith('@')) {
      splitSelectors(prelude).forEach((selector) => {
        if (!result.has(selector)) result.set(selector, new Set());
        result.get(selector).add(path.relative(root, file).split(path.sep).join('/'));
      });
    }
  }
}

const files = cssFiles(stylesRoot);
const selectors = new Map();
files.forEach((file) => collectSelectors(fs.readFileSync(file, 'utf8'), file, selectors));

// Reset owns browser normalization while Foundation owns semantic defaults.
const duplicateAllowlist = new Map([
  ['html', ['assets/app/styles/foundation.css', 'assets/app/styles/reset.css']],
  ['body', ['assets/app/styles/foundation.css', 'assets/app/styles/reset.css']],
  ['button', ['assets/app/styles/foundation.css', 'assets/app/styles/reset.css']]
]);
const duplicateViolations = [...selectors.entries()].flatMap(([selector, owners]) => {
  if (owners.size < 2) return [];
  const actual = [...owners].sort();
  const allowed = duplicateAllowlist.get(selector)?.slice().sort();
  return allowed && JSON.stringify(actual) === JSON.stringify(allowed)
    ? []
    : [`${selector}: ${actual.join(', ')}`];
});
assert.deepEqual(duplicateViolations, [], `Cross-owner selector collisions:\n${duplicateViolations.join('\n')}`);

const architectureFiles = files.filter((file) => /\/styles\/(?:components(?:\/|\.css)|patterns\/|screens\/|app-frame\.css)/.test(file.split(path.sep).join('/')));
architectureFiles.forEach((file) => {
  const source = fs.readFileSync(file, 'utf8');
  assert.doesNotMatch(source, /#[0-9a-f]{3,8}|rgba?\(|hsla?\(/i, `${path.relative(root, file)} must use semantic color tokens`);
});

const importantViolations = [];
files.forEach((file) => {
  const source = fs.readFileSync(file, 'utf8');
  source.split('\n').forEach((line, index) => {
    if (!line.includes('!important')) return;
    const relative = path.relative(root, file).split(path.sep).join('/');
    const resetException = relative === 'assets/app/styles/reset.css' && /#setae-gui-root img\.emoji/.test(source);
    const printStart = source.lastIndexOf('@media print', source.indexOf(line));
    const printException = relative === 'assets/app/styles/screens/qr.css' && printStart >= 0;
    if (!resetException && !printException) importantViolations.push(`${relative}:${index + 1}`);
  });
});
assert.deepEqual(importantViolations, [], `Disallowed !important declarations: ${importantViolations.join(', ')}`);

const breakpointViolations = [];
files.forEach((file) => {
  const source = fs.readFileSync(file, 'utf8');
  for (const media of source.matchAll(/@media\s*([^\{]+)/g)) {
    for (const width of media[1].matchAll(/(?:min|max)-width:\s*([0-9]+)px/g)) {
      if (![767, 768, 1199, 1200].includes(Number(width[1]))) {
        breakpointViolations.push(`${path.relative(root, file)}: ${media[0].trim()}`);
      }
    }
  }
});
assert.deepEqual(breakpointViolations, [], `Non-standard breakpoints:\n${breakpointViolations.join('\n')}`);

console.log(`UI System v4 style ownership checks passed (${selectors.size} selectors, ${duplicateAllowlist.size} documented reset/foundation exceptions)`);
