<?php
/** Partner page content. No data lookup or registration implementation lives here. */
if (!defined('ABSPATH')) {
    exit;
}
$partner_registration_enabled = !empty($setae_partner['registration']['enabled']);
$partner_action_url = $partner_registration_enabled ? $setae_partner['register_url'] : $setae_partner['plan_url'];
$partner_action_label = 'ブリーダー機能を30日試す';
?>
<main id="setae-public-partner-main" class="setae-public-surface-shell setae-public-partner-shell" tabindex="-1"
      data-public-share-root data-partner-page
      data-share-title="<?php echo esc_attr($setae_partner['share']['title']); ?>"
      data-share-text="<?php echo esc_attr($setae_partner['share']['text']); ?>"
      data-share-url="<?php echo esc_url($setae_partner['share']['url']); ?>"
      data-share-copy-text="<?php echo esc_attr($setae_partner['share']['copy_text']); ?>">
    <section class="setae-public-partner-hero" aria-labelledby="setae-public-partner-title">
        <p class="setae-public-section-label">FOR SHOPS &amp; BREEDERS</p>
        <h1 id="setae-public-partner-title" class="setae-public-partner-title"><span class="setae-public-partner-title-line">売る前から、</span><span class="setae-public-partner-title-line">譲った後まで。</span></h1>
        <p class="setae-public-partner-lead">
            ベビー群から個体ID・QRへ。生まれたCB個体の給餌・脱皮・写真・親情報などの記録を、次の飼育者へつなぎます。
            購入者はQRから個体パスポートを受け取り、承認後は購入後の飼育記録も続けて残せます。
        </p>
        <div class="setae-public-partner-hero-controls" data-public-share-controls>
            <div class="setae-public-partner-actions">
                <a class="setae-public-button is-primary" href="<?php echo esc_url($partner_action_url); ?>"
                   <?php if ($partner_registration_enabled): ?>data-public-register aria-haspopup="dialog" aria-controls="<?php echo esc_attr($setae_partner['registration']['id']); ?>"<?php endif; ?>><?php echo esc_html($partner_action_label); ?></a>
                <a class="setae-public-button is-default" href="#setae-public-partner-buyer">購入した個体の履歴を引き継ぐ</a>
                <button type="button" class="setae-public-button is-quiet" data-public-share-action="link">案内ページURLをコピー</button>
            </div>
            <p class="setae-public-share-status" role="status" aria-live="polite" aria-atomic="true" data-public-share-status></p>
        </div>
    </section>

    <section class="setae-public-partner-section" aria-labelledby="setae-public-partner-benefits-title">
        <div class="setae-public-partner-section-heading">
            <h2 id="setae-public-partner-benefits-title" class="setae-public-partner-heading">購入者へ渡せるもの</h2>
            <p class="setae-public-partner-description">個体に積み重ねた記録を、購入後の管理へつなぎます。血統や記録内容を証明するサービスではありません。</p>
        </div>
        <div class="setae-public-partner-features">
            <?php foreach ($setae_partner['features'] as $feature): ?>
                <div class="setae-public-partner-feature">
                    <div class="setae-public-partner-feature-heading">
                        <p class="setae-public-section-label"><?php echo esc_html($feature['eyebrow']); ?></p>
                        <h3 class="setae-public-partner-subheading"><?php echo esc_html($feature['title']); ?></h3>
                    </div>
                    <div class="setae-public-partner-feature-copy">
                        <p class="setae-public-partner-feature-kind"><?php echo esc_html($feature['kind']); ?></p>
                        <p class="setae-public-partner-description"><?php echo esc_html($feature['description']); ?></p>
                    </div>
                </div>
            <?php endforeach; ?>
        </div>
    </section>

    <section class="setae-public-partner-section" aria-labelledby="setae-public-partner-flow-title">
        <div class="setae-public-partner-section-heading">
            <p class="setae-public-section-label">HOW TO USE</p>
            <h2 id="setae-public-partner-flow-title" class="setae-public-partner-heading">販売時の流れ</h2>
        </div>
        <ol class="setae-public-partner-steps">
            <?php foreach ($setae_partner['steps'] as $step): ?>
                <li class="setae-public-partner-step">
                    <h3 class="setae-public-partner-subheading"><?php echo esc_html($step['title']); ?></h3>
                    <p class="setae-public-partner-description"><?php echo esc_html($step['description']); ?></p>
                </li>
            <?php endforeach; ?>
        </ol>
    </section>

    <section class="setae-public-partner-copy-kit" aria-labelledby="setae-public-partner-copy-title" data-public-share-controls>
        <div class="setae-public-partner-section-heading">
            <p class="setae-public-section-label">COPY KIT</p>
            <h2 id="setae-public-partner-copy-title" class="setae-public-partner-heading">そのまま使える案内文</h2>
            <p id="setae-public-partner-copy-help" class="setae-public-partner-description">SNSや販売後のメッセージへ貼り付けられます。文面を調整するときは、コピー後に貼り付け先で編集してください。</p>
        </div>
        <div class="setae-public-partner-copy-content">
            <label class="setae-public-field" for="setae-public-partner-invite-text">
                購入者への案内文
                <textarea id="setae-public-partner-invite-text" class="setae-public-input setae-public-partner-invite-text"
                          rows="9" readonly wrap="soft" aria-describedby="setae-public-partner-copy-help"><?php echo esc_textarea($setae_partner['copy_text']); ?></textarea>
            </label>
            <div class="setae-public-partner-actions">
                <button type="button" class="setae-public-button is-default" data-public-share-action="text"
                        data-public-share-message="案内文をコピーしました。">案内文をコピー</button>
                <button type="button" class="setae-public-button is-default" data-public-share-action="native" hidden>端末で共有</button>
                <a class="setae-public-button is-default" href="<?php echo esc_url($setae_partner['share']['x_url']); ?>"
                   target="_blank" rel="noopener noreferrer" data-public-share-action="x">Xで共有</a>
                <a class="setae-public-button is-default" href="<?php echo esc_url($setae_partner['share']['line_url']); ?>"
                   target="_blank" rel="noopener noreferrer" data-public-share-action="line">LINEで送る</a>
            </div>
            <p class="setae-public-share-status" role="status" aria-live="polite" aria-atomic="true" data-public-share-status></p>
        </div>
    </section>

    <section id="setae-public-partner-buyer" class="setae-public-partner-final" aria-labelledby="setae-public-partner-final-title">
        <div class="setae-public-partner-final-copy">
            <h2 id="setae-public-partner-final-title" class="setae-public-partner-heading">購入した個体の履歴を引き継ぐ</h2>
            <p class="setae-public-partner-description">販売者から受け取った個体のQRを、カメラで読み取ってください。公開情報を確認して、メールアドレス・パスワード・利用規約への同意で登録できます。メール認証後に申請し、現在の所有者の承認を待ちます。</p>
        </div>
        <a class="setae-public-button is-default" href="<?php echo esc_url($setae_partner['app_url']); ?>">SETAEを開く</a>
    </section>
</main>
