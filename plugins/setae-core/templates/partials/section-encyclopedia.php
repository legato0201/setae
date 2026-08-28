<?php
/**
 * Partial: Encyclopedia Section
 *
 * The initial page is rendered on the server, then the same card partial is
 * reused by the filtered AJAX response.
 */

$species_counts = wp_count_posts('setae_species');
$published_species_count = isset($species_counts->publish) ? (int) $species_counts->publish : 0;
$regions = get_terms(array(
    'taxonomy' => 'setae_habitat',
    'hide_empty' => true,
    'orderby' => 'name',
    'order' => 'ASC',
));
$lifestyles = get_terms(array(
    'taxonomy' => 'setae_lifestyle',
    'hide_empty' => true,
    'orderby' => 'name',
    'order' => 'ASC',
));
?>
<div id="section-enc" class="setae-section setae-encyclopedia" style="display: none;">
    <header class="enc-page-header">
        <div>
            <span class="enc-page-kicker">SPECIES LIBRARY</span>
            <h1>図鑑</h1>
        </div>
        <div class="enc-page-count" aria-label="公開中の種類数">
            <strong><?php echo esc_html(number_format_i18n($published_species_count)); ?></strong>
            <span>種を掲載</span>
        </div>
    </header>

    <div class="enc-workspace">
        <aside class="enc-filter-sidebar" aria-label="図鑑の絞り込み">
            <div class="enc-filter-sidebar-head">
                <h2>絞り込み</h2>
                <button type="button" class="enc-text-button js-enc-clear-filters">リセット</button>
            </div>

            <div class="enc-filter-group">
                <label for="setae-enc-lifestyle">生活型</label>
                <select id="setae-enc-lifestyle" class="enc-select">
                    <option value="">すべて</option>
                    <?php if (!empty($lifestyles) && !is_wp_error($lifestyles)): ?>
                        <?php foreach ($lifestyles as $lifestyle): ?>
                            <option value="<?php echo esc_attr($lifestyle->slug); ?>">
                                <?php echo esc_html($lifestyle->name); ?>
                            </option>
                        <?php endforeach; ?>
                    <?php endif; ?>
                </select>
            </div>

            <div class="enc-filter-group">
                <label for="setae-enc-habitat">生息地域</label>
                <select id="setae-enc-habitat" class="enc-select">
                    <option value="">すべて</option>
                    <?php if (!empty($regions) && !is_wp_error($regions)): ?>
                        <?php foreach ($regions as $region): ?>
                            <option value="<?php echo esc_attr($region->slug); ?>">
                                <?php echo esc_html($region->name); ?>
                            </option>
                        <?php endforeach; ?>
                    <?php endif; ?>
                </select>
            </div>

            <div class="enc-filter-group">
                <label for="setae-enc-sort">並び順</label>
                <select id="setae-enc-sort" class="enc-select">
                    <option value="name_asc">学名順</option>
                    <option value="count_desc">飼育者が多い順</option>
                    <option value="topic_recent">相談の更新順</option>
                    <option value="research_recent">調査の更新順</option>
                    <option value="diff_asc">飼育難易度順</option>
                </select>
            </div>

        </aside>

        <div class="enc-results-column">
            <div class="enc-search-toolbar">
                <div class="enc-search-field">
                    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <circle cx="11" cy="11" r="7"></circle>
                        <path d="m20 20-3.5-3.5"></path>
                    </svg>
                    <input type="search" id="setae-enc-search" autocomplete="off" placeholder="和名・学名・属名で検索">
                    <button type="button" class="enc-search-clear js-enc-search-clear" aria-label="検索語を消去" hidden>
                        <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M18 6 6 18M6 6l12 12"></path>
                        </svg>
                    </button>
                </div>

                <button type="button" class="enc-mobile-filter-toggle js-enc-mobile-filter-toggle" aria-expanded="false" aria-controls="enc-mobile-filters">
                    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M4 6h16M7 12h10M10 18h4"></path>
                    </svg>
                    <span>条件</span>
                    <span class="enc-mobile-filter-count" hidden>0</span>
                </button>
            </div>

            <div id="enc-mobile-filters" class="enc-mobile-filters" hidden>
                <label>
                    <span>生活型</span>
                    <select class="enc-select js-enc-mobile-lifestyle">
                        <option value="">すべて</option>
                        <?php if (!empty($lifestyles) && !is_wp_error($lifestyles)): ?>
                            <?php foreach ($lifestyles as $lifestyle): ?>
                                <option value="<?php echo esc_attr($lifestyle->slug); ?>"><?php echo esc_html($lifestyle->name); ?></option>
                            <?php endforeach; ?>
                        <?php endif; ?>
                    </select>
                </label>
                <label>
                    <span>生息地域</span>
                    <select class="enc-select js-enc-mobile-habitat">
                        <option value="">すべて</option>
                        <?php if (!empty($regions) && !is_wp_error($regions)): ?>
                            <?php foreach ($regions as $region): ?>
                                <option value="<?php echo esc_attr($region->slug); ?>"><?php echo esc_html($region->name); ?></option>
                            <?php endforeach; ?>
                        <?php endif; ?>
                    </select>
                </label>
                <label>
                    <span>並び順</span>
                    <select class="enc-select js-enc-mobile-sort">
                        <option value="name_asc">学名順</option>
                        <option value="count_desc">飼育者が多い順</option>
                        <option value="topic_recent">相談の更新順</option>
                        <option value="research_recent">調査の更新順</option>
                        <option value="diff_asc">飼育難易度順</option>
                    </select>
                </label>
                <button type="button" class="enc-text-button js-enc-clear-filters">条件をリセット</button>
            </div>

            <div class="enc-content-switch" id="setae-enc-content-filters" role="tablist" aria-label="情報の状態">
                <button type="button" class="active" role="tab" aria-selected="true" data-content-filter="all">すべて</button>
                <button type="button" role="tab" aria-selected="false" data-content-filter="researched">出典あり</button>
                <button type="button" role="tab" aria-selected="false" data-content-filter="community">飼育・相談あり</button>
                <button type="button" role="tab" aria-selected="false" data-content-filter="breeding">繁殖募集中</button>
            </div>

            <div class="enc-results-meta" aria-live="polite">
                <p id="setae-enc-result-count"><?php echo esc_html(number_format_i18n($published_species_count)); ?>種</p>
                <p id="setae-enc-active-summary">すべての図鑑情報</p>
            </div>

            <?php
            $args = array(
                'post_type' => 'setae_species',
                'post_status' => 'publish',
                'posts_per_page' => 18,
                'orderby' => 'title',
                'order' => 'ASC',
            );
            $query = new WP_Query($args);
            $GLOBALS['setae_species_card_query_ids'] = wp_list_pluck($query->posts, 'ID');
            ?>
            <div class="setae-species-grid" id="setae-species-list-container">
                <?php if ($query->have_posts()): ?>
                    <?php while ($query->have_posts()): ?>
                        <?php
                        $query->the_post();
                        include plugin_dir_path(__FILE__) . 'card-species.php';
                        ?>
                    <?php endwhile; ?>
                    <?php wp_reset_postdata(); ?>
                <?php else: ?>
                    <div class="setae-empty-state enc-empty-state">
                        <h3>図鑑情報がまだありません</h3>
                    </div>
                <?php endif; ?>
            </div>

            <div id="setae-enc-loader" class="enc-list-loader" aria-live="polite" hidden>
                <span class="enc-loader-mark" aria-hidden="true"></span>
                <span>さらに読み込んでいます</span>
            </div>

            <input type="hidden" id="setae-current-page" value="1">
            <input type="hidden" id="setae-max-pages" value="<?php echo esc_attr($query->max_num_pages); ?>">
        </div>
    </div>
</div>
