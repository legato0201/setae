<?php
/**
 * Partial: Encyclopedia Section
 * Description: 検索・ソート・フィルター機能を強化した図鑑セクション
 */
?>
<div id="section-enc" class="setae-section" style="display: none;">

    <div class="setae-toolbar-container sticky-shadow" style="position:sticky; top:0; z-index:90; background:#f4f7f6; padding:10px 15px; margin: -15px -15px 15px -15px; box-shadow: 0 2px 10px rgba(0,0,0,0.05);">
        <div class="setae-toolbar-header" style="display:flex; justify-content:space-between; align-items:center; gap:10px; margin-bottom:10px;">
            
            <div class="setae-search-wrapper" style="position:relative; flex-grow:1;">
                <svg class="search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="position:absolute; left:12px; top:50%; transform:translateY(-50%); width:18px; height:18px; color:#999;">
                    <circle cx="11" cy="11" r="8"></circle>
                    <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                </svg>
                <input type="text" id="setae-enc-search" class="setae-search-input" placeholder="種名・学名で検索..." style="width:100%; padding:10px 10px 10px 38px; border-radius:20px; border:1px solid #ddd; font-size:14px; background:#fff;">
            </div>

            <div class="setae-actions" style="display:flex; gap:8px;">
                <button id="btn-enc-sort-menu" class="setae-icon-btn" aria-label="並び替え" style="background:#fff; border:1px solid #ddd; border-radius:50%; width:40px; height:40px; display:flex; align-items:center; justify-content:center; cursor:pointer;">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M4 6h16M4 12h10M4 18h7"></path>
                    </svg>
                </button>
            </div>
        </div>

        <div class="setae-decks-scroll" id="setae-enc-filters" style="display:flex; gap:8px; overflow-x:auto; padding-bottom:5px; scrollbar-width:none;">
            <button class="deck-pill active" data-filter="all" style="white-space:nowrap; padding:6px 14px; border-radius:16px; border:1px solid #ddd; background:#fff; font-size:12px; cursor:pointer;">
                すべて
            </button>
            
            <button class="deck-pill" data-filter="style_arboreal" style="white-space:nowrap; padding:6px 14px; border-radius:16px; border:1px solid #ddd; background:#fff; font-size:12px; cursor:pointer;">
                <span class="pill-icon">🌿</span> 樹上性
            </button>
            <button class="deck-pill" data-filter="style_terrestrial" style="white-space:nowrap; padding:6px 14px; border-radius:16px; border:1px solid #ddd; background:#fff; font-size:12px; cursor:pointer;">
                <span class="pill-icon">🏜️</span> 地表性
            </button>
            <button class="deck-pill" data-filter="style_fossorial" style="white-space:nowrap; padding:6px 14px; border-radius:16px; border:1px solid #ddd; background:#fff; font-size:12px; cursor:pointer;">
                <span class="pill-icon">🕳️</span> 地中性
            </button>

            <?php
            // 地域タームを取得してボタン化
            $regions = get_terms(array('taxonomy' => 'setae_habitat', 'hide_empty' => true));
            if (!empty($regions) && !is_wp_error($regions)) {
                foreach ($regions as $region) {
                    echo '<button class="deck-pill" data-filter="region_' . esc_attr($region->slug) . '" style="white-space:nowrap; padding:6px 14px; border-radius:16px; border:1px solid #ddd; background:#fff; font-size:12px; cursor:pointer;">';
                    echo '🌏 ' . esc_html($region->name);
                    echo '</button>';
                }
            }
            ?>
        </div>
    </div>
    <div class="setae-species-grid" id="setae-species-list-container">
        <?php
        $args = array(
            'post_type' => 'setae_species',
            'posts_per_page' => -1,
            'status' => 'publish'
        );
        $species_query = new WP_Query($args);

        if ($species_query->have_posts()):
            while ($species_query->have_posts()):
                $species_query->the_post();

                // メタデータの取得
                $common_name = get_post_meta(get_the_ID(), '_setae_common_name_ja', true);
                $size = get_post_meta(get_the_ID(), '_setae_size', true);
                $temp = get_post_meta(get_the_ID(), '_setae_temperature', true);
                $difficulty = get_post_meta(get_the_ID(), '_setae_difficulty', true);
                
                // ★追加: 飼育数（未設定なら0）
                $keeping_count = get_post_meta(get_the_ID(), '_setae_keeping_count', true) ?: 0;

                // 難易度の数値化（ソート用）
                $diff_map = ['beginner' => 1, 'intermediate' => 2, 'expert' => 3];
                $diff_val = isset($diff_map[$difficulty]) ? $diff_map[$difficulty] : 0;

                // タクソノミーの取得
                $lifestyles = get_the_terms(get_the_ID(), 'setae_lifestyle');
                $lifestyle_name = $lifestyles ? $lifestyles[0]->name : '';
                $lifestyle_slug = $lifestyles ? $lifestyles[0]->slug : '';

                $regions = get_the_terms(get_the_ID(), 'setae_habitat');
                $region_name = $regions ? $regions[0]->name : '';
                $region_slug = $regions ? $regions[0]->slug : '';

                $thumb_url = has_post_thumbnail() ? get_the_post_thumbnail_url(get_the_ID(), 'medium_large') : '';
                $search_string = strtolower(get_the_title() . ' ' . $common_name);
                ?>

                <article class="species-card js-species-item" 
                    data-id="<?php the_ID(); ?>"
                    data-search="<?php echo esc_attr($search_string); ?>"
                    data-sort-name="<?php echo esc_attr(strtolower(get_the_title())); ?>"
                    data-sort-count="<?php echo esc_attr($keeping_count); ?>"
                    data-sort-diff="<?php echo esc_attr($diff_val); ?>"
                    data-filter-style="<?php echo esc_attr('style_' . $lifestyle_slug); ?>"
                    data-filter-region="<?php echo esc_attr('region_' . $region_slug); ?>"
                >
                    <a href="javascript:void(0);" class="card-link js-open-species-detail" data-id="<?php the_ID(); ?>">

                        <div class="card-image-box">
                            <?php if ($thumb_url): ?>
                                <img src="<?php echo esc_url($thumb_url); ?>" alt="<?php the_title(); ?>" loading="lazy">
                            <?php else: ?>
                                <div class="no-image">No Image</div>
                            <?php endif; ?>

                            <div class="card-badges">
                                <?php if ($keeping_count > 0): ?>
                                    <span class="badge" style="background:#ffcc00; color:#000;">🔥 <?php echo $keeping_count; ?> Keeping</span>
                                <?php endif; ?>
                                
                                <?php if ($lifestyle_name): ?>
                                    <span class="badge badge-lifestyle <?php echo esc_attr($lifestyle_slug); ?>">
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
                                <h2 class="ja-name"><?php echo $common_name ? esc_html($common_name) : '名称未設定'; ?></h2>
                                <p class="sci-name"><?php the_title(); ?></p>
                            </div>

                            <div class="species-specs">
                                <div class="spec-item">
                                    <span class="spec-label">Size</span>
                                    <span class="spec-value"><?php echo $size ? esc_html($size) . 'cm' : '-'; ?></span>
                                </div>
                                <div class="spec-item">
                                    <span class="spec-label">Temp</span>
                                    <span class="spec-value"><?php echo $temp ? esc_html($temp) : '-'; ?></span>
                                </div>
                                <div class="spec-item difficulty-<?php echo esc_attr($difficulty); ?>">
                                    <span class="spec-label">Level</span>
                                    <span class="spec-value">
                                        <?php
                                        $diff_labels = ['beginner' => '初心者', 'intermediate' => '中級者', 'expert' => '上級者'];
                                        echo isset($diff_labels[$difficulty]) ? $diff_labels[$difficulty] : '-';
                                        ?>
                                    </span>
                                </div>
                            </div>
                        </div>
                    </a>
                </article>

            <?php
            endwhile;
            wp_reset_postdata();
        else:
            ?>
            <p style="padding:20px; text-align:center; color:#999;">まだ登録された種がありません。</p>
        <?php endif; ?>
    </div>
</div>

<script>
jQuery(document).ready(function($) {
    'use strict';
    
    const $container = $('#setae-species-list-container');
    const $items = $container.find('.js-species-item');
    const $input = $('#setae-enc-search');
    const $filterBtns = $('#setae-enc-filters .deck-pill');
    
    let currentFilter = 'all';
    let currentSort = 'name_asc'; // default

    // 1. 検索機能
    $input.on('input', function() {
        applyFilterSort();
    });

    // 2. フィルター機能
    $filterBtns.on('click', function() {
        $filterBtns.removeClass('active').css('background', '#fff').css('color', '#333');
        $(this).addClass('active').css('background', '#333').css('color', '#fff'); // Active Style
        currentFilter = $(this).data('filter');
        applyFilterSort();
    });

    // 3. ソートメニュー表示
    $('#btn-enc-sort-menu').on('click', function(e) {
        e.stopPropagation();
        const $existing = $('#setae-enc-sort-popup');
        if($existing.length) { $existing.remove(); return; }

        const menuHtml = `
            <div id="setae-enc-sort-popup" style="position:absolute; background:#fff; border:1px solid #eee; border-radius:12px; box-shadow:0 4px 24px rgba(0,0,0,0.15); width:200px; z-index:9999; overflow:hidden;">
                <div class="enc-sort-opt" data-sort="name_asc" style="padding:10px 15px; cursor:pointer; border-bottom:1px solid #f5f5f5;">🔤 学名順 (A-Z)</div>
                <div class="enc-sort-opt" data-sort="count_desc" style="padding:10px 15px; cursor:pointer; border-bottom:1px solid #f5f5f5;">🔥 飼育数順</div>
                <div class="enc-sort-opt" data-sort="diff_asc" style="padding:10px 15px; cursor:pointer; border-bottom:1px solid #f5f5f5;">🔰 難易度順 (易→難)</div>
                <div class="enc-sort-opt" data-sort="diff_desc" style="padding:10px 15px; cursor:pointer;">👿 難易度順 (難→易)</div>
            </div>
        `;
        $('body').append(menuHtml);
        
        // 位置調整
        const rect = this.getBoundingClientRect();
        $('#setae-enc-sort-popup').css({
            top: (rect.bottom + window.scrollY + 5) + 'px',
            left: (rect.right + window.scrollX - 200) + 'px'
        });
    });

    // ソート選択イベント
    $(document).on('click', '.enc-sort-opt', function() {
        currentSort = $(this).data('sort');
        $('#setae-enc-sort-popup').remove();
        applyFilterSort();
    });

    // メニュー外クリックで閉じる
    $(document).on('click', function(e) {
        if(!$(e.target).closest('#btn-enc-sort-menu').length) {
            $('#setae-enc-sort-popup').remove();
        }
    });

    // メインロジック: フィルターとソートを適用
    function applyFilterSort() {
        const query = $input.val().toLowerCase();
        
        // --- Filter ---
        const $visibleItems = $items.filter(function() {
            const $el = $(this);
            // Search Text
            const searchData = $el.data('search');
            if(query && !searchData.includes(query)) return false;

            // Category Filter
            if (currentFilter !== 'all') {
                // ライフスタイル or 地域
                // data-filter-style="style_arboreal" 等を持っているかチェック
                const style = $el.data('filter-style') || '';
                const region = $el.data('filter-region') || '';
                
                // 完全一致で判定 (currentFilterは 'style_arboreal' のような形式)
                if (style !== currentFilter && region !== currentFilter) return false;
            }
            return true;
        });

        // 非表示
        $items.hide();
        $visibleItems.show();

        // --- Sort ---
        // 表示要素のみをソートして再配置
        const sorted = $visibleItems.toArray().sort(function(a, b) {
            const $a = $(a);
            const $b = $(b);

            if (currentSort === 'name_asc') {
                return $a.data('sort-name').localeCompare($b.data('sort-name'));
            }
            if (currentSort === 'count_desc') {
                return $b.data('sort-count') - $a.data('sort-count');
            }
            if (currentSort === 'diff_asc') {
                return $a.data('sort-diff') - $b.data('sort-diff');
            }
            if (currentSort === 'diff_desc') {
                return $b.data('sort-diff') - $a.data('sort-diff');
            }
            return 0;
        });

        $container.append(sorted);
    }
});
</script>