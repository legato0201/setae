const assert = require('node:assert/strict');
const { baseUrl, launchBrowser, openFixture, writeEvidence, outsideDialogPoint, assertFocusTrap } = require('./browser-v247-helpers.cjs');
const cases = [
  { fixture: 'life-history', source: 'public_passport', claim: 'r4k7m' },
  { fixture: 'public_profile-guest', source: 'public_profile', claim: '' },
  { fixture: 'public_care_share-guest', source: 'public_care_share', claim: '' },
  { fixture: 'public_partner-guest', source: 'public_partner', claim: '' }
];
const results = [];
const pass = (source, check) => results.push({ source, check, status: 'PASS' });

(async () => {
  const browser = await launchBrowser();
  try {
    for (const test of cases) {
      const opened = await openFixture(test.fixture, { browser, viewport: { width: 1024, height: 900 } });
      const { page } = opened;
      const trigger = page.locator('[data-public-register]').first();
      const dialog = page.locator('[data-public-registration]');
      assert.equal(await dialog.count(), 1, test.source + ': one shared dialog');
      assert.equal(await dialog.getAttribute('data-source'), test.source);
      await trigger.click(); await dialog.waitFor({ state: 'visible' });
      await page.waitForFunction(() => document.activeElement?.getAttribute('name') === 'email');
      await assertFocusTrap(page, dialog);
      await page.keyboard.press('Escape'); await dialog.waitFor({ state: 'hidden' });
      await page.waitForFunction(() => document.activeElement?.hasAttribute('data-public-register'));
      pass(test.source, 'open-initial-focus-trap-escape-return');

      await trigger.click();
      const bounds = await dialog.boundingBox();
      await page.mouse.click(bounds.x + 2, bounds.y + 2);
      assert.equal(await dialog.evaluate((node) => node.open), true);
      const outside = await outsideDialogPoint(dialog, page);
      await page.mouse.click(outside.x, outside.y); await dialog.waitFor({ state: 'hidden' });
      pass(test.source, 'padding-kept-open-backdrop-dismissed');

      await trigger.click();
      const submit = dialog.locator('[data-public-register-submit]');
      await submit.click();
      await dialog.locator('[data-public-register-error]').waitFor({ state: 'visible' });
      assert.equal((await page.evaluate(() => window.__setaePublic247.requests())).length, 0);
      pass(test.source, 'invalid-form-does-not-submit');

      await dialog.locator('[name="email"]').fill('keeper@example.test');
      await dialog.locator('[name="password"]').fill('fixture-password-247');
      const referral = dialog.locator('[name="referral_code"]');
      let expectedReferral = 'MANUAL_REF_247';
      if (test.claim) {
        assert.equal(await referral.getAttribute('type'), 'hidden', 'Claim registration keeps referral context without a fourth input.');
        expectedReferral = await referral.inputValue();
      } else {
        await referral.fill(expectedReferral);
      }
      await dialog.locator('[name="terms_accepted"]').check();
      await page.evaluate(() => window.__setaePublic247.setRegistrationMode('pending'));
      await submit.click();
      await page.waitForFunction(() => document.querySelector('[data-public-registration]').dataset.busy === 'true');
      const payload = (await page.evaluate(() => window.__setaePublic247.requests())).at(-1);
      const expectedFields = ['action', 'username', 'email', 'password', 'referral_code', 'referral_source', 'terms_accepted', 'terms_version', 'qr_claim_code'];
      if (test.source === 'public_partner') expectedFields.push('return_url');
      assert.deepEqual(Object.keys(payload).sort(), expectedFields.sort());
      if (test.source === 'public_partner') assert.equal(payload.return_url, `${baseUrl}/?setae_plan=breeder_trial`);
      assert.equal(payload.action, 'setae_register_user');
      assert.equal(payload.username, '');
      assert.equal(payload.email, 'keeper@example.test');
      assert.equal(payload.password, 'fixture-password-247');
      assert.equal(payload.referral_code, expectedReferral);
      assert.equal(payload.referral_source, test.source);
      assert.equal(payload.terms_accepted, '1');
      assert.equal(payload.terms_version, '2026-03-01');
      assert.equal(payload.qr_claim_code, test.claim);
      assert.equal(await dialog.locator('[data-public-register-form]').getAttribute('aria-busy'), 'true');
      assert.equal(await dialog.locator('button:not([disabled]),input:not([disabled])').count(), 0);
      await page.keyboard.press('Escape');
      await page.mouse.click(outside.x, outside.y);
      assert.equal(await dialog.evaluate((node) => node.open), true);
      pass(test.source, 'exact-existing-payload-and-busy-dismissal-lock');

      await page.evaluate(() => window.__setaePublic247.completePending(false));
      await dialog.locator('[data-public-register-error]').filter({ hasText: 'このメールアドレスは使用できません' }).waitFor();
      assert.equal(await dialog.locator('[name="email"]').inputValue(), 'keeper@example.test');
      assert.equal(await dialog.locator('[name="password"]').inputValue(), 'fixture-password-247');
      assert.equal(await dialog.locator('[name="referral_code"]').inputValue(), expectedReferral);
      assert.equal(await dialog.locator('[name="terms_accepted"]').isChecked(), true);
      assert.equal(await submit.isEnabled(), true);
      pass(test.source, 'error-keeps-all-inputs-and-enables-retry');
      await page.evaluate(() => window.__setaePublic247.setRegistrationMode('success'));
      await submit.click(); await dialog.waitFor({ state: 'hidden' });
      await page.locator('[data-public-register-notice]').filter({ hasText: '認証メール' }).waitFor();
      await page.waitForFunction(() => document.activeElement?.hasAttribute('data-public-register'));
      assert.equal(await dialog.locator('[name="password"]').inputValue(), '');
      pass(test.source, 'success-notice-password-cleared-and-focus-return');
      assert.deepEqual(opened.issues, [], test.source + ': no runtime errors');
      await opened.context.close();
    }
    for (const surface of ['public_profile', 'public_care_share', 'public_partner']) {
      for (const state of ['logged-in', 'disabled']) {
        const opened = await openFixture(`${surface}-${state}`, { browser });
        assert.equal(await opened.page.locator('[data-public-register],[data-public-registration]').count(), 0);
        pass(surface, state + '-no-guest-registration');
        await opened.context.close();
      }
    }
    // Mobile starts focus on the dialog itself, avoiding an involuntary keyboard.
    const mobile = await openFixture('transfer', { browser, viewport: { width: 320, height: 844 } });
    await mobile.page.locator('[data-public-register]').first().click();
    await mobile.page.waitForFunction(() => document.activeElement?.hasAttribute('data-public-registration'));
    pass('public_passport', 'mobile-dialog-focus-without-autofocusing-email');
    await mobile.context.close();
    writeEvidence('browser-public-registration-shared-qa.json', { status: 'PASS', results });
    console.log(`Shared public registration QA passed (${results.length} checks)`);
  } catch (error) {
    writeEvidence('browser-public-registration-shared-qa.json', { status: 'FAIL', error: error.stack, results });
    throw error;
  } finally { await browser.close(); }
})().catch((error) => { console.error(error); process.exitCode = 1; });
