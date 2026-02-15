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

        <h4 id="detail-header-title">Topic</h4>

        <div class="header-action-spacer"></div>
    </div>

    <div id="topic-detail-content">
        <!-- Loaded via JS -->
    </div>

    <div id="topic-comments-list" class="setae-post-container">
        <!-- Comments loaded here -->
    </div>

    <form id="setae-comment-form"
        style="margin-top:20px; display:flex; gap:10px; background:rgba(255,255,255,0.5); padding:10px; border-radius:12px; border:1px solid rgba(255,255,255,0.3);">
        <input type="hidden" id="comment-post-id">
        <input type="text" id="comment-content" class="setae-input" placeholder="投稿内容を入力..." required=""
            style="border:none; background:transparent; box-shadow:none; flex-grow:1;">
        <button type="submit" class="setae-btn-sm"
            style="background:var(--setae-primary); color:#fff; border:none; border-radius:6px; padding:0 15px; flex-shrink:0;">書き込む</button>
    </form>
</div>