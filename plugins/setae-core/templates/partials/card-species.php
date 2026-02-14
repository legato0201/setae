<?php
/**
 * Species Card Template
 * Used in both initial PHP render and AJAX loading.
 */

$id = get_the_ID();
$title_ja = get_the_title(); // 和名想定
$title_en = get_post_meta($id, 'scientific_name', true); // 学名
if (!$title_en)
    $title_en = '-';

// 画像
$thumb_id = get_post_thumbnail_id($id);
$img_html = '<div class="no-image">No Image</div>';
if ($thumb_id) {
    $img_html = wp_get_attachment_image($thumb_id, 'medium', false, array('loading' => 'lazy'));
}

// スペック（メタデータ）
$size = get_post_meta($id, 'max_size', true);
$temp = get_post_meta($id, 'temperature', true);
$level = get_post_meta($id, 'difficulty', true); // beginner, intermediate, advanced

// バッジ（例：Keeping数やタイプ）
$keeping_count = get_post_meta($id, 'keeping_count', true);
$badges = '';
if ($keeping_count) {
    $badges .= '<span class="badge" style="background:#ffcc00; color:#000;">🔥 ' . esc_html($keeping_count) . ' Keeping</span>';
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
                <div class="spec-item"><span class="spec-label">Size</span><span
                        class="spec-value"><?php echo esc_html($size ? $size . 'cm' : '-'); ?></span></div>
                <div class="spec-item"><span class="spec-label">Temp</span><span
                        class="spec-value"><?php echo esc_html($temp ? $temp : '-'); ?></span></div>
                <div class="spec-item difficulty-<?php echo esc_attr($level); ?>">
                    <span class="spec-label">Level</span>
                    <span class="spec-value"><?php echo esc_html($level ? $level : '-'); ?></span>
                </div>
            </div>
        </div>
    </a>
</article>