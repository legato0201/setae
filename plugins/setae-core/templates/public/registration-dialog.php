<?php
/** @var array $registration A context from Setae_Public_Registration::build_context(). */
if (!defined('ABSPATH')) {
    exit;
}
$registration_id = $registration['id'];
?>
<dialog
    class="setae-public-dialog setae-public-register-dialog"
    id="<?php echo esc_attr($registration_id); ?>"
    aria-labelledby="<?php echo esc_attr($registration_id); ?>-title"
    aria-describedby="<?php echo esc_attr($registration_id); ?>-description"
    tabindex="-1"
    data-public-registration
    data-source="<?php echo esc_attr($registration['source']); ?>"
    data-analytics-id="<?php echo esc_attr($registration['analytics_id']); ?>"
    data-ajax-url="<?php echo esc_url($registration['ajax_url']); ?>"
    data-success-message="<?php echo esc_attr($registration['success_message']); ?>"
    data-busy="false"
>
    <div class="setae-public-register-dialog-frame">
        <header class="setae-public-register-heading">
            <div>
                <p class="setae-public-register-eyebrow">START WITH SETAE</p>
                <h2 id="<?php echo esc_attr($registration_id); ?>-title"><?php echo esc_html($registration['title']); ?></h2>
            </div>
            <button type="button" class="setae-public-button is-quiet" data-public-register-close>閉じる</button>
        </header>
        <p id="<?php echo esc_attr($registration_id); ?>-description"><?php echo esc_html($registration['description']); ?></p>
        <form id="<?php echo esc_attr($registration_id); ?>-form" data-public-register-form autocomplete="on" novalidate>
            <input type="hidden" name="username" value="<?php echo esc_attr($registration['username']); ?>">
            <input type="hidden" name="referral_source" value="<?php echo esc_attr($registration['referral_source']); ?>">
            <input type="hidden" name="terms_version" value="<?php echo esc_attr($registration['terms_version']); ?>">
            <input type="hidden" name="qr_claim_code" value="<?php echo esc_attr($registration['qr_claim_code']); ?>">
            <input type="hidden" name="qr_claim_intent" value="<?php echo esc_attr($registration['qr_claim_intent']); ?>">
            <input type="hidden" name="return_url" value="<?php echo esc_attr($registration['return_url']); ?>">
            <div class="setae-public-form-error" id="<?php echo esc_attr($registration_id); ?>-error" role="alert" tabindex="-1" data-public-register-error hidden></div>
            <label class="setae-public-field" for="<?php echo esc_attr($registration_id); ?>-email">
                <span>メールアドレス</span>
                <input class="setae-public-input" type="email" id="<?php echo esc_attr($registration_id); ?>-email" name="email" value="<?php echo esc_attr($registration['email']); ?>" autocomplete="email" inputmode="email" autocapitalize="none" spellcheck="false" required>
            </label>
            <label class="setae-public-field" for="<?php echo esc_attr($registration_id); ?>-password">
                <span>パスワード</span>
                <input class="setae-public-input" type="password" id="<?php echo esc_attr($registration_id); ?>-password" name="password" autocomplete="new-password" minlength="6" aria-describedby="<?php echo esc_attr($registration_id); ?>-password-help" required>
                <small id="<?php echo esc_attr($registration_id); ?>-password-help">6文字以上で設定してください。</small>
            </label>
            <?php if ($registration['claim_context']): ?>
                <input type="hidden" name="referral_code" value="<?php echo esc_attr($registration['referral_code']); ?>">
            <?php else: ?>
            <label class="setae-public-field" for="<?php echo esc_attr($registration_id); ?>-referral">
                <span>紹介コード（任意）</span>
                <input class="setae-public-input" type="text" id="<?php echo esc_attr($registration_id); ?>-referral" name="referral_code" value="<?php echo esc_attr($registration['referral_code']); ?>" autocomplete="off" maxlength="64" aria-describedby="<?php echo esc_attr($registration_id); ?>-referral-help">
                <small id="<?php echo esc_attr($registration_id); ?>-referral-help" data-public-register-referral-help><?php echo esc_html($registration['referral_help']); ?></small>
            </label>
            <?php endif; ?>
            <div class="setae-public-register-consent">
                <label class="setae-public-register-checkbox-label" for="<?php echo esc_attr($registration_id); ?>-terms">
                    <input class="setae-public-checkbox" type="checkbox" id="<?php echo esc_attr($registration_id); ?>-terms" name="terms_accepted" value="1" required>
                    <span>利用規約に同意します</span>
                </label>
                <a href="<?php echo esc_url($registration['terms_url']); ?>" target="_blank" rel="noopener noreferrer">利用規約を確認</a>
            </div>
            <div class="setae-public-form-actions">
                <button type="button" class="setae-public-button is-default" data-public-register-close>キャンセル</button>
                <button type="submit" class="setae-public-button is-primary" data-public-register-submit><?php echo esc_html($registration['submit_label']); ?></button>
            </div>
            <p class="setae-public-form-status" role="status" aria-live="polite" aria-atomic="true" data-public-register-status></p>
        </form>
    </div>
</dialog>
<p class="setae-public-register-notice" id="<?php echo esc_attr($registration_id); ?>-notice" role="status" aria-live="polite" aria-atomic="true" data-public-register-notice></p>
