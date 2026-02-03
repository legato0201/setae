<?php
/**
 * Partial: Community Detail View
 */
?>
<div id="section-com-detail" class="setae-section" style="display:none;">
    <div class="setae-header-bar"
        style="display:flex; align-items:center; margin-bottom:15px; border-bottom:1px solid #eee; padding-bottom:10px;">
        <button class="setae-btn-text" id="btn-back-to-topics"
            style="margin-right:15px; font-size:18px; color:var(--setae-primary); border:none; background:none; cursor:pointer;">
            ← Back
        </button>
        <h4 style="margin:0; flex-grow:1; text-align:center;" id="detail-header-title">Topic</h4>
        <div style="width:50px;"></div> <!-- Spacer for center alignment -->
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