<?php
/**
 * Partial: Encyclopedia Section
 * Description: サーバーサイド検索・ソート対応版
 */
?>
<div id="section-enc" class="setae-section">

    <div class="setae-toolbar-container sticky-shadow"
        style="position:sticky; top:0; z-index:90; background:#f4f7f6; padding:10px 15px; margin: -16px -16px 16px -16px; width: auto; box-shadow: 0 2px 10px rgba(0,0,0,0.05);">
        <div class="setae-toolbar-header"
            style="display:flex; justify-content:space-between; align-items:center; gap:10px; margin-bottom:10px;">

            <div class="setae-search-wrapper" style="position:relative; flex-grow:1;">
                <svg class="search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"
                    style="position:absolute; left:12px; top:50%; transform:translateY(-50%); width:18px; height:18px; color:#999;">
                    <circle cx="11" cy="11" r="8"></circle>
                    <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                </svg>
                <input type="text" id="setae-enc-search" class="setae-search-input" placeholder="種名・学名で検索..."
                    style="width:100%; padding:10px 10px 10px 38px; border-radius:20px; border:1px solid #ddd; font-size:14px; background:#fff;">
            </div>

            <div class="setae-actions" style="display:flex; gap:8px;">
                <button id="btn-enc-sort-menu" class="setae-icon-btn" aria-label="並び替え"
                    style="background:#fff; border:1px solid #ddd; border-radius:50%; width:40px; height:40px; display:flex; align-items:center; justify-content:center; cursor:pointer;">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M4 6h16M4 12h10M4 18h7"></path>
                    </svg>
                </button>
            </div>
        </div>

        <div class="setae-decks-scroll" id="setae-enc-filters"
            style="display:flex; gap:8px; overflow-x:auto; padding-bottom:5px; scrollbar-width:none;">
            <button class="deck-pill active" data-filter="all">すべて</button>

            <button class="deck-pill" data-filter="lifestyle_arboreal"><span class="pill-icon">🌿</span> 樹上性</button>
            <button class="deck-pill" data-filter="lifestyle_terrestrial"><span class="pill-icon">🏜️</span>
                地表性</button>
            <button class="deck-pill" data-filter="lifestyle_fossorial"><span class="pill-icon">🕳️</span> 地中性</button>

            <?php
            // 地域フィルタ (タクソノミー: setae_habitat)
            $regions = get_terms(array('taxonomy' => 'setae_habitat', 'hide_empty' => true));
            if (!empty($regions) && !is_wp_error($regions)) {
                foreach ($regions as $region) {
                    // region_スラッグ の形式で出力
                    echo '<button class="deck-pill" data-filter="habitat_' . esc_attr($region->slug) . '">';
                    echo '🌏 ' . esc_html($region->name);
                    echo '</button>';
                }
            }
            ?>
        </div>
    </div>

    <div class="setae-species-grid" id="setae-species-list-container">
        <?php
        // 初回ロード時はPHPで1ページ目を描画（SEO・速度対策）
        $args = array(
            'post_type' => 'setae_species',
            'post_status' => 'publish',
            'posts_per_page' => 12,
            'orderby' => 'title',
            'order' => 'ASC',
        );
        $query = new WP_Query($args);

        if ($query->have_posts()) {
            while ($query->have_posts()) {
                $query->the_post();
                // 共通カードテンプレートを読み込み
                include(plugin_dir_path(__FILE__) . 'card-species.php');
            }
            wp_reset_postdata();
        } else {
            echo '<p class="no-results" style="padding:20px; text-align:center; color:#999;">データが見つかりません</p>';
        }
        ?>
    </div>

    <div id="setae-enc-loader"
        style="width:100%; height:50px; visibility:hidden; display:flex; justify-content:center; align-items:center; margin-top:20px;">
        <span class="spinner" style="display:inline-block; margin-right:5px;"></span> <span
            style="color:#999; font-size:12px;">Loading more...</span>
    </div>

    <input type="hidden" id="setae-current-page" value="1">
    <input type="hidden" id="setae-max-pages" value="<?php echo esc_attr($query->max_num_pages); ?>">

</div>