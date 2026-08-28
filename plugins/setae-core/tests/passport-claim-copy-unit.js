const assert = require('node:assert/strict');
const { runProduction } = require('./helpers/passport-acquisition-fixture.cjs');

function inputs(html) {
  return [...html.matchAll(/<input\b([^>]+)>/g)].map(([, attributes]) => Object.fromEntries(
    [...attributes.matchAll(/([\w-]+)="([^"]*)"/g)].map(([, name, value]) => [name, value])));
}
const offered = runProduction();
assert.match(offered.html, /この個体の履歴を引き継ぐ/);
assert.match(offered.html, /この個体の記録を、次の飼育者へ。/);
assert.match(offered.html, /メール認証が完了すると、この個体の引き継ぎ申請を送信します。/);
assert.match(offered.html, /現在の所有者が承認すると、履歴ごとマイ個体へ移動します。/);
const claimForm = offered.html.match(/<form[^>]*data-public-register-form[\s\S]*?<\/form>/)?.[0];
assert.ok(claimForm, 'Use the actual shared registration template.');
const fields = inputs(claimForm);
assert.deepEqual(fields.filter((field) => field.type !== 'hidden').map((field) => field.name), ['email', 'password', 'terms_accepted']);
assert.equal(fields.find((field) => field.name === 'qr_claim_code').value, 'r4k7m');
assert.equal(fields.find((field) => field.name === 'qr_claim_intent').value, 'request_after_verification');
assert.equal(fields.find((field) => field.name === 'referral_code').type, 'hidden');
assert.match(claimForm, /data-public-register-submit>認証メールを送る/);
assert.doesNotMatch(claimForm, /name="password"[^>]*value=/);
assert.match(offered.html, /data-public-register[^>]*>この個体の履歴を引き継ぐ/);
assert.match(offered.html, /setae_auth=login/);
assert.deepEqual(offered.public_configs, [{ surface: 'passport', context: { object_type: 'spider', object_id: 201 } }]);

for (const visibility of ['basic', 'life_history']) {
  const ordinary = runProduction({ seed: { visibility, transfer: false } });
  const hidden = inputs(ordinary.html);
  assert.equal(hidden.find((field) => field.name === 'qr_claim_code').value, 'r4k7m', 'Retain existing code-only registration compatibility.');
  assert.equal(hidden.find((field) => field.name === 'qr_claim_intent').value, '', 'Browsing public data is not automatic claim consent.');
  assert.match(ordinary.html, /引き継ぎ受付中の場合、メール認証後/);
  assert.doesNotMatch(ordinary.html, /メール認証が完了すると、この個体の引き継ぎ申請を送信します。/);
}
for (const seed of [{ transfer: false }, { transfer: false, viewer: 11 }, { registration: false }]) {
  const result = runProduction({ seed });
  assert.doesNotMatch(result.html, /<dialog\b[^>]*data-public-registration/);
  if (!seed.transfer && seed.registration !== false) {
    assert.deepEqual(result.public_configs[0].context, [], 'Private Passport event context does not expose specimen/owner IDs.');
  }
}
const privateGuest = runProduction({ seed: { transfer: false } });
assert.doesNotMatch(privateGuest.html, /SPECIMEN_ID_247|Phormingochilus|PRIVATE_KEEPER|PRIVATE_INTERNAL|passport-247-photo/);
const spoofed = runProduction({ seed: { viewer: 22 }, url: '/r4k7m/?requested=1' });
assert.doesNotMatch(spoofed.html, /引き継ぎ申請を送信しました。/);

const partner = runProduction({ operation: 'partner', url: '/setae-partner/' });
assert.match(partner.html, /売る前から、<\/span><span[^>]*>譲った後まで。/);
assert.match(partner.html, /ブリーダー機能を30日試す/);
assert.match(partner.html, /購入した個体の履歴を引き継ぐ/);
assert.match(partner.html, /登録だけで試用や課金が始まることはありません。/);
assert.equal(inputs(partner.html).find((field) => field.name === 'return_url').value, 'http://127.0.0.1:8872/?setae_plan=breeder_trial');
assert.equal(inputs(partner.html).find((field) => field.name === 'qr_claim_intent').value, '');
assert.equal((partner.html.match(/<a\b[^>]*class="setae-public-button is-primary"[^>]*data-public-register(?:\s|>)/g) || []).length, 1);
console.log('Passport claim copy tests passed (actual PHP controllers/templates; three fields, informed intent, private boundary, Partner confirmation destination)');
