const assert = require('node:assert/strict');
const path = require('node:path');
const { launchBrowser, openFixture, screenshotPath, writeEvidence, evidenceDir } = require('./browser-v246-helpers.cjs');

const viewports = [
  { name: 'compact-320', width: 320, height: 844 },
  { name: 'compact-390', width: 390, height: 844 },
  { name: 'medium-768', width: 768, height: 1024 },
  { name: 'medium-1024', width: 1024, height: 1024 },
  { name: 'wide-1440', width: 1440, height: 1100 }
];
const states = [
  { name: 'avatar', query: { avatar: '1' } },
  { name: 'initial', query: { avatar: '0' } },
  { name: 'records-0', query: { count: '0' } },
  { name: 'records-1', query: { count: '1' } },
  { name: 'records-9', query: { count: '9' } },
  { name: 'records-10-plus', query: { count: '16' } },
  { name: 'long-identity', query: { long: '1' } },
  { name: 'guest', query: { auth: '0' } },
  { name: 'logged-in', query: { auth: '1' } },
  { name: 'registration-enabled', query: { registration: '1' } },
  { name: 'registration-disabled', query: { registration: '0' } },
  { name: 'not-found', query: { notfound: '1' } }
];

async function inspect(page) {
  return page.evaluate(() => {
    const visible = (node) => {
      const style = getComputedStyle(node);
      const rect = node.getBoundingClientRect();
      return !node.hidden && style.display !== 'none' && style.visibility !== 'hidden' && rect.width > 0 && rect.height > 0;
    };
    const controls = [...document.querySelectorAll('a[href], button, summary, input, select, textarea')].filter(visible);
    const media = [...document.querySelectorAll('.setae-public-profile-note-media')].filter(visible);
    const mediaRatios = media.map((node) => {
      const rect = node.getBoundingClientRect();
      return rect.width / rect.height;
    });
    const captionInsets = [...document.querySelectorAll('.setae-public-profile-note')].filter(visible).map((note) => {
      const image = note.querySelector('.setae-public-profile-note-media')?.getBoundingClientRect();
      const caption = note.querySelector('.setae-public-profile-note-caption')?.getBoundingClientRect();
      return image && caption ? Math.abs(caption.left - image.left) : 0;
    });
    const stats = [...document.querySelectorAll('.setae-public-profile-stats > div')].filter(visible);
    const notes = document.querySelector('.setae-public-profile-notes')?.getBoundingClientRect() || null;
    const side = document.querySelector('.setae-public-profile-side')?.getBoundingClientRect() || null;
    return {
      viewport: innerWidth,
      documentOverflow: document.documentElement.scrollWidth > innerWidth + 1,
      documentWidth: document.documentElement.scrollWidth,
      h1: [...document.querySelectorAll('h1')].filter(visible).length,
      main: [...document.querySelectorAll('main')].filter(visible).length,
      undersizedTargets: innerWidth <= 767
        ? controls.filter((node) => {
          const rect = node.matches('input[type="checkbox"]') ? (node.closest('label') || node).getBoundingClientRect() : node.getBoundingClientRect();
          return rect.height < 43.5 || rect.width < 43.5;
        }).map((node) => ({ tag: node.tagName, className: node.className, text: node.textContent.trim().slice(0, 30), width: node.getBoundingClientRect().width, height: node.getBoundingClientRect().height }))
        : [],
      mediaRatios,
      captionInsets,
      statsCount: stats.length,
      statsAligned: stats.every((row) => row.querySelector('dt') && row.querySelector('dd')),
      sideRailPosition: notes && side ? (innerWidth >= 768 ? side.left > notes.left : side.top >= notes.top) : true,
      notes: document.querySelectorAll('.setae-public-profile-note').length,
      privateNotes: document.querySelectorAll('.setae-public-profile-note:not([data-visibility="shared"])').length,
      hasEmpty: Boolean(document.querySelector('[data-empty]:not([hidden])')),
      registrationTriggers: document.querySelectorAll('[data-public-register]').length,
      registrationDialog: document.querySelectorAll('#setae-public-register-dialog').length
    };
  });
}

function validate(result, label) {
  assert.equal(result.documentOverflow, false, label + ': horizontal overflow (' + result.documentWidth + '/' + result.viewport + ')');
  assert.equal(result.h1, 1, label + ': exactly one visible h1');
  assert.equal(result.main, 1, label + ': exactly one visible main');
  assert.deepEqual(result.undersizedTargets, [], label + ': mobile targets must be at least 44px');
  result.mediaRatios.forEach((ratio) => assert.ok(Math.abs(ratio - (4 / 3)) < 0.03, label + ': field note media must remain 4:3'));
  result.captionInsets.forEach((inset) => assert.ok(inset <= 3, label + ': caption and media start lines must align'));
  assert.ok(result.statsCount === 0 || result.statsCount === 3, label + ': stats must remain a three-term definition list');
  assert.equal(result.statsAligned, true, label + ': every stat needs dt and dd');
  assert.equal(result.sideRailPosition, true, label + ': side rail must follow the responsive hierarchy');
  assert.equal(result.privateNotes, 0, label + ': fixture private records must not render');
}

(async () => {
  const browser = await launchBrowser();
  const results = [];
  try {
    for (const viewport of viewports) {
      for (const colorScheme of ['light', 'dark']) {
        const opened = await openFixture('public-profile-preview.html', { browser, viewport, colorScheme });
        const geometry = await inspect(opened.page);
        validate(geometry, viewport.name + '/' + colorScheme);
        const file = screenshotPath('public-profile-' + viewport.name + '-' + colorScheme + '.png');
        await opened.page.screenshot({ path: file, fullPage: true });
        results.push({ kind: 'viewport', viewport, colorScheme, screenshot: path.relative(evidenceDir, file), ...geometry });
        await opened.context.close();
      }
    }

    for (const state of states) {
      const opened = await openFixture('public-profile-preview.html', { browser, query: state.query });
      const geometry = await inspect(opened.page);
      validate(geometry, state.name);
      if (state.name === 'records-0') assert.equal(geometry.hasEmpty, true);
      if (state.name === 'records-1') assert.equal(geometry.notes, 1);
      if (state.name === 'records-9') assert.equal(geometry.notes, 9);
      if (state.name === 'records-10-plus') {
        assert.equal(geometry.notes, 9);
        assert.match(await opened.page.locator('[data-note-limit]').textContent(), /最新9件/);
      }
      if (state.name === 'registration-disabled') {
        assert.equal(geometry.registrationTriggers, 0);
        assert.equal(geometry.registrationDialog, 0);
      }
      if (state.name === 'logged-in') assert.equal(geometry.registrationTriggers, 0);
      const file = ['long-identity', 'records-0', 'records-10-plus', 'not-found'].includes(state.name)
        ? screenshotPath('public-profile-state-' + state.name + '.png')
        : '';
      if (file) await opened.page.screenshot({ path: file, fullPage: true });
      results.push({ kind: 'state', state: state.name, screenshot: file ? path.relative(evidenceDir, file) : '', ...geometry });
      await opened.context.close();
    }

    const share = await openFixture('public-profile-preview.html', { browser, viewport: viewports[1] });
    await share.page.locator('.setae-public-profile-share-menu summary').click();
    assert.equal(await share.page.locator('.setae-public-profile-share-menu').getAttribute('open'), '');
    const shareFile = screenshotPath('public-profile-share-menu-390.png');
    await share.page.screenshot({ path: shareFile, fullPage: false });
    results.push({ kind: 'overlay', state: 'share-menu', screenshot: path.relative(evidenceDir, shareFile) });
    await share.context.close();

    const dialog = await openFixture('public-profile-preview.html', { browser, viewport: viewports[1] });
    await dialog.page.getByRole('link', { name: '無料で始める' }).first().click();
    await dialog.page.getByRole('dialog').waitFor();
    const dialogGeometry = await inspect(dialog.page);
    validate(dialogGeometry, 'registration-dialog');
    const dialogFile = screenshotPath('public-profile-registration-dialog-390.png');
    await dialog.page.screenshot({ path: dialogFile, fullPage: false });
    results.push({ kind: 'overlay', state: 'registration-dialog', screenshot: path.relative(evidenceDir, dialogFile), ...dialogGeometry });
    await dialog.context.close();

    const zoomed = await openFixture('public-profile-preview.html', { browser, viewport: { width: 640, height: 1000 }, query: { long: '1' } });
    await zoomed.page.evaluate(() => { document.documentElement.style.zoom = '2'; });
    await zoomed.page.evaluate(() => new Promise((resolve) => requestAnimationFrame(resolve)));
    const zoomGeometry = await inspect(zoomed.page);
    assert.equal(zoomGeometry.documentOverflow, false, '200% zoom at a 320px effective width must reflow without overflow');
    const zoomFile = screenshotPath('public-profile-text-zoom-200.png');
    await zoomed.page.screenshot({ path: zoomFile, fullPage: true });
    results.push({ kind: 'accessibility', state: 'text-zoom-200', screenshot: path.relative(evidenceDir, zoomFile), ...zoomGeometry });
    await zoomed.context.close();

    const forced = await openFixture('public-profile-preview.html', { browser, viewport: viewports[1], forcedColors: 'active' });
    await forced.page.getByRole('button', { name: 'リンクをコピー' }).focus();
    const forcedGeometry = await inspect(forced.page);
    validate(forcedGeometry, 'forced-colors');
    const forcedFile = screenshotPath('public-profile-forced-colors-390.png');
    await forced.page.screenshot({ path: forcedFile, fullPage: true });
    results.push({ kind: 'accessibility', state: 'forced-colors', screenshot: path.relative(evidenceDir, forcedFile), ...forcedGeometry });
    await forced.context.close();
  } finally {
    await browser.close();
  }
  writeEvidence('browser-public-profile-visual-qa.json', { cases: results.length, results });
  console.log('Public Profile visual QA passed (' + results.length + ' cases)');
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
