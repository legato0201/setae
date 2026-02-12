<?php

class Setae_CPT_Suggestion
{

    public function init()
    {
        add_action('init', array($this, 'register_cpt'));
        add_action('admin_menu', array($this, 'add_menu_badge'));
        add_action('add_meta_boxes', array($this, 'add_review_meta_box'));
        add_action('save_post', array($this, 'handle_approval_merge'));
    }

    // 1. CPT登録
    public function register_cpt()
    {
        register_post_type('setae_suggestion', array(
            'labels' => array(
                'name' => '修正提案',
                'singular_name' => '修正提案',
                'menu_name' => '修正提案'
            ),
            'public' => false,
            'show_ui' => true,
            'show_in_menu' => true, // 独立したメニューとして表示
            'supports' => array('title', 'editor', 'thumbnail', 'custom-fields'),
            'capability_type' => 'post',
        ));
    }

    // 2. Adminバッジ通知
    public function add_menu_badge()
    {
        global $menu;
        $post_type = 'setae_suggestion';

        // Pendingステータスの投稿数を取得
        $count = wp_count_posts($post_type)->pending;

        if ($count > 0) {
            foreach ($menu as $key => $value) {
                // Setaeメニューを探す (スラッグ等は環境に合わせて調整してください)
                if ($value[2] == 'setae_main_menu' || strpos($value[2], 'post_type=setae_suggestion') !== false) {
                    $menu[$key][0] .= ' <span class="update-plugins count-' . $count . '"><span class="plugin-count">' . $count . '</span></span>';
                    return;
                }
            }
        }
    }

    // 3. 承認用メタボックス
    public function add_review_meta_box()
    {
        add_meta_box(
            'setae_suggestion_action',
            '承認アクション',
            array($this, 'render_meta_box'),
            'setae_suggestion',
            'side',
            'high'
        );
    }

    public function render_meta_box($post)
    {
        $target_id = get_post_meta($post->ID, '_target_species_id', true);
        $target_link = $target_id ? get_edit_post_link($target_id) : '#';

        echo '<p>対象種ID: <a href="' . esc_url($target_link) . '" target="_blank">#' . esc_html($target_id) . '</a></p>';
        echo '<p>ステータスを<strong>「公開 (Publish)」</strong>に変更して更新すると、提案内容が対象種に自動反映されます。</p>';

        // 提案内容のプレビュー
        $fields = ['_suggested_common_name_ja', '_suggested_lifestyle', '_suggested_difficulty'];
        foreach ($fields as $f) {
            $val = get_post_meta($post->ID, $f, true);
            if ($val)
                echo '<div><strong>' . str_replace('_suggested_', '', $f) . ':</strong> ' . esc_html($val) . '</div>';
        }
    }

    // 4. 自動反映ロジック (保存時にフック)
    public function handle_approval_merge($post_id)
    {
        // オートセーブやリビジョンは無視
        if (defined('DOING_AUTOSAVE') && DOING_AUTOSAVE)
            return;
        if (get_post_type($post_id) !== 'setae_suggestion')
            return;

        // ステータスが 'publish' になった時のみ実行
        if (get_post_status($post_id) !== 'publish')
            return;

        // 既に反映済みかチェックするフラグがあれば防止できるが、ここでは簡易的に毎回上書きする仕様とします

        $target_id = get_post_meta($post_id, '_target_species_id', true);
        if (!$target_id)
            return;

        // --- データの反映処理 ---

        // 1. テキストメタデータ
        $map = [
            '_suggested_common_name_ja' => '_setae_common_name_ja',
            '_suggested_difficulty' => '_setae_difficulty',
            '_suggested_temperature' => '_setae_temperature',
            '_suggested_lifespan' => '_setae_lifespan',
            '_suggested_size' => '_setae_size',
        ];

        foreach ($map as $src => $dest) {
            $val = get_post_meta($post_id, $src, true);
            if ($val)
                update_post_meta($target_id, $dest, $val);
        }

        // 2. タクソノミー (Lifestyle)
        $lifestyle = get_post_meta($post_id, '_suggested_lifestyle', true);
        if ($lifestyle) {
            // スラッグからタームIDを取得してセット (termが存在しない場合は作成が必要だが、通常は固定)
            $term = get_term_by('slug', $lifestyle, 'setae_lifestyle');
            if ($term) {
                wp_set_object_terms($target_id, (int) $term->term_id, 'setae_lifestyle');
            }
        }

        // 3. 画像 (アイキャッチ)
        if (has_post_thumbnail($post_id)) {
            $thumb_id = get_post_thumbnail_id($post_id);
            set_post_thumbnail($target_id, $thumb_id);
        }

        // 4. 説明文 (本文) -> 追記する形にするか、上書きするか。今回は「追記」にします。
        $suggestion_content = get_post_field('post_content', $post_id);
        if (!empty($suggestion_content)) {
            $original_content = get_post_field('post_content', $target_id);
            $new_content = $original_content . "\n\n\n" . $suggestion_content;
            wp_update_post(array(
                'ID' => $target_id,
                'post_content' => $new_content
            ));
        }
    }
}
