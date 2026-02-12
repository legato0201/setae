<?php
/**
 * Partial: Modals
 */
?>
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

<!-- Edit Suggestion Modal -->
<div id="setae-species-edit-modal" class="setae-modal" style="display: none;">
    <div class="setae-modal-content">
        <span id="close-species-edit-modal" class="setae-close">&times;</span>
        <h3>図鑑情報の修正・提供</h3>
        <p style="font-size:12px; color:#666; margin-bottom:15px;">
            より正確な情報や、より良い画像の提供にご協力ください。<br>
            送信された内容は管理者が確認後、反映されます。
        </p>

        <form id="setae-species-edit-form" enctype="multipart/form-data">
            <input type="hidden" id="edit-req-species-id" name="species_id" value="">
            <input type="hidden" name="action" value="setae_submit_species_edit">

            <div class="setae-form-group">
                <label>画像提供 (任意)</label>
                <input type="file" name="suggested_image" accept="image/*">
                <p style="font-size:10px; color:#999;">※ご自身で撮影された写真に限ります。</p>
            </div>

            <div class="setae-form-group">
                <label>説明文・特徴の追記</label>
                <textarea name="suggested_description" rows="5" placeholder="生息地、性格、飼育のコツなどの情報..."></textarea>
            </div>

            <div class="setae-form-group" style="display:grid; grid-template-columns: 1fr 1fr; gap:10px;">
                <div>
                    <label>寿命 (Lifespan)</label>
                    <input type="text" name="suggested_lifespan" placeholder="例: 15-20 years">
                </div>
                <div>
                    <label>最大サイズ (Legspan)</label>
                    <input type="text" name="suggested_size" placeholder="例: 15cm">
                </div>
            </div>

            <div class="setae-form-actions">
                <button type="submit" class="setae-btn-primary">管理者に提案を送信</button>
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
                <select id="edit-spider-species-select" class="setae-input">
                    <option value="">選択してください...</option>
                </select>
                <input type="text" id="edit-spider-species-custom" class="setae-input" style="display:none;"
                    placeholder="種類名を入力">
                <div style="text-align:right; margin-top:4px;">
                    <span id="btn-toggle-edit-species-input"
                        style="font-size:12px; color:#3498db; cursor:pointer; text-decoration:underline;">手入力に切り替え</span>
                </div>
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
                <label>カテゴリー</label>
                <div class="setae-radio-group" style="display:flex; gap:10px; flex-wrap:wrap;">
                    <label class="radio-chip active">
                        <input type="radio" name="classification" value="tarantula" checked hidden>
                        🕷️ Tarantula
                    </label>
                    <label class="radio-chip">
                        <input type="radio" name="classification" value="scorpion" hidden>
                        🦂 Scorpion
                    </label>
                    <label class="radio-chip">
                        <input type="radio" name="classification" value="reptile" hidden>
                        🦎 Reptile
                    </label>
                    <label class="radio-chip">
                        <input type="radio" name="classification" value="plant" hidden>
                        🌿 Plant
                    </label>
                    <label class="radio-chip">
                        <input type="radio" name="classification" value="other" hidden>
                        📦 Other
                    </label>
                </div>
            </div>
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
                <label>種類 / 品種名</label>

                <div id="wrapper-species-search" class="setae-autocomplete-wrapper" style="position:relative;">
                    <input type="text" id="spider-species-search" class="setae-input" placeholder="学名・和名を入力 (DB検索)..."
                        autocomplete="off">
                    <input type="hidden" id="spider-species-select">
                    <div id="spider-species-suggestions"
                        style="position:absolute; top:100%; left:0; right:0; background:#fff; border:1px solid #ddd; max-height:200px; overflow-y:auto; z-index:1000; display:none; border-radius:0 0 8px 8px; box-shadow:0 4px 6px rgba(0,0,0,0.1);">
                    </div>
                </div>

                <input type="text" id="spider-custom-species" class="setae-input"
                    placeholder="種類名を入力 (例: Monstera deliciosa)" style="display:none;">
            </div>
            <div class="setae-form-group">
                <label>ニックネーム (任意)</label>
                <input type="text" id="spider-name" placeholder="Name/ID" class="setae-input">
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
                    <label>サイズ (cm)</label>
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
                    <!-- Best Shot Checkbox -->
                    <label
                        style="display:flex; align-items:center; gap:5px; font-size:12px; margin-left:10px; cursor:pointer;">
                        <input type="checkbox" id="log-best-shot"> Best Shot
                    </label>
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