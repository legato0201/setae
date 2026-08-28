<?php
/** @var array $setae_profile */
/** @var array $setae_context */
$profile = $setae_profile;
$context = $setae_context;
?>
<div
    id="setae-public-profile"
    class="setae-public-profile-page"
    data-profile-id="<?php echo esc_attr($profile['user_id']); ?>"
    data-profile-code="<?php echo esc_attr($profile['referral_code']); ?>"
    data-share-title="<?php echo esc_attr($profile['meta_title']); ?>"
    data-share-text="<?php echo esc_attr($profile['share_text']); ?>"
    data-share-url="<?php echo esc_url($profile['invite_url']); ?>"
>
    <header class="setae-public-profile-header">
        <div class="setae-public-profile-header-inner">
            <?php echo Setae_Public_Identity::render_brand(); // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped ?>
            <nav class="setae-public-profile-header-actions" aria-label="公開プロフィールの操作">
                <button type="button" class="setae-public-button setae-public-profile-button is-quiet" data-public-profile-share>共有</button>
                <?php if ($context['is_logged_in']): ?>
                    <a class="setae-public-button setae-public-profile-button is-primary" href="<?php echo esc_url($context['app_url']); ?>">SETAEを開く</a>
                <?php else: ?>
                    <a class="setae-public-button setae-public-profile-button is-quiet" href="<?php echo esc_url($context['login_url']); ?>">ログイン</a>
                    <?php if ($context['registration_enabled']): ?>
                        <a class="setae-public-button setae-public-profile-button is-primary setae-public-profile-header-register" href="<?php echo esc_url($context['register_url']); ?>" data-public-register aria-controls="setae-public-register-dialog">無料で始める</a>
                    <?php endif; ?>
                <?php endif; ?>
            </nav>
        </div>
    </header>

    <main class="setae-public-profile-main">
        <section class="setae-public-profile-hero" aria-labelledby="setae-public-profile-name">
            <div class="setae-public-profile-avatar">
                <?php if ($profile['avatar']): ?>
                    <img src="<?php echo esc_url($profile['avatar']); ?>" alt="<?php echo esc_attr($profile['name']); ?>" width="96" height="96" decoding="async" loading="eager">
                <?php else: ?>
                    <span aria-hidden="true"><?php echo esc_html($profile['initial']); ?></span>
                <?php endif; ?>
            </div>
            <div class="setae-public-profile-identity">
                <p class="setae-public-profile-eyebrow">KEEPER PROFILE</p>
                <h1 id="setae-public-profile-name"><?php echo esc_html($profile['name']); ?></h1>
                <?php if ($profile['public_handle']): ?>
                    <p class="setae-public-profile-handle">@<?php echo esc_html($profile['public_handle']); ?></p>
                <?php endif; ?>
                <p class="setae-public-profile-lead"><?php echo esc_html($profile['lead']); ?></p>

                <dl class="setae-public-profile-stats" aria-label="公開プロフィールの概要">
                    <div><dt>登録個体</dt><dd><?php echo esc_html(number_format_i18n($profile['spider_count'])); ?></dd></div>
                    <div><dt>公開記録</dt><dd><?php echo esc_html(number_format_i18n($profile['shared_count'])); ?></dd></div>
                    <div><dt>最終公開</dt><dd><?php echo esc_html($profile['latest_label']); ?></dd></div>
                </dl>

                <div class="setae-public-profile-actions">
                    <?php if ($context['is_logged_in']): ?>
                        <a class="setae-public-button setae-public-profile-button is-primary" href="<?php echo esc_url($context['app_url']); ?>">SETAEを開く</a>
                    <?php elseif ($context['registration_enabled']): ?>
                        <a class="setae-public-button setae-public-profile-button is-primary" href="<?php echo esc_url($context['register_url']); ?>" data-public-register aria-controls="setae-public-register-dialog">無料で始める</a>
                    <?php else: ?>
                        <a class="setae-public-button setae-public-profile-button is-primary" href="<?php echo esc_url($context['login_url']); ?>">ログイン</a>
                    <?php endif; ?>
                    <button type="button" class="setae-public-button setae-public-profile-button" data-public-profile-copy="<?php echo esc_url($profile['invite_url']); ?>">リンクをコピー</button>
                    <details class="setae-public-profile-share-menu">
                        <summary class="setae-public-button setae-public-profile-button">共有先</summary>
                        <div class="setae-public-profile-share-popover" aria-label="共有先">
                            <button type="button" data-public-profile-text="<?php echo esc_attr($profile['share_copy_text']); ?>">紹介文をコピー</button>
                            <a href="<?php echo esc_url($profile['x_share_url']); ?>" target="_blank" rel="noopener noreferrer" data-public-profile-x>Xで共有</a>
                            <a href="<?php echo esc_url($profile['line_share_url']); ?>" target="_blank" rel="noopener noreferrer" data-public-profile-line>LINEで共有</a>
                        </div>
                    </details>
                </div>
                <p class="setae-public-profile-live-status" role="status" aria-live="polite" data-public-profile-status></p>
            </div>
        </section>

        <div class="setae-public-profile-layout">
            <section class="setae-public-profile-notes" aria-labelledby="setae-public-profile-notes-title">
                <header class="setae-public-profile-section-heading">
                    <div>
                        <p class="setae-public-profile-eyebrow">PUBLIC FIELD NOTES</p>
                        <h2 id="setae-public-profile-notes-title">公開フィールドノート</h2>
                    </div>
                    <p><?php echo $profile['is_limited'] ? '最新9件を表示' : '最新の公開記録'; ?></p>
                </header>

                <?php if ($profile['logs']): ?>
                    <div class="setae-public-profile-note-index">
                        <?php foreach ($profile['logs'] as $log): ?>
                            <article class="setae-public-profile-note">
                                <a href="<?php echo esc_url($log['share_url']); ?>" aria-label="<?php echo esc_attr($log['spider_title'] . 'の' . $log['type_label'] . '記録を開く'); ?>">
                                    <div class="setae-public-profile-note-media<?php echo $log['image'] ? '' : ' is-placeholder'; ?>">
                                        <?php if ($log['image']): ?>
                                            <img src="<?php echo esc_url($log['image']); ?>" alt="<?php echo esc_attr($log['spider_title']); ?>" width="4" height="3" loading="lazy" decoding="async" fetchpriority="low">
                                        <?php else: ?>
                                            <?php echo Setae_Public_Visual::specimen_placeholder(array(
                                                'classification' => $log['classification'],
                                                'scientific_name' => $log['species_name'],
                                                'code' => $log['spider_title'],
                                                'variant' => 'thumbnail',
                                                'show_taxon' => false,
                                            )); // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped ?>
                                        <?php endif; ?>
                                    </div>
                                    <div class="setae-public-profile-note-caption">
                                        <h3><?php echo esc_html($log['spider_title']); ?></h3>
                                        <p class="setae-public-profile-taxon"><i><?php echo esc_html($log['species_name']); ?></i></p>
                                        <p class="setae-public-profile-note-meta"><span><?php echo esc_html($log['type_label']); ?></span><time datetime="<?php echo esc_attr($log['date_iso']); ?>"><?php echo esc_html($log['display_date']); ?></time></p>
                                        <p class="setae-public-profile-note-summary"><?php echo esc_html($log['summary']); ?></p>
                                    </div>
                                </a>
                            </article>
                        <?php endforeach; ?>
                    </div>
                <?php else: ?>
                    <div class="setae-public-profile-empty">
                        <h3>公開中の記録はまだありません</h3>
                        <p>このユーザーが共有した記録が、ここに表示されます。</p>
                    </div>
                <?php endif; ?>
            </section>

            <aside class="setae-public-profile-side" aria-label="SETAEと紹介コード">
                <section>
                    <p class="setae-public-profile-eyebrow">ABOUT SETAE</p>
                    <h2>SETAEとは</h2>
                    <p>生きたコレクションを、個体ごとの写真・給餌・脱皮・観察記録とともに管理するための飼育台帳です。</p>
                </section>
                <section class="setae-public-profile-referral">
                    <h2>紹介コード</h2>
                    <code><?php echo esc_html($profile['referral_code']); ?></code>
                    <button type="button" class="setae-public-button setae-public-profile-button is-quiet" data-public-profile-copy="<?php echo esc_attr($profile['referral_code']); ?>" data-copy-message="紹介コードをコピーしました">コードをコピー</button>
                </section>
            </aside>
        </div>
    </main>

    <footer class="setae-public-profile-footer">
        <a href="<?php echo esc_url($context['home_url']); ?>">SETAE</a>
        <span>Living Collection Ledger</span>
    </footer>
</div>
