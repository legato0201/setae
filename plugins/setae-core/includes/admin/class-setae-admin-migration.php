<?php

if (!defined('ABSPATH')) {
    exit; // Exit if accessed directly.
}

class Setae_Admin_Migration
{

    public function __construct()
    {
        add_action('admin_menu', array($this, 'add_migration_menu'));
        add_action('wp_ajax_setae_migration_preview', array($this, 'ajax_preview'));
        add_action('wp_ajax_setae_migration_execute', array($this, 'ajax_execute'));
    }

    public function add_migration_menu()
    {
        add_submenu_page(
            'edit.php?post_type=setae_spider',
            'データ移行ツール',
            'データ移行ツール',
            'manage_options',
            'setae_migration',
            array($this, 'render_admin_page')
        );
    }

    public function render_admin_page()
    {
        $db_host = get_option('setae_mig_db_host', 'localhost');
        $db_name = get_option('setae_mig_db_name', '');
        $db_user = get_option('setae_mig_db_user', '');
        $db_pass = get_option('setae_mig_db_pass', '');
        $db_pref = get_option('setae_mig_db_pref', 'wp_');
        ?>
        <style>
            .mig-preview-table {
                width: 100%;
                border-collapse: collapse;
                margin-top: 15px;
                background: #fff;
            }

            .mig-preview-table th,
            .mig-preview-table td {
                border: 1px solid #ccd0d4;
                padding: 10px;
                text-align: left;
                vertical-align: top;
            }

            .mig-preview-table th {
                background: #f0f0f1;
                font-size: 13px;
            }

            .mig-log-details {
                background: #fafafa;
                padding: 10px;
                margin-top: 5px;
                border: 1px dashed #ccc;
                font-size: 12px;
                max-height: 200px;
                overflow-y: auto;
            }

            .mig-log-item {
                border-bottom: 1px solid #eee;
                padding: 5px 0;
                display: flex;
                gap: 10px;
            }

            .mig-log-item:last-child {
                border-bottom: none;
            }

            .mig-log-img {
                width: 50px;
                height: 50px;
                object-fit: cover;
                border-radius: 4px;
                border: 1px solid #ddd;
            }

            .mig-log-meta span {
                display: inline-block;
                background: #e0e0e0;
                padding: 2px 6px;
                border-radius: 3px;
                margin-right: 5px;
                font-size: 11px;
            }

            .mig-log-meta span.molt {
                background: #ffeb3b;
            }

            .mig-log-meta span.food {
                background: #4caf50;
                color: white;
            }

            .mig-input-group {
                margin-bottom: 10px;
            }

            .mig-input-group label.title {
                display: block;
                font-size: 12px;
                font-weight: bold;
                color: #333;
                margin-bottom: 5px;
            }

            /* タブ用CSS */
            .mig-tab-content {
                display: none;
                padding: 20px;
                background: #fff;
                border: 1px solid #ccd0d4;
                border-top: none;
            }

            .mig-tab-content.active {
                display: block;
            }

            /* ラジオボタン用CSS */
            .setae-radio-group .radio-chip {
                border: 1px solid #ccc;
                padding: 5px 10px;
                border-radius: 20px;
                cursor: pointer;
                display: flex;
                align-items: center;
                gap: 5px;
                font-size: 12px;
                background: #fff;
                transition: all 0.2s;
            }

            .setae-radio-group .radio-chip.active {
                background: #0073aa;
                color: #fff;
                border-color: #0073aa;
            }

            .setae-radio-group .radio-chip img {
                width: 16px;
                height: 16px;
            }
        </style>

        <div class="wrap">
            <h1 class="wp-heading-inline">データ移行ツール (レガシーDBからSetaeへ)</h1>
            <p>別のWordPressデータベースから、個体データと飼育ログをインポートします。画像は自動でサーバーにダウンロードされます。</p>

            <h2 class="nav-tab-wrapper">
                <a href="#tab-settings" class="nav-tab nav-tab-active">1. データベース設定</a>
                <a href="#tab-preview" class="nav-tab">2. プレビュー ＆ 実行</a>
            </h2>

            <div id="tab-settings" class="mig-tab-content active">
                <form id="setae-mig-form" style="max-width: 600px;">
                    <table class="form-table">
                        <tr>
                            <th><label>Database Host</label></th>
                            <td><input type="text" id="mig_db_host" value="<?php echo esc_attr($db_host); ?>"
                                    class="regular-text"></td>
                        </tr>
                        <tr>
                            <th><label>Database Name</label></th>
                            <td><input type="text" id="mig_db_name" value="<?php echo esc_attr($db_name); ?>"
                                    class="regular-text"></td>
                        </tr>
                        <tr>
                            <th><label>Database User</label></th>
                            <td><input type="text" id="mig_db_user" value="<?php echo esc_attr($db_user); ?>"
                                    class="regular-text"></td>
                        </tr>
                        <tr>
                            <th><label>Database Password</label></th>
                            <td><input type="password" id="mig_db_pass" value="<?php echo esc_attr($db_pass); ?>"
                                    class="regular-text"></td>
                        </tr>
                        <tr>
                            <th><label>Table Prefix</label></th>
                            <td><input type="text" id="mig_db_pref" value="<?php echo esc_attr($db_pref); ?>"
                                    class="regular-text"></td>
                        </tr>
                        <tr>
                            <th colspan="2">
                                <hr>
                            </th>
                        </tr>
                        <tr>
                            <th><label>移行元 (旧) ユーザーID</label></th>
                            <td><input type="number" id="mig_legacy_user_id" value="" class="regular-text" placeholder="例: 1"
                                    required></td>
                        </tr>
                        <tr>
                            <th><label>移行先 (新) WPユーザー</label></th>
                            <td>
                                <?php
                                wp_dropdown_users(array(
                                    'name' => 'mig_new_wp_user_id',
                                    'id' => 'mig_new_wp_user_id',
                                    'show_option_none' => '-- 紐付けるユーザーを選択 --',
                                    'class' => 'regular-text'
                                ));
                                ?>
                            </td>
                        </tr>
                    </table>
                    <?php wp_nonce_field('setae_migration_nonce', '_mig_nonce'); ?>
                    <p class="submit">
                        <button type="button" id="btn-mig-preview" class="button button-primary">全件プレビュー取得 ＆ タブを移動</button>
                    </p>
                </form>
            </div>

            <div id="tab-preview" class="mig-tab-content">
                <div id="mig-preview-area" style="min-height: 150px; background: #f0f0f1; padding: 15px;">
                    <p style="color: #666;">「1. データベース設定」タブから「全件プレビュー取得」を実行してください。</p>
                </div>
                <p class="submit">
                    <button type="button" id="btn-mig-execute" class="button button-primary button-large"
                        disabled>マッピングして移行を実行する</button>
                </p>
                <div id="mig-progress" style="display:none; margin-top:10px; font-weight:bold; color:#0073aa;">
                    処理中...（画像のダウンロードを行うため時間がかかります。ブラウザを閉じないでください）
                </div>
            </div>
        </div>

        <script>
            jQuery(document).ready(function ($) {
                // タブ切り替え処理
                $('.nav-tab').on('click', function (e) {
                    e.preventDefault();
                    $('.nav-tab').removeClass('nav-tab-active');
                    $(this).addClass('nav-tab-active');
                    $('.mig-tab-content').removeClass('active');
                    $($(this).attr('href')).addClass('active');
                });

                // ラジオチップの選択UI
                $(document).on('click', '.radio-chip', function () {
                    $(this).siblings('.radio-chip').removeClass('active');
                    $(this).addClass('active');
                    $(this).find('input[type="radio"]').prop('checked', true).trigger('change');
                });

                function validateUserSelection() {
                    const legacyId = $('#mig_legacy_user_id').val();
                    const newUserId = $('#mig_new_wp_user_id').val();
                    if (!legacyId || !newUserId || newUserId === '-1') {
                        alert('旧ユーザーIDと新WPユーザーの両方を指定してください。');
                        return false;
                    }
                    return true;
                }

                $('#btn-mig-preview').on('click', function () {
                    if (!validateUserSelection()) return;

                    const $btn = $(this);
                    $btn.prop('disabled', true).text('データ取得中...');
                    $('#mig-preview-area').html('<p>データを読み込んでいます...</p>');
                    $('#btn-mig-execute').prop('disabled', true);

                    // タブをプレビューに切り替え
                    $('.nav-tab[href="#tab-preview"]').click();

                    $.post(ajaxurl, {
                        action: 'setae_migration_preview',
                        nonce: $('#_mig_nonce').val(),
                        host: $('#mig_db_host').val(),
                        name: $('#mig_db_name').val(),
                        user: $('#mig_db_user').val(),
                        pass: $('#mig_db_pass').val(),
                        pref: $('#mig_db_pref').val(),
                        legacy_user_id: $('#mig_legacy_user_id').val(),
                        new_wp_user_id: $('#mig_new_wp_user_id').val()
                    }, function (res) {
                        $btn.prop('disabled', false).text('全件プレビュー取得 ＆ タブを移動');

                        if (res.success) {
                            const data = res.data;
                            if (data.animals.length === 0) {
                                $('#mig-preview-area').html('<p>対象のデータが見つかりませんでした。</p>');
                                return;
                            }

                            let speciesOptions = '<option value="">-- 図鑑(学名)を選択 --</option>';
                            data.species_list.forEach(sp => { speciesOptions += `<option value="${sp.id}">${sp.title}</option>`; });

                            let html = `<p><strong>${data.animals.length}件</strong> の個体データが見つかりました。</p>`;
                            html += `<table class="mig-preview-table">
                                    <thead>
                                        <tr>
                                            <th style="width:30px; text-align:center;"><input type="checkbox" id="mig-select-all" checked></th>
                                            <th style="width:50px;">旧ID</th>
                                            <th style="width:150px;">個体名 (性別)</th>
                                            <th style="width:350px;">分類・種の設定</th>
                                            <th>ログプレビュー</th>
                                        </tr>
                                    </thead>
                                    <tbody>`;

                            data.animals.forEach(animal => {
                                // 大分類の自動判定ロジック
                                let defaultClass = 'other';
                                let legacyType = animal.legacy_animal_type || '';
                                let legacyCat = animal.legacy_category || '';

                                if (legacyType === '蛛形類' || legacyCat === 'タランチュラ' || legacyCat === 'クモ') defaultClass = 'tarantula';
                                else if (legacyCat === 'サソリ') defaultClass = 'scorpion';
                                else if (legacyType === '爬虫類' || legacyType === '両生類') defaultClass = 'reptile';
                                else if (legacyType === '植物' || legacyType.includes('植物')) defaultClass = 'plant';

                                let isTarantula = (defaultClass === 'tarantula');

                                // ログHTML
                                let logsHtml = animal.logs.length > 0 ? '' : '<p style="color:#999;">ログなし</p>';
                                animal.logs.forEach(log => {
                                    let imgHtml = log.photo ? `<img src="${log.photo}" class="mig-log-img">` : `<div class="mig-log-img" style="background:#ddd; display:flex; align-items:center; justify-content:center; color:#999; font-size:10px;">NoImg</div>`;
                                    let metaHtml = '';
                                    if (log.molt === 'Yes') metaHtml += `<span class="molt">脱皮</span>`;
                                    if (log.food) metaHtml += `<span class="food">餌: ${log.food}</span>`;
                                    logsHtml += `<div class="mig-log-item">${imgHtml}<div><div style="font-weight:bold; color:#555;">${log.date}</div><div class="mig-log-meta">${metaHtml}</div><div style="margin-top:2px;">${log.note || '-'}</div></div></div>`;
                                });

                                // ラジオボタングループHTML生成
                                let radioName = `class_${animal.legacy_id}`;
                                let radioHtml = `
                                <div class="setae-radio-group mig-val-class-group" style="display:flex; gap:5px; flex-wrap:wrap;">
                                    <label class="radio-chip ${defaultClass === 'tarantula' ? 'active' : ''}">
                                        <input type="radio" name="${radioName}" value="tarantula" ${defaultClass === 'tarantula' ? 'checked' : ''} hidden>
                                        <img src="https://s.w.org/images/core/emoji/17.0.2/svg/1f577.svg" alt="🕷️">クモ
                                    </label>
                                    <label class="radio-chip ${defaultClass === 'scorpion' ? 'active' : ''}">
                                        <input type="radio" name="${radioName}" value="scorpion" ${defaultClass === 'scorpion' ? 'checked' : ''} hidden>
                                        <img src="https://s.w.org/images/core/emoji/17.0.2/svg/1f982.svg" alt="🦂">サソリ
                                    </label>
                                    <label class="radio-chip ${defaultClass === 'reptile' ? 'active' : ''}">
                                        <input type="radio" name="${radioName}" value="reptile" ${defaultClass === 'reptile' ? 'checked' : ''} hidden>
                                        <img src="https://s.w.org/images/core/emoji/17.0.2/svg/1f98e.svg" alt="🦎">爬虫類
                                    </label>
                                    <label class="radio-chip ${defaultClass === 'plant' ? 'active' : ''}">
                                        <input type="radio" name="${radioName}" value="plant" ${defaultClass === 'plant' ? 'checked' : ''} hidden>
                                        <img src="https://s.w.org/images/core/emoji/17.0.2/svg/1f33f.svg" alt="🌿">植物
                                    </label>
                                    <label class="radio-chip ${defaultClass === 'other' ? 'active' : ''}">
                                        <input type="radio" name="${radioName}" value="other" ${defaultClass === 'other' ? 'checked' : ''} hidden>
                                        <img src="https://s.w.org/images/core/emoji/17.0.2/svg/1f4e6.svg" alt="📦">その他
                                    </label>
                                </div>
                            `;

                                html += `
                                <tr class="mig-animal-row" data-legacy-id="${animal.legacy_id}">
                                    <td style="text-align:center;"><input type="checkbox" class="mig-select-animal" value="${animal.legacy_id}" checked></td>
                                    <td>${animal.legacy_id}</td>
                                    <td><strong>${animal.name}</strong><br><small>(${animal.gender})</small></td>
                                    <td>
                                        <div class="mig-input-group">
                                            <label class="title">大分類 (Classification)</label>
                                            ${radioHtml}
                                        </div>
                                        <div class="mig-input-group">
                                            <label class="title">種類指定</label>
                                            <select class="mig-val-type" style="width:100%;">
                                                <option value="tarantula" ${isTarantula ? 'selected' : ''}>図鑑と紐付け</option>
                                                <option value="other" ${!isTarantula ? 'selected' : ''}>自由入力</option>
                                            </select>
                                        </div>
                                        <div class="mig-input-group mig-species-container" style="${isTarantula ? '' : 'display:none;'}">
                                            <select class="mig-val-species-id" style="width:100%;">${speciesOptions}</select>
                                        </div>
                                        <div class="mig-input-group mig-custom-container" style="${!isTarantula ? '' : 'display:none;'}">
                                            <input type="text" class="mig-val-custom-name" value="${animal.legacy_category || animal.legacy_animal_type || ''}" placeholder="種類名を入力" style="width:100%;">
                                        </div>
                                    </td>
                                    <td>
                                        <details>
                                            <summary style="cursor:pointer; color:#0073aa; font-weight:bold;">
                                                ログ ${animal.logs_count}件 を確認
                                            </summary>
                                            <div class="mig-log-details">
                                                ${logsHtml}
                                            </div>
                                        </details>
                                    </td>
                                </tr>
                            `;
                            });

                            html += `</tbody></table>`;
                            $('#mig-preview-area').html(html);
                            $('#btn-mig-execute').prop('disabled', false);

                            // ▼ 追加: 全選択/全解除のイベント ▼
                            $('#mig-select-all').on('change', function () {
                                $('.mig-select-animal').prop('checked', $(this).prop('checked'));
                            });
                            // ▲ 追加ここまで ▲

                            // 種類指定のセレクトボックス切り替えイベント
                            $('.mig-val-type').on('change', function () {
                                const $td = $(this).closest('td');
                                if ($(this).val() === 'tarantula') {
                                    $td.find('.mig-species-container').show();
                                    $td.find('.mig-custom-container').hide();
                                } else {
                                    $td.find('.mig-species-container').hide();
                                    $td.find('.mig-custom-container').show();
                                }
                            });

                        } else {
                            $('#mig-preview-area').html('<p style="color:red;">エラー: ' + res.data + '</p>');
                        }
                    });
                });

                $('#btn-mig-execute').on('click', function () {
                    if (!validateUserSelection()) return;

                    let mapping = {};
                    $('.mig-animal-row').each(function () {
                        // ▼ 追加: チェックされていない行はスキップ ▼
                        if (!$(this).find('.mig-select-animal').prop('checked')) return;

                        let legId = $(this).data('legacy-id');
                        let classVal = $(this).find('input[type="radio"]:checked').val();
                        let typeVal = $(this).find('.mig-val-type').val();
                        let speciesId = $(this).find('.mig-val-species-id').val();
                        let customName = $(this).find('.mig-val-custom-name').val();

                        mapping[legId] = {
                            classification: classVal,
                            type: typeVal,
                            species_id: speciesId,
                            custom_name: customName
                        };
                    });

                    // ▼ 追加: 選択数が0ならアラートを出して終了 ▼
                    if (Object.keys(mapping).length === 0) {
                        alert('移行する個体が選択されていません。');
                        return;
                    }

                    if (!confirm(Object.keys(mapping).length + '件の個体を移行します。\n画像のダウンロードを行うため時間がかかります。開始しますか？')) return;

                    const $btn = $(this);
                    $btn.prop('disabled', true);
                    $('#mig-progress').show();

                    $.post(ajaxurl, {
                        action: 'setae_migration_execute',
                        nonce: $('#_mig_nonce').val(),
                        host: $('#mig_db_host').val(),
                        name: $('#mig_db_name').val(),
                        user: $('#mig_db_user').val(),
                        pass: $('#mig_db_pass').val(),
                        pref: $('#mig_db_pref').val(),
                        legacy_user_id: $('#mig_legacy_user_id').val(),
                        new_wp_user_id: $('#mig_new_wp_user_id').val(),
                        mapping: mapping
                    }, function (res) {
                        $('#mig-progress').hide();
                        if (res.success) {
                            alert('移行が完了しました！\n個体: ' + res.data.imported_animals + '件\nログ: ' + res.data.imported_records + '件\n画像DL: ' + res.data.imported_images + '件');
                            $('#mig-preview-area').html('<p style="color:green; font-weight:bold;">すべての移行が完了しました。</p>');
                        } else {
                            alert('エラーが発生しました: ' + res.data);
                            $btn.prop('disabled', false);
                        }
                    });
                });
            });
        </script>
        <?php
    }

    private function get_external_db()
    {
        $host = sanitize_text_field($_POST['host']);
        $name = sanitize_text_field($_POST['name']);
        $user = sanitize_text_field($_POST['user']);
        $pass = sanitize_text_field($_POST['pass']);
        $pref = sanitize_text_field($_POST['pref']);

        update_option('setae_mig_db_host', $host);
        update_option('setae_mig_db_name', $name);
        update_option('setae_mig_db_user', $user);
        update_option('setae_mig_db_pass', $pass);
        update_option('setae_mig_db_pref', $pref);

        $ext_db = new wpdb($user, $pass, $name, $host);
        if (!empty($ext_db->error)) {
            return new WP_Error('db_error', 'データベースへの接続に失敗しました: ' . $ext_db->error->get_error_message());
        }
        $ext_db->ext_prefix = $pref;
        return $ext_db;
    }

    public function ajax_preview()
    {
        check_ajax_referer('setae_migration_nonce', 'nonce');
        if (!current_user_can('manage_options'))
            wp_send_json_error('権限がありません');

        $legacy_user_id = intval($_POST['legacy_user_id']);
        if (empty($legacy_user_id))
            wp_send_json_error('移行元ユーザーIDが正しくありません。');

        $ext_db = $this->get_external_db();
        if (is_wp_error($ext_db))
            wp_send_json_error($ext_db->get_error_message());

        $table_animals = $ext_db->ext_prefix . 'animals';
        $table_records = $ext_db->ext_prefix . 'records';

        // 1. Setae図鑑(Species)の一覧を取得
        $species_posts = get_posts(array(
            'post_type' => 'setae_species',
            'posts_per_page' => -1,
            'orderby' => 'title',
            'order' => 'ASC'
        ));
        $species_list = array();
        foreach ($species_posts as $sp) {
            $species_list[] = array('id' => $sp->ID, 'title' => $sp->post_title);
        }

        // 2. Setaeの分類(Classification)ターム一覧を取得
        $class_terms = get_terms(array(
            'taxonomy' => 'setae_classification',
            'hide_empty' => false,
        ));
        $classifications = array();
        if (!is_wp_error($class_terms)) {
            foreach ($class_terms as $term) {
                $classifications[] = $term->name;
            }
        }

        // 3. 旧データの取得
        $animals = $ext_db->get_results($ext_db->prepare("SELECT * FROM {$table_animals} WHERE user_id = %d", $legacy_user_id), ARRAY_A);
        if ($ext_db->last_error)
            wp_send_json_error("テーブルエラー: " . $ext_db->last_error);
        $records = $ext_db->get_results($ext_db->prepare("SELECT * FROM {$table_records} WHERE user_id = %d ORDER BY created_at DESC", $legacy_user_id), ARRAY_A);

        // 4. 個体ごとにログを整理してプレビューデータを構築
        $preview_data = array();
        foreach ($animals as $animal) {
            $animal_logs = array_filter($records, function ($r) use ($animal) {
                return $r['animal_id'] == $animal['id'];
            });

            $logs_preview = array();
            foreach ($animal_logs as $log) {
                $logs_preview[] = array(
                    'date' => date('Y-m-d H:i', strtotime($log['created_at'])),
                    'note' => $log['comment'],
                    'food' => $log['food_type'],
                    'molt' => $log['is_molt'] ? 'Yes' : 'No',
                    'photo' => $log['photo']
                );
            }

            $preview_data[] = array(
                'legacy_id' => $animal['id'],
                'name' => $animal['japanese_name'] ?: ($animal['management_no'] ?: '名無し'),
                'gender' => $this->map_gender($animal['gender']),
                'legacy_category' => $animal['category'],
                'legacy_animal_type' => $animal['animal_type'],
                'logs_count' => count($logs_preview),
                'logs' => array_values($logs_preview)
            );
        }

        wp_send_json_success(array(
            'species_list' => $species_list,
            'classifications' => $classifications,
            'animals' => $preview_data
        ));
    }

    public function ajax_execute()
    {
        check_ajax_referer('setae_migration_nonce', 'nonce');
        if (!current_user_can('manage_options'))
            wp_send_json_error('権限がありません');

        // サイドロード（画像ダウンロード）用のファイルを読み込む
        require_once(ABSPATH . 'wp-admin/includes/media.php');
        require_once(ABSPATH . 'wp-admin/includes/file.php');
        require_once(ABSPATH . 'wp-admin/includes/image.php');

        $legacy_user_id = intval($_POST['legacy_user_id']);
        $new_wp_user_id = intval($_POST['new_wp_user_id']);
        $mapping = isset($_POST['mapping']) ? (array) $_POST['mapping'] : array();

        if (empty($legacy_user_id) || empty($new_wp_user_id)) {
            wp_send_json_error('ユーザーIDが正しくありません。');
        }

        // 画像のダウンロードで時間がかかるため、タイムアウトを長めに設定
        set_time_limit(600);

        $ext_db = $this->get_external_db();
        if (is_wp_error($ext_db))
            wp_send_json_error($ext_db->get_error_message());

        $table_animals = $ext_db->ext_prefix . 'animals';
        $table_records = $ext_db->ext_prefix . 'records';

        $animals = $ext_db->get_results($ext_db->prepare("SELECT * FROM {$table_animals} WHERE user_id = %d", $legacy_user_id), ARRAY_A);

        $imported_animals = 0;
        $animal_id_map = array();

        foreach ($animals as $animal) {
            // ▼ 追加: mappingに含まれない（チェックされていない）個体はスキップ ▼
            if (!isset($mapping[$animal['id']])) {
                continue;
            }
            // ▲ 追加ここまで ▲

            $existing = get_posts(array(
                'post_type' => 'setae_spider',
                'meta_key' => '_legacy_animal_id',
                'meta_value' => $animal['id'],
                'posts_per_page' => 1,
                'fields' => 'ids'
            ));

            if (!empty($existing)) {
                $animal_id_map[$animal['id']] = $existing[0];
                continue;
            }

            $post_title = $animal['japanese_name'] ?: ($animal['management_no'] ?: 'No Name (' . $animal['id'] . ')');

            $post_data = array(
                'post_title' => $post_title,
                'post_type' => 'setae_spider',
                'post_status' => 'publish',
                'post_author' => $new_wp_user_id,
                'post_date' => $animal['created_at'] !== '0000-00-00 00:00:00' ? $animal['created_at'] : current_time('mysql'),
            );

            $new_post_id = wp_insert_post($post_data);

            if (!is_wp_error($new_post_id)) {
                update_post_meta($new_post_id, '_setae_gender', $this->map_gender($animal['gender']));
                if ($animal['last_shed_date'])
                    update_post_meta($new_post_id, '_setae_last_molt_date', $animal['last_shed_date']);
                if ($animal['last_feed_date'])
                    update_post_meta($new_post_id, '_setae_last_feed_date', $animal['last_feed_date']);
                update_post_meta($new_post_id, '_setae_owner_id', $new_wp_user_id);
                update_post_meta($new_post_id, '_legacy_animal_id', $animal['id']);

                // 分類と種類のマッピング適用
                if (isset($mapping[$animal['id']])) {
                    $map_data = $mapping[$animal['id']];

                    // 1. 大分類 (Classification) の登録
                    if (!empty($map_data['classification'])) {
                        wp_set_object_terms($new_post_id, sanitize_text_field($map_data['classification']), 'setae_classification');
                    }

                    // 2. 種類の登録
                    if ($map_data['type'] === 'tarantula' && !empty($map_data['species_id'])) {
                        update_post_meta($new_post_id, '_setae_species_id', intval($map_data['species_id']));
                    } else if ($map_data['type'] === 'other' && !empty($map_data['custom_name'])) {
                        update_post_meta($new_post_id, '_setae_custom_species_name', sanitize_text_field($map_data['custom_name']));
                    }
                }

                $animal_id_map[$animal['id']] = $new_post_id;
                $imported_animals++;

                // ▼▼ 追加: 個体のアイコン写真をダウンロードしてアイキャッチに設定 ▼▼
                if (!empty($animal['photo'])) {
                    $photo_url = trim($animal['photo']);
                    // SSL証明書エラー(ループバック)を回避
                    add_filter('https_ssl_verify', '__return_false');
                    add_filter('https_local_ssl_verify', '__return_false');

                    // アタッチメントIDを取得 ('id' を指定)
                    $attach_id = media_sideload_image(esc_url_raw($photo_url), $new_post_id, null, 'id');

                    remove_filter('https_ssl_verify', '__return_false');
                    remove_filter('https_local_ssl_verify', '__return_false');

                    if (!is_wp_error($attach_id)) {
                        set_post_thumbnail($new_post_id, $attach_id);
                    }
                }
                // ▲▲ 追加ここまで ▲▲
            }
        }

        // ----------------------------------------------------------------------------------
        // ▼▼ 修正: 2. 飼育ログの移行 (ここから下をまるごと差し替えてください) ▼▼
        // ----------------------------------------------------------------------------------
        $records = $ext_db->get_results($ext_db->prepare("SELECT * FROM {$table_records} WHERE user_id = %d", $legacy_user_id), ARRAY_A);
        $imported_records = 0;
        $imported_images = 0; // 追加: ダウンロード成功した画像数

        foreach ($records as $record) {
            if (!isset($animal_id_map[$record['animal_id']]))
                continue;
            $new_spider_id = $animal_id_map[$record['animal_id']];

            // 既に作成済みの紐付いていないログを取得
            $existing_log = get_posts(array(
                'post_type' => 'setae_log',
                'meta_key' => '_legacy_record_id',
                'meta_value' => $record['id'],
                'posts_per_page' => 1,
                'fields' => 'ids'
            ));

            $is_update = !empty($existing_log);
            $new_log_id = $is_update ? $existing_log[0] : 0;

            if ($is_update) {
                // 既存ログがある場合は親ID(post_parent)を正しく紐付け直す
                wp_update_post(array(
                    'ID' => $new_log_id,
                    'post_parent' => $new_spider_id
                ));
            } else {
                // 新規作成
                $log_post_data = array(
                    'post_title' => 'Log - ' . date('Y-m-d', strtotime($record['created_at'])),
                    'post_type' => 'setae_log',
                    'post_status' => 'publish',
                    'post_author' => $new_wp_user_id,
                    'post_date' => $record['created_at'] !== '0000-00-00 00:00:00' ? $record['created_at'] : current_time('mysql'),
                    'post_parent' => $new_spider_id // Setaeの仕様で必須
                );
                $new_log_id = wp_insert_post($log_post_data);
            }

            if (!is_wp_error($new_log_id)) {

                // 画像のダウンロード
                $new_image_url = '';
                $photo_url = trim($record['photo']);

                if (!empty($photo_url)) {
                    // まだSetaeのURLになっていない場合のみDL実行
                    if (strpos($photo_url, wp_upload_dir()['baseurl']) === false) {
                        // 同一サーバー間でのSSL検証エラー(ループバック)を強制バイパス
                        add_filter('https_ssl_verify', '__return_false');
                        add_filter('https_local_ssl_verify', '__return_false');

                        $sideloaded_src = media_sideload_image(esc_url_raw($photo_url), $new_log_id, null, 'src');

                        remove_filter('https_ssl_verify', '__return_false');
                        remove_filter('https_local_ssl_verify', '__return_false');

                        if (!is_wp_error($sideloaded_src)) {
                            $new_image_url = $sideloaded_src;
                            $imported_images++;
                        } else {
                            $new_image_url = $photo_url;
                            update_post_meta($new_log_id, '_mig_img_error', $sideloaded_src->get_error_message());
                        }
                    } else {
                        $new_image_url = $photo_url;
                    }
                } else {
                    // アップデート時、既存画像URLがあれば消さないように保持
                    if ($is_update) {
                        $old_data = json_decode(get_post_meta($new_log_id, '_setae_log_data', true), true);
                        if (!empty($old_data['image'])) {
                            $new_image_url = $old_data['image'];
                        }
                    }
                }

                // JSONデータの構築（Setae側で日付が表示されるよう 'date' を追加し、スラッシュのエスケープを防ぐ）
                $log_json_data = array(
                    'date' => date('Y-m-d', strtotime($record['created_at'])),
                    'note' => $record['comment'] ? $record['comment'] : '',
                    'food_type' => $record['food_type'] ? $record['food_type'] : '',
                    'molt' => $record['is_molt'] ? true : false,
                    'image' => $new_image_url
                );

                if (!empty($record['record_weight'])) {
                    $log_json_data['weight'] = $record['record_weight'];
                }

                // 文字列の数字ではなく、int型として明示的に保存する
                update_post_meta($new_log_id, '_setae_log_spider_id', intval($new_spider_id));
                update_post_meta($new_log_id, '_setae_log_data', json_encode($log_json_data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES));
                update_post_meta($new_log_id, '_legacy_record_id', $record['id']);

                if (!$is_update) {
                    $imported_records++;
                }
            }
        }

        wp_send_json_success(array(
            'imported_animals' => $imported_animals,
            'imported_records' => $imported_records,
            'imported_images' => $imported_images // 結果に追加
        ));
    }

    private function map_gender($legacy_gender)
    {
        $legacy_gender = mb_strtolower(trim($legacy_gender));
        if (in_array($legacy_gender, ['オス', 'male', 'm']))
            return 'male';
        if (in_array($legacy_gender, ['メス', 'female', 'f']))
            return 'female';
        return 'unknown';
    }
}

new Setae_Admin_Migration();