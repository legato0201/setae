<?php get_header(); ?>

<div class="setae-encyclopedia-wrapper">

    <header class="encyclopedia-header">
        <div class="header-content">
            <h1 class="page-title">Species Encyclopedia</h1>
            <p class="page-subtitle">タランチュラ図鑑</p>
        </div>
    </header>

    <div class="setae-species-grid">
        <?php if (have_posts()): ?>
            <?php while (have_posts()):
                the_post();
                // メタデータの取得
                $common_name = get_post_meta(get_the_ID(), '_setae_common_name_ja', true);
                $size = get_post_meta(get_the_ID(), '_setae_size', true);
                $temp = get_post_meta(get_the_ID(), '_setae_temperature', true);
                $humidity = get_post_meta(get_the_ID(), '_setae_humidity', true);
                $difficulty = get_post_meta(get_the_ID(), '_setae_difficulty', true);

                // タクソノミーの取得
                $lifestyles = get_the_terms(get_the_ID(), 'setae_lifestyle');
                $lifestyle_name = $lifestyles ? $lifestyles[0]->name : '';
                $lifestyle_slug = $lifestyles ? $lifestyles[0]->slug : ''; // css用
        
                $regions = get_the_terms(get_the_ID(), 'setae_habitat'); // Region
                $region_name = $regions ? $regions[0]->name : '';

                // サムネイル
                $thumb_url = has_post_thumbnail() ? get_the_post_thumbnail_url(get_the_ID(), 'medium_large') : '';
                ?>

                <article class="species-card">
                    <a href="<?php the_permalink(); ?>" class="card-link">

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
                                        <?php echo $size ? esc_html(trim(str_ireplace('cm', '', $size))) . 'cm' : '-'; ?>
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

            <?php endwhile; ?>
        <?php else: ?>
            <p>まだ登録された種がありません。</p>
        <?php endif; ?>
    </div>
</div>

<?php get_footer(); ?>