<?php
/**
 * 図鑑カードの単体テンプレート
 * 変数 $post が利用可能な状態でincludeされる想定
 */
$id = get_the_ID();

// --- データの取得と整形 ---
$common_name = get_post_meta($id, '_setae_common_name_ja', true);
$size = get_post_meta($id, '_setae_size', true);
$temp = get_post_meta($id, '_setae_temperature', true);
$difficulty = get_post_meta($id, '_setae_difficulty', true);

// 飼育数を取得 (DBから直接集計)
global $wpdb;
$sql = $wpdb->prepare("
    SELECT COUNT(DISTINCT post_author)
    FROM {$wpdb->posts} p
    INNER JOIN {$wpdb->postmeta} pm ON p.ID = pm.post_id
    WHERE p.post_type = 'setae_spider'
    AND p.post_status = 'publish'
    AND pm.meta_key = '_setae_species_id'
    AND pm.meta_value = %d
", $id);
$keeping_count = (int) $wpdb->get_var($sql);

// 難易度の数値化
$diff_map = ['beginner' => 1, 'intermediate' => 2, 'expert' => 3];
$diff_val = isset($diff_map[$difficulty]) ? $diff_map[$difficulty] : 0;

// ライフスタイル
$lifestyles = get_the_terms($id, 'setae_lifestyle');
$lifestyle_name = $lifestyles ? $lifestyles[0]->name : '';
$raw_slug = $lifestyles ? urldecode($lifestyles[0]->slug) : '';
$style_key = '';
if ($raw_slug === '樹上性')
    $style_key = 'arboreal';
elseif ($raw_slug === '地表性')
    $style_key = 'terrestrial';
elseif ($raw_slug === '地中性')
    $style_key = 'fossorial';
else
    $style_key = $lifestyles ? $lifestyles[0]->slug : '';

// 地域
$regions = get_the_terms($id, 'setae_habitat');
$region_name = $regions ? $regions[0]->name : '';
$region_slug = $regions ? $regions[0]->slug : '';

$thumb_url = has_post_thumbnail() ? get_the_post_thumbnail_url($id, 'medium_large') : '';
?>

<article class="species-card js-species-item" data-id="<?php echo esc_attr($id); ?>">
    <a href="javascript:void(0);" class="card-link js-open-species-detail" data-id="<?php echo esc_attr($id); ?>">
        <div class="card-image-box">
            <?php if ($thumb_url): ?>
                <img src="<?php echo esc_url($thumb_url); ?>" alt="<?php the_title(); ?>" loading="lazy">
            <?php else: ?>
                <div class="no-image">No Image</div>
            <?php endif; ?>

            <div class="card-badges">
                <?php if ($keeping_count > 0): ?>
                    <span class="badge" style="background:#ffcc00; color:#000;">🔥
                        <?php echo $keeping_count; ?> Keeping
                    </span>
                <?php endif; ?>

                <?php if ($lifestyle_name): ?>
                    <span class="badge badge-lifestyle <?php echo esc_attr($style_key); ?>">
                        <?php echo esc_html($lifestyle_name); ?>
                    </span>
                <?php endif; ?>
                <?php if ($region_name): ?>
                    <span class="badge badge-region">
                        <?php echo esc_html($region_name); ?>
                    </span>
                <?php endif; ?>
            </div>
        </div>

        <div class="card-content">
            <div class="species-names">
                <h2 class="ja-name">
                    <?php echo $common_name ? esc_html($common_name) : '名称未設定'; ?>
                </h2>
                <p class="sci-name">
                    <?php the_title(); ?>
                </p>
            </div>
            <div class="species-specs">
                <div class="spec-item"><span class="spec-label">Size</span><span class="spec-value">
                        <?php echo $size ? esc_html($size) . 'cm' : '-'; ?>
                    </span></div>
                <div class="spec-item"><span class="spec-label">Temp</span><span class="spec-value">
                        <?php echo $temp ? esc_html($temp) : '-'; ?>
                    </span></div>
                <div class="spec-item difficulty-<?php echo esc_attr($difficulty); ?>">
                    <span class="spec-label">Level</span>
                    <span class="spec-value">
                        <?php echo $difficulty ?: '-'; ?>
                    </span>
                </div>
            </div>
        </div>
    </a>
</article>