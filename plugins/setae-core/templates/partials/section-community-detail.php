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
        style="margin-top:20px; display:flex; align-items:flex-end; gap:10px; background:rgba(255,255,255,0.5); padding:10px; border-radius:12px; border:1px solid rgba(255,255,255,0.3);">

        <input type="hidden" id="comment-post-id">

        <div id="comment-image-preview" style="display:none; position:relative; margin-right:5px;">
            <img src="" style="width:40px; height:40px; object-fit:cover; border-radius:6px; border:1px solid #ddd;">
            <button type="button" id="btn-clear-comment-image"
                style="position:absolute; top:-5px; right:-5px; background:red; color:white; border:none; border-radius:50%; width:16px; height:16px; font-size:10px; display:flex; align-items:center; justify-content:center; cursor:pointer;">×</button>
        </div>

        <input type="file" id="comment-image-input" accept="image/*" style="display:none;">

        <button type="button" id="btn-trigger-comment-image" title="画像を添付"
            style="background:none; border:none; cursor:pointer; padding:8px; color:#666; display:flex; align-items:center;">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
                stroke-linecap="round" stroke-linejoin="round">
                <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"></path>
                <circle cx="12" cy="13" r="4"></circle>
            </svg>
        </button>

        <input type="text" id="comment-content" class="setae-input" placeholder="投稿内容を入力..." required=""
            style="border:none; background:transparent; box-shadow:none; flex-grow:1; padding-bottom:8px;">

        <button type="submit" class="setae-btn-sm"
            style="background:var(--setae-primary); color:#fff; border:none; border-radius:6px; padding:8px 15px; flex-shrink:0;">書き込む</button>
    </form>
</div>