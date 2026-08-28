<?php
/**
 * Species Card Template.
 *
 * `$GLOBALS['setae_species_card_query_ids']` is set by both the initial query
 * and the AJAX query so community metrics can be loaded in three grouped
 * queries instead of once per card.
 */

if (!function_exists('setae_get_species_card_metrics')) {
    function setae_get_species_card_metrics($species_id)
    {
        static $metrics = null;

        $species_id = absint($species_id);
        if ($metrics === null) {
            global $wpdb;

            $ids = isset($GLOBALS['setae_species_card_query_ids'])
                ? array_values(array_unique(array_filter(array_map('absint', (array) $GLOBALS['setae_species_card_query_ids']))))
                : array($species_id);
            if (empty($ids)) {
                $ids = array($species_id);
            }

            $metrics = array();
            foreach ($ids as $id) {
                $metrics[$id] = array(
                    'keepers' => 0,
                    'topics' => 0,
                    'open_topics' => 0,
                    'breeding' => 0,
                    'latest_topic_at' => '',
                );
            }

            $placeholders = implode(',', array_fill(0, count($ids), '%d'));

            $keeper_rows = $wpdb->get_results($wpdb->prepare(
                "SELECT CAST(species_pm.meta_value AS UNSIGNED) AS species_id,
                    COUNT(DISTINCT spiders.post_author) AS keeper_count
                FROM {$wpdb->postmeta} species_pm
                INNER JOIN {$wpdb->posts} spiders ON spiders.ID = species_pm.post_id
                WHERE species_pm.meta_key = '_setae_species_id'
                    AND spiders.post_type = 'setae_spider'
                    AND spiders.post_status = 'publish'
                    AND CAST(species_pm.meta_value AS UNSIGNED) IN ({$placeholders})
                GROUP BY CAST(species_pm.meta_value AS UNSIGNED)",
                $ids
            ), ARRAY_A);

            foreach ($keeper_rows as $row) {
                $id = absint($row['species_id']);
                if (isset($metrics[$id])) {
                    $metrics[$id]['keepers'] = (int) $row['keeper_count'];
                }
            }

            $topic_rows = $wpdb->get_results($wpdb->prepare(
                "SELECT CAST(species_pm.meta_value AS UNSIGNED) AS species_id,
                    COUNT(DISTINCT topics.ID) AS topic_count,
                    COUNT(DISTINCT CASE
                        WHEN status_pm.meta_value IS NULL OR status_pm.meta_value != 'resolved'
                        THEN topics.ID ELSE NULL END) AS open_count,
                    MAX(topics.post_modified_gmt) AS latest_at
                FROM {$wpdb->postmeta} species_pm
                INNER JOIN {$wpdb->posts} topics ON topics.ID = species_pm.post_id
                LEFT JOIN {$wpdb->postmeta} status_pm
                    ON status_pm.post_id = topics.ID
                    AND status_pm.meta_key = '_setae_topic_status'
                WHERE species_pm.meta_key = '_setae_related_species_id'
                    AND topics.post_type = 'setae_topic'
                    AND topics.post_status = 'publish'
                    AND CAST(species_pm.meta_value AS UNSIGNED) IN ({$placeholders})
                GROUP BY CAST(species_pm.meta_value AS UNSIGNED)",
                $ids
            ), ARRAY_A);

            foreach ($topic_rows as $row) {
                $id = absint($row['species_id']);
                if (isset($metrics[$id])) {
                    $metrics[$id]['topics'] = (int) $row['topic_count'];
                    $metrics[$id]['open_topics'] = (int) $row['open_count'];
                    $metrics[$id]['latest_topic_at'] = (string) $row['latest_at'];
                }
            }

            $breeding_rows = $wpdb->get_results($wpdb->prepare(
                "SELECT CAST(species_pm.meta_value AS UNSIGNED) AS species_id,
                    COUNT(DISTINCT spiders.ID) AS breeding_count
                FROM {$wpdb->postmeta} species_pm
                INNER JOIN {$wpdb->posts} spiders ON spiders.ID = species_pm.post_id
                INNER JOIN {$wpdb->postmeta} status_pm
                    ON status_pm.post_id = spiders.ID
                    AND status_pm.meta_key = '_setae_bl_status'
                    AND status_pm.meta_value = 'recruiting'
                WHERE species_pm.meta_key = '_setae_species_id'
                    AND spiders.post_type = 'setae_spider'
                    AND spiders.post_status = 'publish'
                    AND CAST(species_pm.meta_value AS UNSIGNED) IN ({$placeholders})
                GROUP BY CAST(species_pm.meta_value AS UNSIGNED)",
                $ids
            ), ARRAY_A);

            foreach ($breeding_rows as $row) {
                $id = absint($row['species_id']);
                if (isset($metrics[$id])) {
                    $metrics[$id]['breeding'] = (int) $row['breeding_count'];
                }
            }
        }

        return isset($metrics[$species_id]) ? $metrics[$species_id] : array(
            'keepers' => 0,
            'topics' => 0,
            'open_topics' => 0,
            'breeding' => 0,
            'latest_topic_at' => '',
        );
    }
}

$id = get_the_ID();
$scientific_name = get_the_title($id);
$common_name = get_post_meta($id, '_setae_common_name_ja', true) ?: $scientific_name;
$description = get_the_excerpt($id);
if (!$description) {
    $description = wp_trim_words(wp_strip_all_tags(get_post_field('post_content', $id)), 24, '...');
}

$thumb_id = get_post_thumbnail_id($id);
$featured_images = get_post_meta($id, '_setae_featured_images', true);
$image_url = $thumb_id ? get_the_post_thumbnail_url($id, 'medium_large') : '';
if (!$image_url && is_array($featured_images) && !empty($featured_images[0])) {
    $image_url = $featured_images[0];
}

$size = get_post_meta($id, '_setae_size', true);
$temperature = get_post_meta($id, '_setae_temperature', true);
$difficulty = get_post_meta($id, '_setae_difficulty', true);
$research_status = get_post_meta($id, '_setae_research_status', true) ?: 'unreviewed';
$research_sources = get_post_meta($id, '_setae_research_sources', true);
$source_count = is_array($research_sources) ? count($research_sources) : 0;
$metrics = setae_get_species_card_metrics($id);
$lifestyle_terms = get_the_terms($id, 'setae_lifestyle');
$habitat_terms = get_the_terms($id, 'setae_habitat');

$difficulty_labels = array(
    'beginner' => '入門',
    'intermediate' => '中級',
    'expert' => '上級',
);
$research_labels = array(
    'verified' => '確認済み',
    'reviewed' => 'レビュー済み',
    'draft' => 'Codex調査中',
    'unreviewed' => '調査待ち',
);
?>
<article class="species-card js-species-item" data-id="<?php echo esc_attr($id); ?>">
    <button type="button" class="card-link js-open-species-detail" data-id="<?php echo esc_attr($id); ?>" aria-label="<?php echo esc_attr($common_name . 'の詳細を見る'); ?>">
        <div class="card-image-box">
            <?php if ($image_url): ?>
                <img src="<?php echo esc_url($image_url); ?>" alt="<?php echo esc_attr($common_name); ?>" loading="lazy">
            <?php else: ?>
                <div class="no-image setae-avatar-img">
                    <img src="<?php echo esc_url(Setae_Icon_Registry::asset_url('specimen.spider')); ?>" alt="画像なし">
                </div>
            <?php endif; ?>

            <div class="species-card-status-row">
                <span class="species-research-badge is-<?php echo esc_attr($research_status); ?>">
                    <?php echo esc_html(isset($research_labels[$research_status]) ? $research_labels[$research_status] : $research_labels['unreviewed']); ?>
                </span>
                <?php if ($metrics['breeding'] > 0): ?>
                    <span class="species-breeding-badge">繁殖 <?php echo esc_html(number_format_i18n($metrics['breeding'])); ?>件</span>
                <?php endif; ?>
            </div>
        </div>

        <div class="card-content">
            <div class="species-names">
                <h2 class="ja-name"><?php echo esc_html($common_name); ?></h2>
                <p class="sci-name"><?php echo esc_html($scientific_name); ?></p>
            </div>

            <?php if ($description): ?>
                <p class="species-card-excerpt"><?php echo esc_html($description); ?></p>
            <?php endif; ?>

            <div class="species-card-taxonomy">
                <?php if (!empty($lifestyle_terms) && !is_wp_error($lifestyle_terms)): ?>
                    <span><?php echo esc_html($lifestyle_terms[0]->name); ?></span>
                <?php endif; ?>
                <?php if (!empty($habitat_terms) && !is_wp_error($habitat_terms)): ?>
                    <span><?php echo esc_html($habitat_terms[0]->name); ?></span>
                <?php endif; ?>
                <?php if ($difficulty): ?>
                    <span><?php echo esc_html(isset($difficulty_labels[$difficulty]) ? $difficulty_labels[$difficulty] : $difficulty); ?></span>
                <?php endif; ?>
            </div>

            <dl class="species-card-metrics">
                <div>
                    <dt>飼育者</dt>
                    <dd><?php echo esc_html(number_format_i18n($metrics['keepers'])); ?></dd>
                </div>
                <div>
                    <dt>相談</dt>
                    <dd><?php echo esc_html(number_format_i18n($metrics['topics'])); ?></dd>
                </div>
                <div>
                    <dt>出典</dt>
                    <dd><?php echo esc_html(number_format_i18n($source_count)); ?></dd>
                </div>
            </dl>

            <div class="species-card-care-range">
                <span><?php echo esc_html($temperature ?: '温度未登録'); ?></span>
                <span><?php echo esc_html($size ? trim(str_ireplace('cm', '', $size)) . ' cm' : 'サイズ未登録'); ?></span>
            </div>
        </div>
    </button>
</article>
