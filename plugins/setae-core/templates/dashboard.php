<?php
// Main Dashboard Template
?>
<div id="setae-app">
    <!-- App Header -->
    <div class="setae-header">
        <div class="setae-logo">SETAE</div>
        <div class="setae-user-actions" id="setae-profile-trigger">
            <span id="header-user-name"><?php echo esc_html(wp_get_current_user()->display_name); ?></span>
            <?php echo get_avatar(get_current_user_id(), 32, '', 'Profile', array('class' => 'header-user-icon')); ?>
        </div>
    </div>

    <!-- Navigation -->
    <div class="setae-nav">
        <div class="setae-nav-item" data-target="section-enc">
            <span class="setae-nav-icon">📖</span> <span class="setae-nav-label">図鑑</span>
        </div>
        <div class="setae-nav-item active" data-target="section-my">
            <span class="setae-nav-icon">🕷️</span> <span class="setae-nav-label">My Spiders</span>
        </div>
        <div class="setae-nav-item" data-target="section-bl">
            <span class="setae-nav-icon">🤝</span> <span class="setae-nav-label">BL Match</span>
        </div>
        <div class="setae-nav-item" data-target="section-com">
            <span class="setae-nav-icon">💬</span> <span class="setae-nav-label">Community</span>
        </div>
    </div>

    <!-- Main Content -->
    <div class="setae-content">

        <!-- Encyclopedia Section -->
        <div id="section-enc" class="setae-section" style="display: none;">
            <div class="setae-card">
                <h3>Encyclopedia</h3>
                <div class="setae-toolbar">
                    <input type="text" id="setae-species-search" placeholder="種名・属名で検索...">
                </div>
            </div>

            <div id="setae-species-grid" class="setae-grid" style="opacity: 1;">
                <!-- JS Populated -->
            </div>
        </div>

        <!-- My Spiders Section -->
        <div id="section-my" class="setae-section">
            <!-- Advanced Control Bar -->
            <div class="setae-toolbar-container">
                <div class="setae-toolbar-header">
                    <div class="setae-search-wrapper">
                        <svg class="search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                            stroke-width="2.5">
                            <circle cx="11" cy="11" r="8"></circle>
                            <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                        </svg>
                        <input type="text" id="setae-spider-search" class="setae-search-input" placeholder="検索...">
                    </div>

                    <div class="setae-actions">
                        <button id="btn-sort-menu" class="setae-icon-btn" aria-label="並び替え">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                                stroke-width="2">
                                <path d="M4 6h16M4 12h10M4 18h7"></path>
                            </svg>
                        </button>
                        <button id="btn-add-spider" class="setae-add-btn" aria-label="新規追加">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                                stroke-width="3">
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

        <!-- My Spiders Detail Section (Hidden by Default) -->
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
                        <span class="status-label">Last Molt</span>
                        <strong id="detail-spider-molt">2026-01-31</strong>
                    </div>
                    <div class="status-item">
                        <span class="status-label">Last Feed</span>
                        <strong id="detail-spider-feed">2026-01-31</strong>
                    </div>
                    <div class="status-item">
                        <span class="status-label">Cycle</span>
                        <strong>Normal</strong>
                    </div>
                </div>

                <div class="setae-grid-dashboard">
                    <div class="setae-card dashboard-card">
                        <h4>Growth Log</h4>
                        <div class="chart-container">
                            <canvas id="growthChart"></canvas>
                        </div>
                    </div>
                    <div class="setae-card dashboard-card">
                        <h4>Prey Preferences</h4>
                        <div class="chart-container">
                            <canvas id="preyChart"></canvas>
                        </div>
                    </div>
                </div>

                <div class="setae-card section-calendar">
                    <div class="card-header-flex">
                        <h4>Log Calendar</h4>
                        <div class="cal-nav">
                            <button id="cal-prev">&lt;</button>
                            <span id="cal-month-label">2026.1</span>
                            <button id="cal-next">&gt;</button>
                        </div>
                    </div>
                    <div id="setae-calendar" class="setae-calendar-grid">
                    </div>
                    <button id="btn-add-log" class="setae-btn-floating">+ Record</button>
                </div>

                <div class="setae-timeline-section">
                    <h4>History Timeline</h4>
                    <div id="setae-log-list" class="timeline-container">
                    </div>
                    <div id="log-sentinel"></div>
                </div>
            </div>
        </div>

        <!-- BL Match Section -->
        <div id="section-bl" class="setae-section" style="display:none;">
            <div class="setae-card">
                <h3>Breeding Loan Match</h3>
                <div class="setae-toolbar" style="margin-top:10px;">
                    <button class="setae-btn-sm active" id="btn-bl-board">募集中</button>
                    <button class="setae-btn-sm" id="btn-bl-contracts">契約管理</button>
                </div>
            </div>

            <div id="bl-board-view">
                <div id="setae-bl-grid" class="setae-grid">
                    <!-- JS Populated -->
                </div>
            </div>

            <div id="bl-contracts-view" style="display:none;">
                <div id="setae-contracts-list">
                    <!-- JS Populated -->
                </div>
            </div>
        </div>

        <!-- Community Section (Master View) -->
        <div id="section-com" class="setae-section" style="display:none;">
            <div class="setae-header-bar"
                style="display:flex; justify-content:space-between; align-items:center; margin-bottom:15px; padding:0 5px;">
                <h3 style="margin:0;">Community</h3>
                <button class="setae-btn setae-btn-primary" id="btn-create-topic"
                    style="border-radius:20px; padding:6px 15px; font-size:13px;">+ New</button>
            </div>

            <div id="setae-topic-list">
                <div class="setae-card">
                    <p style="text-align:center;">読み込み中...</p>
                </div>
            </div>
        </div>

        <!-- Community Detail Section (Detail View) -->
        <div id="section-com-detail" class="setae-section" style="display:none;">
            <div class="setae-header-bar"
                style="display:flex; align-items:center; margin-bottom:15px; border-bottom:1px solid #eee; padding-bottom:10px;">
                <button class="setae-btn-text" id="btn-back-to-topics"
                    style="margin-right:15px; font-size:18px; color:var(--setae-primary); border:none; background:none; cursor:pointer;">
                    ← Back
                </button>
                <h4 style="margin:0; flex-grow:1; text-align:center;" id="detail-header-title">Topic</h4>
                <div style="width:50px;"></div> <!-- Spacer for center alignment -->
            </div>

            <div id="topic-detail-content">
                <!-- Loaded via JS -->
            </div>

            <div id="topic-comments-list" class="setae-post-container">
                <!-- Comments loaded here -->
            </div>

            <form id="setae-comment-form"
                style="margin-top:20px; display:flex; gap:10px; background:rgba(255,255,255,0.5); padding:10px; border-radius:12px; border:1px solid rgba(255,255,255,0.3);">
                <input type="hidden" id="comment-post-id">
                <input type="text" id="comment-content" class="setae-input" placeholder="投稿内容を入力..." required=""
                    style="border:none; background:transparent; box-shadow:none; flex-grow:1;">
                <button type="submit" class="setae-btn-sm"
                    style="background:var(--setae-primary); color:#fff; border:none; border-radius:6px; padding:0 15px; flex-shrink:0;">書き込む</button>
            </form>
        </div>

    </div> <!-- Close .setae-content -->
</div> <!-- Close #setae-app -->

<!-- Modals (Moved to Root) -->
<div id="setae-profile-modal" class="setae-modal" style="display:none;">
    <div class="setae-modal-content">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:20px;">
            <h3 style="margin:0;">Profile Settings</h3>
            <div class="setae-profile-avatar" id="profile-avatar-preview-container"
                style="width:60px; height:60px; border-radius:50%; overflow:hidden; border:2px solid #00ffcc; position:relative;">
                <?php echo get_avatar(get_current_user_id(), 60); ?>
            </div>
        </div>

        <form id="setae-profile-form">
            <div class="setae-form-group">
                <label>Display Name</label>
                <input type="text" id="prof-display-name" class="setae-input"
                    value="<?php echo esc_attr(wp_get_current_user()->display_name); ?>">
            </div>
            <div class="setae-form-group">
                <label>Icon Photo</label>
                <!-- Hidden Input -->
                <input type="file" id="prof-icon" accept="image/*" style="display:none;">
                <!-- Custom Button -->
                <button type="button" id="btn-trigger-prof-upload" class="setae-btn-upload" style="width:100%;">
                    📸 写真を変更
                </button>
            </div>
            <div class="setae-form-group">
                <label>Email Address</label>
                <input type="email" id="prof-email" class="setae-input"
                    value="<?php echo esc_attr(wp_get_current_user()->user_email); ?>">
            </div>
            <div class="setae-form-group">
                <label>New Password (empty to keep current)</label>
                <input type="password" id="prof-password" class="setae-input" placeholder="********">
            </div>
            <div class="setae-form-actions" style="margin-top:25px;">
                <button type="button" class="setae-btn setae-btn-secondary" id="setae-logout-btn"
                    style="margin-right:auto; color:#ff4d4d; border-color:rgba(255,77,77,0.3);">Logout</button>
                <button type="button" class="setae-btn setae-btn-secondary" id="close-profile-modal">Close</button>
                <button type="submit" class="setae-btn setae-btn-primary">Save Changes</button>
            </div>
        </form>
    </div>
</div>

<!-- Edit Spider Modal -->
<!-- Edit Spider Modal -->
<div id="modal-edit-spider" class="setae-modal" style="display:none;">
    <div class="setae-modal-content">
        <span class="setae-close" id="close-edit-spider">×</span>
        <h3>個体情報の編集</h3>
        <form id="form-edit-spider">
            <input type="hidden" id="edit-spider-id">
            <div class="setae-form-group">
                <label>写真更新 (任意)</label>
                <div class="setae-file-upload-wrapper">
                    <input type="file" id="edit-spider-image" accept="image/*" style="display:none;">
                    <button type="button" id="btn-trigger-edit-upload" class="setae-btn-upload">
                        📸 写真を変更
                    </button>
                    <div id="edit-spider-image-preview" class="image-preview-area" style="display:none;">
                        <img id="edit-preview-img-tag" src=""
                            style="width:100%; border-radius:8px; height:150px; object-fit:cover;">
                        <button type="button" id="btn-remove-edit-image" class="remove-image-btn">×</button>
                    </div>
                </div>
            </div>
            <div class="setae-form-group">
                <label>種類 (Species)</label>
                <select id="edit-spider-species-select" required="" class="setae-input">
                    <option value="">選択してください...</option>
                </select>
            </div>
            <div class="setae-form-group">
                <label>ニックネーム</label>
                <input type="text" id="edit-spider-name" class="setae-input" placeholder="Name/ID">
            </div>
            <div class="setae-form-actions setae-modal-footer-split">
                <button type="button" id="btn-delete-spider" class="setae-btn-text-danger">
                    🗑️ 削除
                </button>
                <div style="display:flex; gap:10px;">
                    <button type="button" class="setae-btn setae-btn-secondary"
                        id="close-edit-spider-btn">キャンセル</button>
                    <button type="submit" class="setae-btn setae-btn-primary">保存</button>
                </div>
            </div>
        </form>
    </div>
</div>

<!-- Add Spider Modal -->
<div id="modal-add-spider" class="setae-modal" style="display:none;">
    <div class="setae-modal-content">
        <span class="setae-close">×</span>
        <h3>新規個体登録</h3>
        <form id="form-add-spider">
            <div class="setae-form-group">
                <label>写真 (任意)</label>
                <div class="setae-file-upload-wrapper">
                    <input type="file" id="spider-image" accept="image/*" style="display:none;">
                    <button type="button" id="btn-trigger-upload-add" class="setae-btn"
                        style="width:100%; border:2px dashed #ccc; background:#fafafa; color:#888; padding:15px; margin-top:5px;">
                        📸 写真を選択
                    </button>
                    <div id="spider-image-preview" style="display:none; margin-top:10px; position:relative;">
                        <img id="preview-img-tag-add" src=""
                            style="width:100%; border-radius:8px; height:150px; object-fit:cover;">
                        <button type="button" id="btn-remove-image-add"
                            style="position:absolute; top:5px; right:5px; background:rgba(0,0,0,0.6); color:#fff; border:none; border-radius:50%; width:24px; height:24px; cursor:pointer;">×</button>
                    </div>
                </div>
            </div>
            <div class="setae-form-group">
                <label>種類 (Species)</label>
                <div class="setae-autocomplete-wrapper" style="position:relative;">
                    <input type="text" id="spider-species-search" class="setae-input" placeholder="学名・和名を入力..."
                        autocomplete="off">
                    <input type="hidden" id="spider-species-select">
                    <div id="spider-species-suggestions"
                        style="position:absolute; top:100%; left:0; right:0; background:#fff; border:1px solid #ddd; max-height:200px; overflow-y:auto; z-index:1000; display:none; border-radius:0 0 8px 8px; box-shadow:0 4px 6px rgba(0,0,0,0.1);">
                    </div>
                </div>
            </div>
            <div class="setae-form-group">
                <label>ニックネーム (任意)</label>
                <input type="text" id="spider-name" placeholder="Name/ID" class="setae-input">
            </div>
            <div class="setae-form-group">
                <label>最終脱皮日</label>
                <input type="date" id="spider-last-molt" class="setae-input">
            </div>
            <div class="setae-form-group">
                <label>最終給餌日</label>
                <input type="date" id="spider-last-feed" class="setae-input">
            </div>
            <button type="submit" class="setae-btn setae-btn-primary">登録</button>
        </form>
    </div>
</div>

<!-- Create Topic Modal -->
<div id="setae-create-topic-modal" class="setae-modal" style="display:none;">
    <div class="setae-modal-content">
        <span class="setae-close" id="close-topic-modal">×</span>
        <h3>新規トピック</h3>
        <form id="setae-topic-form">
            <div class="setae-form-group">
                <label>タイトル</label>
                <input type="text" id="topic-title" class="setae-input" required="">
            </div>
            <div class="setae-form-group">
                <label>内容</label>
                <textarea id="topic-content" class="setae-input" rows="5" required=""></textarea>
            </div>
            <button type="submit" class="setae-btn setae-btn-primary">投稿</button>
        </form>
    </div>
</div>

<!-- QR Code Modal -->
<div id="setae-qr-modal" class="setae-modal" style="display:none;">
    <div class="setae-modal-content" style="text-align:center;">
        <span class="setae-close" id="close-qr-modal">×</span>
        <h3>QR Code</h3>
        <p id="setae-qr-label" style="margin-bottom:15px; font-weight:bold;"></p>
        <div id="setae-qrcode-target" style="display:inline-block; margin:auto;"></div>
    </div>
</div>

<!-- Manage Feed Types Modal -->
<div id="setae-manage-feed-modal" class="setae-modal" style="display:none; z-index:10002;">
    <div class="setae-modal-content">
        <span class="setae-close" id="close-manage-feed-modal">×</span>
        <h3>餌リストの編集</h3>
        <div id="feed-type-list"
            style="margin-bottom:15px; max-height:200px; overflow-y:auto; border:1px solid #eee; padding:5px; border-radius:8px;">
            <!-- JS Populated -->
        </div>
        <div style="display:flex; gap:5px;">
            <input type="text" id="new-feed-type" class="setae-input" placeholder="新しい餌の名前 (例: 🪳 デュビア)">
            <button type="button" id="btn-add-feed-type" class="setae-btn setae-btn-primary"
                style="white-space:nowrap;">追加</button>
        </div>
    </div>
</div>

<!-- Add Log Modal (Compact Design) -->
<div id="setae-log-modal" class="setae-modal" style="display:none;">
    <div class="setae-modal-content compact-mode">
        <span class="setae-close" id="close-log-modal">×</span>
        <h3 class="modal-title">記録を追加</h3>

        <form id="setae-log-form">
            <input type="hidden" id="log-spider-id">

            <div class="form-row-top">
                <div class="setae-form-group date-group">
                    <label><img src="https://s.w.org/images/core/emoji/17.0.2/svg/1f4c5.svg" class="label-icon">
                        日付</label>
                    <input type="date" id="log-date" class="setae-input-sm" required>
                </div>
                <div class="setae-form-group type-group">
                    <label>イベントタイプ</label>
                    <input type="hidden" id="log-type" value="feed">
                    <div class="log-type-grid-sm">
                        <button type="button" class="type-btn-sm active" data-val="feed" title="Feed">🦗</button>
                        <button type="button" class="type-btn-sm" data-val="molt" title="Molt">🧬</button>
                        <button type="button" class="type-btn-sm" data-val="growth" title="Growth">📏</button>
                        <button type="button" class="type-btn-sm" data-val="note" title="Note">📝</button>
                    </div>
                </div>
            </div>

            <div class="options-container" style="display: block;">
                <div id="log-feed-options" class="log-option-group">
                    <div class="option-header">
                        <label>餌 (Prey)</label>
                        <button type="button" id="btn-manage-feed-types" class="btn-text-only">⚙️ 編集</button>
                    </div>
                    <input type="hidden" id="log-feed-prey-select" value="Dubia (デュビア)">
                    <div id="log-feed-prey-buttons" class="prey-chip-container">
                        <!-- JS Populated -->
                    </div>
                    <div class="setae-checkbox-group-sm">
                        <label><input type="checkbox" id="log-feed-refused"> <span>拒食 (Refused)</span></label>
                    </div>
                </div>

                <div id="log-growth-options" class="log-option-group" style="display:none;">
                    <label>サイズ (cm / Instar)</label>
                    <input type="text" id="log-size" class="setae-input-sm" placeholder="e.g. 5cm">
                </div>
            </div>

            <div class="form-row-bottom">
                <div class="setae-form-group memo-group">
                    <textarea id="log-note" class="setae-input-sm" rows="1" placeholder="メモを入力..."></textarea>
                </div>
                <div class="setae-form-group upload-group">
                    <input type="file" id="log-image" accept="image/*" style="display:none;">
                    <button type="button" id="btn-trigger-upload" class="btn-icon-only">📸</button>
                    <div id="log-image-preview" class="image-preview-area"
                        style="display:none; position:absolute; bottom:60px; right:20px; z-index:10; background:white; padding:5px; border-radius:8px; box-shadow:0 4px 12px rgba(0,0,0,0.2);">
                        <img id="preview-img-tag" src="" alt="Preview"
                            style="max-width:100px; max-height:100px; border-radius:4px;">
                        <button type="button" id="btn-remove-image" class="remove-image-btn"
                            style="position:absolute; top:-8px; right:-8px; background:red; color:white; border-radius:50%; width:20px; height:20px; border:none; cursor:pointer;">×</button>
                    </div>
                </div>
            </div>

            <button type="submit" class="setae-btn-submit">保存する</button>
        </form>
    </div>
</div>

<!-- Date Detail Modal -->
<div id="setae-date-detail-modal" class="setae-modal" style="display:none;">
    <div class="setae-modal-content" style="max-width:400px;">
        <span class="setae-close" id="close-date-detail-modal">×</span>
        <h3 id="date-detail-title">YYYY-MM-DD</h3>
        <div id="date-detail-list" style="margin-bottom:20px;">
            <!-- JS Populated -->
        </div>
        <button id="btn-add-log-from-date" class="setae-btn setae-btn-primary" style="width:100%;">
            + この日に記録を追加
        </button>
    </div>
</div>