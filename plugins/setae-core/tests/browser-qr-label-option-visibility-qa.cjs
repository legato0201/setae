const assert = require('node:assert/strict');
const path = require('node:path');
const { evidenceDir, openFixture, writeEvidence } = require('./browser-v245-helpers.cjs');

const configurations = [
  { id: 'a4-field', output: 'a4', format: 'field', expected: ['QR', '個体番号', '学名', '齢期・性別', '裁断マーク', '外枠', 'メモ中央罫線'] },
  { id: 'tape-field', output: 'tape', format: 'field', expected: ['QR', '個体番号', '学名', '齢期・性別', '外枠', 'メモ中央罫線'] },
  { id: 'a4-micro', output: 'a4', format: 'micro-id', expected: ['QR', '個体番号', '裁断マーク', '外枠', 'メモ中央罫線'] },
  { id: 'tape-micro', output: 'tape', format: 'micro-id', expected: ['QR', '個体番号', '外枠', 'メモ中央罫線'] }
];
const viewports = [320, 390, 768, 1440];

async function labelAudit(page) {
  return page.evaluate(() => {
    const labels = [...document.querySelectorAll('.label-option-toggle .checkbox-control-label')].map((label) => {
      const rect = label.getBoundingClientRect();
      const style = getComputedStyle(label);
      return {
        text: label.textContent.trim(),
        width: rect.width,
        height: rect.height,
        display: style.display,
        visibility: style.visibility,
        opacity: Number(style.opacity),
        clipPath: style.clipPath
      };
    });
    const controls = [...document.querySelectorAll('.label-option-toggle')];
    const grid = document.querySelector('.label-option-grid');
    return {
      labels,
      gridColumns: grid ? getComputedStyle(grid).gridTemplateColumns.split(' ').filter(Boolean).length : 0,
      minControlHeight: controls.length ? Math.min(...controls.map((control) => control.getBoundingClientRect().height)) : 0,
      overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      legends: [...document.querySelectorAll('.label-option-group legend')].map((item) => item.textContent.trim()),
      disabled: controls.filter((control) => control.querySelector('input:disabled')).map((control) => ({
        label: control.querySelector('.checkbox-control-label')?.textContent.trim(),
        checked: control.querySelector('input')?.checked,
        focusable: control.querySelector('input')?.tabIndex >= 0 && !control.querySelector('input')?.disabled,
        opacity: Number(getComputedStyle(control).opacity)
      }))
    };
  });
}

function assertLabels(audit, expected, context) {
  assert.deepEqual(audit.labels.map((item) => item.text), expected, `${context}: visible label set`);
  audit.labels.forEach((label) => {
    assert.ok(label.width > 8, `${context}: ${label.text} width ${label.width}`);
    assert.ok(label.height > 8, `${context}: ${label.text} height ${label.height}`);
    assert.notEqual(label.display, 'none', `${context}: ${label.text} display`);
    assert.notEqual(label.visibility, 'hidden', `${context}: ${label.text} visibility`);
    assert.ok(label.opacity > 0.5, `${context}: ${label.text} opacity`);
    assert.notEqual(label.clipPath, 'inset(50%)', `${context}: ${label.text} clip-path`);
  });
  assert.deepEqual(audit.legends, ['印刷内容', '印刷・手書き補助']);
  assert.ok(audit.overflow <= 1, `${context}: horizontal overflow ${audit.overflow}px`);
}

async function verifyInteraction(page, configuration) {
  const controls = page.locator('.label-option-toggle');
  const interactions = [];
  let expectedUpdates = 0;
  for (let index = 0; index < await controls.count(); index += 1) {
    const control = controls.nth(index);
    const input = control.locator('input');
    const label = (await control.locator('.checkbox-control-label').textContent()).trim();
    const disabled = await input.isDisabled();
    const before = await input.isChecked();
    const previewBefore = await page.locator('[data-role="qr-label-preview"]').innerHTML();
    if (disabled) {
      await input.evaluate((element) => element.click());
      const after = await input.isChecked();
      assert.equal(after, before, `${configuration.id}/${label}: disabled checkbox must not change`);
      interactions.push({ label, disabled, before, after });
      continue;
    }
    await input.focus();
    await page.keyboard.press('Space');
    expectedUpdates += 1;
    const after = await input.isChecked();
    const previewAfter = await page.locator('[data-role="qr-label-preview"]').innerHTML();
    const focused = await input.evaluate((element) => document.activeElement === element);
    assert.notEqual(after, before, `${configuration.id}/${label}: checkbox state must change`);
    assert.notEqual(previewAfter, previewBefore, `${configuration.id}/${label}: preview must update`);
    assert.equal(focused, true, `${configuration.id}/${label}: focus must remain on the toggled checkbox`);
    interactions.push({ label, disabled, before, after, focused });
  }
  const updates = await page.evaluate(() => window.__setaeQrLabels245.state().previewUpdates);
  await page.waitForTimeout(220);
  const announcement = await page.locator('[data-role="qr-label-preview-status"]').textContent();
  assert.equal(updates, expectedUpdates, `${configuration.id}: preview island update count`);
  assert.equal(announcement.trim(), 'ラベルプレビューを更新しました。');
  return { interactions, updates, announcement: announcement.trim() };
}

(async () => {
  const report = { configurations: {}, responsive: {}, textScaling: {}, forcedColors: {} };

  for (const configuration of configurations) {
    for (const colorScheme of ['light', 'dark']) {
      const { browser, page, issues } = await openFixture('qr-label-options-v245.html', {
        query: { output: configuration.output, format: configuration.format, theme: colorScheme },
        viewport: { width: 390, height: 1100 },
        colorScheme
      });
      try {
        const audit = await labelAudit(page);
        assertLabels(audit, configuration.expected, `${configuration.id}/${colorScheme}`);
        if (configuration.format === 'micro-id') {
          assert.deepEqual(audit.disabled.map((item) => item.label), ['QR', '個体番号']);
          audit.disabled.forEach((item) => {
            assert.equal(item.checked, true);
            assert.equal(item.focusable, false);
            assert.ok(item.opacity > 0.5);
          });
        } else {
          assert.deepEqual(audit.disabled, []);
        }
        await page.screenshot({
          path: path.join(evidenceDir, `qr-label-${configuration.id}-390-${colorScheme}.png`),
          fullPage: true
        });
        const interaction = colorScheme === 'light' ? await verifyInteraction(page, configuration) : null;
        assert.deepEqual(issues, []);
        report.configurations[`${configuration.id}-${colorScheme}`] = { audit, interaction };
      } finally {
        await browser.close();
      }
    }

    const { browser, page, issues } = await openFixture('qr-label-options-v245.html', {
      query: { output: configuration.output, format: configuration.format, theme: 'light' },
      viewport: { width: 1440, height: 1000 },
      hasTouch: false
    });
    try {
      const audit = await labelAudit(page);
      assertLabels(audit, configuration.expected, `${configuration.id}/1440/light`);
      assert.deepEqual(issues, []);
      await page.screenshot({
        path: path.join(evidenceDir, `qr-label-${configuration.id}-1440-light.png`),
        fullPage: true
      });
      report.configurations[`${configuration.id}-1440-light`] = { audit };
    } finally {
      await browser.close();
    }
  }

  for (const width of viewports) {
    for (const colorScheme of ['light', 'dark']) {
      const { browser, page, issues } = await openFixture('qr-label-options-v245.html', {
        query: { output: 'a4', format: 'field', theme: colorScheme },
        viewport: { width, height: width < 768 ? 1100 : 900 },
        hasTouch: width < 768,
        colorScheme
      });
      try {
        const audit = await labelAudit(page);
        assertLabels(audit, configurations[0].expected, `${width}/${colorScheme}`);
        if (width < 768) {
          assert.equal(audit.gridColumns, 1, `${width}: option grid must use one column`);
          assert.ok(audit.minControlHeight >= 44, `${width}: touch target ${audit.minControlHeight}px`);
        }
        if (width === 768) assert.equal(audit.gridColumns, 2, '768: option grid must use two columns');
        assert.deepEqual(issues, []);
        report.responsive[`${width}-${colorScheme}`] = audit;
      } finally {
        await browser.close();
      }
    }
  }

  {
    const { browser, page, issues } = await openFixture('qr-label-options-v245.html', {
      query: { output: 'a4', format: 'field', theme: 'light' },
      viewport: { width: 390, height: 1300 }
    });
    try {
      await page.addStyleTag({ content: 'html { font-size: 200% !important; }' });
      const audit = await labelAudit(page);
      assertLabels(audit, configurations[0].expected, '200%-text');
      const clipped = await page.evaluate(() => [...document.querySelectorAll('.label-option-group legend, .label-option-toggle .checkbox-control-copy')]
        .filter((item) => item.scrollWidth > item.clientWidth + 1 || item.scrollHeight > item.clientHeight + 1)
        .map((item) => item.textContent.trim()));
      assert.deepEqual(clipped, []);
      assert.deepEqual(issues, []);
      report.textScaling = { audit, clipped };
    } finally {
      await browser.close();
    }
  }

  {
    const { browser, page, issues } = await openFixture('qr-label-options-v245.html', {
      query: { output: 'a4', format: 'micro-id', theme: 'light' },
      viewport: { width: 390, height: 1100 },
      forcedColors: 'active'
    });
    try {
      const control = page.locator('.label-option-toggle').filter({ hasText: '外枠' }).first();
      await control.locator('input').focus();
      const audit = await labelAudit(page);
      assertLabels(audit, configurations[2].expected, 'forced-colors');
      const states = await page.evaluate(() => {
        const focused = document.querySelector('.label-option-toggle:has(input:focus-visible)');
        const checkedMark = document.querySelector('.label-option-toggle input:checked + .checkbox-control-mark');
        const disabled = document.querySelector('.label-option-toggle.is-disabled');
        return {
          active: matchMedia('(forced-colors: active)').matches,
          focusOutline: focused ? getComputedStyle(focused).outlineStyle : 'none',
          checkedBorder: checkedMark ? getComputedStyle(checkedMark).borderStyle : 'none',
          disabledColor: disabled ? getComputedStyle(disabled).color : ''
        };
      });
      assert.equal(states.active, true);
      assert.notEqual(states.focusOutline, 'none');
      assert.notEqual(states.checkedBorder, 'none');
      assert.ok(states.disabledColor);
      assert.deepEqual(issues, []);
      report.forcedColors = { audit, states };
    } finally {
      await browser.close();
    }
  }

  const file = writeEvidence('browser-qr-label-option-visibility-qa.json', { status: 'PASS', ...report });
  console.log(`QR Label Option browser QA passed: ${file}`);
})().catch((error) => { console.error(error); process.exitCode = 1; });
