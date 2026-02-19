<?php
/**
 * Partial: My Spiders Detail View
 */
?>
<div id="section-my-detail" class="setae-section" style="display: none;">

    <div class="setae-spider-hero">
        <div id="detail-hero-backdrop" class="hero-backdrop"
            style="background-image: url('https://setae.net/wp-content/uploads/2026/01/IMG_1629-scaled.jpeg');">
        </div>
        <div class="hero-content">
            <div class="hero-top-bar">
                <button class="setae-btn-icon-glass" id="btn-back-to-list">←</button>
                <button id="btn-edit-spider-trigger" class="setae-btn-icon-glass">✎</button>
            </div>
            <div class="hero-info">
                <span id="detail-spider-id-badge" class="spider-badge-id">#22</span>
                <h2 id="detail-spider-name">aaaaa</h2>
                <p id="detail-spider-species" class="species-name">Typhochlaena seladonia</p>
            </div>
        </div>
    </div>

    <div class="setae-detail-tabs">
        <button class="tab-btn active"
            data-target="tab-overview"><?php esc_html_e('Overview', 'setae-core'); ?></button>
        <button class="tab-btn" data-target="tab-history"><?php esc_html_e('History', 'setae-core'); ?></button>
        <button class="tab-btn" id="btn-tab-settings" data-target="tab-settings"
            style="display:none;"><?php esc_html_e('Settings / BL', 'setae-core'); ?></button>
    </div>

    <div class="setae-detail-container">
        <div id="tab-overview" class="detail-tab-content active"></div>
        <div id="tab-history" class="detail-tab-content" style="display:none;"></div>
        <div id="tab-settings" class="detail-tab-content" style="display:none;"></div>
    </div>
</div>