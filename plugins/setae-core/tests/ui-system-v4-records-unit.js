const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');
const records = read('assets/app/pages/records.js');
const primitives = read('assets/app/components/primitives.js');
const actionMenuCss = read('assets/app/styles/components/action-menu.css');
const ledgerCss = read('assets/app/styles/patterns/ledger.css');
const recordsCss = read('assets/app/styles/screens/records.css');
const shell = read('includes/frontend/class-setae-app-shell.php');
const fixture = read('tests/fixtures/records-v4.html');

assert.ok(fs.existsSync(path.join(root, 'assets/app/styles/patterns/ledger.css')));
assert.ok(fs.existsSync(path.join(root, 'assets/app/styles/screens/records.css')));
assert.match(ledgerCss, /^@layer patterns\s*\{/);
assert.match(recordsCss, /^@layer screens\s*\{/);
for (const [name, source] of [['Ledger', ledgerCss], ['Records', recordsCss]]) {
  assert.equal((source.match(/\{/g) || []).length, (source.match(/\}/g) || []).length, `${name} CSS braces must be balanced`);
  assert.doesNotMatch(source, /#[0-9a-f]{3,8}|rgba?\(|hsla?\(/i, `${name} colors must use tokens`);
  assert.doesNotMatch(source, /font-size:\s*[0-9.]+(?:px|rem|em)/i, `${name} typography must use tokens`);
  assert.doesNotMatch(source, /border-radius:\s*[1-9][0-9.]*(?:px|rem|em|%)/i, `${name} radii must use tokens`);
  assert.doesNotMatch(source, /box-shadow\s*:/i, `${name} must remain a rule-based ledger`);
}

const rawControl = /<(?:button|input|select|textarea)\b/i;
assert.doesNotMatch(records, rawControl, 'Records must compose controls from primitives');
['actionMenu', 'button', 'emptyState', 'selectControl', 'statusIndicator', 'tabs', 'textButton'].forEach((name) => {
  assert.match(records, new RegExp(`\\b${name}\\b`), `Records must use ${name}`);
});
assert.match(primitives, /export function textButton/);
assert.match(primitives, /item\?\.separator[\s\S]*?action-menu-separator/);
assert.match(actionMenuCss, /\.action-menu-separator/);
assert.match(actionMenuCss, /\.action-menu \.menu-item\.danger/);

assert.match(records, /workbench-ledger records-ledger/);
assert.match(records, /workbench-ledger-row records-ledger-row/);
assert.doesNotMatch(records, /class="[^"]*(?:surface|record-card|card-grid)/);
assert.match(ledgerCss, /grid-template-columns:\s*var\(--ledger-date-width\) var\(--space-5\) minmax\(0, 1fr\) var\(--touch-target\)/);
assert.match(ledgerCss, /@media \(max-width:\s*767px\)[\s\S]*?grid-template-columns:\s*var\(--space-5\) minmax\(0, 1fr\) var\(--touch-target\)/);
assert.match(ledgerCss, /@media \(max-width:\s*767px\)[\s\S]*?\.workbench-ledger-content\s*\{[^}]*grid-row:\s*2/s);

assert.match(records, /function recordTarget/);
assert.match(records, /open-journal-enclosure/);
assert.match(records, /open-journal-nursery/);
assert.match(records, /'animal-id'/);
assert.match(records, /scientificName\(animal\)/);
assert.match(records, /nurseryCodeRange\(nursery\)/);
assert.match(recordsCss, /\.records-target-description\.is-taxon\s*\{[^}]*font-family:\s*var\(--font-taxon\)[^}]*font-style:\s*italic/s);

assert.match(records, /role:\s*'record-filter'/);
assert.match(records, /records-count/);
assert.match(records, /まだ記録がありません/);
assert.match(records, /actionLabel:\s*'最初の記録を追加'/);
assert.match(records, /renderQrWorkspace\(\{ qr, animals \}\)/);

['toggle-refused', 'share-record', 'delete-record'].forEach((action) => assert.match(records, new RegExp(`action: '${action}'`)));
assert.match(records, /items\.push\(\{ separator:\s*true \}\)/);
assert.match(records, /className:\s*'danger'/);
assert.match(records, /iconName:\s*'more'/);
assert.match(records, /iconOnly:\s*true/);
assert.match(records, /item\.targetType === 'enclosure' \|\| item\.targetType === 'nursery'/);

assert.equal(fs.existsSync(path.join(root, 'assets/app/styles/layouts.css')), false);
assert.match(shell, /'setae-gui-ledger-pattern'[\s\S]*?styles\/patterns\/ledger\.css[\s\S]*?'setae-gui-registry-pattern'/);
assert.match(shell, /'setae-gui-records-screen'[\s\S]*?styles\/screens\/records\.css[\s\S]*?'setae-gui-today-screen'/);
assert.match(shell, /'setae-gui-nursery-screen'[\s\S]*?'setae-gui-records-screen'/);
assert.match(shell, /'setae-gui-husbandry-screen'[\s\S]*?'setae-gui-nursery-screen'/);
assert.match(shell, /'setae-gui-qr-screen'[\s\S]*?'setae-gui-husbandry-screen'/);
assert.match(shell, /'setae-gui-community-screen'[\s\S]*?'setae-gui-qr-screen'/);
assert.match(shell, /'setae-gui-settings-screen'[\s\S]*?'setae-gui-community-screen'/);

assert.match(fixture, /renderRecords/);
assert.match(fixture, /count/);
assert.match(fixture, /fixtureParams\.get\('view'\) \|\| 'history'/);
assert.match(fixture, /styles\/screens\/qr\.css/);
assert.match(fixture, /Typhochlaena seladonia/);
assert.match(fixture, /Rack A \/ Upper/);
assert.match(fixture, /Array\.from\(\{ length:\s*84 \}/);
assert.match(fixture, /dataset\.overflow/);
assert.match(fixture, /dataset\.rowRadius/);
assert.match(fixture, /dataset\.rowShadow/);

console.log('UI System v4 Records Ledger tests passed');
