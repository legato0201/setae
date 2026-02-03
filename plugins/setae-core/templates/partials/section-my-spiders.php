<?php
/**
 * Partial: My Spiders Section
 */
?>
<div id="section-my" class="setae-section">
    <!-- Advanced Control Bar -->
    <div class="setae-toolbar-container">
        <div class="setae-toolbar-header">
            <div class="setae-search-wrapper">
                <svg class="search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                    <circle cx="11" cy="11" r="8"></circle>
                    <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                </svg>
                <input type="text" id="setae-spider-search" class="setae-search-input" placeholder="検索...">
            </div>

            <div class="setae-actions">
                <button id="btn-sort-menu" class="setae-icon-btn" aria-label="並び替え">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M4 6h16M4 12h10M4 18h7"></path>
                    </svg>
                </button>
                <button id="btn-add-spider" class="setae-add-btn" aria-label="新規追加">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
                        <line x1="12" y1="5" x2="12" y2="19"></line>
                        <line x1="5" y1="12" x2="19" y2="12"></line>
                    </svg>
                    <span>追加</span>
                </button>
            </div>
        </div>

        <div class="setae-decks-scroll">
            <button class="deck-pill active" data-deck="all">
                すべて <span class="count-badge">0</span>
            </button>
            <button class="deck-pill" data-deck="hungry">
                <span class="pill-icon">🦗</span> 空腹 <span class="count-badge">0</span>
            </button>
            <button class="deck-pill" data-deck="pre_molt">
                <span class="pill-icon">⚠️</span> 脱皮前 <span class="count-badge">0</span>
            </button>
            <button class="deck-pill" data-deck="sling">
                <span class="pill-icon">👶</span> 幼体 <span class="count-badge">0</span>
            </button>
        </div>
    </div>

    <!-- Sort Dropdown (Handled by CSS/JS) -->
    <div id="setae-sort-dropdown" style="display: none;">
        <div class="sort-option active" data-sort="hungriest">🍽 空腹順 (Hungriest)</div>
        <div class="sort-option" data-sort="molt_oldest">🧬 脱皮日が古い順</div>
        <div class="sort-option" data-sort="name_asc">🔤 名前順 (A-Z)</div>
    </div>

    <div id="setae-spider-list" class="setae-list-container" style="opacity: 1;">
        <!-- JS Populated -->
    </div>

    <!-- Kanban Board Container -->
    <div id="setae-spider-kanban" class="setae-kanban-board"
        style="display:none; overflow-x:auto; padding-bottom:20px;">
        <!-- Columns injected via JS -->
    </div>
</div>