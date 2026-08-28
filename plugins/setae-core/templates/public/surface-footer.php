<?php
/** @var array $surface Completed public header/footer context. */
if (!defined('ABSPATH')) {
    exit;
}
?>
<footer class="setae-public-surface-footer">
    <div class="setae-public-surface-shell setae-public-surface-footer-inner">
        <?php echo Setae_Public_Identity::render_brand($surface['brand_url']); // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped ?>
        <nav class="setae-public-surface-footer-links" aria-label="フッター">
            <a class="setae-public-button is-quiet" href="<?php echo esc_url($surface['terms_url']); ?>">利用規約</a>
            <a class="setae-public-button is-quiet" href="<?php echo esc_url($surface['home_url']); ?>">トップへ</a>
        </nav>
    </div>
</footer>
