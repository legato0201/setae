<?php
/**
 * Partial: Community Section (Master View)
 */
?>
<div id="section-com" class="setae-section" style="display:none; padding-bottom: 80px;">
    <div class="setae-header-bar">
        <h3>Community</h3>

        <div class="setae-pill-nav">
            <button class="com-filter-btn active" data-type="all">
                すべて
            </button>
            <button class="com-filter-btn" data-type="question">
                <span class="badge-dot badge-question"></span> 質問
            </button>
            <button class="com-filter-btn" data-type="chat">
                <span class="badge-dot badge-chat"></span> 雑談
            </button>
            <button class="com-filter-btn" data-type="breeding">
                <span class="badge-dot badge-breeding"></span> ブリード
            </button>
        </div>
    </div>

    <div id="setae-topic-list">
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

    <button id="btn-create-topic" class="setae-fab"
        style="position:fixed; bottom:80px; right:20px; width:56px; height:56px; border-radius:50%; background:var(--setae-primary); color:#fff; border:none; box-shadow:0 4px 12px rgba(0,0,0,0.3); font-size:24px; display:flex; justify-content:center; align-items:center; cursor:pointer; z-index:100;">
        +
    </button>
</div>