<?php
get_header();

$setae_request_flag = static function ($key) {
    return isset($_GET[$key])
        && '1' === sanitize_text_field(wp_unslash($_GET[$key]));
};
$setae_page = get_queried_object();
$setae_has_app_shortcode = $setae_page instanceof WP_Post
    && has_shortcode((string) $setae_page->post_content, 'setae_dashboard');
$setae_guest_trial = !is_user_logged_in() && $setae_request_flag('try');
$setae_app_requested = class_exists('Setae_App_Shell')
    ? Setae_App_Shell::is_app_page_request()
    : (
        is_front_page()
        || $setae_guest_trial
        || $setae_request_flag('setae_app')
        || $setae_has_app_shortcode
    );
$setae_app_url = class_exists('Setae_App_Shell')
    ? Setae_App_Shell::app_url()
    : home_url('/');
$setae_login_url = class_exists('Setae_App_Shell')
    ? Setae_App_Shell::login_url()
    : add_query_arg('setae_auth', 'login', $setae_app_url);
$setae_register_url = add_query_arg('setae_auth', 'register', $setae_app_url);
$setae_public_topics_url = add_query_arg('setae_public', 'topics', $setae_app_url);
$setae_public_species_url = add_query_arg('setae_public', 'species', $setae_app_url);
$setae_is_logged_in = is_user_logged_in();

if (is_front_page() && !$setae_app_requested) {
    $registration_enabled = (bool) get_option('setae_enable_registration');
    $default_free_spider_limit = defined('SETAE_DEFAULT_FREE_SPIDER_LIMIT')
        ? SETAE_DEFAULT_FREE_SPIDER_LIMIT
        : 8;
    $free_spider_limit = max(
        1,
        (int) get_option('setae_free_spider_limit', $default_free_spider_limit)
    );
    $setae_partner_url = get_option('permalink_structure')
        ? home_url('/setae-partner/')
        : add_query_arg('setae_partner', 1, home_url('/'));

    $public_species_query = new WP_Query(array(
        'post_type' => 'setae_species',
        'post_status' => 'publish',
        'posts_per_page' => 5,
        'orderby' => 'rand',
        'no_found_rows' => true,
        'cache_results' => false,
        'meta_query' => array(
            array(
                'key' => '_thumbnail_id',
                'compare' => 'EXISTS',
            ),
        ),
    ));

    $public_topics_query = new WP_Query(array(
        'post_type' => 'setae_topic',
        'post_status' => 'publish',
        'posts_per_page' => 3,
        'orderby' => 'modified',
        'order' => 'DESC',
        'no_found_rows' => true,
    ));

    $species_count_obj = wp_count_posts('setae_species');
    $species_count = isset($species_count_obj->publish) ? (int) $species_count_obj->publish : 0;
    $normalize_public_text = static function ($value) {
        return wp_strip_all_tags(html_entity_decode(
            (string) $value,
            ENT_QUOTES | ENT_HTML5,
            'UTF-8'
        ));
    };
    $get_public_image_credit = static function ($species_id) use ($normalize_public_text) {
        $credit_type = get_post_meta($species_id, '_setae_image_credit_type', true) ?: 'user';
        $credit_text = '';
        $credit_avatar = '';

        if ('user' === $credit_type) {
            $credit_user_id = absint(get_post_meta($species_id, '_setae_image_credit_user', true));
            $credit_user = $credit_user_id ? get_userdata($credit_user_id) : null;
            if ($credit_user) {
                $credit_text = $normalize_public_text($credit_user->display_name);
                $avatar_id = absint(get_user_meta($credit_user_id, 'setae_user_avatar', true));
                $credit_avatar = $avatar_id
                    ? (string) wp_get_attachment_image_url($avatar_id, 'thumbnail')
                    : '';
            }
        } elseif ('text' === $credit_type) {
            $credit_text = $normalize_public_text(
                get_post_meta($species_id, '_setae_image_credit_text', true)
            );
        }

        return array(
            'text' => $credit_text,
            'avatar' => $credit_avatar,
        );
    };
    $render_public_photo_credit = static function ($credit, $modifier_class = '') {
        if (empty($credit['text'])) {
            return;
        }

        $class_name = trim('setae-public-photo-credit ' . $modifier_class);
        ?>
        <span
            class="<?php echo esc_attr($class_name); ?>"
            aria-label="<?php echo esc_attr('写真提供 ' . $credit['text']); ?>">
            <?php if (!empty($credit['avatar'])): ?>
                <img src="<?php echo esc_url($credit['avatar']); ?>" alt="" loading="lazy" decoding="async">
            <?php endif; ?>
            <span class="setae-public-photo-credit-copy">
                <small>写真提供</small>
                <strong><?php echo esc_html($credit['text']); ?></strong>
            </span>
        </span>
        <?php
    };

    $hero_species_id = 0;
    $hero_image = '';
    $hero_image_srcset = '';
    $hero_species_name = '';
    $hero_species_scientific_name = '';
    $hero_image_credit = array('text' => '', 'avatar' => '');

    if (!empty($public_species_query->posts)) {
        foreach ($public_species_query->posts as $candidate_species) {
            $candidate_image = get_the_post_thumbnail_url($candidate_species->ID, 'full');
            if (!$candidate_image) {
                continue;
            }

            $hero_species_id = (int) $candidate_species->ID;
            $hero_image = $candidate_image;
            $hero_image_srcset = wp_get_attachment_image_srcset(
                get_post_thumbnail_id($candidate_species->ID),
                'full'
            );
            $hero_species_scientific_name = $normalize_public_text(get_the_title($candidate_species->ID));
            $hero_species_name = $normalize_public_text(
                get_post_meta($candidate_species->ID, '_setae_common_name_ja', true)
            );
            $hero_image_credit = $get_public_image_credit($candidate_species->ID);
            break;
        }
    }

    $hero_alt = $hero_species_name ?: $hero_species_scientific_name ?: 'SETAE図鑑に登録された生体';
    ?>
    <div id="setae-public-home" class="setae-public-home setae-public-home-v2" data-setae-public-home="1">
        <div class="setae-public-app-shell">
            <header class="setae-public-header">
                <a class="setae-public-brand" href="<?php echo esc_url(home_url('/')); ?>" aria-label="SETAE ホーム">
                    <span class="setae-public-brand-mark" aria-hidden="true"></span>
                    <span>SETAE</span>
                </a>

                <nav class="setae-public-header-nav" aria-label="トップページ">
                    <a href="#setae-public-experience">できること</a>
                    <a href="#setae-public-encyclopedia">図鑑</a>
                    <a href="#setae-public-community">相談</a>
                </nav>

                <div class="setae-public-header-actions">
                    <?php if ($setae_is_logged_in): ?>
                        <a href="<?php echo esc_url($setae_app_url); ?>" class="setae-public-header-register">アプリを開く</a>
                    <?php else: ?>
                        <a href="<?php echo esc_url($setae_login_url); ?>" class="setae-public-login-link">ログイン</a>
                        <a href="<?php echo esc_url($setae_public_topics_url); ?>" class="setae-public-trial-link">相談・図鑑を見る</a>
                        <?php if ($registration_enabled): ?>
                            <a href="<?php echo esc_url($setae_register_url); ?>" class="setae-public-header-register">無料で始める</a>
                        <?php endif; ?>
                    <?php endif; ?>
                </div>
            </header>

            <main class="setae-public-content">
                <section id="setae-public-start" class="setae-public-hero-v2" aria-labelledby="setae-public-hero-title">
                    <?php if ($hero_image): ?>
                        <img
                            class="setae-public-hero-image"
                            src="<?php echo esc_url($hero_image); ?>"
                            <?php if ($hero_image_srcset): ?>
                                srcset="<?php echo esc_attr($hero_image_srcset); ?>"
                                sizes="100vw"
                            <?php endif; ?>
                            alt="<?php echo esc_attr($hero_alt); ?>"
                            fetchpriority="high"
                            decoding="async">
                    <?php endif; ?>
                    <div class="setae-public-hero-shade" aria-hidden="true"></div>

                    <div class="setae-public-hero-inner">
                        <div class="setae-public-hero-copy">
                            <p class="setae-public-eyebrow">タランチュラ飼育の記録アプリ</p>
                            <h1 id="setae-public-hero-title">飼育記録を、<br>続けたくなる習慣に。</h1>
                            <p class="setae-public-hero-lead">
                                給餌、脱皮、写真を1匹ごとに整理。今日見る個体と成長の流れが、
                                スマホでもPCでもひと目でわかります。
                            </p>

                            <div class="setae-public-hero-actions">
                                <?php if ($setae_is_logged_in): ?>
                                    <a id="setae-btn-register-start" class="setae-public-primary-btn" href="<?php echo esc_url($setae_app_url); ?>">アプリを開く</a>
                                <?php elseif ($registration_enabled): ?>
                                    <a id="setae-btn-register-start" class="setae-public-primary-btn" href="<?php echo esc_url($setae_register_url); ?>">無料で1匹登録する</a>
                                <?php endif; ?>
                                <a href="<?php echo esc_url($setae_public_species_url); ?>" class="setae-public-secondary-btn">
                                    <span class="setae-public-trial-main">登録なしで、図鑑を見る</span>
                                    <small class="setae-public-trial-note">相談も閲覧できます</small>
                                </a>
                                <a href="#setae-public-experience" class="setae-public-hero-link">
                                    実際の画面を見る
                                    <span aria-hidden="true">↓</span>
                                </a>
                            </div>

                            <ul class="setae-public-start-notes" aria-label="登録について">
                                <li>登録なしで<?php echo esc_html($free_spider_limit); ?>匹まで</li>
                                <li>登録後にそのまま同期</li>
                                <li>写真はあとからでOK</li>
                            </ul>
                        </div>
                    </div>

                    <?php if ($hero_species_scientific_name || !empty($hero_image_credit['text'])): ?>
                        <div class="setae-public-hero-caption">
                            <?php if ($hero_species_scientific_name): ?>
                                <span class="setae-public-hero-species">
                                    図鑑収録:
                                    <em><?php echo esc_html($hero_species_scientific_name); ?></em>
                                </span>
                            <?php endif; ?>
                            <?php $render_public_photo_credit($hero_image_credit, 'setae-public-hero-credit'); ?>
                        </div>
                    <?php endif; ?>
                </section>

                <div class="setae-public-proof" aria-label="SETAEの特徴">
                    <div>
                        <strong><?php echo esc_html(number_format_i18n($species_count)); ?></strong>
                        <span>種類の図鑑データ</span>
                    </div>
                    <div>
                        <strong>給餌・脱皮・写真</strong>
                        <span>日々の記録を1か所に</span>
                    </div>
                    <div>
                        <strong>スマホ・PC・QR</strong>
                        <span>飼育場所でも机でも</span>
                    </div>
                </div>

                <section id="setae-public-experience" class="setae-public-band setae-public-experience" aria-labelledby="setae-public-experience-title">
                    <div class="setae-public-inner setae-public-experience-layout">
                        <div class="setae-public-experience-copy">
                            <p class="setae-public-section-label">まずは1匹から</p>
                            <h2 id="setae-public-experience-title">次にすることが、ひと目でわかる。</h2>
                            <p>
                                記録を増やすほど、ただの日付がその個体だけの飼育リズムになります。
                                久しぶりに見る個体も、最後の給餌や脱皮を探し回る必要がありません。
                            </p>

                            <div class="setae-public-benefit-list">
                                <div>
                                    <span class="setae-public-benefit-index">01</span>
                                    <div>
                                        <h3>今日のケアを整理</h3>
                                        <p>確認したい個体と記録状況を、一覧の先頭で確認できます。</p>
                                    </div>
                                </div>
                                <div>
                                    <span class="setae-public-benefit-index">02</span>
                                    <div>
                                        <h3>成長が写真とグラフになる</h3>
                                        <p>脱皮、体長、写真がつながり、変化を見返す楽しみが生まれます。</p>
                                    </div>
                                </div>
                                <div>
                                    <span class="setae-public-benefit-index">03</span>
                                    <div>
                                        <h3>記録から図鑑・相談へ</h3>
                                        <p>種類の情報やほかの飼育者の記録に、迷わずたどり着けます。</p>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div class="setae-public-product-window" aria-label="SETAEの飼育管理画面イメージ">
                            <div class="setae-public-product-bar">
                                <div>
                                    <span class="setae-public-product-dot" aria-hidden="true"></span>
                                    <strong>マイ個体</strong>
                                </div>
                                <span>今日</span>
                            </div>

                            <div class="setae-public-product-summary">
                                <div>
                                    <span>今日の記録</span>
                                    <strong>1<small>/3</small></strong>
                                </div>
                                <div class="setae-public-product-progress" aria-label="今日の記録 3件中1件完了">
                                    <span></span>
                                </div>
                                <p>あと2匹を確認すると、今日のケアが完了します。</p>
                            </div>

                            <div class="setae-public-product-subject">
                                <div class="setae-public-product-photo">
                                    <?php if ($hero_image): ?>
                                        <img src="<?php echo esc_url($hero_image); ?>" alt="" loading="lazy">
                                    <?php else: ?>
                                        <span aria-hidden="true">SE</span>
                                    <?php endif; ?>
                                </div>
                                <div class="setae-public-product-identity">
                                    <span><?php echo esc_html($hero_species_scientific_name ?: 'Brachypelma hamorii'); ?></span>
                                    <strong>飼育個体 01</strong>
                                    <small>管理開始から 214日</small>
                                </div>
                                <div class="setae-public-product-dates">
                                    <div>
                                        <span>給餌</span>
                                        <strong>7/18</strong>
                                    </div>
                                    <div>
                                        <span>脱皮</span>
                                        <strong>6/24</strong>
                                    </div>
                                </div>
                            </div>

                            <div class="setae-public-rhythm">
                                <div class="setae-public-rhythm-head">
                                    <div>
                                        <span>90日ケアリズム</span>
                                        <strong>安定</strong>
                                    </div>
                                    <span>給餌 8 ・ 脱皮 1</span>
                                </div>
                                <div class="setae-public-rhythm-bars" aria-hidden="true">
                                    <i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i>
                                    <i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i>
                                    <i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i>
                                </div>
                                <div class="setae-public-rhythm-legend">
                                    <span><i class="is-feed"></i>給餌</span>
                                    <span><i class="is-molt"></i>脱皮</span>
                                    <span>90日前</span>
                                    <span>今日</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </section>

                <section class="setae-public-band setae-public-feature-band" aria-labelledby="setae-public-feature-title">
                    <div class="setae-public-inner">
                        <div class="setae-public-section-heading">
                            <p class="setae-public-section-label">飼育のそばに</p>
                            <h2 id="setae-public-feature-title">記録するほど、飼育がもっと面白くなる。</h2>
                        </div>

                        <div class="setae-public-feature-grid">
                            <article>
                                <span class="setae-public-feature-symbol" aria-hidden="true">給</span>
                                <h3>数秒でお世話を記録</h3>
                                <p>給餌、拒食、脱皮、観察を個体カードから素早く追加。あとで詳細も追記できます。</p>
                            </article>
                            <article>
                                <span class="setae-public-feature-symbol is-photo" aria-hidden="true">写</span>
                                <h3>その個体だけのアルバム</h3>
                                <p>記録した写真を時系列で眺め、体色やサイズの変化を成長記録として残せます。</p>
                            </article>
                            <article>
                                <span class="setae-public-feature-symbol is-qr" aria-hidden="true">QR</span>
                                <h3>ケースからすぐ記録</h3>
                                <p>個体ラベルを読み取り、複数の記録をまとめて入力。個体数が増えても迷いません。</p>
                            </article>
                        </div>
                    </div>
                </section>

                <section id="setae-public-encyclopedia" class="setae-public-band setae-public-encyclopedia" aria-labelledby="public-encyclopedia-title">
                    <div class="setae-public-inner">
                        <div class="setae-public-section-header">
                            <div>
                                <p class="setae-public-section-label">写真から出会う図鑑</p>
                                <h2 id="public-encyclopedia-title">次に育てたい種類も、ここで見つかる。</h2>
                                <p>学名、特徴、飼育温度などを、写真と一緒に確認できます。</p>
                            </div>
                            <a class="setae-public-text-btn" href="<?php echo esc_url($setae_public_species_url); ?>">図鑑を開く</a>
                        </div>

                        <div class="setae-public-species-gallery">
                            <?php $public_species_rendered = false; ?>
                            <?php $public_species_index = 0; ?>
                            <?php if ($public_species_query->have_posts()): ?>
                                <?php while ($public_species_query->have_posts()): ?>
                                    <?php
                                    $public_species_query->the_post();
                                    $species_id = get_the_ID();
                                    $title_en = $normalize_public_text(get_the_title());
                                    $title_ja = $normalize_public_text(
                                        get_post_meta($species_id, '_setae_common_name_ja', true)
                                    );
                                    $thumb = get_the_post_thumbnail_url($species_id, 'medium_large');
                                    $species_image_credit = $get_public_image_credit($species_id);
                                    $styles = get_the_terms($species_id, 'setae_lifestyle');
                                    if (!$thumb) {
                                        continue;
                                    }
                                    $public_species_rendered = true;
                                    $public_species_index++;
                                    ?>
                                    <article class="setae-public-species-tile<?php echo $public_species_index === 1 ? ' is-featured' : ''; ?>">
                                        <img
                                            src="<?php echo esc_url($thumb); ?>"
                                            alt="<?php echo esc_attr($title_ja ?: $title_en); ?>"
                                            loading="lazy"
                                            decoding="async">
                                        <?php $render_public_photo_credit($species_image_credit, 'setae-public-species-credit'); ?>
                                        <div class="setae-public-species-shade" aria-hidden="true"></div>
                                        <div class="setae-public-species-copy">
                                            <?php if (!empty($styles) && !is_wp_error($styles)): ?>
                                                <span><?php echo esc_html($styles[0]->name); ?></span>
                                            <?php endif; ?>
                                            <h3><?php echo esc_html($title_ja ?: $title_en); ?></h3>
                                            <?php if ($title_ja): ?>
                                                <p><?php echo esc_html($title_en); ?></p>
                                            <?php endif; ?>
                                        </div>
                                    </article>
                                <?php endwhile; ?>
                                <?php wp_reset_postdata(); ?>
                            <?php endif; ?>

                            <?php if (!$public_species_rendered): ?>
                                <div class="setae-public-empty">
                                    <h3>写真付きの図鑑データを準備中です</h3>
                                    <p>公開できる図鑑データから順番に追加しています。</p>
                                </div>
                            <?php endif; ?>
                        </div>
                    </div>
                </section>

                <?php if ($public_topics_query->have_posts()): ?>
                    <section id="setae-public-community" class="setae-public-band setae-public-community-v2" aria-labelledby="public-community-title">
                        <div class="setae-public-inner setae-public-community-layout">
                            <div class="setae-public-community-copy">
                                <p class="setae-public-section-label">飼育で迷ったときに</p>
                                <h2 id="public-community-title">一人で抱えず、飼育者に相談できる。</h2>
                                <p>
                                    拒食、脱皮、環境づくり。個体の記録を見ながら、気になることを相談できます。
                                </p>
                                <a class="setae-public-primary-btn" href="<?php echo esc_url($setae_public_topics_url); ?>">相談を見る</a>
                            </div>

                            <div class="setae-public-topic-list">
                                <?php while ($public_topics_query->have_posts()): ?>
                                    <?php
                                    $public_topics_query->the_post();
                                    $topic_id = get_the_ID();
                                    $topic_type = get_post_meta($topic_id, 'setae_topic_type', true) ?: 'general';
                                    $type_labels = array(
                                        'question' => '質問',
                                        'chat' => '会話',
                                        'breeding' => '繁殖',
                                        'general' => '飼育',
                                    );
                                    $topic_label = isset($type_labels[$topic_type]) ? $type_labels[$topic_type] : '飼育';
                                    $topic_excerpt = get_the_excerpt();
                                    if (!$topic_excerpt) {
                                        $topic_excerpt = wp_trim_words(wp_strip_all_tags(get_the_content()), 28, '...');
                                    }
                                    ?>
                                    <article class="setae-public-topic-card">
                                        <div class="setae-public-topic-head">
                                            <span><?php echo esc_html($topic_label); ?></span>
                                            <time datetime="<?php echo esc_attr(get_the_modified_date('c')); ?>">
                                                <?php echo esc_html(get_the_modified_date('Y.m.d')); ?>
                                            </time>
                                        </div>
                                        <h3><?php echo esc_html(get_the_title()); ?></h3>
                                        <?php if ($topic_excerpt): ?>
                                            <p><?php echo esc_html($topic_excerpt); ?></p>
                                        <?php endif; ?>
                                        <div class="setae-public-topic-meta">
                                            <span><?php echo esc_html(get_the_author()); ?></span>
                                            <span><?php echo esc_html(number_format_i18n(get_comments_number($topic_id))); ?>件の返信</span>
                                        </div>
                                    </article>
                                <?php endwhile; ?>
                                <?php wp_reset_postdata(); ?>
                            </div>
                        </div>
                    </section>
                <?php endif; ?>

                <section class="setae-public-final-cta" aria-labelledby="setae-public-final-title">
                    <div>
                        <p class="setae-public-section-label">今日から残す</p>
                        <h2 id="setae-public-final-title">まずは、いま飼っている1匹から。</h2>
                        <p>名前と種類だけでも始められます。写真や過去の記録は、あとからゆっくり追加できます。</p>
                    </div>
                    <div class="setae-public-final-actions">
                        <?php if ($setae_is_logged_in): ?>
                            <a class="setae-public-primary-btn" href="<?php echo esc_url($setae_app_url); ?>">アプリを開く</a>
                        <?php elseif ($registration_enabled): ?>
                            <a class="setae-public-primary-btn" href="<?php echo esc_url($setae_register_url); ?>">無料で1匹登録する</a>
                        <?php endif; ?>
                        <?php if (!$setae_is_logged_in): ?>
                            <a href="<?php echo esc_url($setae_login_url); ?>">すでに登録している方はログイン</a>
                        <?php endif; ?>
                    </div>
                </section>
            </main>

            <footer class="setae-public-footer">
                <div>
                    <a class="setae-public-brand" href="<?php echo esc_url(home_url('/')); ?>" aria-label="SETAE ホーム">
                        <span class="setae-public-brand-mark" aria-hidden="true"></span>
                        <span>SETAE</span>
                    </a>
                    <p>タランチュラとエキゾチックアニマルの飼育記録。</p>
                </div>
                <div class="setae-public-footer-links">
                    <a href="<?php echo esc_url($setae_partner_url); ?>">ショップ・ブリーダーの方へ</a>
                    <a href="<?php echo esc_url($setae_is_logged_in ? $setae_app_url : $setae_login_url); ?>"><?php echo $setae_is_logged_in ? 'アプリを開く' : 'ログイン'; ?></a>
                </div>
            </footer>
        </div>
    </div>

    <?php if ($registration_enabled && !$setae_is_logged_in): ?>
        <div id="setae-register-modal" class="setae-modal setae-register-modal-v2" style="display:none;" aria-hidden="true">
            <div class="setae-modal-content setae-register-dialog" role="dialog" aria-modal="true" aria-labelledby="setae-register-title" aria-describedby="setae-register-description">
                <button type="button" class="setae-register-close" id="close-register-modal" aria-label="登録画面を閉じる" title="閉じる">
                    <span aria-hidden="true">×</span>
                </button>

                <aside class="setae-register-context" aria-label="SETAEで残せること">
                    <a class="setae-register-brand" href="<?php echo esc_url(home_url('/')); ?>" aria-label="SETAE ホーム">
                        <span class="setae-public-brand-mark" aria-hidden="true"></span>
                        <span>SETAE</span>
                    </a>

                    <div class="setae-register-context-copy">
                        <span>飼育カルテを、ずっと手元に</span>
                        <strong>続けた記録が、<br>その個体だけの物語になる。</strong>
                        <p>給餌、脱皮、成長写真をひとつにつなげて、今日のお世話と変化を見逃しません。</p>
                    </div>

                    <ul class="setae-register-benefits">
                        <li>
                            <span aria-hidden="true">01</span>
                            <div>
                                <strong>お世話をひとつの履歴に</strong>
                                <small>給餌・脱皮・写真を個体ごとに整理</small>
                            </div>
                        </li>
                        <li>
                            <span aria-hidden="true">02</span>
                            <div>
                                <strong>端末をまたいで続けられる</strong>
                                <small>オフラインの記録もアカウントへ同期</small>
                            </div>
                        </li>
                        <li>
                            <span aria-hidden="true">03</span>
                            <div>
                                <strong>図鑑と飼育者につながる</strong>
                                <small>記録から種類情報や相談へすぐ移動</small>
                            </div>
                        </li>
                    </ul>

                    <div class="setae-register-plan">
                        <span>無料プラン</span>
                        <strong><?php echo esc_html($free_spider_limit); ?>匹まで登録</strong>
                        <small>メール認証後、すぐに利用できます</small>
                    </div>
                </aside>

                <div class="setae-register-workspace">
                    <div class="setae-register-heading">
                        <span>無料アカウント</span>
                        <h2 id="setae-register-title">最初の1匹を登録する準備</h2>
                        <p id="setae-register-description">
                            メール認証が済んだら、すぐに飼育個体を登録できます。
                        </p>
                    </div>

                    <div class="setae-register-steps" aria-label="登録の流れ">
                        <span class="is-current"><b>1</b>入力</span>
                        <i aria-hidden="true"></i>
                        <span><b>2</b>メール認証</span>
                        <i aria-hidden="true"></i>
                        <span><b>3</b>利用開始</span>
                    </div>

                    <form id="setae-register-form" autocomplete="on">
                        <input type="hidden" id="reg-username" value="">
                        <div class="setae-form-group">
                            <label for="reg-email">メールアドレス</label>
                            <input
                                type="email"
                                id="reg-email"
                                class="setae-input"
                                autocomplete="email"
                                inputmode="email"
                                autocapitalize="none"
                                spellcheck="false"
                                required>
                        </div>
                        <div class="setae-form-group">
                            <label for="reg-password">パスワード</label>
                            <input
                                type="password"
                                id="reg-password"
                                class="setae-input"
                                autocomplete="new-password"
                                required
                                minlength="6">
                            <small>6文字以上で設定してください。</small>
                        </div>

                        <details class="setae-register-referral">
                            <summary>紹介コードを持っている</summary>
                            <div class="setae-form-group">
                                <label for="reg-referral-code">紹介コード</label>
                                <input
                                    type="text"
                                    id="reg-referral-code"
                                    class="setae-input"
                                    autocomplete="off"
                                    placeholder="例: あいうえお">
                                <small id="reg-referral-helper">
                                    紹介コードを使うと、生体の登録上限枠が1匹分追加されます。
                                </small>
                            </div>
                        </details>

                        <?php $tos_url = class_exists('Setae_App_Operations') ? Setae_App_Operations::get_terms_url() : (get_option('setae_tos_url') ?: home_url('/terms/')); ?>
                        <label class="setae-register-consent">
                            <input type="checkbox" id="reg-tos-agree" required>
                            <span>
                                <a href="<?php echo esc_url($tos_url); ?>" target="_blank" rel="noopener noreferrer">利用規約</a>
                                に同意します
                            </span>
                        </label>

                        <button type="submit" class="setae-btn setae-btn-primary setae-register-submit">
                            無料アカウントを作る
                        </button>
                        <p class="setae-register-login">
                            すでにアカウントをお持ちですか？
                            <a href="<?php echo esc_url($setae_login_url); ?>">ログイン</a>
                        </p>
                    </form>
                </div>
            </div>
        </div>
    <?php endif; ?>
    <?php
} elseif ($setae_app_requested) {
    if (shortcode_exists('setae_dashboard')) {
        echo do_shortcode('[setae_dashboard]');
    } else {
        echo '<p style="text-align:center; padding:50px;">Setae Core Plugin is missing or inactive.</p>';
    }
} else {
    ?>
    <main id="primary" class="setae-wordpress-content">
        <?php if (have_posts()) : ?>
            <?php while (have_posts()) : ?>
                <?php the_post(); ?>
                <article id="post-<?php the_ID(); ?>" <?php post_class('setae-wordpress-entry'); ?>>
                    <header class="setae-wordpress-entry-header">
                        <?php if (is_singular()) : ?>
                            <h1 class="setae-wordpress-entry-title"><?php the_title(); ?></h1>
                        <?php else : ?>
                            <h2 class="setae-wordpress-entry-title">
                                <a href="<?php the_permalink(); ?>"><?php the_title(); ?></a>
                            </h2>
                        <?php endif; ?>
                    </header>

                    <div class="setae-wordpress-entry-content">
                        <?php the_content(); ?>
                    </div>
                </article>
            <?php endwhile; ?>

            <?php the_posts_pagination(); ?>
        <?php else : ?>
            <section class="setae-wordpress-empty">
                <h1>ページが見つかりません</h1>
                <p>お探しのページは移動または削除された可能性があります。</p>
                <a href="<?php echo esc_url(home_url('/')); ?>">トップへ戻る</a>
            </section>
        <?php endif; ?>
    </main>
    <?php
}

get_footer();
