const assert = require('node:assert/strict');
const { launchBrowser, openFixture, writeEvidence } = require('./browser-v246-helpers.cjs');

async function openProfile(browser) {
  return openFixture('public-profile-preview.html', {
    browser,
    viewport: { width: 1024, height: 900 }
  });
}

async function fillRegistration(page) {
  await page.locator('#setae-public-register-dialog-email').fill('keeper@example.test');
  await page.locator('#setae-public-register-dialog-password').fill('stable-password');
  await page.locator('#setae-public-register-dialog-terms').check();
}

(async () => {
  const browser = await launchBrowser();
  const results = [];
  try {
    let opened = await openProfile(browser);
    let page = opened.page;
    await page.getByRole('button', { name: 'リンクをコピー' }).click();
    await page.getByRole('status').filter({ hasText: 'プロフィールリンクをコピーしました' }).waitFor();
    assert.equal((await page.evaluate(() => window.__setaePublicProfile246.copied())).at(-1), 'https://example.invalid/profile/test-keeper');
    results.push({ check: 'profile-link-copy-and-live-status', status: 'PASS' });

    await page.locator('.setae-public-profile-share-menu summary').click();
    await page.getByRole('button', { name: '紹介文をコピー' }).click();
    await page.getByRole('status').filter({ hasText: '紹介文をコピーしました' }).waitFor();
    assert.match((await page.evaluate(() => window.__setaePublicProfile246.copied())).at(-1), /表示確認用のテストプロフィールです。/);
    results.push({ check: 'introduction-copy', status: 'PASS' });

    await page.evaluate(() => window.__setaePublicProfile246.setNativeShare('resolve'));
    await page.getByRole('button', { name: '共有' }).click();
    await page.waitForFunction(() => window.__setaePublicProfile246.shared().length === 1);
    assert.equal((await page.evaluate(() => window.__setaePublicProfile246.shared()[0].url)), "https://example.invalid/profile/test-keeper");
    results.push({ check: 'native-share', status: 'PASS' });

    await page.evaluate(() => window.__setaePublicProfile246.setNativeShare('none'));
    await page.getByRole('button', { name: '共有' }).click();
    await page.waitForFunction(() => window.__setaePublicProfile246.copied().length >= 3);
    results.push({ check: 'share-copy-fallback', status: 'PASS' });

    await page.evaluate(() => window.__setaePublicProfile246.setNativeShare('reject'));
    const copiedBeforeReject = await page.evaluate(() => window.__setaePublicProfile246.copied().length);
    await page.getByRole('button', { name: '共有' }).click();
    await page.waitForFunction((count) => window.__setaePublicProfile246.copied().length > count, copiedBeforeReject);
    results.push({ check: 'native-share-error-fallback', status: 'PASS' });

    assert.match(await page.locator('[data-public-profile-x]').getAttribute('href'), /^https:\/\/twitter\.com\/intent\/tweet/);
    assert.match(await page.locator('[data-public-profile-line]').getAttribute('href'), /^https:\/\/social-plugins\.line\.me\/lineit\/share/);
    results.push({ check: 'x-and-line-share-links', status: 'PASS' });

    const trigger = page.getByRole('link', { name: '無料で始める' }).first();
    await trigger.focus();
    await trigger.click();
    const dialog = page.getByRole('dialog');
    await dialog.waitFor();
    await page.waitForFunction(() => document.activeElement?.id === 'setae-public-register-dialog-email');
    assert.equal(await page.evaluate(() => document.activeElement.id), 'setae-public-register-dialog-email');
    await page.getByRole('button', { name: '閉じる' }).click();
    await page.waitForFunction(() => !document.querySelector('#setae-public-register-dialog').open);
    assert.equal(await trigger.evaluate((node) => document.activeElement === node), true);
    results.push({ check: 'dialog-open-close-and-focus-return', status: 'PASS' });

    await trigger.click();
    await page.keyboard.press('Escape');
    await page.waitForFunction(() => !document.querySelector('#setae-public-register-dialog').open);
    results.push({ check: 'dialog-escape-close', status: 'PASS' });

    await trigger.click();
    await page.mouse.click(8, 8);
    await page.waitForFunction(() => !document.querySelector('#setae-public-register-dialog').open);
    results.push({ check: 'dialog-backdrop-close', status: 'PASS' });
    await opened.context.close();

    opened = await openProfile(browser);
    page = opened.page;
    await page.evaluate(() => window.__setaePublicProfile246.setRegistrationMode('pending'));
    await page.getByRole('link', { name: '無料で始める' }).first().click();
    await fillRegistration(page);
    await page.getByRole('button', { name: '登録する' }).click();
    await page.waitForFunction(() => document.querySelector('#setae-public-register-dialog').dataset.busy === 'true');
    const busyState = await page.evaluate(() => ({
      open: document.querySelector('#setae-public-register-dialog').open,
      controlsDisabled: [...document.querySelectorAll('#setae-public-register-dialog button, #setae-public-register-dialog input')].every((node) => node.disabled),
      status: document.querySelector('[data-public-register-status]').textContent
    }));
    assert.equal(busyState.open, true);
    assert.equal(busyState.controlsDisabled, true);
    assert.match(busyState.status, /送信/);
    await page.keyboard.press('Escape');
    assert.equal(await page.locator('#setae-public-register-dialog').getAttribute('open'), '');
    results.push({ check: 'registration-busy-lock', status: 'PASS' });
    await opened.context.close();

    opened = await openProfile(browser);
    page = opened.page;
    await page.evaluate(() => window.__setaePublicProfile246.setRegistrationMode('error'));
    await page.getByRole('link', { name: '無料で始める' }).first().click();
    await fillRegistration(page);
    await page.getByRole('button', { name: '登録する' }).click();
    await page.getByRole('alert').filter({ hasText: 'このメールアドレスは使用できません' }).waitFor();
    assert.equal(await page.locator('#setae-public-register-dialog-email').inputValue(), 'keeper@example.test');
    assert.equal(await page.locator('#setae-public-register-dialog-password').inputValue(), 'stable-password');
    assert.equal(await page.locator('#setae-public-register-dialog-terms').isChecked(), true);
    assert.equal(await page.locator('#setae-public-register-dialog-form').getAttribute('aria-busy'), 'false');
    assert.equal(await page.getByRole('button', { name: '登録する' }).isEnabled(), true);
    results.push({ check: 'registration-error-preserves-input', status: 'PASS' });

    await page.evaluate(() => window.__setaePublicProfile246.setRegistrationMode('success'));
    await page.getByRole('button', { name: '登録する' }).click();
    await page.waitForFunction(() => !document.querySelector('#setae-public-register-dialog').open);
    await page.getByRole('status').filter({ hasText: '仮登録が完了しました' }).waitFor();
    results.push({ check: 'registration-retry-success', status: 'PASS' });

    assert.equal(await page.locator('.setae-public-profile-note:not([data-visibility="shared"])').count(), 0);
    assert.equal(await page.locator('.setae-public-profile-note').count(), 9);
    results.push({ check: 'shared-record-privacy-boundary', status: 'PASS' });
    await opened.context.close();
  } finally {
    await browser.close();
  }
  writeEvidence('browser-public-profile-interaction-qa.json', { results });
  console.log('Public Profile interaction QA passed (' + results.length + ' checks)');
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
