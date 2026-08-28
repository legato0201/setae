const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');

const componentFiles = [
  'assets/app/styles/components/action-menu.css',
  'assets/app/styles/components/property-list.css',
  'assets/app/styles/components/activity-list.css',
  'assets/app/styles/components/identity-panel.css',
  'assets/app/styles/components/data-visualization.css',
  'assets/app/styles/components/media-grid.css'
];
const patternFiles = ['assets/app/styles/patterns/specimen-workspace.css'];
const screenFiles = ['assets/app/styles/screens/specimen.css'];
const styleFiles = [...componentFiles, ...patternFiles, ...screenFiles];

[
  'assets/app/components/property-list.js',
  'assets/app/components/activity-list.js',
  'assets/app/components/identity-panel.js',
  'assets/app/components/data-visualization.js',
  'assets/app/components/media-grid.js',
  'assets/app/features/specimen/field-label.js',
  'tests/fixtures/ui-system-v4-specimen-preview.html',
  ...styleFiles
].forEach((file) => assert.ok(fs.existsSync(path.join(root, file)), `Missing ${file}`));

const primitives = read('assets/app/components/primitives.js');
const propertyList = read('assets/app/components/property-list.js');
const activityList = read('assets/app/components/activity-list.js');
const identityPanel = read('assets/app/components/identity-panel.js');
const visualization = read('assets/app/components/data-visualization.js');
const mediaGrid = read('assets/app/components/media-grid.js');
const fieldLabel = read('assets/app/features/specimen/field-label.js');
const qrLabels = read('assets/app/features/qr/labels.js');
const qrView = read('assets/app/features/qr/view.js');
const specimenView = read('assets/app/features/specimen/view.js');
const app = read('assets/app/app.js');
const overlayController = read('assets/app/components/overlay-controller.js');
const shell = read('includes/frontend/class-setae-app-shell.php');
const tokens = read('assets/app/styles/tokens.css');
const styles = styleFiles.map(read).join('\n');

[
  [primitives, 'actionMenu'],
  [propertyList, 'propertyRow'],
  [propertyList, 'propertyList'],
  [activityList, 'activityRow'],
  [activityList, 'activityList'],
  [identityPanel, 'identityPanel'],
  [visualization, 'metricSummary'],
  [visualization, 'chartFrame'],
  [mediaGrid, 'mediaGrid']
].forEach(([source, name]) => assert.match(source, new RegExp(`export function ${name}`), `Missing component ${name}`));

assert.doesNotMatch(specimenView, /<(?:button|input|select|textarea)\b/i, 'Specimen view must render controls through primitives');
[
  'propertyList(',
  'activityList(',
  'activityRow(',
  'identityPanel(',
  'actionMenu(',
  'metricSummary(',
  'mediaGrid(',
  'chartFrame('
].forEach((call) => assert.match(specimenView, new RegExp(call.replace('(', '\\('))));

['概要', '生活史', '成長', '写真', '繁殖'].forEach((label) => assert.match(specimenView, new RegExp(`label: '${label}'`)));
assert.doesNotMatch(specimenView, /label: 'タイムライン'/);
assert.match(specimenView, /specimen-workspace-v4/);
assert.match(specimenView, /specimen-identity-panel/);
assert.match(specimenView, /fieldLabelSummary\(/);
assert.doesNotMatch(specimenView, /physical-field-label|renderPhysicalFieldLabel|specimen-label-full|specimen-accession-strip/);
assert.match(fieldLabel, /import \{ renderFieldLabel \} from '\.\.\/qr\/labels\.js'/);
assert.match(fieldLabel, /renderFieldLabel\(fieldLabelTarget\(animal, modalState\.target\), modalState\.labelConfig\)/);
assert.doesNotMatch(fieldLabel, /renderPhysicalFieldLabel|physical-field-label/);
assert.match(fieldLabel, /renderFieldLabelDialog/);
assert.match(qrView, /renderFieldLabel\(preview, config\)/);
assert.match(qrLabels, /map\(\(item\) => renderFieldLabel\(item, normalized\)\)/);
assert.match(qrLabels, /renderFieldLabel\(item, normalized\)/);

assert.equal(fs.existsSync(path.join(root, 'assets/app/styles/layouts.css')), false);
assert.doesNotMatch(styles, /physical-field-label|specimen-identification-actions/);

assert.doesNotMatch(styles, /(?:margin|padding|gap)(?:-[a-z]+)?:\s*[^;]*[1-9][0-9.]*px/i, 'Specimen spacing must use tokens');
assert.doesNotMatch(styles, /#[0-9a-f]{3,8}|rgba?\(|hsla?\(/i, 'Specimen colors must use semantic tokens');
assert.doesNotMatch(styles, /font-size:\s*[0-9.]+(?:px|rem|em)/i, 'Specimen typography must use tokens');
assert.doesNotMatch(styles, /border-radius:\s*[1-9][0-9.]*(?:px|rem|em|%)/i, 'Specimen radii must use tokens');

const viewportBreakpoints = [...styles.matchAll(/(?:min|max)-width:\s*([0-9]+)px/g)]
  .map((match) => Number(match[1]));
assert.deepEqual([...new Set(viewportBreakpoints)].sort((a, b) => a - b), [767, 768, 1199, 1200]);
assert.doesNotMatch(styles, /(?:420|520|680|719|720|759|760|1099|1100|1280|1500)px/);

assert.match(primitives, /<details class="action-menu/);
assert.match(primitives, /<summary class=/);
assert.match(primitives, /aria-haspopup="menu"/);
assert.match(primitives, /role="menu"/);
assert.match(primitives, /role="menuitem"/);
assert.match(app, /\.action-menu\[open\]/);
assert.match(app, /openMenu\.removeAttribute\('open'\)/);
assert.match(overlayController, /if \(event\.key !== 'Tab'\) return/);
assert.match(overlayController, /focusableElements\(panel, windowRef\)/);
assert.match(overlayController, /\[data-action\^="close-"\]/);
assert.match(styles, /:focus-visible/);
assert.match(styles, /var\(--touch-target\)/);
assert.match(tokens, /\[data-theme="dark"\]/);
assert.match(styles, /@media \(prefers-reduced-motion: no-preference\)/);

function assertBalancedCss(source, label) {
  const clean = source.replace(/\/\*[\s\S]*?\*\//g, '');
  let depth = 0;
  for (const character of clean) {
    if (character === '{') depth += 1;
    if (character === '}') depth -= 1;
    assert.ok(depth >= 0, `${label} closes a block before it opens`);
  }
  assert.equal(depth, 0, `${label} must have balanced blocks`);
}

styleFiles.forEach((file) => assertBalancedCss(read(file), file));

[
  'setae-gui-action-menu',
  'setae-gui-property-list',
  'setae-gui-activity-list',
  'setae-gui-identity-panel',
  'setae-gui-data-visualization',
  'setae-gui-media-grid',
  'setae-gui-specimen-workspace-pattern',
  'setae-gui-specimen-screen'
].forEach((handle) => assert.match(shell, new RegExp(`'${handle}'`)));

console.log('UI System v4 Specimen tests passed');
