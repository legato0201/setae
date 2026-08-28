const assert = require('node:assert/strict');
const path = require('node:path');
const { baseUrl, evidenceDir, openFixture, writeEvidence } = require('./browser-v244-helpers.cjs');

const auditedViews = ['today', 'collection', 'intake', 'quick', 'records', 'nursery', 'husbandry', 'qr', 'settings', 'modal', 'sheet'];

async function semanticAudit(page) {
  return page.evaluate(() => {
    const visible = (element) => {
      const style = getComputedStyle(element);
      return style.display !== 'none' && style.visibility !== 'hidden' && element.getClientRects().length > 0;
    };
    const duplicateIds = [...document.querySelectorAll('[id]')]
      .map((element) => element.id)
      .filter((id, index, ids) => ids.indexOf(id) !== index);
    const brokenReferences = [];
    document.querySelectorAll('[aria-labelledby],[aria-describedby],[aria-controls],label[for]').forEach((element) => {
      ['aria-labelledby', 'aria-describedby', 'aria-controls', 'for'].forEach((attribute) => {
        const value = element.getAttribute(attribute);
        if (!value) return;
        value.split(/\s+/).forEach((id) => { if (!document.getElementById(id)) brokenReferences.push(`${attribute}:${id}`); });
      });
    });
    const headings = [...document.querySelectorAll('h1,h2,h3,h4,h5,h6')].filter(visible).map((element) => Number(element.tagName.slice(1)));
    const headingSkips = headings.filter((level, index) => index > 0 && level > headings[index - 1] + 1);
    const visibleNavLabels = [...document.querySelectorAll('nav')].filter(visible).map((element) => element.getAttribute('aria-label') || '');
    const tablists = [...document.querySelectorAll('[role="tablist"]')].filter(visible);
    return {
      mainCount: document.querySelectorAll('main').length,
      visibleMainCount: [...document.querySelectorAll('main')].filter(visible).length,
      visibleH1Count: [...document.querySelectorAll('h1')].filter(visible).length,
      duplicateIds,
      brokenReferences,
      headingSkips,
      positiveTabindex: [...document.querySelectorAll('[tabindex]')].filter((element) => Number(element.getAttribute('tabindex')) > 0).length,
      visibleNavLabels,
      tablistSelectionCounts: tablists.map((tablist) => [...tablist.querySelectorAll('[role="tab"]')].filter((tab) => tab.getAttribute('aria-selected') === 'true').length),
      tablistCount: tablists.length
    };
  });
}

function assertAudit(audit, label) {
  assert.equal(audit.mainCount, 1, `${label}: main count`);
  assert.equal(audit.visibleMainCount, 1, `${label}: visible main count`);
  assert.equal(audit.visibleH1Count, 1, `${label}: visible h1 count`);
  assert.deepEqual(audit.duplicateIds, [], `${label}: duplicate IDs`);
  assert.deepEqual(audit.brokenReferences, [], `${label}: broken references`);
  assert.deepEqual(audit.headingSkips, [], `${label}: heading skips`);
  assert.equal(audit.positiveTabindex, 0, `${label}: positive tabindex`);
  assert.ok(audit.tablistSelectionCounts.every((count) => count === 1), `${label}: each tablist must have one selected tab`);
  assert.equal(new Set(audit.visibleNavLabels).size, audit.visibleNavLabels.length, `${label}: visible navigation labels must be unique`);
}

(async () => {
  const { browser, page } = await openFixture({ view: 'semantic', viewport: { width: 1280, height: 900 } });
  try {
    const audit = await semanticAudit(page);
    assertAudit(audit, 'semantic');

    await page.keyboard.press('Tab');
    assert.equal(await page.locator(':focus').getAttribute('class'), 'skip-link');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(50);
    assert.equal(await page.evaluate(() => document.activeElement?.id), 'setae-main-content');

    await page.getByRole('tab', { name: '履歴' }).click();
    assert.equal(await page.getByRole('tab', { selected: true }).textContent(), '履歴');
    assert.match(await page.getByRole('tabpanel').textContent(), /記録履歴/);
    await page.keyboard.press('ArrowLeft');
    assert.equal(await page.getByRole('tab', { selected: true }).textContent(), '概要');

    await page.screenshot({ path: path.join(evidenceDir, 'semantic-a11y-1280.png'), fullPage: true });
    const viewAudits = [];
    for (const view of auditedViews) {
      await page.goto(`${baseUrl}/tests/fixtures/native-v244.html?view=${view}`, { waitUntil: 'domcontentloaded', timeout: 60000 });
      await page.waitForSelector('body[data-fixture-ready="true"]', { timeout: 60000 });
      const viewAudit = await semanticAudit(page);
      assertAudit(viewAudit, view);
      viewAudits.push({ view, ...viewAudit });
    }
    writeEvidence('browser-semantic-a11y-qa.json', { status: 'PASS', audit, viewAudits });
    console.log('Semantic accessibility browser QA passed');
  } finally {
    await browser.close();
  }
})().catch((error) => { console.error(error); process.exitCode = 1; });
