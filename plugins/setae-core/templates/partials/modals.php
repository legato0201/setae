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
<?php
// 性格タームの取得 (モーダル内で選択肢として表示するため)
$temperaments = get_terms(array(
    'taxonomy' => 'setae_temperament',
    'hide_empty' => false,
));
?>

<div id="setae-species-edit-modal" class="setae-modal" style="display: none;">
    <div class="setae-modal-content" style="max-width: 600px;">
        <span id="close-species-edit-modal" class="setae-close">&times;</span>
        <h3 style="margin-bottom: 5px;">修正・情報提供</h3>
        <p id="edit-req-species-name-display" style="font-size: 13px; color: #888; margin-top: 0; margin-bottom: 20px;">
            Species Name</p>

        <form id="setae-species-edit-form" enctype="multipart/form-data">
            <input type="hidden" id="edit-req-species-id" name="species_id" value="">
            <input type="hidden" id="edit-req-species-name" name="species_name" value="">
            <input type="hidden" name="action" value="setae_submit_species_edit">

            <div class="setae-form-group">
                <label>画像提供 (Best Shot)</label>
                <div class="setae-file-upload-wrapper">
                    <input type="file" name="suggested_image" id="suggested-image-input" accept="image/*"
                        style="display:none;">

                    <label for="suggested-image-input" id="edit-image-placeholder"
                        style="display:block; width:100%; text-align:center; padding: 25px; border: 2px dashed #ccc; background: #fafafa; border-radius: 8px; cursor: pointer; transition: background 0.2s;">
                        <span style="display:block; font-size: 28px; margin-bottom: 8px;">📸</span>
                        <span style="display:block; font-weight: bold; color: #555; font-size: 14px;">写真を選択 (Choose
                            File)</span>
                        <span
                            style="display:block; font-size: 11px; color: #999; margin-top: 5px;">※ご自身で撮影された写真に限ります</span>
                    </label>

                    <div id="image-preview-container" style="display:none; margin-top:10px; position:relative;">
                        <img id="edit-image-preview" src=""
                            style="width:100%; border-radius:8px; height:200px; object-fit:cover; border: 1px solid #eee;">
                        <button type="button" id="btn-remove-suggested-image" class="remove-image-btn"
                            style="position:absolute; top:8px; right:8px; background:rgba(0,0,0,0.6); color:#fff; border:none; border-radius:50%; width:28px; height:28px; cursor:pointer; font-size: 16px; line-height: 1;">×</button>
                    </div>
                </div>
            </div>

            <div style="display:grid; grid-template-columns: 1fr 1fr; gap: 15px;">
                <div class="setae-form-group">
                    <label>和名</label>
                    <input type="text" name="suggested_common_name_ja" class="setae-input" placeholder="例: メキシカンレッドニー">
                </div>
                <div class="setae-form-group">
                    <label>スタイル (Lifestyle)</label>
                    <select name="suggested_lifestyle" class="setae-input">
                        <option value="">選択...</option>
                        <option value="地表性">地表性 (Terrestrial)</option>
                        <option value="樹上性">樹上性 (Arboreal)</option>
                        <option value="地中性">地中性 (Fossorial)</option>
                    </select>
                </div>
            </div>

            <div style="display:grid; grid-template-columns: 1fr 1fr; gap: 15px;">
                <div class="setae-form-group">
                    <label>適温 (Temp)</label>
                    <input type="text" name="suggested_temperature" class="setae-input" placeholder="例: 24-28℃">
                </div>
                <div class="setae-form-group">
                    <label>湿度 (Humidity)</label>
                    <input type="text" name="suggested_humidity" class="setae-input" placeholder="例: 60-70%">
                </div>
            </div>

            <div class="setae-form-group">
                <label>性格 (Temperament)</label>
                <div id="temperament-selector-trigger" class="setae-input"
                    style="cursor:pointer; display:flex; align-items:center; flex-wrap:wrap; gap:4px; min-height: 42px;">
                    <span style="color:#999;">タップして選択してください...</span>
                </div>
                <input type="hidden" name="suggested_temperament_ids" id="suggested-temperament-input">
            </div>

            <div style="display:grid; grid-template-columns: 1fr 1fr; gap: 15px;">
                <div class="setae-form-group">
                    <label>寿命 (Lifespan)</label>
                    <input type="text" name="suggested_lifespan" class="setae-input" placeholder="例: 15-20 years">
                </div>
                <div class="setae-form-group">
                    <label>最大サイズ (Legspan)</label>
                    <input type="text" name="suggested_size" class="setae-input" placeholder="例: 15cm">
                </div>
            </div>

            <div class="setae-form-group">
                <label>特徴・補足情報</label>
                <textarea name="suggested_description" rows="4" class="setae-input" style="resize:vertical;"
                    placeholder="詳細な特徴や飼育のポイントがあれば追記してください..."></textarea>
            </div>

            <div class="setae-form-actions" style="margin-top: 20px;">
                <button type="submit" class="setae-btn setae-btn-primary"
                    style="width: 100%; padding: 12px; font-size: 16px;">提案を送信する</button>
            </div>
        </form>
    </div>
</div>

<div id="setae-temperament-dialog"
    style="display:none; position:fixed; top:0; left:0; width:100%; height:100%; z-index:100002; background:rgba(0,0,0,0.5); justify-content:center; align-items:center;">
    <div
        style="background:#fff; width:300px; max-height:80vh; border-radius:12px; overflow:hidden; display:flex; flex-direction:column; box-shadow:0 10px 40px rgba(0,0,0,0.2);">
        <div style="padding:15px; border-bottom:1px solid #eee; font-weight:bold; text-align:center;">性格を選択 (複数可)</div>
        <div style="padding:10px; overflow-y:auto; flex-grow:1;">
            <?php if (!empty($temperaments) && !is_wp_error($temperaments)): ?>
                <?php foreach ($temperaments as $term): ?>
                    <label
                        style="display:flex; align-items:center; padding:10px; border-bottom:1px solid #f5f5f5; cursor:pointer;">
                        <input type="checkbox" class="js-temp-checkbox" value="<?php echo esc_attr($term->term_id); ?>"
                            data-label="<?php echo esc_attr($term->name); ?>" style="transform:scale(1.2); margin-right:10px;">
                        <span style="font-size:14px;"><?php echo esc_html($term->name); ?></span>
                    </label>
                <?php endforeach; ?>
            <?php else: ?>
                <p style="padding:10px; font-size:12px; color:#999;">登録された性格がありません。</p>
            <?php endif; ?>
        </div>
        <div style="padding:10px; border-top:1px solid #eee; text-align:center; background:#f9f9f9;">
            <button type="button" id="btn-confirm-temperament"
                style="background:#333; color:#fff; border:none; padding:8px 24px; border-radius:20px; cursor:pointer;">決定</button>
        </div>
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
                <label>性別 (Gender)</label>
                <div class="setae-radio-group segment-control">
                    <label class="segment-item">
                        <input type="radio" name="edit_spider_gender" value="unknown" checked="">
                        <span>不明</span>
                    </label>
                    <label class="segment-item">
                        <input type="radio" name="edit_spider_gender" value="female">
                        <span><img draggable="false" role="img" class="emoji" alt="♀"
                                src="https://s.w.org/images/core/emoji/17.0.2/svg/2640.svg"> メス</span>
                    </label>
                    <label class="segment-item">
                        <input type="radio" name="edit_spider_gender" value="male">
                        <span><img draggable="false" role="img" class="emoji" alt="♂"
                                src="https://s.w.org/images/core/emoji/17.0.2/svg/2642.svg"> オス</span>
                    </label>
                </div>
            </div>
            <div class="setae-form-group">
                <label>種類 (Species)</label>

                <div id="wrapper-edit-species-search" class="setae-autocomplete-wrapper" style="position:relative;">
                    <input type="text" id="edit-spider-species-search" class="setae-input"
                        placeholder="学名・和名を入力 (DB検索)..." autocomplete="off">
                    <input type="hidden" id="edit-spider-species-id">

                    <div id="edit-spider-species-suggestions"
                        style="position:absolute; top:100%; left:0; right:0; background:#fff; border:1px solid #ddd; max-height:200px; overflow-y:auto; z-index:1000; display:none; border-radius:0 0 8px 8px; box-shadow:0 4px 6px rgba(0,0,0,0.1);">
                    </div>
                </div>

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

        <div id="add-spider-limit-message"
            style="display:none; padding:20px; background:#fffbea; border:1px solid #fce8a6; border-radius:12px; text-align:center; margin-bottom:15px;">
            <div style="font-weight:bold; color:#b28900; margin-bottom:10px; font-size:16px;">
                <img draggable="false" role="img" class="emoji" alt="⚠️"
                    src="https://s.w.org/images/core/emoji/17.0.2/svg/26a0.svg"> 生体の登録上限に達しています
            </div>
            <p style="font-size:13px; color:#555; margin-bottom:20px; line-height:1.5;">
                無料プランの登録上限（<span id="limit-msg-count"></span>匹）に達しました。<br>
                引き続き登録するには、以下のいずれかの方法をご利用ください。
            </p>
            <div style="display:flex; flex-direction:column; gap:12px;">
                <button type="button" class="setae-btn setae-btn-primary" id="limit-upgrade-premium-btn"
                    style="background:linear-gradient(135deg, #FFD700, #FDB931); border:none; color:#fff; font-weight:bold; box-shadow:0 4px 12px rgba(253, 185, 49, 0.3);">
                    ✨ プレミアムプランにアップグレード (無制限)
                </button>
                <button type="button" class="setae-btn"
                    style="background:#fff; border:1px solid #ddd; color:#333; font-size:13px;"
                    onclick="jQuery('#modal-add-spider').fadeOut(); jQuery('.setae-nav-item[data-target=\'section-enc\']').click();">
                    📖 図鑑へ写真提供してボーナス枠を獲得 (+1枠)
                </button>
            </div>
        </div>

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
<!-- Create Topic Modal (Updated & Renamed) -->
<div id="modal-new-topic" class="setae-modal" style="display:none;">
    <div class="setae-modal-content" style="max-width:500px;">
        <span class="setae-close" id="close-topic-modal">×</span>
        <h3>新しいトピックを作成</h3>
        <form id="setae-topic-form">
            <div style="margin-bottom:15px;">
                <label style="display:block; font-size:12px; margin-bottom:5px;">カテゴリ</label>
                <select id="topic-type" class="setae-input" style="width:100%;">
                    <option value="question">質問・相談</option>
                    <option value="chat">雑談・報告</option>
                    <option value="breeding">ブリード記録</option>
                    <option value="other">その他</option>
                </select>
            </div>
            <div style="margin-bottom:15px;">
                <label style="display:block; font-size:12px; margin-bottom:5px;">タイトル</label>
                <input type="text" id="topic-title" class="setae-input" required placeholder="わかりやすいタイトルを"
                    style="width:100%;">
            </div>
            <div style="margin-bottom:15px;">
                <label style="display:block; font-size:12px; margin-bottom:5px;">内容</label>
                <textarea id="topic-content" class="setae-input" rows="5" required placeholder="内容を入力してください..."
                    style="width:100%;"></textarea>
            </div>
            <button type="submit" class="setae-btn setae-btn-primary" style="width:100%;">投稿する</button>
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
                    <div class="setae-toggle-wrapper toggle-refused">
                        <label class="setae-switch">
                            <input type="checkbox" id="log-feed-refused">
                            <span class="setae-slider"></span>
                        </label>
                        <span class="toggle-label">拒食 (Refused)</span>
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
                    <!-- Best Shot Toggle Switch -->
                    <div class="setae-toggle-wrapper">
                        <label class="setae-switch">
                            <input type="checkbox" id="log-best-shot">
                            <span class="setae-slider"></span>
                        </label>
                        <span class="toggle-label">Best Shot</span>
                    </div>
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

<!-- Gallery View Modal -->
<div id="modal-gallery-view" class="setae-modal" style="z-index: 100000; display: none;">
    <div class="modal-content"
        style="max-width: 800px; padding: 0; background: #111; border: none; overflow: hidden; display: flex; flex-direction: column; position: relative; border-radius: 12px; box-shadow: 0 10px 40px rgba(0,0,0,0.5);">

        <div
            style="background: linear-gradient(to bottom, rgba(0,0,0,0.8), transparent); position: absolute; top: 0; left: 0; width: 100%; z-index: 10; display: flex; align-items: center; justify-content: space-between; padding: 15px 20px; box-sizing: border-box;">
            <div style="display: flex; align-items: center; gap: 12px;">
                <div id="gallery-modal-avatar"
                    style="width: 36px; height: 36px; border-radius: 50%; overflow: hidden; background: #333; box-shadow: 0 2px 8px rgba(0,0,0,0.3);">
                </div>
                <div style="display: flex; flex-direction: column;">
                    <span style="font-size: 11px; color: #aaa; text-transform: uppercase; letter-spacing: 0.5px;">Photo
                        by</span>
                    <span id="gallery-modal-username"
                        style="font-weight: bold; font-size: 14px; color: #fff; text-shadow: 0 1px 3px rgba(0,0,0,0.8);"></span>
                </div>
            </div>
            <span id="close-gallery-modal"
                style="color: #fff; opacity: 0.8; cursor: pointer; font-size: 28px; text-shadow: 0 1px 3px rgba(0,0,0,0.8); transition: 0.2s;">&times;</span>
        </div>

        <div
            style="height: 75vh; width: 100%; display: flex; align-items: center; justify-content: center; background: #000;">
            <img id="gallery-modal-img" src="" style="max-width: 100%; max-height: 100%; object-fit: contain;">
        </div>
    </div>
</div>