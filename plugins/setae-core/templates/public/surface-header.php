<?php
/** @var array $surface Completed public header/footer context. */
if (!defined('ABSPATH')) {
    exit;
}
?>
<header class="setae-public-surface-header">
    <div class="setae-public-surface-shell setae-public-surface-header-inner">
        <?php echo Setae_Public_Identity::render_brand($surface['brand_url']); // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped ?>
        <p class="setae-public-surface-label"><?php echo esc_html($surface['label']); ?></p>
        <?php if (empty($surface['is_logged_in']) && !empty($surface['login_url'])): ?>
            <nav class="setae-public-surface-header-actions" aria-label="アカウント">
                <a class="setae-public-button is-quiet" href="<?php echo esc_url($surface['login_url']); ?>">ログイン</a>
            </nav>
        <?php endif; ?>
    </div>
</header>
