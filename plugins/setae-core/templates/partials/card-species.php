<?php
/**
 * Species Card Template
 * Used in both initial PHP render and AJAX loading.
 */

$id = get_the_ID();

// 1. タイトル（学名）と和名の取得ロジックを修正
$title_en = get_the_title(); // タイトルフィールド = 学名
$title_ja = get_post_meta($id, '_setae_common_name_ja', true); // 和名フィールド

// 和名が未設定の場合は学名を表示（または '-' ）
if (!$title_ja) {
    $title_ja = $title_en;
}

// 画像
$thumb_id = get_post_thumbnail_id($id);
$img_html = '<div class="no-image">' . esc_html__('No Image', 'setae-core') . '</div>';
if ($thumb_id) {
    $img_html = wp_get_attachment_image($thumb_id, 'medium', false, array('loading' => 'lazy'));
}

// 2. メタデータのキー名を修正 ('_setae_' プレフィックスを付与)
$size = get_post_meta($id, '_setae_size', true);
$temp = get_post_meta($id, '_setae_temperature', true);
$level = get_post_meta($id, '_setae_difficulty', true);

// バッジ（例：Keeping数やタイプ）
$keeping_count = get_post_meta($id, 'keeping_count', true);
$badges = '';
if ($keeping_count) {
    $badges .= '<span class="badge" style="background:#ffcc00; color:#000;">🔥 ' . esc_html($keeping_count) . ' ' . esc_html__('Keeping', 'setae-core') . '</span>';
}
// タクソノミーバッジ（例：樹上性）
$styles = get_the_terms($id, 'setae_lifestyle');
if (!empty($styles) && !is_wp_error($styles)) {
    foreach ($styles as $style) {
        $badges .= '<span class="badge badge-lifestyle ' . esc_attr($style->slug) . '">' . esc_html($style->name) . '</span>';
    }
}
?>

<article class="species-card js-species-item" data-id="<?php echo esc_attr($id); ?>">
    <a href="javascript:void(0);" class="card-link js-open-species-detail" data-id="<?php echo esc_attr($id); ?>">
        <div class="card-image-box">
            <?php echo $img_html; ?>
            <div class="card-badges">
                <?php echo $badges; ?>
            </div>
        </div>

        <div class="card-content">
            <div class="species-names">
                <h2 class="ja-name"><?php echo esc_html($title_ja); ?></h2>
                <p class="sci-name"><?php echo esc_html($title_en); ?></p>
            </div>
            <div class="species-specs">
                <div class="spec-item"><span class="spec-label"><?php esc_html_e('Size', 'setae-core'); ?></span><span
                        class="spec-value"><?php echo esc_html($size ? $size . 'cm' : '-'); ?></span></div>
                <div class="spec-item"><span class="spec-label"><?php esc_html_e('Temp', 'setae-core'); ?></span><span
                        class="spec-value"><?php echo esc_html($temp ? $temp : '-'); ?></span></div>
                <div class="spec-item difficulty-<?php echo esc_attr($level); ?>">
                    <span class="spec-label"><?php esc_html_e('Level', 'setae-core'); ?></span>
                    <span class="spec-value"><?php echo $level ? esc_html__($level, 'setae-core') : '-'; ?></span>
                </div>
            </div>
        </div>
    </a>
</article>