<?php
/**
 * Partial: Encyclopedia Detail View
 */
?>
<div id="section-enc-detail" class="setae-section" style="display: none;">
    <div class="setae-header-bar"
        style="display:flex; align-items:center; padding:10px 15px; border-bottom:1px solid #eee; background:#fff; position:sticky; top:0; z-index:100; width: auto; margin: -16px -16px 0 -16px;">
        <button id="btn-back-to-enc" class="setae-btn-back" type="button" aria-label="Back">
            <svg viewBox="0 0 24 24">
                <path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z"></path>
            </svg>
        </button>
        <h4 style="margin:0; flex-grow:1; text-align:center; font-size:16px; font-weight:bold; color:#333;"
            id="enc-detail-title">
            Loading...
        </h4>

        <button id="btn-open-edit-modal" class="setae-icon-btn" type="button" aria-label="Edit Suggestion"
            style="width:40px; border:none; background:transparent; cursor:pointer;">
            <svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" stroke-width="2" fill="none">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
            </svg>
        </button>
    </div>

    <div class="setae-card" style="padding:0; overflow:hidden; margin-bottom:15px;">
        <img id="enc-detail-image" src="" style="width:100%; height:200px; object-fit:cover; display:block;">
        <div style="padding:15px;">
            <span id="enc-detail-genus"
                style="display:block; font-style:italic; color:#888; font-size:12px; margin-bottom:4px;">Genus</span>
            <div id="enc-detail-common-name" style="font-size:12px; color:#555; font-weight:bold;"></div>
            <h3 id="enc-detail-name" style="margin:0;">Species Title</h3>

            <!-- Temperament List (Chips) -->
            <div id="enc-detail-temperament-list" style="margin-top:8px; display:flex; flex-wrap:wrap; gap:4px;">
                <!-- JS populated -->
            </div>

            <div style="margin-top:10px; display:flex; gap:10px; font-size:12px;">
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
                <span style="display:block; font-size:10px; color:#888;">Lifestyle</span>
                <strong id="enc-detail-lifestyle">-</strong>
            </div>
            <div style="background:#f9f9f9; padding:8px; border-radius:6px;">
                <span style="display:block; font-size:10px; color:#888;">Temp</span>
                <strong id="enc-detail-temp">-</strong>
            </div>
            <div style="background:#f9f9f9; padding:8px; border-radius:6px;">
                <span style="display:block; font-size:10px; color:#888;">Humidity</span>
                <strong id="enc-detail-humidity">-</strong>
            </div>
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