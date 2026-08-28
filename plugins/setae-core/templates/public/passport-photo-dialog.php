<?php
if (!defined('ABSPATH')) {
    exit;
}
?>
<dialog id="setae-public-photo-dialog" class="setae-public-dialog setae-qr-photo-dialog" data-setae-public-photo-dialog aria-labelledby="setae-public-photo-title" aria-describedby="setae-public-photo-instructions">
    <div class="setae-qr-photo-dialog-shell">
        <header class="setae-qr-photo-dialog-head">
            <h2 id="setae-public-photo-title">個体の写真</h2>
            <button type="button" class="setae-public-button is-quiet is-icon" data-setae-public-photo-close aria-label="写真を閉じる"><?php echo Setae_Public_Visual::icon('x'); ?></button>
        </header>
        <p id="setae-public-photo-instructions" class="setae-public-visually-hidden">左右の矢印キーで写真を切り替え、Escapeキーで閉じます。</p>
        <figure class="setae-qr-photo-dialog-stage">
            <img class="setae-qr-photo-dialog-image" alt="" loading="eager" decoding="async" data-setae-public-photo-image>
            <figcaption class="setae-qr-photo-dialog-meta"><strong data-setae-public-photo-label></strong><time data-setae-public-photo-date></time></figcaption>
        </figure>
        <div class="setae-qr-photo-dialog-navigation">
            <?php if (count($passport['gallery']) > 1): ?><button type="button" class="setae-public-button is-default" data-setae-public-photo-prev><?php echo Setae_Public_Visual::icon('chevron-left'); ?>前の写真</button><?php endif; ?>
            <p data-setae-public-photo-count aria-live="polite" aria-atomic="true"></p>
            <?php if (count($passport['gallery']) > 1): ?><button type="button" class="setae-public-button is-default" data-setae-public-photo-next>次の写真<?php echo Setae_Public_Visual::icon('chevron-right'); ?></button><?php endif; ?>
        </div>
    </div>
</dialog>
<script type="application/json" data-setae-public-photo-data><?php echo wp_json_encode($passport['gallery'], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_HEX_TAG | JSON_HEX_AMP | JSON_HEX_APOS | JSON_HEX_QUOT); ?></script>
