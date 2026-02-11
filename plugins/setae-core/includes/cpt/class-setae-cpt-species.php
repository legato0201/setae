<?php

class Setae_CPT_Species
{

    public function register()
    {
        $labels = array(
            'name' => '図鑑',
            'singular_name' => '図鑑',
            'menu_name' => '図鑑',
            'name_admin_bar' => '図鑑',
            'add_new' => '新規追加',
            'add_new_item' => '新規種を追加',
            'new_item' => '新しい種',
            'edit_item' => '種を編集',
            'view_item' => '種を表示',
            'all_items' => 'すべての種',
            'search_items' => '種を検索',
            'not_found' => '見つかりませんでした',
            'not_found_in_trash' => 'ゴミ箱に見つかりませんでした',
        );

        $args = array(
            'labels' => $labels,
            'public' => true,
            'publicly_queryable' => true,
            'show_ui' => true,
            'show_in_menu' => true,
            'query_var' => true,
            'rewrite' => array('slug' => 'encyclopedia'),
            'capability_type' => 'post',
            'has_archive' => true,
            'hierarchical' => false,
            'menu_position' => 5,
            'supports' => array('title', 'editor', 'thumbnail', 'excerpt', 'custom-fields', 'revisions'),
            'show_in_rest' => true,
        );

        register_post_type('setae_species', $args);

        // Taxonomies
        $this->register_taxonomies();

        // Admin Columns
        add_filter('manage_setae_species_posts_columns', array($this, 'set_custom_columns'));
        add_action('manage_setae_species_posts_custom_column', array($this, 'render_custom_column'), 10, 2);
        add_filter('manage_edit-setae_species_sortable_columns', array($this, 'set_sortable_columns'));

        // Admin CSS
        add_action('admin_head', array($this, 'admin_head_css'));

        // ▼ 追加: 一括登録メニューとAJAXフック
        add_action('admin_menu', array($this, 'add_bulk_menu'));
        add_action('wp_ajax_setae_bulk_species_save', array($this, 'handle_bulk_save'));
        // ▲ 追加ここまで
    }

    public function admin_head_css()
    {
        $screen = get_current_screen();
        if ($screen && $screen->id === 'edit-setae_species') {
            ?>
            <style>
                /* Thumbnail Column */
                .column-setae_thumb {
                    width: 60px;
                }

                /* Spider Count Column */
                .column-spider_count {
                    width: 80px;
                    text-align: center;
                    font-size: 1.2em;
                }

                /* Genus */
                .taxonomy-setae_genus a {
                    font-family: monospace;
                    color: #3498db;
                }

                /* Temperament Colors */
                .taxonomy-setae_temperament a {
                    font-weight: 600;
                    padding: 2px 6px;
                    border-radius: 4px;
                    text-decoration: none;
                }

                /* Match slugs loosely */
                .taxonomy-setae_temperament a[href*="docile"] {
                    background: #e8f5e9;
                    color: #27ae60;
                }

                .taxonomy-setae_temperament a[href*="calm"] {
                    background: #e8f5e9;
                    color: #27ae60;
                }

                .taxonomy-setae_temperament a[href*="nervous"] {
                    background: #f3e5f5;
                    color: #8e44ad;
                }

                .taxonomy-setae_temperament a[href*="flighty"] {
                    background: #f3e5f5;
                    color: #8e44ad;
                }

                .taxonomy-setae_temperament a[href*="defensive"] {
                    background: #fff3e0;
                    color: #e67e22;
                }

                .taxonomy-setae_temperament a[href*="aggressive"] {
                    background: #ffebee;
                    color: #c0392b;
                }

                /* Habitat Styling */
                .taxonomy-setae_habitat a {
                    background: #f5f5f5;
                    color: #666;
                    padding: 2px 6px;
                    border-radius: 4px;
                    display: inline-block;
                    margin: 1px 0;
                    font-size: 11px;
                    text-decoration: none;
                    border: 1px solid #ddd;
                }

                .taxonomy-setae_habitat a:hover {
                    background: #fff;
                    border-color: #bbb;
                }
            </style>
            <?php
        }
    }

    private function register_taxonomies()
    {
        // Genus
        register_taxonomy('setae_genus', 'setae_species', array(
            'label' => '属 (Genus)',
            'rewrite' => array('slug' => 'genus'),
            'hierarchical' => true,
            'show_in_rest' => true,
            'show_admin_column' => true,
        ));

        // Habitat
        register_taxonomy('setae_habitat', 'setae_species', array(
            'label' => 'Region (Locality)', // Renamed from Habitat
            'hierarchical' => true,
            'show_in_rest' => true,
            'show_admin_column' => true,
        ));

        // ★追加: 習性 (Type) - 地上性/樹上性/地中性
        register_taxonomy('setae_lifestyle', 'setae_species', array(
            'label' => 'Lifestyle (Type)',
            'hierarchical' => true,
            'show_in_rest' => true,
            'show_admin_column' => true,
        ));

        // Temperament
        register_taxonomy('setae_temperament', 'setae_species', array(
            'label' => '性格 (Temperament)',
            'hierarchical' => false,
            'show_in_rest' => true,
            'show_admin_column' => true,
        ));

        // Initialize Meta Boxes
        require_once plugin_dir_path(__FILE__) . 'class-setae-species-meta.php';
        new Setae_Species_Meta();
    }



    public function set_custom_columns($columns)
    {
        // Reorder columns: Checkbox, Thumb, Title, Counts, Genus, Habitat, Date
        $new_columns = array();
        $new_columns['cb'] = $columns['cb'];
        $new_columns['setae_thumb'] = 'Image';
        $new_columns['title'] = 'Name (Japanese / Common)';
        $new_columns['spider_count'] = 'Count'; // Added
        $new_columns['setae_size'] = 'Max Legspan (cm)';

        // Add taxonomies (added auto by WP, but we want to control order)
        if (isset($columns['taxonomy-setae_genus']))
            $new_columns['taxonomy-setae_genus'] = $columns['taxonomy-setae_genus'];
        if (isset($columns['taxonomy-setae_habitat']))
            $new_columns['taxonomy-setae_habitat'] = $columns['taxonomy-setae_habitat'];
        if (isset($columns['taxonomy-setae_temperament']))
            $new_columns['taxonomy-setae_temperament'] = $columns['taxonomy-setae_temperament'];

        // Merge remaining
        foreach ($columns as $key => $value) {
            if (!isset($new_columns[$key])) {
                $new_columns[$key] = $value;
            }
        }
        return $new_columns;
    }

    public function render_custom_column($column, $post_id)
    {
        switch ($column) {
            case 'setae_thumb':
                if (has_post_thumbnail($post_id)) {
                    echo get_the_post_thumbnail($post_id, 'thumbnail', array('style' => 'width:50px; height:50px; object-fit:cover; border-radius:4px;'));
                } else {
                    echo '-';
                }
                break;
            case 'setae_size':
                $size = get_post_meta($post_id, '_setae_size', true);
                echo $size ? esc_html($size) . ' cm' : '-';
                break;
            case 'spider_count':
                // Count spiders linked to this species
                $args = array(
                    'post_type' => 'setae_spider',
                    'post_status' => 'publish', // Only active spiders
                    'meta_query' => array(
                        array('key' => '_setae_species_id', 'value' => $post_id)
                    ),
                    'fields' => 'ids',
                    'posts_per_page' => -1,
                );
                $query = new WP_Query($args);
                echo '<strong style="color:#e67e22;">' . esc_html($query->found_posts) . '</strong>';
                break;
        }
    }

    public function set_sortable_columns($columns)
    {
        $columns['taxonomy-setae_genus'] = 'taxonomy-setae_genus';
        $columns['taxonomy-setae_habitat'] = 'taxonomy-setae_habitat';
        return $columns;
    }


    public function add_bulk_menu()
    {
        add_submenu_page(
            'edit.php?post_type=setae_species',
            '一括登録',
            '一括登録 (Bulk)',
            'manage_options',
            'setae_species_bulk',
            array($this, 'render_bulk_page')
        );
    }

    // 2. 一括登録画面の描画
    public function render_bulk_page()
    {
        ?>
        <div class="wrap">
            <h1 class="wp-heading-inline">図鑑データ一括登録</h1>
            <p>学名、和名、属などを連続して登録できます。完了したら「保存して登録」を押してください。</p>

            <div style="background:#f0f0f1; padding:15px; border:1px solid #ccc; margin-bottom:20px; border-radius:5px;">
                <h3>🤖 AI生成データ取り込み</h3>
                <p>以下のJSONフォーマットでデータを貼り付けると、下の表に自動的に入力されます。</p>

                <details style="margin-bottom:10px;">
                    <summary style="cursor:pointer; color:#0073aa;">コピー用プロンプト (クリックして展開)</summary>
                    <div
                        style="background:#fff; padding:10px; border:1px solid #ddd; margin-top:5px; font-family:monospace; font-size:11px;">
                        以下のタランチュラの情報をJSON形式で出力してください。<br>
                        キーは必ず以下のようにしてください。<br>
                        [<br>
                        {<br>
                        "title": "学名 (例: Grammostola pulchra)",<br>
                        "ja_name": "和名/流通名 (例: ブラジリアンブラック)",<br>
                        "genus": "属名 (例: Grammostola)",<br>
                        "size": "最大レッグスパン数値のみ (例: 15.0)",<br>
                        "temperament": "性格 (選択肢: Docile, Calm, Skittish, Defensive, Aggressive のいずれか)"<br>
                        },<br>
                        ...<br>
                        ]
                    </div>
                </details>

                <textarea id="json-paste-area" style="width:100%; height:100px; font-family:monospace;"
                    placeholder='[{"title":"...", "ja_name":"...", ...}]'></textarea>
                <button type="button" class="button" id="btn-parse-json" style="margin-top:10px;">JSONを反映</button>
            </div>

            <style>
                .setae-bulk-table {
                    width: 100%;
                    border-collapse: collapse;
                    margin-top: 20px;
                    background: #fff;
                    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
                }

                .setae-bulk-table th,
                .setae-bulk-table td {
                    border: 1px solid #ddd;
                    padding: 10px;
                }

                .setae-bulk-table th {
                    background: #f9f9f9;
                    text-align: left;
                }

                .setae-bulk-table input,
                .setae-bulk-table select {
                    width: 100%;
                    border: 1px solid #ccc;
                    padding: 5px;
                    border-radius: 4px;
                }

                .btn-remove-row {
                    color: red;
                    cursor: pointer;
                    font-weight: bold;
                }
            </style>

            <form id="setae-bulk-form">
                <table class="setae-bulk-table" id="bulk-table">
                    <thead>
                        <tr>
                            <th style="width:200px;">学名 (Title) *</th>
                            <th style="width:200px;">和名 (Meta)</th>
                            <th style="width:150px;">属 (Genus)</th>
                            <th style="width:100px;">サイズ (cm)</th>
                            <th style="width:150px;">性格 (Temp)</th>
                            <th style="width:50px;">×</th>
                        </tr>
                    </thead>
                    <tbody>
                    </tbody>
                </table>

                <div style="margin-top: 15px; display: flex; gap: 10px;">
                    <button type="button" class="button" id="btn-add-row">+ 行を追加</button>
                    <button type="submit" class="button button-primary button-large" id="btn-save-bulk">保存して登録</button>
                </div>
            </form>

            <div id="bulk-result" style="margin-top:20px; font-weight:bold;"></div>
        </div>

        <script>
            jQuery(document).ready(function ($) {
                function addRow() {
                    const row = `
                    <tr>
                        <td><input type="text" name="title[]" placeholder="例: Grammostola pulchra" required></td>
                        <td><input type="text" name="ja_name[]" placeholder="例: ブラジリアンブラック"></td>
                        <td><input type="text" name="genus[]" placeholder="例: Grammostola" list="genus_list"></td>
                        <td><input type="number" step="0.1" name="size[]" placeholder="15.0"></td>
                        <td>
                            <select name="temperament[]">
                                <option value="">- 選択 -</option>
                                <option value="Docile (温厚)">Docile (温厚)</option>
                                <option value="Calm (大人しい)">Calm (大人しい)</option>
                                <option value="Skittish (臆病)">Skittish (臆病)</option>
                                <option value="Defensive (荒い)">Defensive (荒い)</option>
                                <option value="Aggressive (凶暴)">Aggressive (凶暴)</option>
                            </select>
                        </td>
                        <td style="text-align:center;"><span class="btn-remove-row">×</span></td>
                    </tr>
                `;
                    $('#bulk-table tbody').append(row);
                }

                // 初期状態で5行追加
                for (let i = 0; i < 5; i++) addRow();

                $('#btn-add-row').on('click', addRow);

                $(document).on('click', '.btn-remove-row', function () {
                    $(this).closest('tr').remove();
                });

                $('#setae-bulk-form').on('submit', function (e) {
                    e.preventDefault();
                    if (!confirm('入力したデータを登録しますか？')) return;

                    const $btn = $('#btn-save-bulk');
                    $btn.prop('disabled', true).text('保存中...');

                    // データを構築
                    let items = [];
                    $('#bulk-table tbody tr').each(function () {
                        const title = $(this).find('input[name="title[]"]').val();
                        if (title) {
                            items.push({
                                title: title,
                                ja_name: $(this).find('input[name="ja_name[]"]').val(),
                                genus: $(this).find('input[name="genus[]"]').val(),
                                size: $(this).find('input[name="size[]"]').val(),
                                temperament: $(this).find('select[name="temperament[]"]').val()
                            });
                        }
                    });

                    if (items.length === 0) {
                        alert('データがありません');
                        $btn.prop('disabled', false).text('保存して登録');
                        return;
                    }

                    $.ajax({
                        url: ajaxurl,
                        type: 'POST',
                        data: {
                            action: 'setae_bulk_species_save',
                            items: items
                        },
                        success: function (res) {
                            if (res.success) {
                                $('#bulk-result').html('<span style="color:green;">' + res.data.count + '件の登録が完了しました。</span>');
                                $('#bulk-table tbody').empty();
                                for (let i = 0; i < 5; i++) addRow();
                            } else {
                                alert('エラー: ' + res.data);
                            }
                        },
                        complete: function () {
                            $btn.prop('disabled', false).text('保存して登録');
                        }
                    });
                });

                // ▼ 追加: JSONパースと反映処理
                $('#btn-parse-json').on('click', function () {
                    const raw = $('#json-paste-area').val();
                    if (!raw.trim()) return;

                    try {
                        const data = JSON.parse(raw);
                        if (!Array.isArray(data)) {
                            alert('JSONは配列形式である必要があります (例: [ {...}, {...} ])');
                            return;
                        }

                        // 既存の空行をクリアする（任意）
                        // $('#bulk-table tbody').empty();

                        let count = 0;
                        data.forEach(item => {
                            // 必須チェック
                            if (!item.title) return;

                            const row = `
                            <tr>
                                <td><input type="text" name="title[]" value="${item.title}" required></td>
                                <td><input type="text" name="ja_name[]" value="${item.ja_name || ''}"></td>
                                <td><input type="text" name="genus[]" value="${item.genus || ''}"></td>
                                <td><input type="number" step="0.1" name="size[]" value="${item.size || ''}"></td>
                                <td>
                                    <select name="temperament[]">
                                        <option value="">- 選択 -</option>
                                        <option value="Docile (温厚)" ${item.temperament && item.temperament.match(/docile/i) ? 'selected' : ''}>Docile (温厚)</option>
                                        <option value="Calm (大人しい)" ${item.temperament && item.temperament.match(/calm/i) ? 'selected' : ''}>Calm (大人しい)</option>
                                        <option value="Skittish (臆病)" ${item.temperament && item.temperament.match(/skittish/i) ? 'selected' : ''}>Skittish (臆病)</option>
                                        <option value="Defensive (荒い)" ${item.temperament && item.temperament.match(/defensive/i) ? 'selected' : ''}>Defensive (荒い)</option>
                                        <option value="Aggressive (凶暴)" ${item.temperament && item.temperament.match(/aggressive/i) ? 'selected' : ''}>Aggressive (凶暴)</option>
                                    </select>
                                </td>
                                <td style="text-align:center;"><span class="btn-remove-row">×</span></td>
                            </tr>
                            `;
                            $('#bulk-table tbody').append(row);
                            count++;
                        });

                        alert(count + '件のデータを読み込みました。');
                        $('#json-paste-area').val(''); // クリア

                    } catch (e) {
                        alert('JSONの解析に失敗しました。フォーマットを確認してください。\n' + e.message);
                    }
                });
                // ▲ 追加ここまで
            });
        </script>
        <?php
    }

    // 3. AJAX保存処理
    public function handle_bulk_save()
    {
        // 権限チェック (簡易)
        if (!current_user_can('edit_posts')) {
            wp_send_json_error('権限がありません');
        }

        $items = isset($_POST['items']) ? $_POST['items'] : array();
        $count = 0;

        foreach ($items as $item) {
            $title = sanitize_text_field($item['title']);
            if (empty($title))
                continue;

            // 既存チェック（同名の種があればスキップまたは更新）
            $existing = get_page_by_title($title, OBJECT, 'setae_species');
            if ($existing) {
                $post_id = $existing->ID;
            } else {
                $post_id = wp_insert_post(array(
                    'post_type' => 'setae_species',
                    'post_title' => $title,
                    'post_status' => 'publish'
                ));
            }

            if ($post_id) {
                // 和名 (Meta)
                if (!empty($item['ja_name'])) {
                    update_post_meta($post_id, '_setae_common_name_ja', sanitize_text_field($item['ja_name']));
                }

                // サイズ (Meta)
                if (!empty($item['size'])) {
                    update_post_meta($post_id, '_setae_size', sanitize_text_field($item['size']));
                }

                // 属 (Taxonomy: setae_genus)
                if (!empty($item['genus'])) {
                    $genus = sanitize_text_field($item['genus']);
                    // タームが存在しなければ作成してセット
                    wp_set_object_terms($post_id, $genus, 'setae_genus');
                }

                // 性格 (Taxonomy: setae_temperament)
                if (!empty($item['temperament'])) {
                    wp_set_object_terms($post_id, sanitize_text_field($item['temperament']), 'setae_temperament');
                }

                $count++;
            }
        }

        wp_send_json_success(array('count' => $count));
    }

}
