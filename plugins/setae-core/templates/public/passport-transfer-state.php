<?php
if (!defined('ABSPATH')) {
    exit;
}
?>
<section class="setae-qr-side-section setae-qr-transfer-section" aria-labelledby="setae-passport-transfer-title">
    <h2 id="setae-passport-transfer-title">この個体の履歴を引き継ぐ</h2>
    <p>引き継ぎは、現在の所有者が承認した時点で完了します。申請だけでは所有権は移動しません。</p>
    <?php if ($actions['request_status']): ?>
        <p class="setae-public-status is-warning" role="status">所有者の承認待ちです</p>
    <?php elseif ($passport['is_logged_in']): ?>
        <form method="post" action="<?php echo esc_url($actions['claim_url']); ?>" class="setae-qr-claim-form" data-setae-public-claim>
            <?php wp_nonce_field('setae_qr_claim_' . $actions['claim_code'], 'setae_qr_claim_nonce'); ?>
            <input type="hidden" name="setae_qr_claim" value="1">
            <button type="submit" class="setae-public-button is-primary"><?php echo Setae_Public_Visual::icon('transfer'); ?>引き継ぎを申請</button>
            <p class="setae-public-form-status" data-setae-public-claim-status role="status" aria-live="polite"></p>
        </form>
    <?php else: ?>
        <div class="setae-qr-transfer-actions">
            <?php if ($passport['registration']['enabled']): ?>
                <a class="setae-public-button is-primary" href="<?php echo esc_url($actions['register_url']); ?>" data-public-register aria-haspopup="dialog" aria-controls="<?php echo esc_attr($passport['registration']['id']); ?>">この個体の履歴を引き継ぐ</a>
                <a class="setae-public-button is-quiet" href="<?php echo esc_url($actions['claim_login_url']); ?>">ログインして申請</a>
            <?php else: ?><a class="setae-public-button is-primary" href="<?php echo esc_url($actions['claim_login_url']); ?>">ログインして申請</a><?php endif; ?>
        </div>
        <?php if ($passport['registration']['enabled']): ?><p>メール認証が完了すると引き継ぎ申請を送信します。現在の所有者が承認するまで所有権は移動しません。</p><?php endif; ?>
    <?php endif; ?>
</section>
