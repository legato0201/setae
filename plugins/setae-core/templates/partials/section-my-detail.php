<?php
/**
 * Partial: My Spiders Detail View
 */
?>
<div id="section-my-detail" class="setae-section" style="display: none;">
    <header class="setae-detail-topbar">
        <button type="button" class="setae-detail-icon-button" id="btn-back-to-list" aria-label="個体一覧に戻る">
            <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="m15 18-6-6 6-6"></path>
            </svg>
        </button>

        <div class="setae-detail-title">
            <span>マイ個体</span>
            <strong id="detail-topbar-title">個体カルテ</strong>
        </div>

        <div class="setae-detail-topbar-actions">
            <div id="setae-detail-primary-actions"></div>
            <button type="button" id="btn-detail-favorite" class="setae-detail-icon-button" aria-label="お気に入りに追加" title="お気に入り">
                <svg viewBox="0 0 24 24" aria-hidden="true">
                    <path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2-5.6-2.9-5.6 2.9 1.1-6.2L3 9.6l6.2-.9Z"></path>
                </svg>
            </button>
            <button type="button" id="btn-edit-spider-trigger" class="setae-detail-icon-button" aria-label="個体情報を編集" title="個体情報を編集">
                <svg viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M12 20h9"></path>
                    <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4Z"></path>
                </svg>
            </button>
        </div>
    </header>

    <section class="setae-spider-hero" aria-labelledby="detail-spider-name">
        <div id="detail-hero-backdrop" class="hero-backdrop" role="img" aria-label="個体の写真"></div>
        <div class="hero-content">
            <div class="detail-hero-summary">
                <div class="hero-info">
                    <span id="detail-spider-id-badge" class="spider-badge-id">#--</span>
                    <h1 id="detail-spider-name">読み込み中...</h1>
                    <p id="detail-spider-species" class="species-name">-</p>
                    <div id="detail-hero-tags" class="detail-hero-tags" aria-label="個体プロフィール"></div>
                    <dl id="detail-hero-facts" class="detail-hero-facts"></dl>
                </div>
                <dl class="detail-hero-stats" aria-label="個体の現在状況">
                    <div class="detail-hero-stat">
                        <dt id="detail-hero-feed-label">最終給餌</dt>
                        <dd id="detail-hero-feed">-</dd>
                    </div>
                    <div class="detail-hero-stat">
                        <dt id="detail-hero-molt-label">最終脱皮</dt>
                        <dd id="detail-hero-molt">-</dd>
                    </div>
                    <div class="detail-hero-stat detail-hero-stat--status">
                        <dt>現在の状態</dt>
                        <dd id="detail-hero-status">-</dd>
                    </div>
                </dl>
            </div>
            <aside id="detail-health-meter" class="detail-health-meter" aria-label="ケアコンディション"></aside>
        </div>
    </section>

    <div class="setae-detail-command-bar">
        <div class="setae-detail-tabs" role="tablist" aria-label="個体カルテの表示">
            <button type="button" id="detail-tab-overview" class="tab-btn active" role="tab" aria-selected="true" aria-controls="tab-overview" tabindex="0"
                data-target="tab-overview"><?php esc_html_e('カルテ', 'setae-core'); ?></button>
            <button type="button" id="detail-tab-history" class="tab-btn" role="tab" aria-selected="false" aria-controls="tab-history" tabindex="-1"
                data-target="tab-history"><?php esc_html_e('すべての記録', 'setae-core'); ?></button>
            <button type="button" class="tab-btn" role="tab" aria-selected="false"
                id="btn-tab-settings" aria-controls="tab-settings" data-target="tab-settings" tabindex="-1"
                style="display:none;"><?php esc_html_e('設定', 'setae-core'); ?></button>
        </div>

        <div id="setae-detail-nav" class="setae-detail-nav" aria-label="個体を切り替える" style="display:none;">
            <button type="button" class="setae-detail-nav-btn js-detail-nav" data-direction="prev" aria-label="前の個体">
                <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m15 18-6-6 6-6"></path></svg>
                <strong>前</strong>
            </button>
            <span id="setae-detail-nav-position" class="setae-detail-nav-position"></span>
            <button type="button" class="setae-detail-nav-btn js-detail-nav" data-direction="next" aria-label="次の個体">
                <strong>次</strong>
                <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9 18 6-6-6-6"></path></svg>
            </button>
        </div>
    </div>

    <div class="setae-detail-container">
        <div id="tab-overview" class="detail-tab-content active" role="tabpanel" aria-labelledby="detail-tab-overview"></div>
        <div id="tab-history" class="detail-tab-content" role="tabpanel" aria-labelledby="detail-tab-history" style="display:none;"></div>
        <div id="tab-settings" class="detail-tab-content" role="tabpanel" aria-labelledby="btn-tab-settings" style="display:none;"></div>
    </div>
</div>
