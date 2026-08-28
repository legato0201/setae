<?php
/**
 * Partial: Shared Care Feed Detail
 */
?>
<div id="section-care-feed-detail" class="setae-section" style="display:none; padding-bottom: 100px;">
    <div class="detail-header-bar">
        <button type="button" class="setae-btn-back" id="btn-back-to-care-feed" aria-label="お世話フィードへ戻る" title="戻る">
            <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="m15 18-6-6 6-6"></path>
            </svg>
        </button>
        <h3 id="care-feed-detail-title">お世話フィード</h3>
    </div>

    <div class="care-feed-detail-workspace">
        <main class="care-feed-detail-main">
            <div id="care-feed-detail-content">
                <div class="setae-card" style="text-align:center; padding:20px; color:#999;">
                    <span class="spinner"></span> 読み込み中...
                </div>
            </div>

            <div id="care-feed-comments-list" class="setae-post-container"></div>

            <div id="care-feed-comments-more" style="text-align:center; margin: 16px 0; display:none;">
                <button type="button" id="btn-load-more-care-comments" class="setae-btn-secondary">
                    コメントをもっと見る
                </button>
            </div>
        </main>

        <aside class="care-feed-detail-compose">
            <form id="care-feed-comment-form" class="care-feed-comment-form">
                <div id="care-feed-reply-target" class="care-feed-reply-target" style="display:none;">
                    <span></span>
                    <button type="button" id="btn-care-feed-reply-cancel">解除</button>
                </div>
                <div class="care-feed-comment-templates" aria-label="定型コメント">
                    <button type="button" class="js-care-comment-template" data-label="参考になります"
                        data-comment="参考になります。うちの飼育でも試してみたいです。">参考になります</button>
                    <button type="button" class="js-care-comment-template" data-label="うちも似ています"
                        data-comment="うちも似た様子がありました。経過が気になります。">うちも似ています</button>
                    <button type="button" class="js-care-comment-template" data-label="詳しく知りたい"
                        data-comment="よければ環境や前後の様子も教えてください。">詳しく知りたい</button>
                </div>
                <textarea id="care-feed-comment-content" class="setae-input" rows="2" maxlength="1000"
                    placeholder="コメントを書く..."></textarea>
                <div class="care-feed-comment-actions">
                    <span id="care-feed-comment-count">0 / 1000</span>
                    <button type="submit" class="setae-btn setae-btn-primary">投稿する</button>
                </div>
            </form>
        </aside>
    </div>
</div>
