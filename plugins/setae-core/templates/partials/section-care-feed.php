<?php
/**
 * Partial: Shared Care Feed
 */
$social_user = wp_get_current_user();
$social_avatar_url = get_avatar_url(get_current_user_id(), array('size' => 96));
$social_handle = $social_user && $social_user->exists()
    ? Setae_Public_Identity::get_handle($social_user->ID)
    : '';
?>
<div id="section-care-feed" class="setae-section" style="display:none; padding-bottom: 80px;">
    <div class="setae-header-bar care-feed-header social-hub-header">
        <div class="social-hub-header-top">
            <div class="com-title-area">
                <h3><span class="dashicons dashicons-groups" aria-hidden="true"></span><span>交流</span></h3>
                <span class="com-stats">飼育者のタイムライン</span>
            </div>
            <div class="social-hub-header-actions">
                <div class="social-live-status" data-social-live-status="care" data-state="live"
                    role="status" aria-live="polite" aria-label="新着投稿を自動確認中">
                    <span class="social-live-dot" aria-hidden="true"></span>
                    <span class="social-live-label">ライブ</span>
                </div>
                <button type="button" class="social-filter-toggle js-social-filter-toggle" aria-expanded="false" aria-controls="care-feed-filter-panel">
                    <span class="dashicons dashicons-filter" aria-hidden="true"></span>
                    <span>絞り込み</span>
                </button>
            </div>
        </div>
        <div class="social-hub-tabs" role="tablist" aria-label="交流の表示を切り替え">
            <button type="button" class="social-hub-tab active js-social-hub-tab" data-social-view="care" role="tab" aria-selected="true"><span class="dashicons dashicons-heart" aria-hidden="true"></span><span>お世話記録</span><span class="social-hub-unread-count" data-social-unread="care" hidden></span></button>
            <button type="button" class="social-hub-tab js-social-hub-tab" data-social-view="community" role="tab" aria-selected="false"><span class="dashicons dashicons-format-chat" aria-hidden="true"></span><span>相談広場</span><span class="social-hub-unread-count" data-social-unread="community" hidden></span></button>
        </div>
    </div>

    <div class="care-feed-workspace">
        <main class="care-feed-stream" aria-label="お世話記録タイムライン">
            <section class="social-quick-compose" aria-label="ひとことや相談を投稿">
                <div class="social-compose-avatar">
                    <?php if ($social_avatar_url): ?>
                        <img src="<?php echo esc_url($social_avatar_url); ?>" alt="">
                    <?php else: ?>
                        <span aria-hidden="true"><?php echo esc_html($social_user->display_name ? substr($social_user->display_name, 0, 1) : '?'); ?></span>
                    <?php endif; ?>
                </div>
                <form class="social-quick-compose-form js-social-quick-compose" enctype="multipart/form-data" data-compose-context="care" aria-label="新しい投稿を作成">
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
                        <label for="social-care-quick-subject"><span>CW</span>要約・注意書き</label>
                        <input type="text" id="social-care-quick-subject" class="social-compose-subject-input js-social-compose-subject-input" maxlength="80" placeholder="本文の前に表示する要約">
                    </div>
                    <label class="screen-reader-text" for="social-care-quick-content">飼育の近況や相談</label>
                    <textarea id="social-care-quick-content" class="social-quick-compose-input js-social-quick-content" maxlength="500" rows="2" placeholder="いま何を共有しますか？"></textarea>
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
                            <input type="file" id="social-care-quick-image" class="js-social-compose-file" accept="image/jpeg,image/png,image/webp,image/gif" hidden>
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

                <nav class="social-compose-nav" aria-label="お世話記録の表示範囲">
                    <button type="button" class="social-compose-nav-item care-feed-scope-btn active" data-scope="all">
                        <span class="dashicons dashicons-admin-home" aria-hidden="true"></span>
                        <span>みんな</span>
                    </button>
                    <button type="button" class="social-compose-nav-item care-feed-scope-btn" data-scope="following">
                        <span class="dashicons dashicons-groups" aria-hidden="true"></span>
                        <span>フォロー中</span>
                    </button>
                    <button type="button" class="social-compose-nav-item care-feed-scope-btn" data-scope="mine">
                        <span class="dashicons dashicons-admin-users" aria-hidden="true"></span>
                        <span>自分の記録</span>
                    </button>
                </nav>
            </section>

            <button type="button" class="social-new-posts-banner js-social-new-posts-jump" data-social-view="care"
                aria-live="polite" hidden>
                <span class="dashicons dashicons-arrow-up-alt2" aria-hidden="true"></span>
                <span><b class="js-social-new-posts-count">0</b>件の新しい記録</span>
            </button>

            <div id="setae-care-feed-list" role="feed" aria-live="polite" aria-label="お世話記録の投稿">
                <div class="setae-card" style="text-align:center; padding:20px; color:#999;">
                    <span class="spinner"></span> 読み込み中...
                </div>
            </div>

            <div id="setae-care-feed-load-more" style="text-align:center; margin:20px 0; display:none;">
                <button id="btn-load-more-care-feed" class="setae-btn-secondary"
                    style="background:#fff; border:1px solid #ddd; color:#666; padding:8px 20px; border-radius:20px; cursor:pointer;">
                    もっと見る
                </button>
                <div id="loader-care-feed" style="display:none; color:#999; margin-top:10px;">
                    <span class="spinner-icon"
                        style="display:inline-block; width:16px; height:16px; border:2px solid #ccc; border-top-color:#333; border-radius:50%; animation:spin 1s linear infinite;"></span>
                    読み込み中...
                </div>
            </div>
        </main>

        <aside id="care-feed-filter-panel" class="care-feed-desktop-rail social-filter-panel" aria-label="お世話フィードの状況と絞り込み">
            <div id="care-feed-activity-panel" class="care-feed-activity-panel" style="display:none;"></div>

            <div class="care-feed-controls social-rail-section">
                <div class="social-rail-heading">
                    <strong>タイムライン</strong>
                    <span>表示内容を整える</span>
                </div>
                <div class="care-feed-control-section">
                    <span class="care-feed-control-label">表示する記録</span>
                    <div class="care-feed-scope-row social-scope-nav" aria-label="記録の表示範囲">
                        <button type="button" class="care-feed-scope-btn active" data-scope="all">みんな</button>
                        <button type="button" class="care-feed-scope-btn" data-scope="following">フォロー中</button>
                        <button type="button" class="care-feed-scope-btn" data-scope="mine">自分</button>
                    </div>
                </div>

                <div class="care-feed-select-grid">
                    <label class="care-feed-select-control" for="care-feed-sort-select">
                        <span>並び替え</span>
                        <select id="care-feed-sort-select" class="care-feed-control-select">
                            <option value="new">新しい順</option>
                            <option value="active">会話中</option>
                        </select>
                    </label>
                    <label class="care-feed-select-control" for="care-feed-filter-select">
                        <span>種類</span>
                        <select id="care-feed-filter-select" class="care-feed-control-select">
                            <option value="all">すべて</option>
                            <option value="tarantula">タランチュラ</option>
                            <option value="scorpion">サソリ</option>
                            <option value="reptile">爬虫類</option>
                            <option value="plant">植物</option>
                            <option value="other">その他</option>
                        </select>
                    </label>
                </div>

                <button type="button" class="care-feed-relationship-toggle js-care-feed-relationships-toggle" aria-expanded="false" aria-controls="care-feed-relationship-panel">
                    <span>フォロー・表示設定</span>
                    <span class="care-feed-relationship-toggle-icon" aria-hidden="true">›</span>
                </button>
                <div id="care-feed-relationship-panel" class="care-feed-relationship-panel" hidden></div>
            </div>

            <div id="care-feed-desktop-summary" class="care-feed-desktop-summary" style="display:none;"></div>
        </aside>
    </div>
</div>
