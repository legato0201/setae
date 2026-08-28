const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const styles = [];
const walk = (directory) => fs.readdirSync(directory, { withFileTypes: true }).forEach((entry) => {
  const absolute = path.join(directory, entry.name);
  if (entry.isDirectory()) walk(absolute);
  else if (entry.name.endsWith('.css')) styles.push(absolute);
});
walk(path.join(root, 'assets/app/styles'));

const tokens = read('assets/app/styles/tokens.css');
const foundation = read('assets/app/styles/foundation.css');
const ledger = read('assets/app/styles/patterns/ledger.css');
const combined = styles.map((file) => fs.readFileSync(file, 'utf8')).join('\n');
assert.doesNotMatch(combined, /\bInter\b/i);
assert.match(tokens, /--font-ui:\s*system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif/);
['regular: 400', 'medium: 500', 'semibold: 600', 'bold: 700'].forEach((weight) => assert.match(tokens, new RegExp(`--weight-${weight.replace(': ', ':\\s*')}`)));

const weightViolations = [];
styles.forEach((file) => {
  const source = fs.readFileSync(file, 'utf8');
  for (const match of source.matchAll(/font-weight\s*:\s*([^;]+);/g)) {
    if (!/^var\(--weight-(?:regular|medium|semibold|bold)\)$/.test(match[1].trim())) weightViolations.push(`${path.relative(root, file)}: ${match[1].trim()}`);
  }
});
assert.deepEqual(weightViolations, []);

assert.match(foundation, /\.page-header h1,[\s\S]*font-size:\s*var\(--type-workbench-title\)[\s\S]*font-weight:\s*var\(--weight-bold\)/s);
assert.match(foundation, /\.section-title\s*\{[^}]*font-size:\s*var\(--type-section\)[^}]*line-height:\s*var\(--leading-display\)/s);
assert.match(foundation, /\.secondary,[\s\S]*font-size:\s*var\(--type-caption\)[\s\S]*line-height:\s*var\(--leading-body\)/s);
assert.match(foundation, /\.scientific-name,[\s\S]*font-family:\s*var\(--font-taxon\)[\s\S]*font-style:\s*italic/s);
assert.match(foundation, /\.animal-code,[\s\S]*font-family:\s*var\(--font-mono\)[\s\S]*font-variant-numeric:\s*tabular-nums/s);
assert.match(ledger, /\.workbench-ledger-date\s*\{[^}]*font-variant-numeric:\s*tabular-nums/s);
assert.match(foundation, /\.eyebrow,[\s\S]*letter-spacing:\s*var\(--tracking-eyebrow\)/s);

const rawLeadingViolations = styles.filter((file) => !file.split(path.sep).join('/').endsWith('/screens/qr.css')).flatMap((file) => {
  const source = fs.readFileSync(file, 'utf8');
  return [...source.matchAll(/line-height\s*:\s*(?:normal|\d+(?:\.\d+)?)/g)].map((match) => `${path.relative(root, file)}: ${match[0]}`);
});
assert.deepEqual(rawLeadingViolations, [], 'Only fixed physical-label print typography may use raw line-height values');

console.log('UI System v4 typography checks passed');
