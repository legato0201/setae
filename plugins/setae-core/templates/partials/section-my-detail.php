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

    <div class="setae-detail-container">

        <div class="status-grid">
            <div class="status-item">
                <span class="status-label"><?php esc_html_e('Last Molt', 'setae-core'); ?></span>
                <strong id="detail-spider-molt">2026-01-31</strong>
            </div>
            <div class="status-item">
                <span class="status-label"><?php esc_html_e('Last Feed', 'setae-core'); ?></span>
                <strong id="detail-spider-feed">2026-01-31</strong>
            </div>
            <div class="status-item">
                <span class="status-label"><?php esc_html_e('Cycle', 'setae-core'); ?></span>
                <strong><?php esc_html_e('Normal', 'setae-core'); ?></strong>
            </div>
        </div>

        <div class="setae-grid-dashboard">
            <div class="setae-card dashboard-card">
                <h4><?php esc_html_e('Growth Log', 'setae-core'); ?></h4>
                <div class="chart-container">
                    <canvas id="growthChart"></canvas>
                </div>
            </div>
            <div class="setae-card dashboard-card">
                <h4><?php esc_html_e('Prey Preferences', 'setae-core'); ?></h4>
                <div class="chart-container">
                    <canvas id="preyChart"></canvas>
                </div>
            </div>
        </div>

        <div class="setae-card section-calendar">
            <div class="card-header-flex">
                <h4><?php esc_html_e('Log Calendar', 'setae-core'); ?></h4>
                <div class="cal-nav">
                    <button id="cal-prev">&lt;</button>
                    <span id="cal-month-label">2026.1</span>
                    <button id="cal-next">&gt;</button>
                </div>
            </div>
            <div id="setae-calendar" class="setae-calendar-grid">
            </div>
            <button id="btn-add-log"
                class="setae-btn-floating"><?php esc_html_e('+ Record', 'setae-core'); ?></button>
        </div>

        <div class="setae-timeline-section">
            <h4><?php esc_html_e('History Timeline', 'setae-core'); ?></h4>
            <div id="setae-log-list" class="timeline-container">
            </div>
            <div id="log-sentinel"></div>
        </div>
    </div>
</div>