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
            <?php esc_html_e('Loading...', 'setae-core'); ?>
        </h4>

        <button id="btn-open-edit-modal" class="setae-icon-btn" type="button" aria-label="Edit Suggestion"
            style="width:40px; border:none; background:transparent; cursor:pointer;">
            <svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" stroke-width="2" fill="none">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
            </svg>
        </button>
    </div>

    <div class="setae-card" style="padding:0; overflow:hidden; margin-bottom:15px; position:relative;">
        <img id="enc-detail-image" src="" style="width:100%; height:200px; object-fit:cover; display:block;">
        <div id="enc-detail-image-credit"
            style="display:none; position:absolute; bottom:155px; right:10px; background:rgba(0,0,0,0.6); color:#fff; font-size:10px; padding:2px 6px; border-radius:4px; z-index:10;">
            © <span class="credit-text"></span>
        </div>
        <div style="padding:15px;">
            <span id="enc-detail-genus"
                style="display:block; font-style:italic; color:#888; font-size:12px; margin-bottom:4px;"><?php esc_html_e('Genus', 'setae-core'); ?></span>
            <div id="enc-detail-common-name" style="font-size:12px; color:#555; font-weight:bold;"></div>
            <h3 id="enc-detail-name" style="margin:0;"><?php esc_html_e('Species Title', 'setae-core'); ?></h3>

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
        <h4 style="margin-top:0;"><?php esc_html_e('Species Info', 'setae-core'); ?></h4>
        <p id="enc-detail-description" style="font-size:13px; line-height:1.6; color:#555;">...</p>

        <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px; margin-top:10px;">
            <div style="background:#f9f9f9; padding:8px; border-radius:6px;">
                <span
                    style="display:block; font-size:10px; color:#888;"><?php esc_html_e('Lifestyle', 'setae-core'); ?></span>
                <strong id="enc-detail-lifestyle">-</strong>
            </div>
            <div style="background:#f9f9f9; padding:8px; border-radius:6px;">
                <span
                    style="display:block; font-size:10px; color:#888;"><?php esc_html_e('Temp', 'setae-core'); ?></span>
                <strong id="enc-detail-temp">-</strong>
            </div>
            <div style="background:#f9f9f9; padding:8px; border-radius:6px;">
                <span
                    style="display:block; font-size:10px; color:#888;"><?php esc_html_e('Humidity', 'setae-core'); ?></span>
                <strong id="enc-detail-humidity">-</strong>
            </div>
            <div style="background:#f9f9f9; padding:8px; border-radius:6px;">
                <span
                    style="display:block; font-size:10px; color:#888;"><?php esc_html_e('Lifespan', 'setae-core'); ?></span>
                <strong id="enc-detail-lifespan">-</strong>
            </div>
            <div style="background:#f9f9f9; padding:8px; border-radius:6px;">
                <span
                    style="display:block; font-size:10px; color:#888;"><?php esc_html_e('Max Legspan', 'setae-core'); ?></span>
                <strong id="enc-detail-size">-</strong>
            </div>
        </div>
    </div>

    <!-- Sponsor and Search Area -->
    <div class="setae-card" style="margin-bottom:15px; display:flex; flex-direction:column; gap:10px;">
        <a id="btn-search-yahoo" href="#" target="_blank"
            onclick="this.href='https://auctions.yahoo.co.jp/search/search?p=' + encodeURIComponent(document.getElementById('enc-detail-name').innerText);"
            style="display: flex; align-items: center; justify-content: center; background: #fdcb00; color: #333; font-weight: bold; text-decoration: none; padding: 12px; border-radius: 8px; font-size: 14px; box-shadow: 0 2px 4px rgba(0,0,0,0.05); transition: opacity 0.2s;">
            <span style="margin-right: 8px; font-size: 16px;">🔍</span> ヤフオクでこの種を探す
        </a>

        <a id="btn-search-inaturalist" href="#" target="_blank" rel="noopener noreferrer"
            onclick="this.href='https://www.inaturalist.org/search?q=' + encodeURIComponent(document.getElementById('enc-detail-name').innerText);"
            style="display: flex; align-items: center; justify-content: center; background: #74ac00; color: #fff; font-weight: bold; text-decoration: none; padding: 12px; border-radius: 8px; font-size: 14px; box-shadow: 0 2px 4px rgba(0,0,0,0.05); transition: opacity 0.2s;">
            <span style="margin-right: 8px; font-size: 16px;">🌿</span> iNaturalistでこの種を調べる
        </a>
    </div>

    <div id="enc-detail-ad-container" class="setae-card"
        style="margin-bottom:15px; border: 2px dashed #ddd; background: #fafafa; text-align: center; padding: 20px 15px;">
        <span
            style="display: inline-block; font-size: 10px; background: #eee; color: #888; padding: 3px 8px; border-radius: 12px; margin-bottom: 8px;">スポンサー枠</span>
        <div style="font-weight: bold; font-size: 15px; color: #333; margin-bottom: 6px;">広告主募集中</div>
        <div style="font-size: 12px; color: #666; line-height: 1.5; margin-bottom: 12px;">
            ここにショップのHP情報や、販売個体の値段掲載などが可能です。<br>
            詳細をご希望のショップ様は運営までご連絡ください。
        </div>
        <a href="https://nakano2835.com/contact/" target="_blank" rel="noopener noreferrer"
            style="display: inline-block; text-decoration: none; background: #fff; border: 1px solid #ccc; color: #555; padding: 6px 16px; border-radius: 20px; font-size: 12px; cursor: pointer; font-weight: bold;">
            お問い合わせ
        </a>
    </div>

    <!-- Community Gallery -->
    <div class="setae-card">
        <h4 style="margin-top:0;"><?php esc_html_e('Best Shots Gallery', 'setae-core'); ?></h4>
        <div id="enc-gallery-grid" style="display:grid; grid-template-columns:repeat(3, 1fr); gap:4px;">
            <!-- JS Populated -->
        </div>
        <p id="enc-gallery-empty" style="text-align:center; color:#ccc; font-size:12px; display:none;">
            <?php esc_html_e('No community photos yet.', 'setae-core'); ?>
        </p>
    </div>
</div>