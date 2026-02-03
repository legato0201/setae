<?php
// All Modals
?>
<!-- Profile Modal -->
<div id="setae-profile-modal" class="setae-modal" style="display:none;">
    <div class="setae-modal-content">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:20px;">
            <h3 style="margin:0;">Profile Settings</h3>
            <div class="setae-profile-avatar" id="profile-avatar-preview-container"
                style="width:60px; height:60px; border-radius:50%; overflow:hidden; border:2px solid #00ffcc; position:relative;">
                <img alt="" src="<?php echo get_avatar_url(get_current_user_id()); ?>" class="avatar avatar-60 photo"
                    height="60" width="60">
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
                <input type="file" id="prof-icon" accept="image/*" style="display:none;">
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
                <select id="edit-spider-species-select" required class="setae-input">
                    <option value="">選択してください...</option>
                </select>
            </div>
            <div class="setae-form-group">
                <label>ニックネーム</label>
                <input type="text" id="edit-spider-name" class="setae-input" placeholder="Name/ID">
            </div>
            <div class="setae-form-group">
                <label>最終脱皮日</label>
                <input type="date" id="edit-spider-last-molt" class="setae-input">
            </div>
            <div class="setae-form-group">
                <label>最終給餌日</label>
                <input type="date" id="edit-spider-last-feed" class="setae-input">
            </div>
            <div style="display:flex; justify-content:space-between; margin-top:20px;">
                <button type="button" id="btn-delete-spider" class="setae-btn"
                    style="background:#ff4d4d; color:white;">削除</button>
                <button type="submit" class="setae-btn setae-btn-primary">保存</button>
            </div>
        </form>
    </div>
</div>

<!-- Add Spider Modal (Advanced) -->
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
                <input type="text" id="topic-title" class="setae-input" required>
            </div>
            <div class="setae-form-group">
                <label>内容</label>
                <textarea id="topic-content" class="setae-input" rows="5" required></textarea>
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
            <!-- JS populated -->
        </div>
        <div style="display:flex; gap:5px;">
            <input type="text" id="new-feed-type" class="setae-input" placeholder="新しい餌の名前 (例: 🪳 デュビア)">
            <button type="button" id="btn-add-feed-type" class="setae-btn setae-btn-primary"
                style="white-space:nowrap;">追加</button>
        </div>
    </div>
</div>

<!-- Add Log Modal -->
<div id="setae-log-modal" class="setae-modal" style="display:none;">
    <div class="setae-modal-content">
        <span class="setae-close" id="close-log-modal">×</span>
        <h3>記録を追加</h3>
        <form id="setae-log-form">
            <input type="hidden" id="log-spider-id">
            <div class="setae-form-group">
                <label>日付</label>
                <input type="date" id="log-date" class="setae-input" required>
            </div>
            <div class="setae-form-group">
                <label>イベントタイプ</label>
                <!-- Hidden input store selected value -->
                <input type="hidden" id="log-type" value="feed">

                <div class="log-type-grid">
                    <button type="button" class="log-type-btn active" data-val="feed">
                        <span class="icon">🦗</span>
                        <span class="label">Feed</span>
                    </button>
                    <button type="button" class="log-type-btn" data-val="molt">
                        <span class="icon">🧬</span>
                        <span class="label">Molt</span>
                    </button>
                    <button type="button" class="log-type-btn" data-val="growth">
                        <span class="icon">📏</span>
                        <span class="label">Growth</span>
                    </button>
                    <button type="button" class="log-type-btn" data-val="note">
                        <span class="icon">📝</span>
                        <span class="label">Note</span>
                    </button>
                </div>
            </div>

            <!-- Feed Options -->
            <div id="log-feed-options" class="log-option-group">
                <label>餌の種類 (Prey Type)</label>

                <!-- Hidden Input for Form Submission -->
                <input type="hidden" id="log-feed-prey-select">

                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
                    <span style="font-size:12px; color:#888;">よく使う餌を選択:</span>
                    <button type="button" id="btn-manage-feed-types" class="setae-btn-sm"
                        style="background:#eee; color:#333; font-size:12px; padding:2px 8px;">⚙️ 編集</button>
                </div>

                <div id="log-feed-prey-buttons" class="log-type-grid"
                    style="grid-template-columns: repeat(auto-fill, minmax(100px, 1fr)); margin-bottom:15px;">
                    <!-- JS populated -->
                </div>

                <div class="setae-checkbox-group">
                    <label><input type="checkbox" id="log-feed-refused"> 拒食 (Refused)</label>
                </div>
            </div>

            <!-- Growth Options -->
            <div id="log-growth-options" class="log-option-group" style="display:none;">
                <label>サイズ (cm) or Instar</label>
                <input type="text" id="log-size" class="setae-input" placeholder="e.g. 5cm or 3LS">
            </div>

            <div class="setae-form-group">
                <label>メモ</label>
                <textarea id="log-note" class="setae-input" rows="3"></textarea>
            </div>

            <!-- Custom File Upload -->
            <div class="setae-form-group">
                <label>写真 (任意)</label>
                <div class="setae-file-upload-wrapper">
                    <input type="file" id="log-image" accept="image/*" style="display:none;">
                    <button type="button" id="btn-trigger-upload" class="setae-btn-upload">
                        📸 写真を選択
                    </button>
                    <div id="log-image-preview" class="image-preview-area" style="display:none;">
                        <img id="preview-img-tag" src="" alt="Preview">
                        <button type="button" id="btn-remove-image" class="remove-image-btn">×</button>
                    </div>
                </div>
            </div>
            <button type="submit" class="setae-btn setae-btn-primary">保存</button>
        </form>
    </div>
</div>

<!-- Date Detail Modal (For Calendar Interaction) -->
<div id="setae-date-detail-modal" class="setae-modal" style="display:none;">
    <div class="setae-modal-content" style="max-width:400px;">
        <span class="setae-close" id="close-date-detail-modal">×</span>
        <h3 id="date-detail-title">YYYY-MM-DD</h3>
        <div id="date-detail-list" style="margin-bottom:20px;">
            <!-- Existing Logs will appear here -->
        </div>
        <button id="btn-add-log-from-date" class="setae-btn setae-btn-primary" style="width:100%;">
            + この日に記録を追加
        </button>
    </div>
</div>