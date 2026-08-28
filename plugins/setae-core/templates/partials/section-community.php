<?php
/**
 * Partial: Community Section (Master View)
 */
$social_user = wp_get_current_user();
$social_avatar_url = get_avatar_url(get_current_user_id(), array('size' => 96));
$social_handle = $social_user && $social_user->exists()
    ? Setae_Public_Identity::get_handle($social_user->ID)
    : '';
?>
<div id="section-com" class="setae-section" style="display:none; padding-bottom: 80px;">

    <div class="setae-header-bar com-pro-header social-hub-header">
        <div class="com-header-top social-hub-header-top">
            <div class="com-title-area">
                <h3><span class="dashicons dashicons-groups" aria-hidden="true"></span><span>交流</span></h3>
                <span class="com-stats">飼育者のタイムライン</span>
            </div>
            <div class="social-hub-header-actions">
                <div class="social-live-status" data-social-live-status="community" data-state="live"
                    role="status" aria-live="polite" aria-label="新着投稿を自動確認中">
                    <span class="social-live-dot" aria-hidden="true"></span>
                    <span class="social-live-label">ライブ</span>
                </div>
                <button type="button" class="social-filter-toggle js-social-filter-toggle" aria-expanded="false" aria-controls="community-filter-panel">
                    <span class="dashicons dashicons-filter" aria-hidden="true"></span>
                    <span>絞り込み</span>
                </button>
            </div>
        </div>

        <div class="social-hub-tabs" role="tablist" aria-label="交流の表示を切り替え">
            <button type="button" class="social-hub-tab js-social-hub-tab" data-social-view="care" role="tab" aria-selected="false"><span class="dashicons dashicons-heart" aria-hidden="true"></span><span>お世話記録</span><span class="social-hub-unread-count" data-social-unread="care" hidden></span></button>
            <button type="button" class="social-hub-tab active js-social-hub-tab" data-social-view="community" role="tab" aria-selected="true"><span class="dashicons dashicons-format-chat" aria-hidden="true"></span><span>相談広場</span><span class="social-hub-unread-count" data-social-unread="community" hidden></span></button>
        </div>
    </div>

    <div class="community-workspace">
        <main class="community-thread-stream" aria-label="相談広場タイムライン">
            <section class="social-quick-compose" aria-label="ひとことや相談を投稿">
                <div class="social-compose-avatar">
                    <?php if ($social_avatar_url): ?>
                        <img src="<?php echo esc_url($social_avatar_url); ?>" alt="">
                    <?php else: ?>
                        <span aria-hidden="true"><?php echo esc_html($social_user->display_name ? substr($social_user->display_name, 0, 1) : '?'); ?></span>
                    <?php endif; ?>
                </div>
                <form class="social-quick-compose-form js-social-quick-compose" enctype="multipart/form-data" data-compose-context="community" aria-label="新しい投稿を作成">
                    <div class="social-compose-identity">
                        <strong><?php echo esc_html($social_user->display_name ?: 'ユーザー'); ?></strong>
                        <?php if ($social_handle): ?><span class="social-compose-handle" title="ログイン情報とは異なるSETAE専用公開ID">@<?php echo esc_html($social_handle); ?></span><?php endif; ?>
                    </div>
                    <div class="social-compose-audience" title="交流への投稿は公開タイムラインに表示されます">
                        <span class="dashicons dashicons-admin-site-alt3" aria-hidden="true"></span>
                        <span>公開</span>
                        <i aria-hidden="true">·</i>
                        <span>SETAEタイムライン</span>
                    </div>
                    <div class="social-compose-subject js-social-compose-subject" hidden>
                        <label for="social-community-quick-subject"><span>CW</span>要約・注意書き</label>
                        <input type="text" id="social-community-quick-subject" class="social-compose-subject-input js-social-compose-subject-input" maxlength="80" placeholder="本文の前に表示する要約">
                    </div>
                    <label class="screen-reader-text" for="social-community-quick-content">飼育の近況や相談</label>
                    <textarea id="social-community-quick-content" class="social-quick-compose-input js-social-quick-content" maxlength="500" rows="2" placeholder="いま何を共有しますか？"></textarea>
                    <div class="social-compose-media-preview js-social-compose-media-preview" hidden>
                        <img src="" alt="添付予定の写真">
                        <div class="social-compose-media-copy">
                            <div class="social-compose-media-file">
                                <strong class="js-social-compose-media-name">写真</strong>
                                <span class="js-social-compose-media-size"></span>
                            </div>
                            <label>
                                <span>画像の説明</span>
                                <input type="text" class="js-social-compose-media-alt" maxlength="300" placeholder="写真に写っている内容を説明">
                            </label>
                        </div>
                        <button type="button" class="js-social-compose-media-remove" aria-label="添付写真を削除" title="写真を削除">
                            <span class="dashicons dashicons-no-alt" aria-hidden="true"></span>
                        </button>
                    </div>
                    <div class="social-quick-compose-footer">
                        <div class="social-quick-compose-options">
                            <input type="file" id="social-community-quick-image" class="js-social-compose-file" accept="image/jpeg,image/png,image/webp,image/gif" hidden>
                            <button type="button" class="social-compose-tool js-social-compose-image" aria-label="写真を添付" title="写真を添付">
                                <span class="dashicons dashicons-format-image" aria-hidden="true"></span>
                            </button>
                            <button type="button" class="social-compose-tool social-compose-cw js-social-compose-subject-toggle" aria-pressed="false" title="CWを追加">
                                <span class="dashicons dashicons-visibility" aria-hidden="true"></span>
                                <span class="social-compose-tool-label">CW</span>
                            </button>
                            <label>
                                <span class="screen-reader-text">投稿の種類</span>
                                <select class="social-quick-compose-type" aria-label="投稿の種類">
                                    <option value="chat">ひとこと</option>
                                    <option value="question">質問</option>
                                    <option value="breeding">ブリード</option>
                                </select>
                            </label>
                            <button type="button" class="social-compose-detail js-open-topic-modal">詳しく書く</button>
                        </div>
                        <div class="social-quick-compose-submit-row">
                            <span class="social-compose-draft-status" aria-live="polite"></span>
                            <span class="social-quick-compose-count" style="--compose-progress: 0deg;" aria-label="残り500文字">
                                <span class="social-compose-remaining">500</span>
                            </span>
                            <button type="submit" class="social-quick-compose-submit" disabled>投稿</button>
                        </div>
                    </div>
                </form>

                <nav class="social-compose-nav" aria-label="相談タイムラインの表示範囲">
                    <button type="button" class="social-compose-nav-item com-scope-btn active" data-scope="all">
                        <span class="dashicons dashicons-admin-home" aria-hidden="true"></span>
                        <span>みんな</span>
                    </button>
                    <button type="button" class="social-compose-nav-item com-scope-btn" data-scope="following">
                        <span class="dashicons dashicons-groups" aria-hidden="true"></span>
                        <span>フォロー中</span>
                    </button>
                    <button type="button" class="social-compose-nav-item com-scope-btn" data-scope="mine">
                        <span class="dashicons dashicons-admin-users" aria-hidden="true"></span>
                        <span>自分の投稿</span>
                    </button>
                </nav>
            </section>

            <button type="button" class="social-new-posts-banner js-social-new-posts-jump" data-social-view="community"
                aria-live="polite" hidden>
                <span class="dashicons dashicons-arrow-up-alt2" aria-hidden="true"></span>
                <span><b class="js-social-new-posts-count">0</b>件の新しい投稿</span>
            </button>

            <div id="setae-topic-list" role="feed" aria-live="polite" aria-label="相談広場の投稿">
                <!-- JS will populate this -->
                <div class="setae-card" style="text-align:center; padding:20px; color:#999;">
                    <span class="spinner"></span> 読み込み中...
                </div>
            </div>

            <!-- Load More Button & Spinner -->
            <div id="setae-topic-load-more" style="text-align:center; margin:20px 0; display:none;">
                <button id="btn-load-more-topics" class="setae-btn-secondary"
                    style="background:#fff; border:1px solid #ddd; color:#666; padding:8px 20px; border-radius:20px; cursor:pointer;">
                    もっと見る
                </button>
                <div id="loader-topics" style="display:none; color:#999; margin-top:10px;">
                    <span class="spinner-icon"
                        style="display:inline-block; width:16px; height:16px; border:2px solid #ccc; border-top-color:#333; border-radius:50%; animation:spin 1s linear infinite;"></span>
                    読み込み中...
                </div>
            </div>
        </main>

        <aside id="community-filter-panel" class="community-desktop-rail social-filter-panel" aria-label="相談広場の検索と絞り込み">
            <div class="social-rail-section">
                <div class="social-rail-heading">
                    <strong>相談を探す</strong>
                    <span>話題や本文から検索</span>
                </div>
                <div class="com-search-box">
                    <input type="search" id="com-search-input" placeholder="相談を検索">
                    <button type="button" id="com-search-btn" class="search-btn" aria-label="検索">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                            <circle cx="11" cy="11" r="8"></circle>
                            <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                        </svg>
                    </button>
                </div>

                <div class="com-controls">
                    <div class="community-scope-control">
                        <span class="care-feed-control-label">表示範囲</span>
                        <div class="community-scope-row social-scope-nav" aria-label="相談の表示範囲">
                            <button type="button" class="com-scope-btn active" data-scope="all">みんな</button>
                            <button type="button" class="com-scope-btn" data-scope="following">フォロー中</button>
                            <button type="button" class="com-scope-btn" data-scope="mine">自分</button>
                        </div>
                    </div>
                    <div class="setae-pill-nav" aria-label="相談の種類">
                        <button class="com-filter-btn active" data-type="all">すべて</button>
                        <button class="com-filter-btn" data-type="question"><span class="badge-dot badge-question"></span>質問</button>
                        <button class="com-filter-btn" data-type="chat"><span class="badge-dot badge-chat"></span>雑談</button>
                        <button class="com-filter-btn" data-type="breeding"><span class="badge-dot badge-breeding"></span>ブリード</button>
                    </div>

                    <div class="com-sort-box">
                        <label for="com-sort-select">並び替え</label>
                        <select id="com-sort-select" class="setae-select">
                            <option value="newest">新しい順</option>
                            <option value="updated">会話中</option>
                            <option value="momentum">勢い順</option>
                        </select>
                    </div>
                </div>
            </div>

            <div id="community-unread-panel" class="community-unread-panel" style="display:none;"></div>
            <div id="community-species-context-panel" class="community-species-context" style="display:none;"></div>
            <div id="community-desktop-summary" class="community-desktop-summary" style="display:none;"></div>
        </aside>
    </div>
</div>
