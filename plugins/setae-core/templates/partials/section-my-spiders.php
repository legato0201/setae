<?php
/**
 * Partial: My Spiders Section
 */
?>
<div id="section-my" class="setae-section">
    <header class="setae-my-hub-header">
        <div class="setae-my-hub-title">
            <h1>個体一覧</h1>
            <span class="setae-my-hub-kicker">飼育中の個体をひと目で管理</span>
        </div>
        <button type="button" id="btn-add-spider" class="setae-add-btn" aria-label="個体を追加">
            <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M12 5v14M5 12h14"></path>
            </svg>
            <span>個体を追加</span>
        </button>
    </header>

    <div class="setae-my-tool-switch" role="tablist" aria-label="マイ個体の表示">
        <button type="button" class="setae-my-tool-tab is-active" role="tab" aria-selected="true"
            aria-controls="setae-my-collection-pane" data-my-tool="collection">
            飼育一覧 <span id="my-tool-active-count" class="setae-my-tool-count">0</span>
        </button>
        <button type="button" class="setae-my-tool-tab" role="tab" aria-selected="false"
            aria-controls="setae-my-archive-pane" data-my-tool="archive">
            アーカイブ <span id="my-tool-archive-count" class="setae-my-tool-count">0</span>
        </button>
        <button type="button" class="setae-my-tool-tab" role="tab" aria-selected="false"
            aria-controls="setae-feeder-pane" data-my-tool="feeders">
            餌管理 <span id="my-tool-feeder-alert" class="setae-my-tool-alert" hidden></span>
        </button>
    </div>

    <div id="setae-my-collection-pane" class="setae-my-tool-pane" role="tabpanel">
    <aside id="setae-my-desktop-dashboard" class="setae-my-desktop-dashboard" aria-label="飼育ダッシュボード"></aside>

    <div class="setae-toolbar-container">
        <div class="setae-toolbar-header">
            <div class="setae-search-wrapper">
                <svg class="search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                    <circle cx="11" cy="11" r="8"></circle>
                    <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                </svg>
                <label for="setae-spider-search" class="setae-visually-hidden">個体名または種類で検索</label>
                <input type="search" id="setae-spider-search" class="setae-search-input" placeholder="個体名・種類・IDで検索" enterkeyhint="search" autocomplete="off">
            </div>

            <div class="setae-actions">
                <button type="button" id="btn-my-filter-toggle" class="setae-icon-btn setae-my-filter-toggle" aria-label="絞り込み条件を表示" title="絞り込み" aria-controls="setae-my-filter-decks" aria-expanded="true">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                        <path d="M4 5h16l-6 7v5l-4 2v-7Z"></path>
                    </svg>
                    <span>絞り込み</span>
                </button>
                <button type="button" id="btn-qr-manager" class="setae-qr-launch-btn" aria-label="QRラベルと読み取りを開く" title="QR管理">
                    <svg class="setae-qr-launch-mark" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                        <rect width="5" height="5" x="3" y="3" rx="1"></rect>
                        <rect width="5" height="5" x="16" y="3" rx="1"></rect>
                        <rect width="5" height="5" x="3" y="16" rx="1"></rect>
                        <path d="M21 16h-3a2 2 0 0 0-2 2v3"></path>
                        <path d="M21 21v.01"></path><path d="M12 7v3a2 2 0 0 1-2 2H7"></path>
                        <path d="M3 12h.01"></path><path d="M12 3h.01"></path><path d="M12 16v.01"></path>
                        <path d="M16 12h1"></path><path d="M21 12v.01"></path><path d="M12 21v-1"></path>
                    </svg>
                    <span>QR</span>
                    <i id="setae-qr-notification-badge" hidden></i>
                </button>
                <button type="button" id="btn-sort-menu" class="setae-icon-btn" aria-label="並び替え" title="並び替え" aria-haspopup="menu" aria-expanded="false">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                        <path d="M4 6h16M4 12h10M4 18h7"></path>
                    </svg>
                    <span>並び替え</span>
                </button>
            </div>
        </div>

        <div id="setae-my-filter-decks" class="setae-decks-scroll">
            <button type="button" class="deck-pill active" data-deck="all">
                <?php esc_html_e('すべて', 'setae-core'); ?> <span class="count-badge">0</span>
            </button>
            <button type="button" class="deck-pill" data-deck="hungry">
                <?php esc_html_e('空腹', 'setae-core'); ?> <span class="count-badge">0</span>
            </button>
            <button type="button" class="deck-pill" data-deck="pre_molt">
                <?php esc_html_e('脱皮前', 'setae-core'); ?> <span class="count-badge">0</span>
            </button>
            <button type="button" class="deck-pill" data-deck="attention">
                <?php esc_html_e('要確認', 'setae-core'); ?> <span class="count-badge">0</span>
            </button>
            <button type="button" class="deck-pill" data-deck="favorite">
                <?php esc_html_e('お気に入り', 'setae-core'); ?> <span class="count-badge">0</span>
            </button>

            <?php
            // setae_classification タクソノミーを取得してボタンを動的生成
            $classifications = get_terms(array(
                'taxonomy' => 'setae_classification',
                'hide_empty' => false,
            ));

            // タームメタの並び順(_setae_term_order)でソート
            if (!is_wp_error($classifications) && !empty($classifications)) {
                usort($classifications, function ($a, $b) {
                    $order_a = (int) get_term_meta($a->term_id, '_setae_term_order', true);
                    $order_b = (int) get_term_meta($b->term_id, '_setae_term_order', true);
                    return $order_a <=> $order_b;
                });

                foreach ($classifications as $term) {
                    $icon = !empty($term->description) ? strip_tags($term->description) : '📦';
                    ?>
                    <button type="button" class="deck-pill" data-deck="cat_<?php echo esc_attr($term->slug); ?>" style="display:none;">
                        <span class="pill-icon"><?php echo esc_html($icon); ?></span>
                        <?php echo esc_html($term->name); ?> <span class="count-badge">0</span>
                    </button>
                    <?php
                }
            }
            ?>
        </div>
    </div>

    <div class="setae-my-workspace">
        <div class="setae-my-main">
            <div id="setae-today-check" class="setae-today-check" style="display:none;"></div>
            <div id="setae-species-pulse" class="setae-species-pulse" style="display:none;"></div>
            <div id="setae-continue-panel" class="setae-continue-panel" style="display:none;"></div>

            <div id="setae-spider-list" class="setae-list-container" style="opacity: 1;">
                <!-- JS Populated -->
            </div>

            <!-- Kanban Board Container -->
            <div id="setae-spider-kanban" class="setae-kanban-board"
                style="display:none; overflow-x:auto; padding-bottom:20px;">
                <!-- Columns injected via JS -->
            </div>
        </div>
    </div>
    </div>

    <div id="setae-my-archive-pane" class="setae-my-tool-pane" role="tabpanel" hidden>
        <div class="setae-archive-workspace">
            <header class="setae-archive-header">
                <div>
                    <span class="setae-section-kicker">COLLECTION</span>
                    <h2>アーカイブ</h2>
                </div>
                <label class="setae-archive-search">
                    <span class="screen-reader-text">アーカイブを検索</span>
                    <svg viewBox="0 0 24 24" aria-hidden="true">
                        <circle cx="11" cy="11" r="7"></circle>
                        <path d="m20 20-4-4"></path>
                    </svg>
                    <input type="search" id="setae-archive-search" placeholder="名前・種類で検索">
                </label>
            </header>
            <div id="setae-archive-summary" class="setae-archive-summary" aria-live="polite"></div>
            <div id="setae-archive-list" class="setae-archive-list" aria-live="polite">
                <div class="setae-tool-loading">アーカイブを読み込んでいます</div>
            </div>
        </div>
    </div>

    <div id="setae-feeder-pane" class="setae-my-tool-pane" role="tabpanel" hidden>
        <div id="setae-feeder-app" class="setae-feeder-app" aria-live="polite">
            <div class="setae-tool-loading">餌管理を読み込んでいます</div>
        </div>
    </div>
</div>
