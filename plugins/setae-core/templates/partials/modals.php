<?php
/**
 * Partial: Modals
 */
?>
<!-- Modals (Moved to Root) -->
<div id="setae-profile-modal" class="setae-modal" style="display:none;">
    <div class="setae-modal-content" style="max-width: 420px;">

        <div class="profile-header">
            <h3><?php esc_html_e('プロフィール設定', 'setae-core'); ?></h3>
            <span class="setae-close" id="close-profile-modal">×</span>
        </div>

        <form id="setae-profile-form">
            <div class="profile-avatar-section">
                <div class="avatar-wrapper" id="trigger-avatar-upload"
                    title="<?php esc_attr_e('写真・アイコンを変更', 'setae-core'); ?>">
                    <div class="profile-avatar-preview" id="profile-avatar-preview-container">
                        <?php echo get_avatar(get_current_user_id(), 150); ?>
                    </div>
                    <div class="avatar-edit-badge">📷</div>
                </div>
                <input type="file" id="prof-icon" accept="image/*" style="display:none;">
            </div>

            <div class="setae-form-group">
                <label><?php esc_html_e('表示名', 'setae-core'); ?></label>
                <input type="text" id="prof-display-name" class="setae-input"
                    value="<?php echo esc_attr(wp_get_current_user()->display_name); ?>"
                    placeholder="<?php esc_attr_e('ニックネーム', 'setae-core'); ?>">
            </div>

            <div class="setae-form-group">
                <label><?php esc_html_e('メールアドレス', 'setae-core'); ?></label>
                <input type="email" id="prof-email" class="setae-input"
                    value="<?php echo esc_attr(wp_get_current_user()->user_email); ?>" placeholder="example@mail.com">
            </div>

            <div class="setae-form-group">
                <label><?php esc_html_e('新しいパスワード', 'setae-core'); ?> <small
                        style="font-weight:normal; text-transform:none;"><?php esc_html_e('（変更しない場合は空欄）', 'setae-core'); ?></small></label>
                <input type="password" id="prof-password" class="setae-input" placeholder="********"
                    autocomplete="new-password">
            </div>

            <div class="setae-form-group">
                <label><?php esc_html_e('プレミアムプラン', 'setae-core'); ?></label>
                <button type="button" class="setae-btn setae-btn-primary" id="upgrade-premium-btn"
                    style="width:100%;height:44px;background:linear-gradient(135deg, #FFD700, #FDB931);color:#fff;border:none;border-radius:12px;font-size:15px;font-weight:600;box-shadow:0 4px 12px rgba(253, 185, 49, 0.3);">
                    ✨ <?php esc_html_e('プレミアムにアップグレード', 'setae-core'); ?>
                </button>
            </div>

            <div class="setae-form-actions">
                <button type="button" class="setae-btn setae-btn-danger-ghost" id="setae-logout-btn">
                    <span>↪</span> <?php esc_html_e('ログアウト', 'setae-core'); ?>
                </button>

                <div class="actions-right">
                    <button type="button" class="setae-btn setae-btn-secondary"
                        id="close-profile-modal-btn"><?php esc_html_e('キャンセル', 'setae-core'); ?></button>
                    <button type="submit"
                        class="setae-btn setae-btn-primary"><?php esc_html_e('変更を保存', 'setae-core'); ?></button>
                </div>
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
            種名</p>

        <form id="setae-species-edit-form" enctype="multipart/form-data">
            <input type="hidden" id="edit-req-species-id" name="species_id" value="">
            <input type="hidden" id="edit-req-species-name" name="species_name" value="">
            <input type="hidden" name="action" value="setae_submit_species_edit">

            <div class="setae-form-group">
                <label>画像提供（図鑑候補写真）</label>
                <div class="setae-file-upload-wrapper">
                    <input type="file" name="suggested_image" id="suggested-image-input" accept="image/*"
                        style="display:none;">

                    <label for="suggested-image-input" id="edit-image-placeholder"
                        style="display:block; width:100%; text-align:center; padding: 25px; border: 2px dashed #ccc; background: #fafafa; border-radius: 8px; cursor: pointer; transition: background 0.2s;">
                        <span style="display:block; font-size: 28px; margin-bottom: 8px;">📸</span>
                        <span style="display:block; font-weight: bold; color: #555; font-size: 14px;">写真を選択</span>
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
                    <label>生活型</label>
                    <select name="suggested_lifestyle" class="setae-input">
                        <option value="">選択...</option>
                        <option value="地表性">地表性</option>
                        <option value="樹上性">樹上性</option>
                        <option value="地中性">地中性</option>
                    </select>
                </div>
            </div>

            <div style="display:grid; grid-template-columns: 1fr 1fr; gap: 15px;">
                <div class="setae-form-group">
                    <label>適温</label>
                    <input type="text" name="suggested_temperature" class="setae-input" placeholder="例: 24-28℃">
                </div>
                <div class="setae-form-group">
                    <label>湿度</label>
                    <input type="text" name="suggested_humidity" class="setae-input" placeholder="例: 60-70%">
                </div>
            </div>

            <div class="setae-form-group">
                <label>性格</label>
                <div id="temperament-selector-trigger" class="setae-input">
                    <span class="temperament-placeholder">タップして選択してください...</span>
                </div>
                <input type="hidden" name="suggested_temperament_ids" id="suggested-temperament-input">
            </div>

            <div style="display:grid; grid-template-columns: 1fr 1fr; gap: 15px;">
                <div class="setae-form-group">
                    <label>寿命</label>
                    <input type="text" name="suggested_lifespan" class="setae-input" placeholder="例: 15-20年">
                </div>
                <div class="setae-form-group">
                    <label>最大サイズ</label>
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
                <label>性別</label>
                <div class="setae-radio-group segment-control">
                    <label class="segment-item">
                        <input type="radio" name="edit_spider_gender" value="unknown" checked="">
                        <span>不明</span>
                    </label>
                    <label class="segment-item">
                        <input type="radio" name="edit_spider_gender" value="female">
                        <span><span aria-hidden="true">♀</span> メス</span>
                    </label>
                    <label class="segment-item">
                        <input type="radio" name="edit_spider_gender" value="male">
                        <span><span aria-hidden="true">♂</span> オス</span>
                    </label>
                </div>
            </div>
            <div class="setae-form-group">
                <label>種類</label>

                <div id="wrapper-edit-species-search" class="setae-autocomplete-wrapper" style="position:relative;">
                    <input type="text" id="edit-spider-species-search" class="setae-input"
                        placeholder="学名・和名を入力 (DB検索)..." autocomplete="off">
                    <input type="hidden" id="edit-spider-species-id">

                    <div id="edit-spider-species-suggestions" class="setae-edit-species-suggestions"
                        role="listbox" aria-label="種類の検索候補">
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
                <input type="text" id="edit-spider-name" class="setae-input" placeholder="名前・管理番号">
            </div>
            <section class="setae-edit-profile-section" aria-labelledby="edit-spider-profile-title">
                <div class="setae-edit-profile-heading">
                    <strong id="edit-spider-profile-title">飼育プロフィール</strong>
                    <small>詳細ダッシュボードとケア判断に使います</small>
                </div>
                <div class="setae-edit-profile-grid">
                    <div class="setae-form-group">
                        <label for="edit-spider-acquired-date">入手・管理開始日</label>
                        <input type="date" id="edit-spider-acquired-date" class="setae-input">
                    </div>
                    <div class="setae-form-group">
                        <label for="edit-spider-instar">齢数</label>
                        <input type="number" id="edit-spider-instar" class="setae-input" min="1" max="30" inputmode="numeric" placeholder="例: 5">
                    </div>
                    <div class="setae-form-group">
                        <label for="edit-spider-temperature">現在の温度</label>
                        <input type="text" id="edit-spider-temperature" class="setae-input" maxlength="20" placeholder="例: 26℃">
                    </div>
                    <div class="setae-form-group">
                        <label for="edit-spider-humidity">現在の湿度</label>
                        <input type="text" id="edit-spider-humidity" class="setae-input" maxlength="20" placeholder="例: 75%">
                    </div>
                    <div class="setae-form-group">
                        <label for="edit-spider-origin">産地・入手元</label>
                        <input type="text" id="edit-spider-origin" class="setae-input" maxlength="120" placeholder="例: CB、ペルー">
                    </div>
                    <div class="setae-form-group">
                        <label for="edit-spider-enclosure">飼育容器</label>
                        <input type="text" id="edit-spider-enclosure" class="setae-input" maxlength="120" placeholder="例: A-12">
                    </div>
                    <div class="setae-form-group setae-edit-profile-wide">
                        <label for="edit-spider-substrate">床材・環境メモ</label>
                        <input type="text" id="edit-spider-substrate" class="setae-input" maxlength="120" placeholder="例: ヤシガラ、給水あり">
                    </div>
                    <div class="setae-form-group setae-edit-profile-wide">
                        <label for="edit-spider-notes">個体メモ</label>
                        <textarea id="edit-spider-notes" class="setae-input" rows="3" maxlength="2000" placeholder="性格、隠れ家の使い方、注意点など"></textarea>
                    </div>
                </div>
            </section>
            <div class="setae-form-actions setae-modal-footer-split">
                <div class="setae-edit-management-actions">
                    <button type="button" id="btn-archive-spider" class="setae-btn-text-archive">
                        アーカイブ
                    </button>
                    <button type="button" id="btn-delete-spider" class="setae-btn-text-danger">
                        削除
                    </button>
                </div>
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
<div id="modal-add-spider" class="setae-modal setae-add-spider-modal" style="display:none;" aria-hidden="true">
    <div class="setae-modal-content setae-add-spider-dialog" role="dialog" aria-modal="true"
        aria-labelledby="add-spider-dialog-title" aria-describedby="add-spider-dialog-description">
        <header class="setae-add-spider-header">
            <div>
                <span class="setae-add-spider-kicker">MY COLLECTION</span>
                <h2 id="add-spider-dialog-title">
                    <?php esc_html_e('新しい個体を登録', 'setae-core'); ?>
                </h2>
                <p id="add-spider-dialog-description">
                    <?php esc_html_e('種類と呼び名を決めると、今日からその個体だけの飼育カルテが始まります。', 'setae-core'); ?>
                </p>
            </div>
            <button type="button" class="setae-close setae-add-spider-close"
                aria-label="<?php esc_attr_e('新規個体登録を閉じる', 'setae-core'); ?>" title="<?php esc_attr_e('閉じる', 'setae-core'); ?>">
                <svg viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M18 6 6 18M6 6l12 12"></path>
                </svg>
            </button>
        </header>

        <div id="add-spider-limit-message" class="setae-add-limit-message" style="display:none;">
            <div class="setae-add-limit-heading">
                <span aria-hidden="true">⚠</span>
                <?php esc_html_e('生体の登録上限に達しています', 'setae-core'); ?>
            </div>
            <p>
                <?php echo wp_kses_post(__('無料プランの登録上限（<span id="limit-msg-count"></span>匹）に達しました。<br>引き続き登録するには、以下のいずれかの方法をご利用ください。', 'setae-core')); ?>
            </p>
            <div class="setae-add-limit-actions">
                <button type="button" class="setae-btn setae-btn-primary" id="limit-upgrade-premium-btn"
                    data-tone="premium">
                    <span aria-hidden="true">✨</span>
                    <?php esc_html_e('プレミアムプランにアップグレード (無制限)', 'setae-core'); ?>
                </button>
                <button type="button" class="setae-btn setae-btn-secondary"
                    onclick="jQuery('#modal-add-spider').fadeOut(); jQuery('.setae-nav-item[data-target=\'section-enc\']').click();">
                    <span aria-hidden="true">📖</span>
                    <?php esc_html_e('図鑑へ写真提供してボーナス枠を獲得 (+1枠)', 'setae-core'); ?>
                </button>
                <button type="button" class="setae-btn setae-add-limit-x" id="btn-share-x-add-limit">
                    <span aria-hidden="true">𝕏</span>
                    <?php esc_html_e('でアプリを紹介してボーナス枠を獲得 (+1枠)', 'setae-core'); ?>
                </button>
            </div>
        </div>

        <form id="form-add-spider">
            <div class="setae-add-spider-layout">
                <div class="setae-add-spider-form-pane">
                    <section class="setae-add-spider-section">
                        <div class="setae-add-spider-section-head">
                            <span aria-hidden="true">1</span>
                            <div>
                                <strong><?php esc_html_e('分類を選ぶ', 'setae-core'); ?></strong>
                                <small><?php esc_html_e('一覧や記録項目が分類に合わせて切り替わります。', 'setae-core'); ?></small>
                            </div>
                        </div>
                        <div class="setae-form-group">
                            <label>
                                <?php esc_html_e('カテゴリー', 'setae-core'); ?>
                            </label>
                            <div class="setae-radio-group setae-add-classification-options">
                                <?php
                                // setae_classification タクソノミーを取得
                                $classifications = get_terms(array(
                                    'taxonomy' => 'setae_classification',
                                    'hide_empty' => false,
                                ));

                                // タームメタの並び順(_setae_term_order)でソート
                                if (!is_wp_error($classifications) && !empty($classifications)):
                                    usort($classifications, function ($a, $b) {
                                        $order_a = (int) get_term_meta($a->term_id, '_setae_term_order', true);
                                        $order_b = (int) get_term_meta($b->term_id, '_setae_term_order', true);
                                        return $order_a <=> $order_b;
                                    });

                                    foreach ($classifications as $index => $term):
                                        $is_checked = ($index === 0) ? 'checked' : '';
                                        $is_active = ($index === 0) ? 'active' : '';
                                        $icon = !empty($term->description) ? strip_tags($term->description) : '生';
                                        ?>
                                        <label class="radio-chip <?php echo esc_attr($is_active); ?>"
                                            data-label="<?php echo esc_attr($term->name); ?>"
                                            data-mark="<?php echo esc_attr($icon); ?>">
                                            <input type="radio" name="classification" value="<?php echo esc_attr($term->slug); ?>" <?php echo $is_checked; ?> hidden="">
                                            <span class="setae-classification-chip-icon" aria-hidden="true"><?php echo esc_html($icon); ?></span>
                                            <span><?php echo esc_html($term->name); ?></span>
                                        </label>
                                        <?php
                                    endforeach;
                                else:
                                    ?>
                                    <label class="radio-chip active" data-label="<?php esc_attr_e('その他', 'setae-core'); ?>" data-mark="生">
                                        <input type="radio" name="classification" value="other" checked="" hidden="">
                                        <span class="setae-classification-chip-icon" aria-hidden="true">生</span>
                                        <span><?php esc_html_e('その他', 'setae-core'); ?></span>
                                    </label>
                                <?php endif; ?>
                            </div>
                        </div>
                    </section>

                    <section class="setae-add-spider-section">
                        <div class="setae-add-spider-section-head">
                            <span aria-hidden="true">2</span>
                            <div>
                                <strong><?php esc_html_e('個体を識別する', 'setae-core'); ?></strong>
                                <small><?php esc_html_e('種類と、普段呼んでいる名前や管理番号を入力します。', 'setae-core'); ?></small>
                            </div>
                        </div>
                        <div class="setae-form-group">
                            <label for="spider-species-search">
                                <?php esc_html_e('種類 / 品種名', 'setae-core'); ?>
                            </label>

                            <div id="wrapper-species-search" class="setae-autocomplete-wrapper">
                                <input type="text" id="spider-species-search" class="setae-input"
                                    placeholder="<?php esc_attr_e('学名・和名を入力して図鑑から検索', 'setae-core'); ?>" autocomplete="off">
                                <input type="hidden" id="spider-species-select" value="">
                                <div id="spider-species-suggestions" class="setae-species-suggestions" role="listbox"
                                    aria-label="<?php esc_attr_e('種類の検索候補', 'setae-core'); ?>">
                                </div>
                            </div>

                            <input type="text" id="spider-custom-species" class="setae-input"
                                placeholder="<?php esc_attr_e('種類名を自由入力', 'setae-core'); ?>"
                                style="display:none;">
                        </div>
                        <div class="setae-form-group">
                            <label for="spider-name">
                                <?php esc_html_e('ニックネーム / 管理番号', 'setae-core'); ?>
                                <small><?php esc_html_e('任意', 'setae-core'); ?></small>
                            </label>
                            <input type="text" id="spider-name"
                                placeholder="<?php esc_attr_e('例: PM01、るり', 'setae-core'); ?>"
                                class="setae-input" maxlength="80">
                        </div>
                    </section>

                    <section class="setae-add-spider-section">
                        <div class="setae-add-spider-section-head">
                            <span aria-hidden="true">3</span>
                            <div>
                                <strong><?php esc_html_e('最初の写真を添える', 'setae-core'); ?></strong>
                                <small><?php esc_html_e('写真はあとから追加できます。', 'setae-core'); ?></small>
                            </div>
                        </div>
                        <div class="setae-form-group setae-add-photo-group">
                            <label for="spider-image">
                                <?php esc_html_e('個体写真', 'setae-core'); ?>
                                <small><?php esc_html_e('任意', 'setae-core'); ?></small>
                            </label>
                            <div class="setae-file-upload-wrapper">
                                <input type="file" id="spider-image" class="setae-add-photo-input" accept="image/*">
                                <button type="button" id="btn-trigger-upload-add" class="setae-add-photo-button">
                                    <svg viewBox="0 0 24 24" aria-hidden="true">
                                        <path d="M14.5 4 16 6h3a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h3l1.5-2h5Z"></path>
                                        <circle cx="12" cy="13" r="3"></circle>
                                    </svg>
                                    <span>
                                        <strong><?php esc_html_e('写真を選択', 'setae-core'); ?></strong>
                                        <small><?php esc_html_e('体全体が見える写真がおすすめです', 'setae-core'); ?></small>
                                    </span>
                                </button>
                                <div id="spider-image-preview" class="setae-add-photo-selection" style="display:none;">
                                    <img id="preview-img-tag-add" src="" alt="">
                                    <span>
                                        <strong><?php esc_html_e('写真を選択済み', 'setae-core'); ?></strong>
                                        <small><?php esc_html_e('右のカードに反映されています', 'setae-core'); ?></small>
                                    </span>
                                    <button type="button" id="btn-remove-image-add"
                                        aria-label="<?php esc_attr_e('選択した写真を削除', 'setae-core'); ?>" title="<?php esc_attr_e('写真を削除', 'setae-core'); ?>">
                                        <svg viewBox="0 0 24 24" aria-hidden="true">
                                            <path d="M18 6 6 18M6 6l12 12"></path>
                                        </svg>
                                    </button>
                                </div>
                            </div>
                        </div>
                    </section>
                </div>

                <aside class="setae-add-spider-preview-pane" aria-label="<?php esc_attr_e('登録後の個体カードプレビュー', 'setae-core'); ?>">
                    <div class="setae-add-preview-heading">
                        <span><?php esc_html_e('登録後のカード', 'setae-core'); ?></span>
                        <small><?php esc_html_e('入力内容をリアルタイムに反映', 'setae-core'); ?></small>
                    </div>
                    <article id="add-spider-card-preview" class="setae-add-card-preview" data-classification="tarantula">
                        <div class="setae-add-card-visual">
                            <img id="add-spider-preview-image" src="" alt="">
                            <span id="add-spider-preview-mark" aria-hidden="true">生</span>
                            <em><?php esc_html_e('NEW', 'setae-core'); ?></em>
                        </div>
                        <div class="setae-add-card-body">
                            <span id="add-spider-preview-species" class="setae-add-card-species">
                                <?php esc_html_e('種類を選択', 'setae-core'); ?>
                            </span>
                            <strong id="add-spider-preview-name" class="setae-add-card-name">
                                <?php esc_html_e('名前・管理番号', 'setae-core'); ?>
                            </strong>
                            <div class="setae-add-card-signal">
                                <i aria-hidden="true"></i>
                                <span id="add-spider-preview-classification"><?php esc_html_e('新しい個体', 'setae-core'); ?></span>
                                <b><?php esc_html_e('最初の記録', 'setae-core'); ?></b>
                            </div>
                            <div class="setae-add-card-dates">
                                <div>
                                    <span id="add-spider-preview-primary-label"><?php esc_html_e('給餌', 'setae-core'); ?></span>
                                    <strong>--/--</strong>
                                </div>
                                <div>
                                    <span id="add-spider-preview-secondary-label"><?php esc_html_e('脱皮', 'setae-core'); ?></span>
                                    <strong>--/--</strong>
                                </div>
                            </div>
                            <div class="setae-add-card-rhythm">
                                <div>
                                    <span><?php esc_html_e('90日ケアリズム', 'setae-core'); ?></span>
                                    <b>0 <?php esc_html_e('記録', 'setae-core'); ?></b>
                                </div>
                                <div class="setae-add-card-rhythm-bars" aria-hidden="true">
                                    <i></i><i></i><i></i><i></i><i></i><i></i>
                                    <i></i><i></i><i></i><i></i><i></i><i></i>
                                </div>
                            </div>
                        </div>
                    </article>
                    <p class="setae-add-preview-note">
                        <?php esc_html_e('登録後は、このカードから給餌・脱皮・写真をすぐに記録できます。', 'setae-core'); ?>
                    </p>
                </aside>
            </div>

            <footer class="setae-add-spider-footer">
                <p>
                    <span aria-hidden="true"></span>
                    <?php esc_html_e('登録後、そのまま最初の飼育記録へ進めます。', 'setae-core'); ?>
                </p>
                <button type="submit" class="setae-btn setae-btn-primary setae-add-spider-submit">
                    <span><?php esc_html_e('この個体を登録', 'setae-core'); ?></span>
                    <svg viewBox="0 0 24 24" aria-hidden="true">
                        <path d="m9 18 6-6-6-6"></path>
                    </svg>
                </button>
            </footer>
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
            <div id="topic-draft-banner" class="log-draft-banner topic-draft-banner" style="display:none;">
                <span>下書きを復元しました</span>
                <button type="button" id="btn-topic-draft-discard">破棄</button>
            </div>
            <div class="topic-template-panel">
                <button type="button" class="topic-template-btn" data-template="feeding">給餌・拒食</button>
                <button type="button" class="topic-template-btn" data-template="molt">脱皮・成長</button>
                <button type="button" class="topic-template-btn" data-template="environment">環境・レイアウト</button>
                <button type="button" class="topic-template-btn" data-template="identify">同定・写真</button>
            </div>
            <div class="topic-related-species" style="margin-bottom:15px;">
                <label style="display:block; font-size:12px; margin-bottom:5px;">関連種（任意）</label>
                <input type="hidden" id="topic-related-species-id" value="">
                <div id="topic-related-species-selected" class="topic-related-species-selected" style="display:none;"></div>
                <div class="topic-related-species-search-wrap">
                    <input type="text" id="topic-related-species-search" class="setae-input"
                        placeholder="学名・和名で検索" autocomplete="off" style="width:100%;">
                    <div id="topic-related-species-suggestions" class="topic-related-species-suggestions"
                        style="display:none;"></div>
                </div>
                <p class="topic-related-species-hint">図鑑の種と紐づけると、種ページにもこの相談が表示されます。</p>
            </div>
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
    <div class="setae-modal-content compact-mode log-entry-modal">
        <span class="setae-close" id="close-log-modal">×</span>
        <div class="log-modal-header">
            <h3 class="modal-title">記録を追加</h3>
        </div>

        <form id="setae-log-form">
            <input type="hidden" id="log-spider-id">

            <div id="log-draft-banner" class="log-draft-banner" style="display:none;">
                <span>下書きを復元しました</span>
                <button type="button" id="btn-log-draft-discard">破棄</button>
            </div>

            <div class="log-entry-form-layout">
                <section class="log-entry-primary" aria-label="記録の内容">
            <div class="form-row-top">
                <div class="setae-form-group date-group">
                    <label><span aria-hidden="true">📅</span> 日付</label>
                    <input type="date" id="log-date" class="setae-input-sm" required>
                    <div id="log-date-quick" class="log-date-quick">
                        <button type="button" class="log-date-chip" data-offset="0">今日</button>
                        <button type="button" class="log-date-chip" data-offset="-1">昨日</button>
                    </div>
                </div>
                <div class="setae-form-group type-group">
                    <label>イベントタイプ</label>
                    <input type="hidden" id="log-type" value="feed">
                    <div class="log-type-grid-sm">
                        <button type="button" class="type-btn-sm active" data-val="feed" title="給餌">🦗</button>
                        <button type="button" class="type-btn-sm" data-val="molt" title="脱皮">🧬</button>
                        <button type="button" class="type-btn-sm" data-val="growth" title="成長">📏</button>
                        <button type="button" class="type-btn-sm" data-val="note" title="メモ">📝</button>
                    </div>
                </div>
            </div>

            <div class="options-container" style="display: block;">
                <div id="log-feed-options" class="log-option-group">
                    <div class="option-header">
                        <label>餌</label>
                        <div class="option-header-actions">
                            <span id="log-feed-last-choice" class="log-feed-last-choice" style="display:none;"></span>
                            <button type="button" id="btn-manage-feed-types" class="btn-text-only">⚙️ 編集</button>
                        </div>
                    </div>
                    <input type="hidden" id="log-feed-prey-select" value="デュビア">
                    <div id="log-feed-prey-buttons" class="prey-chip-container">
                        <!-- JS Populated -->
                    </div>
                    <div class="setae-toggle-wrapper toggle-refused">
                        <label class="setae-switch">
                            <input type="checkbox" id="log-feed-refused">
                            <span class="setae-slider"></span>
                        </label>
                        <span class="toggle-label">拒食</span>
                    </div>
                </div>

                <div id="log-growth-options" class="log-option-group" style="display:none;">
                    <div style="display:flex; justify-content:space-between; align-items:flex-end; margin-bottom: 5px;">
                        <label style="margin-bottom:0;">サイズ</label>
                        <span id="log-prev-size-label" style="font-size:11px; color:#888; display:none;">前回: <span
                                id="log-prev-size-val" style="font-weight:bold; color:#555;">--</span></span>
                    </div>
                    <div style="display:flex; align-items:center; gap:8px;">
                        <input type="number" id="log-size" class="setae-input-sm" placeholder="例: 5.5" step="0.1"
                            inputmode="decimal" style="flex-grow:1; margin-bottom:0;">
                        <span style="color:#666; font-size:14px; font-weight:bold;">cm</span>
                    </div>
                </div>
            </div>
                </section>

                <section class="log-entry-notes" aria-label="メモと写真">
                    <div class="log-notes-heading">
                        <label class="log-note-label" for="log-note">メモ</label>
                    </div>
                    <div id="log-note-suggestions" class="log-note-suggestions" style="display:none;"></div>

            <div class="form-row-bottom">
                <div class="setae-form-group memo-group">
                    <textarea id="log-note" class="setae-input-sm" rows="3" placeholder="メモを入力..."></textarea>
                </div>
                <div class="setae-form-group upload-group">
                    <input type="file" id="log-image" accept="image/*" style="display:none;">
                    <button type="button" id="btn-trigger-upload" class="btn-icon-only log-upload-button" aria-label="写真を追加">
                        <span aria-hidden="true">📸</span>
                        <span class="log-upload-button-label">写真を追加</span>
                    </button>
                    <div id="log-image-preview" class="image-preview-area" style="display:none;">
                        <img id="preview-img-tag" src="" alt="プレビュー">
                        <button type="button" id="btn-remove-image" class="remove-image-btn" aria-label="写真を削除">×</button>
                    </div>
                </div>
            </div>
                </section>
            </div>

            <div class="log-share-options">
                <div class="setae-toggle-wrapper toggle-best-shot is-disabled">
                    <label class="setae-switch">
                        <input type="checkbox" id="log-best-shot" disabled>
                        <span class="setae-slider"></span>
                    </label>
                    <span class="toggle-label">図鑑候補写真</span>
                </div>
                <div class="setae-toggle-wrapper toggle-share-feed">
                    <label class="setae-switch">
                        <input type="checkbox" id="log-share-feed">
                        <span class="setae-slider"></span>
                    </label>
                    <span class="toggle-label">お世話記録を共有</span>
                </div>
                <p id="log-share-hint" class="log-share-hint">共有はいつでもオン・オフできます。</p>
            </div>

            <div class="log-submit-actions">
                <button type="submit" class="setae-btn-submit">保存する</button>
                <button type="button" id="btn-log-save-next" class="setae-btn-save-next" style="display:none;">保存して次へ</button>
            </div>
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
                    <span style="font-size: 11px; color: #aaa; letter-spacing: 0.5px;">写真提供</span>
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

<!-- サポーターバッジ説明モーダル -->
<div id="modal-badge-info" class="setae-modal" style="display: none; z-index: 100001;">
    <div class="setae-modal-content" style="max-width: 400px; border-radius: 16px; padding: 20px;">
        <span class="setae-modal-close" id="modal-badge-info-close"
            style="cursor: pointer; font-size: 24px; position: absolute; right: 15px; top: 10px;">&times;</span>
        <h3
            style="margin-top: 0; border-bottom: 2px solid #f0f0f0; padding-bottom: 10px; font-size: 18px; display: flex; align-items: center; gap: 8px;">
            <img draggable="false" role="img" class="emoji" alt="🏅"
                src="https://s.w.org/images/core/emoji/17.0.2/svg/1f3c5.svg" style="height: 1.2em; width: 1.2em;">
            サポーターバッジ
        </h3>

        <p style="font-size: 13px; color: #555; margin-bottom: 15px; line-height: 1.5;">
            図鑑への写真提供や、紹介コードを使ってアプリを紹介することで、生体登録枠が＋１されていきます。<br>
            獲得したボーナス枠数に応じて、プロフィールアイコンに付与される<strong>サポーターバッジ</strong>がランクアップします！
        </p>

        <div style="display: flex; flex-direction: column; gap: 8px;">
            <div
                style="display: flex; align-items: center; gap: 15px; background: #fafafa; padding: 10px; border-radius: 8px; border: 1px solid #eee;">
                <div style="position: relative; width: 44px; height: 44px;">
                    <div
                        style="width: 100%; height: 100%; background: #bdc3c7; color: #fff; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 20px; font-weight: bold;">
                        B</div>
                    <span class="bonus-badge tier-basic">I</span>
                </div>
                <div>
                    <div style="font-weight: bold; font-size: 14px; color: #B8652A;">ブロンズサポーター</div>
                    <div style="font-size: 12px; color: #777;">ボーナス枠 1〜10 獲得</div>
                </div>
            </div>

            <div
                style="display: flex; align-items: center; gap: 15px; background: #fafafa; padding: 10px; border-radius: 8px; border: 1px solid #eee;">
                <div style="position: relative; width: 44px; height: 44px;">
                    <div
                        style="width: 100%; height: 100%; background: #34495e; color: #fff; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 20px; font-weight: bold;">
                        S</div>
                    <span class="bonus-badge tier-advanced">II</span>
                </div>
                <div>
                    <div style="font-weight: bold; font-size: 14px; color: #64748B;">シルバーサポーター</div>
                    <div style="font-size: 12px; color: #777;">ボーナス枠 11〜20 獲得</div>
                </div>
            </div>

            <div
                style="display: flex; align-items: center; gap: 15px; background: #fafafa; padding: 10px; border-radius: 8px; border: 1px solid #eee;">
                <div style="position: relative; width: 44px; height: 44px;">
                    <div
                        style="width: 100%; height: 100%; background: #2ecc71; color: #fff; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 20px; font-weight: bold;">
                        E</div>
                    <span class="bonus-badge tier-uncommon">III</span>
                </div>
                <div>
                    <div style="font-weight: bold; font-size: 14px; color: #059669;">エメラルドサポーター</div>
                    <div style="font-size: 12px; color: #777;">ボーナス枠 21〜30 獲得</div>
                </div>
            </div>

            <div
                style="display: flex; align-items: center; gap: 15px; background: #fafafa; padding: 10px; border-radius: 8px; border: 1px solid #eee;">
                <div style="position: relative; width: 44px; height: 44px;">
                    <div
                        style="width: 100%; height: 100%; background: #3498db; color: #fff; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 20px; font-weight: bold;">
                        S</div>
                    <span class="bonus-badge tier-rare">IV</span>
                </div>
                <div>
                    <div style="font-weight: bold; font-size: 14px; color: #2563EB;">サファイアサポーター</div>
                    <div style="font-size: 12px; color: #777;">ボーナス枠 31〜40 獲得</div>
                </div>
            </div>

            <div
                style="display: flex; align-items: center; gap: 15px; background: #fafafa; padding: 10px; border-radius: 8px; border: 1px solid #eee;">
                <div style="position: relative; width: 44px; height: 44px;">
                    <div
                        style="width: 100%; height: 100%; background: #9b59b6; color: #fff; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 20px; font-weight: bold;">
                        A</div>
                    <span class="bonus-badge tier-epic">V</span>
                </div>
                <div>
                    <div style="font-weight: bold; font-size: 14px; color: #7C3AED;">アメジストサポーター</div>
                    <div style="font-size: 12px; color: #777;">ボーナス枠 41〜50 獲得</div>
                </div>
            </div>

            <div
                style="display: flex; align-items: center; gap: 15px; background: #fafafa; padding: 10px; border-radius: 8px; border: 1px solid #eee;">
                <div style="position: relative; width: 44px; height: 44px;">
                    <div
                        style="width: 100%; height: 100%; background: #2c3e50; color: #fff; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 20px; font-weight: bold;">
                        L</div>
                    <span class="bonus-badge tier-legend">★</span>
                </div>
                <div>
                    <div style="font-weight: bold; font-size: 14px; color: #d35400;">レジェンドサポーター</div>
                    <div style="font-size: 12px; color: #777;">ボーナス枠 51〜 獲得</div>
                </div>
            </div>
        </div>

        <div style="margin-top: 20px; text-align: center;">
            <button type="button" class="setae-btn" id="btn-close-badge-info-bottom"
                style="width: 100%; background: #ecf0f1; color: #333; padding: 10px; font-weight: bold;">閉じる</button>
        </div>
    </div>
</div>

<div id="baby-create-modal" class="setae-modal baby-create-modal" style="display:none;" aria-hidden="true">
    <div class="baby-create-dialog" role="dialog" aria-modal="true" aria-labelledby="baby-create-title">
        <header class="baby-create-dialog-header">
            <div>
                <span class="baby-create-kicker">NEW BABY GROUP</span>
                <h2 id="baby-create-title">ベビー群を追加</h2>
                <p>同じ孵化・発見タイミングの個体を、連番でまとめて管理します。</p>
            </div>
            <button type="button" class="baby-create-close js-close-baby-create" aria-label="ベビー群の追加を閉じる">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true">
                    <path d="M18 6 6 18M6 6l12 12"></path>
                </svg>
            </button>
        </header>

        <form id="baby-group-form" class="baby-create-form" novalidate>
            <div class="baby-create-dialog-body">
                <section class="baby-create-section" aria-labelledby="baby-create-basic-title">
                    <div class="baby-create-section-head">
                        <span aria-hidden="true">1</span>
                        <div>
                            <strong id="baby-create-basic-title">管理の基本</strong>
                            <p>管理名と連番の範囲を決めます。</p>
                        </div>
                    </div>
                    <div class="baby-form-grid">
                        <label>
                            <span>管理名</span>
                            <input type="text" id="baby-group-name" class="setae-input" placeholder="2026年7月 A群" maxlength="80" autocomplete="off" required>
                        </label>
                        <label>
                            <span>番号の頭文字</span>
                            <input type="text" id="baby-group-prefix" class="setae-input" placeholder="A" maxlength="8" value="A" inputmode="latin" autocapitalize="characters" autocomplete="off">
                            <small id="baby-prefix-feedback" class="baby-prefix-feedback" aria-live="polite"></small>
                        </label>
                        <label>
                            <span>匹数</span>
                            <input type="number" id="baby-group-count" class="setae-input" min="1" max="500" value="100" inputmode="numeric" required>
                        </label>
                        <label class="baby-date-field">
                            <span>孵化日/発見日</span>
                            <span class="baby-date-control">
                                <input type="date" id="baby-group-birth-date" class="setae-input">
                            </span>
                        </label>
                    </div>
                </section>

                <section class="baby-create-section" aria-labelledby="baby-create-lineage-title">
                    <div class="baby-create-section-head">
                        <span aria-hidden="true">2</span>
                        <div>
                            <strong id="baby-create-lineage-title">種類と親個体</strong>
                            <p>種類を選ぶと、同じ種類の親個体を優先して探せます。</p>
                        </div>
                    </div>
                    <div class="baby-create-lineage-grid">
                        <label class="baby-field-full">
                            <span>種類</span>
                            <div id="baby-species-search-wrapper" class="baby-autocomplete-wrapper">
                                <input type="text" id="baby-group-species" class="setae-input" placeholder="例: Psalmopoeus irminia" autocomplete="off">
                                <input type="hidden" id="baby-group-species-id" value="">
                                <div id="baby-species-suggestions" class="baby-suggestions" style="display:none;"></div>
                            </div>
                        </label>
                        <label class="baby-field-full baby-parent-search-field">
                            <span>親個体を絞り込み</span>
                            <input type="search" id="baby-parent-search" class="setae-input" placeholder="種類名・個体名で検索" autocomplete="off">
                        </label>
                        <div class="baby-parent-grid baby-field-full">
                            <label>
                                <span>親個体 1</span>
                                <select id="baby-parent-spider-1" class="setae-input baby-parent-select">
                                    <option value="">未選択</option>
                                </select>
                            </label>
                            <label>
                                <span>親個体 2</span>
                                <select id="baby-parent-spider-2" class="setae-input baby-parent-select">
                                    <option value="">未選択</option>
                                </select>
                            </label>
                        </div>
                        <label class="baby-field-full">
                            <span>親・管理メモ</span>
                            <textarea id="baby-group-parent-note" class="setae-input" rows="3" placeholder="例: 親: メスA x オスB / 温度や発見時の状況"></textarea>
                        </label>
                    </div>
                </section>
            </div>

            <footer class="baby-create-dialog-footer">
                <span id="baby-number-preview" class="baby-number-preview" aria-live="polite">A001-A100で作成</span>
                <div>
                    <button type="button" class="setae-btn setae-btn-secondary js-close-baby-create">キャンセル</button>
                    <button type="submit" class="setae-btn setae-btn-primary">ベビー群を追加</button>
                </div>
            </footer>
        </form>
    </div>
</div>

<div id="setae-qr-modal" class="setae-modal setae-qr-modal" style="display:none;" aria-hidden="true">
    <div class="setae-qr-dialog" role="dialog" aria-modal="true" aria-labelledby="setae-qr-title">
        <header class="setae-qr-dialog-header">
            <div>
                <span class="setae-qr-dialog-kicker">CARE LABEL</span>
                <h2 id="setae-qr-title">QR管理</h2>
            </div>
            <button type="button" class="setae-qr-close" aria-label="QR管理を閉じる">&times;</button>
        </header>

        <nav class="setae-qr-tabs" role="tablist" aria-label="QR管理メニュー">
            <button type="button" class="setae-qr-tab is-active" data-qr-panel="labels" role="tab" aria-selected="true">ラベル</button>
            <button type="button" class="setae-qr-tab" data-qr-panel="scanner" role="tab" aria-selected="false">読み取り</button>
            <button type="button" class="setae-qr-tab" data-qr-panel="transfers" role="tab" aria-selected="false">
                引き継ぎ <span id="setae-qr-transfer-count" hidden></span>
            </button>
        </nav>

        <div class="setae-qr-dialog-body">
            <section class="setae-qr-panel is-active" data-qr-panel-content="labels">
                <div class="setae-qr-label-layout">
                    <aside class="setae-qr-targets-pane">
                        <div class="setae-qr-targets-head">
                            <div>
                                <strong id="setae-qr-source-title">マイ個体</strong>
                                <span id="setae-qr-selection-count">0件選択</span>
                            </div>
                            <button type="button" id="setae-qr-select-all">すべて選択</button>
                        </div>
                        <label class="setae-qr-search">
                            <span class="screen-reader-text">QRラベル対象を検索</span>
                            <input type="search" id="setae-qr-target-search" placeholder="名前・種類・番号で検索" autocomplete="off">
                        </label>
                        <div id="setae-qr-target-list" class="setae-qr-target-list" aria-live="polite"></div>
                    </aside>

                    <div class="setae-qr-label-workspace">
                        <div class="setae-qr-format-row">
                            <div class="setae-qr-segmented" role="group" aria-label="印刷形式">
                                <button type="button" class="is-active" data-qr-format="tape">12mmテープ</button>
                                <button type="button" data-qr-format="a4">A4</button>
                            </div>
                            <label class="setae-qr-length-control">
                                <span>ラベル長</span>
                                <input type="range" id="setae-qr-label-length" min="43" max="70" step="1" value="45">
                                <output id="setae-qr-label-length-value">45mm</output>
                            </label>
                        </div>

                        <div class="setae-qr-preview-stage">
                            <div class="setae-qr-preview-heading">
                                <div>
                                    <strong>印刷プレビュー</strong>
                                    <span>12mm高・QR 10mm角・手書き欄25mm以上</span>
                                </div>
                                <span id="setae-qr-preview-counter">1 / 1</span>
                            </div>
                            <div id="setae-qr-label-preview" class="setae-qr-label-preview" aria-live="polite"></div>
                            <div class="setae-qr-preview-nav">
                                <button type="button" id="setae-qr-preview-prev" aria-label="前のラベル">&lsaquo;</button>
                                <span id="setae-qr-preview-name">対象を選択してください</span>
                                <button type="button" id="setae-qr-preview-next" aria-label="次のラベル">&rsaquo;</button>
                            </div>
                        </div>

                        <div class="setae-qr-print-note">
                            <strong id="setae-qr-print-note-title">実寸PDF</strong>
                            <span id="setae-qr-print-note-text">macOS「プレビュー」またはAdobe Acrobatで開き、倍率100%で印刷します。SR-MK1 / SR5900Pなど360dpi機を推奨します。</span>
                        </div>

                        <div class="setae-qr-label-actions">
                            <button type="button" id="setae-qr-copy-url" class="setae-qr-secondary-btn" disabled>短縮URLをコピー</button>
                            <button type="button" id="setae-qr-print" class="setae-qr-primary-btn" disabled>テプラ用PDF・0枚を作成</button>
                        </div>
                    </div>
                </div>
            </section>

            <section class="setae-qr-panel" data-qr-panel-content="scanner" hidden>
                <div class="setae-qr-scanner-layout">
                    <div class="setae-qr-camera-pane">
                        <div id="setae-qr-camera-stage" class="setae-qr-camera-stage">
                            <video id="setae-qr-video" playsinline muted></video>
                            <canvas id="setae-qr-scan-canvas" hidden></canvas>
                            <div class="setae-qr-camera-empty">
                                <svg class="setae-qr-empty-mark" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                                    <rect width="5" height="5" x="3" y="3" rx="1"></rect>
                                    <rect width="5" height="5" x="16" y="3" rx="1"></rect>
                                    <rect width="5" height="5" x="3" y="16" rx="1"></rect>
                                    <path d="M21 16h-3a2 2 0 0 0-2 2v3"></path>
                                    <path d="M21 21v.01"></path><path d="M12 7v3a2 2 0 0 1-2 2H7"></path>
                                    <path d="M3 12h.01"></path><path d="M12 3h.01"></path><path d="M12 16v.01"></path>
                                    <path d="M16 12h1"></path><path d="M21 12v.01"></path><path d="M12 21v-1"></path>
                                </svg>
                                <strong>QRを読み取る</strong>
                            </div>
                            <div class="setae-qr-scan-frame" aria-hidden="true"></div>
                        </div>
                        <div class="setae-qr-camera-actions">
                            <button type="button" id="setae-qr-camera-toggle" class="setae-qr-primary-btn">カメラを開始</button>
                            <label class="setae-qr-secondary-btn setae-qr-file-label">
                                画像から読み取る
                                <input type="file" id="setae-qr-image-input" accept="image/*" capture="environment">
                            </label>
                        </div>
                        <div id="setae-qr-scan-status" class="setae-qr-scan-status" aria-live="polite">ラベルを続けて読むと、まとめて記録できます。</div>
                    </div>

                    <div class="setae-qr-record-pane">
                        <div class="setae-qr-queue-head">
                            <div><strong>読み取り済み</strong><span id="setae-qr-queue-count">0件</span></div>
                            <button type="button" id="setae-qr-queue-clear">すべて外す</button>
                        </div>
                        <div id="setae-qr-scan-queue" class="setae-qr-scan-queue"></div>
                        <div class="setae-qr-record-workspace">
                            <form id="setae-qr-record-form" class="setae-qr-record-form" novalidate>
                                <div class="setae-qr-record-form-head">
                                    <div>
                                        <span>NEW RECORD</span>
                                        <strong id="setae-qr-record-form-title">記録を追加</strong>
                                    </div>
                                    <button type="button" id="setae-qr-record-edit-cancel" hidden>編集をやめる</button>
                                </div>
                                <fieldset class="setae-qr-record-type-fieldset">
                                    <legend>記録の種類</legend>
                                    <input type="hidden" id="setae-qr-record-type" value="feed">
                                    <div class="setae-qr-record-types" role="group" aria-label="記録の種類">
                                        <button type="button" class="is-active" data-qr-record-type="feed" aria-pressed="true"><i aria-hidden="true"></i>給餌</button>
                                        <button type="button" data-qr-record-type="molt" aria-pressed="false"><i aria-hidden="true"></i>脱皮</button>
                                        <button type="button" data-qr-record-type="pairing" aria-pressed="false"><i aria-hidden="true"></i>ペアリング</button>
                                        <button type="button" data-qr-record-type="observation" aria-pressed="false"><i aria-hidden="true"></i>メモ</button>
                                    </div>
                                </fieldset>
                                <div class="setae-qr-record-row">
                                    <label>
                                        <span>日付</span>
                                        <input type="date" id="setae-qr-record-date" class="setae-input" required>
                                    </label>
                                    <label id="setae-qr-prey-field">
                                        <span>餌</span>
                                        <input type="text" id="setae-qr-record-prey" class="setae-input" placeholder="例: ヨーロッパイエコオロギ">
                                    </label>
                                </div>
                                <label>
                                    <span>メモ（任意）</span>
                                    <textarea id="setae-qr-record-note" class="setae-input" rows="2" maxlength="5000" placeholder="手書きした内容や補足"></textarea>
                                </label>
                                <button type="submit" id="setae-qr-record-add" class="setae-qr-secondary-btn">保存リストに追加</button>
                            </form>

                            <section class="setae-qr-record-drafts" aria-labelledby="setae-qr-record-drafts-title">
                                <header>
                                    <div><strong id="setae-qr-record-drafts-title">保存する記録</strong><span id="setae-qr-record-draft-count">0件</span></div>
                                    <button type="button" id="setae-qr-record-clear" hidden>すべて削除</button>
                                </header>
                                <div id="setae-qr-record-draft-list" aria-live="polite"></div>
                            </section>
                        </div>

                        <div class="setae-qr-batch-actions">
                            <span id="setae-qr-batch-summary">個体を読み取り、記録を追加してください</span>
                            <button type="button" id="setae-qr-record-submit" class="setae-qr-primary-btn" disabled>まとめて保存</button>
                        </div>
                    </div>
                </div>
            </section>

            <section class="setae-qr-panel" data-qr-panel-content="transfers" hidden>
                <div class="setae-qr-transfer-layout">
                    <div class="setae-qr-transfer-column">
                        <header><span>RECEIVED</span><h3>届いた申請</h3></header>
                        <div id="setae-qr-transfer-incoming" class="setae-qr-transfer-list"></div>
                    </div>
                    <div class="setae-qr-transfer-column">
                        <header><span>SENT</span><h3>申請中・完了</h3></header>
                        <div id="setae-qr-transfer-outgoing" class="setae-qr-transfer-list"></div>
                    </div>
                </div>
            </section>
        </div>
    </div>
</div>

<?php
?>
