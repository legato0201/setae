<?php
// My Spiders Section
?>
<div id="section-my" class="setae-section" style="display:none;">
    <div class="setae-desktop-wrapper">
        <div class="setae-fixed-header-group">
            <!-- Collapsing Header Title -->
            <div class="setae-header-area" style="padding: 20px 16px 10px;">
                <h2 style="margin:0; font-size:28px; font-weight:800;">My Spiders</h2>
            </div>

            <!-- Advanced Control Bar (Modern) -->
            <div class="setae-toolbar-container">

                <div class="setae-toolbar-top">
                    <div class="setae-search-wrapper">
                        <span class="search-icon">🔍</span>
                        <input type="text" id="setae-spider-search" class="setae-search-input"
                            placeholder="名前や種類で検索...">
                    </div>

                    <button id="btn-sort-menu" class="setae-icon-btn">
                        <!-- Premium Sort Icon (SVG) -->
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                            stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <line x1="21" y1="10" x2="3" y2="10"></line>
                            <line x1="21" y1="6" x2="3" y2="6"></line>
                            <line x1="21" y1="14" x2="3" y2="14"></line>
                            <line x1="21" y1="18" x2="3" y2="18"></line>
                        </svg>
                    </button>

                    <!-- Sort Dropdown removed (Moved to JS Portal) -->

                    <button id="btn-add-spider" class="setae-icon-btn btn-accent">
                        +
                    </button>
                </div>

                <div class="setae-decks-scroll">
                    <button class="deck-pill active" data-deck="all">
                        すべて <span class="count-badge">...</span>
                    </button>

                    <button class="deck-pill" data-deck="hungry">
                        🦗 空腹 <span class="count-badge">0</span>
                    </button>

                    <button class="deck-pill" data-deck="pre_molt">
                        ⚠️ 脱皮前 <span class="count-badge">0</span>
                    </button>

                    <button class="deck-pill" data-deck="sling">
                        👶 幼体 <span class="count-badge">0</span>
                    </button>
                </div>
                <!-- Sort Dropdown removed (Handled by JS Portal) -->

                <div id="my-spiders-list" class="setae-grid">
                    <!-- Spiders inserted here via JS -->
                    <div class="setae-card loading-state">
                        <p>読み込み中...</p>
                    </div>
                </div>
                <!-- Theme Compatibility -->
                <div id="setae-spider-list" class="setae-grid"></div>
            </div> <!-- End Scrollable List Group -->
        </div> <!-- End Desktop Wrapper -->
    </div> <!-- End Section My -->
</div>