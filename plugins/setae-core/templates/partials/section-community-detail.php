<?php
/**
 * Partial: Community Detail View
 */
?>
<div id="section-com-detail" class="setae-section" style="display:none;">
    <div class="setae-detail-header">
        <button type="button" class="setae-btn-back" id="btn-back-to-topics">
            <svg viewBox="0 0 24 24">
                <path d="M15.41 7.41L14 6l-6 6 6 6 1.41-1.41L10.83 12z" />
            </svg>
        </button>

        <h4 id="detail-header-title">相談</h4>

        <div class="header-action-spacer"></div>
    </div>

    <div class="community-detail-workspace">
        <main class="community-detail-main">
            <div id="topic-detail-content">
                <!-- Loaded via JS -->
            </div>

            <div id="topic-comments-list" class="setae-post-container">
                <!-- Comments loaded here -->
            </div>
        </main>

        <aside class="community-detail-compose">
            <form id="setae-comment-form" class="care-feed-comment-form community-comment-form">
                <input type="hidden" id="comment-post-id">

                <input type="file" id="comment-image-input" accept="image/*" style="display:none;">

                <div class="care-feed-comment-templates community-comment-templates" aria-label="定型コメント">
                    <button type="button" class="js-topic-comment-template" data-label="参考になります"
                        data-comment="参考になります。うちの飼育でも試してみたいです。">参考になります</button>
                    <button type="button" class="js-topic-comment-template" data-label="その後が気になります"
                        data-comment="その後の様子も気になります。進展があれば教えてください。">その後が気になります</button>
                    <button type="button" class="js-topic-comment-template" data-label="詳しく知りたい"
                        data-comment="よければ環境や前後の様子も教えてください。">詳しく知りたい</button>
                </div>

                <div class="community-comment-tools">
                    <button type="button" id="btn-trigger-comment-image" title="画像を添付">
                        <span aria-hidden="true">📷</span>
                        <span>画像</span>
                    </button>

                    <div id="comment-image-preview" style="display:none;">
                        <img src="">
                        <button type="button" id="btn-clear-comment-image" aria-label="画像を削除">×</button>
                    </div>
                </div>

                <textarea id="comment-content" class="setae-input" placeholder="コメントを書く..." autocomplete="off" rows="2"
                    maxlength="1000"></textarea>

                <div class="care-feed-comment-actions">
                    <span id="comment-char-count">0 / 1000</span>
                    <button type="submit" class="setae-btn setae-btn-primary btn-send-comment">投稿する</button>
                </div>
            </form>
        </aside>
    </div>
</div>
