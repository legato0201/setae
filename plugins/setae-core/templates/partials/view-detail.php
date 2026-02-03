<?php
/**
 * Partial: Encyclopedia Detail View
 */
?>
<div id="section-enc-detail" class="setae-section" style="display: none;">
    <div class="setae-header-bar" style="display:flex; align-items:center; margin-bottom:15px;">
        <button id="btn-back-to-enc" class="setae-btn-text" style="margin-right:15px; font-size:18px;">←
            Back</button>
        <h4 style="margin:0; flex-grow:1; text-align:center;" id="enc-detail-title">Species Name</h4>
        <div style="width:50px;"></div>
    </div>

    <div class="setae-card" style="padding:0; overflow:hidden; margin-bottom:15px;">
        <img id="enc-detail-image" src="" style="width:100%; height:200px; object-fit:cover; display:block;">
        <div style="padding:15px;">
            <span id="enc-detail-genus"
                style="display:block; font-style:italic; color:#888; font-size:12px; margin-bottom:4px;">Genus</span>
            <h3 id="enc-detail-name" style="margin:0;">Species Title</h3>
            <div style="margin-top:10px; display:flex; gap:10px; font-size:12px;">
                <span id="enc-detail-temperament"
                    style="background:#eee; padding:3px 8px; border-radius:12px;">Docile</span>
                <span id="enc-detail-keeping"
                    style="background:#ffcc00; color:#333; padding:3px 8px; border-radius:12px; font-weight:bold;">🔥
                    10 Keeping</span>
            </div>
        </div>
    </div>

    <!-- Stats/Info -->
    <div class="setae-card" style="margin-bottom:15px;">
        <h4 style="margin-top:0;">Species Info</h4>
        <p id="enc-detail-description" style="font-size:13px; line-height:1.6; color:#555;">...</p>
        <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px; margin-top:10px;">
            <div style="background:#f9f9f9; padding:8px; border-radius:6px;">
                <span style="display:block; font-size:10px; color:#888;">Lifespan</span>
                <strong id="enc-detail-lifespan">-</strong>
            </div>
            <div style="background:#f9f9f9; padding:8px; border-radius:6px;">
                <span style="display:block; font-size:10px; color:#888;">Max Legspan</span>
                <strong id="enc-detail-size">-</strong>
            </div>
        </div>
    </div>

    <!-- Community Gallery -->
    <div class="setae-card">
        <h4 style="margin-top:0;">Best Shots Gallery</h4>
        <div id="enc-gallery-grid" style="display:grid; grid-template-columns:repeat(3, 1fr); gap:4px;">
            <!-- JS Populated -->
        </div>
        <p id="enc-gallery-empty" style="text-align:center; color:#ccc; font-size:12px; display:none;">No
            community photos yet.</p>
    </div>
</div>