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

    <form id="setae-comment-form">
        <input type="hidden" id="comment-post-id">

        <input type="file" id="comment-image-input" accept="image/*" style="display:none;">

        <button type="button" id="btn-trigger-comment-image" title="画像を添付">
            <img draggable="false" role="img" class="emoji" alt="📸"
                src="https://s.w.org/images/core/emoji/17.0.2/svg/1f4f8.svg">
        </button>

        <div id="comment-image-preview" style="display:none;">
            <img src="" style="width:40px; height:40px; object-fit:cover; border-radius:6px; display:block;">
            <button type="button" id="btn-clear-comment-image"
                style="position:absolute; top:-6px; right:-6px; background:#e74c3c; color:white; border:none; border-radius:50%; width:18px; height:18px; font-size:12px; display:flex; align-items:center; justify-content:center; cursor:pointer; box-shadow:0 2px 5px rgba(0,0,0,0.2);">×</button>
        </div>

        <input type="text" id="comment-content" placeholder="コメントを入力..." autocomplete="off">

        <button type="submit" class="btn-send-comment" title="送信">
            <svg class="send-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                stroke-width="2" stroke-linecap="round" stroke-linejoin="round"
                style="margin-left:-2px; margin-top:1px;">
                <line x1="22" y1="2" x2="11" y2="13"></line>
                <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
            </svg>
        </button>
    </form>
</div>