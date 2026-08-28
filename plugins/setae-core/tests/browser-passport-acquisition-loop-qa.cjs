const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const { launchBrowser, assertFocusTrap, inspectPage, validatePage } = require('./browser-v247-helpers.cjs');
const { pluginRoot, runProduction, sourceHashes, requests } = require('./helpers/passport-acquisition-fixture.cjs');

const evidenceDir = path.resolve(process.env.SETAE_QA_EVIDENCE || path.resolve(__dirname, '../../../../release-evidence/v1.0.251/passport-acquisition-loop'));
const screenshots = path.join(evidenceDir, 'screenshots');
fs.mkdirSync(screenshots, { recursive: true });
const results = [];
const hashes = sourceHashes();
const pass = (name, details = {}) => { results.push({ name, status: 'PASS', ...details }); console.log('PASS ' + name); };
let baseUrl;
let activeSession;
const server = http.createServer(async (request, response) => {
  const test = activeSession;
  try {
    assert.ok(test, 'A local test session must own every fixture request.');
    const chunks = [];
    for await (const chunk of request) chunks.push(chunk);
    const body = Buffer.concat(chunks).toString('utf8');
    const requestUrl = new URL(request.url, baseUrl);
    const trace = { method: request.method, path: requestUrl.pathname, status: null };
    test.http.push(trace);
    const fulfill = async ({ status, headers = {}, contentType, body: content }) => {
      trace.status = status;
      response.writeHead(status, { 'Cache-Control': 'no-store', ...(contentType ? { 'Content-Type': contentType } : {}), ...headers });
      response.end(content);
    };
    await test.handleRequest({
      request: () => ({ url: () => requestUrl.href, method: () => request.method, postData: () => body }),
      fulfill,
      abort: async () => response.destroy(),
      continue: async () => {
        const file = path.resolve(pluginRoot, '.' + decodeURIComponent(requestUrl.pathname));
        assert.ok(file.startsWith(pluginRoot + path.sep) && fs.existsSync(file) && fs.statSync(file).isFile(), 'Only existing fixture assets may be read.');
        assert.ok(fs.realpathSync(file).startsWith(fs.realpathSync(pluginRoot) + path.sep), 'Asset resolution stays inside the plugin workspace.');
        const mime = { '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp' }[path.extname(file)] || 'application/octet-stream';
        await fulfill({ status: 200, contentType: mime, body: fs.readFileSync(file) });
      }
    });
  } catch (error) {
    if (test) test.issues.push(error.message);
    if (!response.headersSent) response.writeHead(500, { 'Content-Type': 'text/plain' });
    response.end('Local fixture boundary failed');
  }
});
const write = (status, error) => fs.writeFileSync(path.join(evidenceDir, 'browser-passport-acquisition-loop-qa.json'), JSON.stringify({
  status, at_utc: new Date().toISOString(), source_sha256: hashes, results, ...(error ? { error: error.stack } : {}),
  ...(error && activeSession ? { fixture_http: activeSession.http, fixture_issues: activeSession.issues, failed_requests: activeSession.failedRequests } : {}),
  scope: 'Isolated headless Edge; actual PHP AJAX, verification entry, QR manager/controllers/templates and public JS. WP database, authentication-cookie calls, mail and event transport are in-memory test boundaries. No real WordPress, SMTP, signed login cookie, Stripe, physical device or remote API was exercised.'
}, null, 2));

async function session(browser, seed = {}, display = {}) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, colorScheme: 'light', reducedMotion: 'reduce', ...display });
  const page = await context.newPage();
  const test = { context, page, state: runProduction({ origin: baseUrl, seed }).state, registrations: [], events: [], issues: [], external: [], http: [], failedRequests: [], gate: null, release: null };
  activeSession = test;
  page.on('pageerror', (error) => test.issues.push(error.message));
  page.on('requestfailed', (request) => test.failedRequests.push({ path: new URL(request.url()).pathname, error: request.failure()?.errorText }));
  await context.route('**/*', async (route) => {
    const url = new URL(route.request().url());
    if (url.origin !== new URL(baseUrl).origin) { test.external.push(url.origin); await route.abort(); return; }
    await route.continue();
  });
  test.handleRequest = async (route) => {
    const request = route.request(); const url = new URL(request.url());
    if (url.origin !== new URL(baseUrl).origin) { test.external.push(url.origin); await route.abort(); return; }
    if (url.pathname === '/tests/acquisition-events') {
      const payload = JSON.parse(request.postData() || '{}');
      assert.doesNotMatch(JSON.stringify(payload), /buyer251@example|fixture-password-251|LOCAL_TEST_VERIFICATION_TOKEN/);
      test.events.push(payload);
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ accepted: true }) }); return;
    }
    if (url.pathname === '/favicon.ico') { await route.fulfill({ status: 204, body: '' }); return; }
    if (url.pathname.startsWith('/assets/') || url.pathname.startsWith('/tests/fixtures/')) { await route.continue(); return; }
    let operation = null;
    if (url.pathname === '/wp-admin/admin-ajax.php') operation = 'register';
    else if (url.searchParams.get('setae_action') === 'verify_email') operation = 'verify';
    else if (url.pathname === '/r4k7m/') operation = 'page';
    else if (url.pathname === '/setae-partner/') operation = 'partner';
    else if (url.pathname === '/') {
      // Destination boundary only. SPA routing/plan confirmation has its own tests.
      await route.fulfill({ status: 200, contentType: 'text/html', body: '<!doctype html><html lang="ja"><title>Local app destination boundary</title><body><main>Local app destination boundary</main></body></html>' }); return;
    }
    if (!operation) { test.issues.push('Unexpected local fixture request: ' + url.pathname); await route.abort(); return; }
    const post = Object.fromEntries(new URLSearchParams(request.postData() || ''));
    if (operation === 'register') {
      assert.equal(post.action, 'setae_register_user');
      test.registrations.push(post);
      if (test.gate) await test.gate;
    }
    const response = runProduction({ origin: baseUrl, operation, state: test.state, url: url.pathname + url.search, method: request.method(), post });
    test.state = response.state;
    if (response.redirect) {
      const destination = new URL(response.redirect.location);
      assert.equal(destination.origin, new URL(baseUrl).origin, 'Every application redirect stays on the configured origin.');
      assert.equal(destination.searchParams.has('token'), false);
      assert.equal(destination.searchParams.has('uid'), false);
      await route.fulfill({ status: response.redirect.status, headers: { location: response.redirect.location, 'referrer-policy': 'no-referrer' }, body: '' });
    } else {
      await route.fulfill({ status: response.status, contentType: response.result ? 'application/json' : 'text/html; charset=utf-8', body: response.result ? JSON.stringify(response.result) : response.html });
    }
  };
  test.go = async (url = '/r4k7m/') => {
    // Public event delivery is asynchronous and is not the UI-ready contract.
    await page.goto(new URL(url, baseUrl).href, { waitUntil: 'domcontentloaded' });
    if (new URL(page.url()).pathname !== '/') {
      await page.waitForSelector('body[data-fixture-ready="true"]');
      await page.waitForFunction(() => !document.querySelector('[data-public-registration]') || document.querySelector('[data-public-registration]').dataset.registrationReady === 'true');
      await page.evaluate(() => document.fonts.ready);
    }
  };
  test.open = async () => {
    await page.locator('[data-public-register]').first().click();
    const dialog = page.locator('[data-public-registration]');
    await dialog.waitFor({ state: 'visible' });
    return dialog;
  };
  test.register = async ({ gate = false, email = 'buyer251@example.test' } = {}) => {
    const dialog = await test.open();
    await dialog.locator('[name="email"]').fill(email);
    await dialog.locator('[name="password"]').fill('fixture-password-251');
    await dialog.locator('[name="terms_accepted"]').check();
    if (gate) test.gate = new Promise((resolve) => { test.release = resolve; });
    await dialog.locator('[data-public-register-submit]').click();
    if (gate) {
      await page.waitForFunction(() => document.querySelector('[data-public-registration]').dataset.busy === 'true');
      assert.equal(await dialog.locator('button:not([disabled]),input:not([disabled])').count(), 0);
      await page.keyboard.press('Escape');
      await dialog.locator('form').evaluate((form) => form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })));
      assert.equal(await dialog.evaluate((node) => node.open), true);
      assert.equal(test.registrations.length, 1, 'Busy UI sends only one registration request.');
      test.release(); test.gate = null;
    }
    await dialog.waitFor({ state: 'hidden' });
    await page.locator('[data-public-register-notice]').filter({ hasText: '認証メール' }).waitFor();
    assert.equal(await dialog.locator('[name="password"]').inputValue(), '');
    const user = Object.values(test.state.users).find((entry) => entry.user_email === email);
    assert.ok(user && Number(user.ID) > 33, 'The actual registration operation created the test account.');
    test.userId = Number(user.ID);
    const link = test.state.mail.at(-1).body.match(/https?:\/\/[^\s"'<>]+/g).find((url) => url.includes('setae_action=verify_email'));
    assert.ok(link, 'Follow the URL generated in the actual registration mail body.');
    test.verificationUrl = link.replaceAll('&amp;', '&');
    return dialog;
  };
  test.close = async () => {
    assert.deepEqual(test.external, [], 'No off-origin network request is permitted.');
    assert.deepEqual(test.issues, [], 'No runtime error or unexpected route.');
    await context.close();
  };
  return test;
}

async function captureDialog(test, name, scale = 1) {
  const { page } = test;
  if (scale !== 1) await page.evaluate((factor) => {
    const sizes = [...document.querySelectorAll('body,body *:not(script):not(style)')].map((node) => [node, parseFloat(getComputedStyle(node).fontSize)]);
    sizes.forEach(([node, size]) => { if (Number.isFinite(size)) node.style.fontSize = `${size * factor}px`; });
  }, scale);
  const pageGeometry = await inspectPage(page); validatePage(pageGeometry, name);
  await page.screenshot({ path: path.join(screenshots, name + '-page.png'), fullPage: true });
  const dialog = await test.open();
  await assertFocusTrap(page, dialog);
  await page.keyboard.press('Tab');
  await dialog.locator('[data-public-register-close]').first().focus();
  await dialog.evaluate((node) => { node.scrollTop = 0; });
  const geometry = await dialog.evaluate((node) => {
    const rect = node.getBoundingClientRect();
    const heading = node.querySelector('.setae-public-register-heading h2').getBoundingClientRect();
    const close = node.querySelector('.setae-public-register-heading [data-public-register-close]');
    const closeBox = close.getBoundingClientRect();
    const range = document.createRange();
    range.selectNodeContents(close);
    const closeLines = [...range.getClientRects()].filter((box) => box.width > 0 && box.height > 0);
    const controls = [...node.querySelectorAll('button,a[href],input:not([type="hidden"])')].map((control) => {
      const target = control.matches('[type="checkbox"]') ? control.closest('label') : control;
      const box = target.getBoundingClientRect();
      return { name: (control.getAttribute('aria-label') || control.labels?.[0]?.textContent || control.textContent || '').trim(), width: box.width, height: box.height, left: box.left, right: box.right };
    });
    const style = getComputedStyle(document.activeElement);
    return { viewport: { width: innerWidth, height: innerHeight }, left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom,
      modal: node.matches(':modal'), overflow: node.scrollWidth > node.clientWidth + 1, documentOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
      heading: heading.toJSON(), close: closeBox.toJSON(), closeTextLines: closeLines.length,
      controls, focusInside: node.contains(document.activeElement), focusVisible: document.activeElement.matches(':focus-visible'), outlineWidth: parseFloat(style.outlineWidth), outlineStyle: style.outlineStyle };
  });
  assert.equal(geometry.modal, true); assert.equal(geometry.overflow, false); assert.equal(geometry.documentOverflow, false);
  assert.equal(geometry.closeTextLines, 1, 'Close label remains on one line at every tested text size.');
  assert.ok(geometry.heading.top >= geometry.close.bottom - 0.5, 'Title and close control occupy separate rows without overlap.');
  assert.ok(geometry.heading.right >= geometry.close.right - 0.5, 'Title spans the full heading width.');
  assert.ok(geometry.left >= -1 && geometry.top >= -1 && geometry.right <= geometry.viewport.width + 1 && geometry.bottom <= geometry.viewport.height + 1);
  assert.deepEqual(geometry.controls.filter((control) => !control.name || control.width < 43.5 || control.height < 43.5 || control.left < geometry.left - 1 || control.right > geometry.right + 1), []);
  assert.equal(geometry.focusInside, true); assert.equal(geometry.focusVisible, true); assert.ok(geometry.outlineWidth >= 2 && geometry.outlineStyle !== 'none');
  await page.screenshot({ path: path.join(screenshots, name + '-dialog.png') });
  const submit = dialog.locator('[data-public-register-submit]'); await submit.focus(); await submit.scrollIntoViewIfNeeded();
  const box = await submit.boundingBox(); assert.ok(box.y >= geometry.top - 1 && box.y + box.height <= geometry.bottom + 1, 'Final action is reachable by dialog scrolling.');
  await submit.hover();
  const primary = await submit.evaluate((node) => { const style = getComputedStyle(node); return { color: style.color, background: style.backgroundColor }; });
  assert.notEqual(primary.color, primary.background, 'Primary label remains visible on hover/focus, including forced colors.');
  await page.screenshot({ path: path.join(screenshots, name + '-dialog-submit.png') });
  await page.keyboard.press('Escape'); await dialog.waitFor({ state: 'hidden' });
  await page.waitForFunction(() => document.activeElement?.hasAttribute('data-public-register'));
  pass(name, { pageGeometry, dialogGeometry: geometry, primary, scope: scale > 1 ? `${scale * 100}% computed text-size emulation; not physical browser zoom` : 'CSS viewport/media emulation' });
}

(async () => {
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
  baseUrl = `http://127.0.0.1:${server.address().port}`;
  const browser = await launchBrowser();
  try {
    const happy = await session(browser); await happy.go();
    await happy.register({ gate: true });
    assert.equal(happy.registrations[0].qr_claim_intent, 'request_after_verification');
    assert.equal(happy.registrations[0].qr_claim_code, 'r4k7m');
    assert.equal(happy.state.user_meta[happy.userId]._setae_pending_qr_claim_intent, 'r4k7m');
    assert.equal(requests(happy.state).length, 0); assert.equal(happy.state.auth_cookies.length, 0);
    await happy.go(happy.verificationUrl);
    assert.equal(new URL(happy.page.url()).search, '?verified=1&requested=1');
    assert.equal(happy.state.viewer, happy.userId); assert.equal(happy.state.auth_cookies.length, 1);
    assert.equal(requests(happy.state).length, 1); assert.equal(Number(happy.state.posts[201].post_author), 11);
    assert.equal(happy.state.user_meta[happy.userId]._setae_pending_qr_claim, undefined);
    await happy.page.getByText('引き継ぎ申請を送信しました。現在の所有者の承認をお待ちください。', { exact: true }).waitFor();
    assert.equal(await happy.page.locator('[data-setae-public-claim]').count(), 0);
    await happy.go(happy.verificationUrl);
    assert.equal(happy.state.auth_cookies.length, 1); assert.equal(requests(happy.state).length, 1);
    pass('registration-verification-correct-user-one-pending-request', { accountCookiesIssued: 1, pendingRequests: 1, ownerUnchangedBeforeApproval: true });

    const requestId = requests(happy.state)[0].ID;
    const forbidden = runProduction({ origin: baseUrl, operation: 'approve', request_id: requestId, state: happy.state });
    assert.equal(forbidden.result.success, false); assert.equal(forbidden.result.code, 'qr_transfer_forbidden');
    const ownerState = { ...happy.state, viewer: 11 };
    const approved = runProduction({ origin: baseUrl, operation: 'approve', request_id: requestId, state: ownerState });
    assert.equal(approved.result.success, true); happy.state = { ...approved.state, viewer: happy.userId };
    assert.equal(Number(happy.state.posts[201].post_author), happy.userId);
    assert.equal(happy.state.meta[201]._setae_acquisition_source, 'transfer_received');
    assert.equal(happy.state.meta[201]._setae_qr_public_mode, 'private');
    assert.equal(happy.state.posts[101].post_name, 'r4k7m');
    assert.equal(happy.state.meta[401]._setae_log_recorded_by_user_id, 11);
    assert.equal(Object.values(happy.state.meta).filter((meta) => meta._setae_acquisition_source === 'transfer_receipt').length, 1);
    await happy.go(happy.verificationUrl); assert.equal(requests(happy.state).length, 1); assert.equal(happy.state.auth_cookies.length, 1);
    happy.state.viewer = 0; await happy.go(happy.verificationUrl);
    assert.equal(new URL(happy.page.url()).searchParams.get('setae_auth'), 'login');
    assert.equal(happy.state.viewer, 0); assert.equal(happy.state.auth_cookies.length, 1);
    pass('only-owner-approval-transfers-and-used-link-never-reauthenticates', { originalRecorderRetained: true, qrUnchanged: true, receivedAndReceiptSources: true });
    assert.ok(happy.events.some((event) => event.event === 'claim_cta_clicked'), 'Actual event JS observes the informed claim CTA.');
    await happy.close();

    const legacy = await session(browser, { visibility: 'basic', transfer: false }); await legacy.go(); await legacy.register();
    assert.equal('qr_claim_intent' in legacy.registrations[0], false);
    await legacy.go(legacy.verificationUrl); assert.equal(requests(legacy.state).length, 0);
    assert.equal(legacy.state.auth_cookies.length, 1);
    pass('code-only-public-registration-never-auto-requests'); await legacy.close();

    const retry = await session(browser); await retry.go(); await retry.register();
    retry.state.lock_failure = true; await retry.go(retry.verificationUrl);
    await retry.page.getByText('引き継ぎ申請を完了できませんでした。受付中の場合は、このページからもう一度申請してください。', { exact: true }).waitFor();
    assert.equal(retry.state.user_meta[retry.userId]._setae_pending_qr_claim_intent, 'r4k7m'); assert.equal(requests(retry.state).length, 0);
    retry.state.lock_failure = false; await retry.go(retry.verificationUrl);
    assert.equal(requests(retry.state).length, 0); assert.equal(retry.state.auth_cookies.length, 1);
    await retry.page.locator('[data-setae-public-claim] button[type="submit"]').click();
    await retry.page.waitForURL('**/r4k7m/?requested=1');
    assert.equal(requests(retry.state).length, 1); assert.equal(retry.state.user_meta[retry.userId]._setae_pending_qr_claim, undefined);
    pass('temporary-failure-retains-intent-and-explicit-native-post-retries'); await retry.close();

    const closed = await session(browser); await closed.go(); await closed.register();
    closed.state.meta[201]._setae_transfer_enabled = ''; await closed.go(closed.verificationUrl);
    await closed.page.getByText('この個体は現在、引き継ぎを受け付けていません。現在の所有者にご確認ください。', { exact: true }).waitFor();
    assert.doesNotMatch(await closed.page.content(), /SPECIMEN_ID_247|Phormingochilus|PRIVATE_KEEPER|PRIVATE_INTERNAL|passport-247-photo/);
    assert.equal(requests(closed.state).length, 0); assert.equal(closed.state.user_meta[closed.userId]._setae_pending_qr_claim, 'r4k7m');
    assert.equal(await closed.page.locator('[data-public-register],[data-setae-public-claim]').count(), 0);
    await closed.page.screenshot({ path: path.join(screenshots, 'closed-private-safe-status.png'), fullPage: true });
    pass('closed-private-claim-is-explained-without-private-data'); await closed.close();

    const invalid = await session(browser); await invalid.go('/?setae_action=verify_email&uid=22&token=invalid-local-token');
    assert.equal(new URL(invalid.page.url()).searchParams.get('verification_error'), 'invalid_verification');
    assert.equal(invalid.state.auth_cookies.length, 0); assert.equal(requests(invalid.state).length, 0);
    pass('invalid-token-redirect-is-tokenless-and-does-not-authenticate'); await invalid.close();

    const partner = await session(browser); await partner.go('/setae-partner/'); await partner.register();
    assert.equal(partner.registrations[0].return_url, `${baseUrl}/?setae_plan=breeder_trial`);
    await partner.go(partner.verificationUrl);
    assert.equal(new URL(partner.page.url()).searchParams.get('setae_plan'), 'breeder_trial');
    assert.equal(partner.state.auth_cookies.length, 1); assert.equal(requests(partner.state).length, 0);
    assert.equal(Object.keys(partner.state.user_meta[partner.userId]).some((key) => /trial_|stripe_/.test(key)), false);
    pass('Partner-verification-returns-to-confirmation-without-starting-trial'); await partner.close();

    for (const display of [
      { name: '390-light', options: {} },
      { name: '390-dark', options: { colorScheme: 'dark' } },
      { name: '390-forced-colors', options: { forcedColors: 'active' } },
      { name: '320-text-200-percent', options: { viewport: { width: 320, height: 1000 } }, scale: 2 },
      { name: '390-text-400-percent', options: { viewport: { width: 390, height: 1100 } }, scale: 4 }
    ]) {
      const visual = await session(browser, {}, display.options); await visual.go();
      await captureDialog(visual, display.name, display.scale || 1); await visual.close();
    }
    assert.deepEqual(sourceHashes(), hashes, 'Source changed during the run; rerun against a stable snapshot.');
    write('PASS'); console.log(`Passport acquisition loop QA passed (${results.length} checks)`);
  } catch (error) { write('FAIL', error); throw error; }
  finally {
    if (activeSession?.release) activeSession.release();
    await browser.close();
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
  }
})().catch((error) => { server.closeAllConnections(); server.close(); console.error(error); process.exitCode = 1; });
