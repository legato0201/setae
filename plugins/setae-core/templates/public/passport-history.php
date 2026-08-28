<?php
/** A ledger of already-filtered events. Never queries logs or meta. */
if (!defined('ABSPATH')) {
    exit;
}
$history_title_id = $setae_history_owner ? 'setae-owner-history-title' : 'setae-passport-history-title';
?>
<section class="setae-qr-history" aria-labelledby="<?php echo esc_attr($history_title_id); ?>">
    <div class="setae-qr-section-heading">
        <?php if ($setae_history_owner): ?><h3 id="<?php echo esc_attr($history_title_id); ?>">最近の管理記録</h3><p>最新6件まで · 所有者だけに表示</p>
        <?php else: ?><h2 id="<?php echo esc_attr($history_title_id); ?>">生活史</h2><p><?php echo esc_html($passport['history']['note']); ?></p><?php endif; ?>
    </div>
    <?php if (!$setae_history_owner): ?><p class="setae-qr-history-intro">脱皮、成長、ペアリングの歩みを記録しています。</p><?php endif; ?>
    <?php if ($setae_history): ?>
        <ol class="setae-qr-history-list">
            <?php foreach ($setae_history as $activity): ?>
                <li class="setae-qr-history-item">
                    <time class="setae-qr-history-date" datetime="<?php echo esc_attr($activity['date']); ?>"><?php echo esc_html($activity['display_date']); ?></time>
                    <span class="setae-qr-history-marker" aria-hidden="true"><?php echo Setae_Public_Visual::icon($activity['type']); ?></span>
                    <div class="setae-qr-history-content"><p class="setae-qr-history-type"><?php echo esc_html($activity['label']); ?></p><p class="setae-qr-history-summary"><?php echo esc_html($activity['summary']); ?></p><?php if ($activity['photo_count']): ?><span class="setae-qr-history-photos"><?php echo Setae_Public_Visual::icon('photo'); ?>写真<?php echo esc_html(number_format_i18n($activity['photo_count'])); ?>点</span><?php endif; ?></div>
                </li>
            <?php endforeach; ?>
        </ol>
    <?php else: ?><p class="setae-qr-empty-note"><?php echo $setae_history_owner ? '管理記録はまだありません。' : '公開されている生活史はまだありません。'; ?></p><?php endif; ?>
</section>
