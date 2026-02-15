<?php
/**
 * Partial: Community Section (Master View)
 */
?>
<div id="section-com" class="setae-section" style="display:none; padding-bottom: 80px;">
    <div class="setae-header-bar" style="margin-bottom:15px; padding:0 5px;">
        <h3 style="margin:0 0 10px 0;">Community</h3>

        <div class="setae-pill-nav" style="display:flex; gap:8px; overflow-x:auto; padding-bottom:5px;">
            <button class="com-filter-btn active" data-type="all"
                style="border:none; background:#eee; padding:6px 12px; border-radius:20px; font-size:12px; white-space:nowrap; cursor:pointer;">
                すべて
            </button>
            <button class="com-filter-btn" data-type="question"
                style="border:none; background:#fff; border:1px solid #eee; color:#666; padding:6px 12px; border-radius:20px; font-size:12px; white-space:nowrap; cursor:pointer;">
                <span style="color:#e74c3c;">●</span> 質問
            </button>
            <button class="com-filter-btn" data-type="chat"
                style="border:none; background:#fff; border:1px solid #eee; color:#666; padding:6px 12px; border-radius:20px; font-size:12px; white-space:nowrap; cursor:pointer;">
                <span style="color:#2ecc71;">●</span> 雑談
            </button>
            <button class="com-filter-btn" data-type="breeding"
                style="border:none; background:#fff; border:1px solid #eee; color:#666; padding:6px 12px; border-radius:20px; font-size:12px; white-space:nowrap; cursor:pointer;">
                <span style="color:#9b59b6;">●</span> ブリード
            </button>
        </div>
    </div>

    <div id="setae-topic-list">
        <div class="setae-card">
            <p style="text-align:center;">読み込み中...</p>
        </div>
    </div>

    <button id="btn-create-topic" class="setae-fab"
        style="position:fixed; bottom:80px; right:20px; width:56px; height:56px; border-radius:50%; background:var(--setae-primary); color:#fff; border:none; box-shadow:0 4px 12px rgba(0,0,0,0.3); font-size:24px; display:flex; justify-content:center; align-items:center; cursor:pointer; z-index:100;">
        +
    </button>
</div>