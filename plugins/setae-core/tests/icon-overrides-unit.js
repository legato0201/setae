const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

(async () => {
  global.window = { SETAE_CONFIG: { iconOverrides: {}, debug: true } };
  const warnings = [];
  const originalWarn = console.warn;
  console.warn = (...args) => warnings.push(args.join(' '));
  const moduleUrl = `${pathToFileURL(path.resolve(__dirname, '../assets/app/components/icons.js')).href}?icon-overrides-test=1`;
  const { icon, iconNames, iconRegistryKeys } = await import(moduleUrl);

  assert.equal(iconNames.length, 41, 'All existing App icons and the copy action should remain available.');
  assert.equal(Object.keys(iconRegistryKeys).length, 41, 'All App icons should have Registry keys.');
  assert.equal(iconRegistryKeys.collection, 'nav.collection');
  assert.equal(iconRegistryKeys.feed, 'action.feed');
  assert.equal(iconRegistryKeys.calendar, 'public.calendar');
  assert.equal(iconRegistryKeys.copy, 'ui.copy');

  const defaultCollection = icon('collection');
  assert.match(defaultCollection, /<rect width="20" height="5"/);
  assert.match(defaultCollection, /stroke-width="1\.5"/);

  global.window.SETAE_CONFIG.iconOverrides['nav.collection'] = '<svg viewBox="0 0 32 32" width="512" height="512" fill="#ff3366" aria-hidden="true" focusable="false"><circle cx="16" cy="16" r="12"/></svg>';
  const customCollection = icon('collection', 'test-icon');
  assert.match(customCollection, /class="ui-icon is-custom-icon test-icon"/);
  assert.match(customCollection, /fill="#ff3366"/);
  assert.doesNotMatch(customCollection, /width="512"/);
  assert.doesNotMatch(customCollection, /height="512"/);
  assert.doesNotMatch(customCollection, /stroke-width="1\.5"/);

  global.window.SETAE_CONFIG.iconOverrides['nav.collection'] = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="8"/></svg>';
  const namespacedCollection = icon('collection');
  assert.match(namespacedCollection, /class="ui-icon is-custom-icon"/);
  assert.match(namespacedCollection, /<circle cx="12" cy="12" r="8"/);

  global.window.SETAE_CONFIG.iconOverrides['nav.collection'] = '<svg viewBox="0 0 24 24" onload="alert(1)"><script>alert(1)</script></svg>';
  const failedSafe = icon('collection');
  assert.match(failedSafe, /<rect width="20" height="5"/);
  assert.doesNotMatch(failedSafe, /script|onload/);
  assert.ok(warnings.some((message) => message.includes('[SETAE Icon Registry] Custom SVG rejected: nav.collection')));

  const unknown = icon('not-registered');
  assert.match(unknown, /M4 19\.5A2\.5/);

  const componentsCss = fs.readFileSync(path.resolve(__dirname, '../assets/app/styles/components.css'), 'utf8');
  const specimenCss = fs.readFileSync(path.resolve(__dirname, '../assets/app/styles/screens/specimen.css'), 'utf8');
  const collectionFixture = fs.readFileSync(path.resolve(__dirname, 'fixtures/ui-system-v4-collection-preview.html'), 'utf8');
  assert.doesNotMatch(componentsCss, /\.ui-icon\s*\{[^}]*stroke-width/s, 'Shared icon CSS must not override custom stroke width.');
  assert.match(specimenCss, /\.ui-icon:not\(\.is-custom-icon\)/, 'Favorite state styling should preserve custom fill icons.');
  assert.match(collectionFixture, /previewParams\.get\('customIcon'\) === '1'/, 'The App fixture must exercise a frontend Registry override.');

  console.warn = originalWarn;

  console.log('icon override tests passed');
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
