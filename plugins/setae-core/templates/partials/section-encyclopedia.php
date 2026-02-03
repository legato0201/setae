<?php
/**
 * Partial: Encyclopedia Section
 * Description: archive-setae_species.php のロジックを統合
 */
?>
<div id="section-enc" class="setae-section" style="display: none;">

    <div class="setae-card">
        <h3>Encyclopedia</h3>
        <div class="setae-toolbar">
            <input type="text" id="setae-species-search" placeholder="種名・属名で検索...">
        </div>
    </div>

    <div class="setae-species-grid" id="setae-species-list-container">
        <?php
        // カスタムクエリの作成（全件取得する場合）
        $args = array(
            'post_type' => 'setae_species',
            'posts_per_page' => -1, // 全件表示 (必要に応じてページネーションを追加)
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

                // タクソノミーの取得
                $lifestyles = get_the_terms(get_the_ID(), 'setae_lifestyle');
                $lifestyle_name = $lifestyles ? $lifestyles[0]->name : '';
                $lifestyle_slug = $lifestyles ? $lifestyles[0]->slug : '';

                $regions = get_the_terms(get_the_ID(), 'setae_habitat');
                $region_name = $regions ? $regions[0]->name : '';

                // サムネイル
                $thumb_url = has_post_thumbnail() ? get_the_post_thumbnail_url(get_the_ID(), 'medium_large') : '';

                // 検索フィルタリング用にデータ属性を追加 (data-search)
                $search_string = strtolower(get_the_title() . ' ' . $common_name);
                ?>

                <article class="species-card js-species-item" data-id="<?php the_ID(); ?>"
                    data-search="<?php echo esc_attr($search_string); ?>">
                    <a href="javascript:void(0);" class="card-link js-open-species-detail" data-id="<?php the_ID(); ?>">

                        <div class="card-image-box">
                            <?php if ($thumb_url): ?>
                                <img src="<?php echo esc_url($thumb_url); ?>" alt="<?php the_title(); ?>" loading="lazy">
                            <?php else: ?>
                                <div class="no-image">No Image</div>
                            <?php endif; ?>

                            <div class="card-badges">
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
                                <h2 class="ja-name">
                                    <?php echo $common_name ? esc_html($common_name) : '名称未設定'; ?>
                                </h2>
                                <p class="sci-name">
                                    <?php the_title(); ?>
                                </p>
                            </div>

                            <div class="species-specs">
                                <div class="spec-item">
                                    <span class="spec-label">Size</span>
                                    <span class="spec-value">
                                        <?php echo $size ? esc_html($size) . 'cm' : '-'; ?>
                                    </span>
                                </div>
                                <div class="spec-item">
                                    <span class="spec-label">Temp</span>
                                    <span class="spec-value">
                                        <?php echo $temp ? esc_html($temp) : '-'; ?>
                                    </span>
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
            wp_reset_postdata(); // 投稿データのリストア
        else:
            ?>
            <p>まだ登録された種がありません。</p>
        <?php endif; ?>
    </div>
</div>