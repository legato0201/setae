<?php

class Setae_Admin_Icons
{
    const PAGE_SLUG = 'setae-icons';

    public function __construct()
    {
        add_action('admin_menu', array($this, 'add_admin_menu'));
        add_action('admin_enqueue_scripts', array($this, 'enqueue_assets'));
        add_action('admin_post_setae_save_icon_override', array($this, 'handle_save'));
        add_action('admin_post_setae_reset_icon_override', array($this, 'handle_reset'));
        add_action('admin_post_setae_reset_all_icon_overrides', array($this, 'handle_reset_all'));
        add_action('admin_post_setae_import_icon_overrides', array($this, 'handle_import'));
        add_action('admin_post_setae_export_icon_overrides', array($this, 'handle_export'));
    }

    public function add_admin_menu()
    {
        add_options_page(
            'SETAE Icon Studio',
            'SETAE Icons',
            'manage_options',
            self::PAGE_SLUG,
            array($this, 'render_page')
        );
    }

    public function enqueue_assets($hook_suffix)
    {
        if ($hook_suffix !== 'settings_page_' . self::PAGE_SLUG) {
            return;
        }
        wp_enqueue_style(
            'setae-icon-studio',
            SETAE_PLUGIN_URL . 'assets/admin/icon-studio.css',
            array(),
            SETAE_VERSION
        );
        wp_enqueue_script(
            'setae-icon-studio',
            SETAE_PLUGIN_URL . 'assets/admin/icon-studio.js',
            array(),
            SETAE_VERSION,
            true
        );
    }

    public function render_page()
    {
        if (!current_user_can('manage_options')) {
            wp_die(
                esc_html__('このページを表示する権限がありません。', 'setae-core'),
                'SETAE',
                array('response' => 403)
            );
        }

        $definitions = Setae_Icon_Registry::definitions();
        $categories = Setae_Icon_Registry::categories();
        $export_url = wp_nonce_url(
            admin_url('admin-post.php?action=setae_export_icon_overrides'),
            'setae_export_icon_overrides'
        );
        ?>
        <div class="wrap setae-icon-studio" data-icon-studio>
            <div class="setae-icon-studio-header">
                <div>
                    <h1>SETAE Icon Studio</h1>
                    <p>SETAEで使用するSVGアイコンを管理します。未変更のアイコンはプラグイン標準デザインを使用します。</p>
                </div>
                <div class="setae-icon-studio-header-actions">
                    <a class="button" href="<?php echo esc_url($export_url); ?>">設定をExport</a>
                    <form method="post" action="<?php echo esc_url(admin_url('admin-post.php')); ?>" data-confirm="すべてのカスタムアイコンを標準に戻します。よろしいですか？">
                        <input type="hidden" name="action" value="setae_reset_all_icon_overrides">
                        <?php wp_nonce_field('setae_reset_all_icon_overrides'); ?>
                        <button type="submit" class="button button-secondary">すべて標準に戻す</button>
                    </form>
                </div>
            </div>

            <?php $this->render_notice(); ?>

            <div class="setae-icon-studio-tools" aria-label="アイコンの検索と絞り込み">
                <label class="setae-icon-studio-search">
                    <span class="screen-reader-text">アイコンを検索</span>
                    <input type="search" class="regular-text" placeholder="名前、キー、用途で検索" data-icon-search>
                </label>
                <div class="setae-icon-category-filter" role="group" aria-label="カテゴリ">
                    <button type="button" class="button is-active" data-icon-category="all" aria-pressed="true">すべて</button>
                    <?php foreach ($categories as $category_key => $category_label): ?>
                        <button type="button" class="button" data-icon-category="<?php echo esc_attr($category_key); ?>" aria-pressed="false"><?php echo esc_html($category_label); ?></button>
                    <?php endforeach; ?>
                </div>
            </div>

            <p class="setae-icon-result-count" aria-live="polite" data-icon-result-count><?php echo esc_html(count($definitions)); ?>件</p>

            <div class="setae-icon-grid" data-icon-grid>
                <?php foreach ($definitions as $definition): ?>
                    <?php $this->render_icon_card($definition); ?>
                <?php endforeach; ?>
            </div>

            <div class="setae-icon-empty" data-icon-empty hidden>
                <h2>該当するアイコンがありません</h2>
                <p>検索語またはカテゴリを変更してください。</p>
            </div>

            <section class="setae-icon-transfer" aria-labelledby="setae-icon-import-title">
                <h2 id="setae-icon-import-title">設定をImport</h2>
                <p>Icon StudioからExportしたschemaVersion 1のJSONを読み込みます。既存設定へ追加・上書きし、不正な項目が1件でもあれば保存しません。</p>
                <form method="post" action="<?php echo esc_url(admin_url('admin-post.php')); ?>">
                    <input type="hidden" name="action" value="setae_import_icon_overrides">
                    <?php wp_nonce_field('setae_import_icon_overrides'); ?>
                    <textarea name="setae_icon_import_json" class="large-text code" rows="8" data-icon-import-textarea aria-label="ImportするJSON"></textarea>
                    <div class="setae-icon-transfer-actions">
                        <label class="button">
                            JSONファイルを読み込む
                            <input type="file" accept=".json,application/json" data-icon-import-file hidden>
                        </label>
                        <button type="submit" class="button button-primary">Import</button>
                    </div>
                </form>
            </section>
        </div>
        <?php
    }

    private function render_icon_card($definition)
    {
        $key = $definition['key'];
        $stored_svg = Setae_Icon_Registry::get_stored_override($key);
        $has_stored = $stored_svg !== '';
        $has_valid = Setae_Icon_Registry::has_valid_override($key);
        $status = $has_valid ? 'カスタム' : ($has_stored ? '無効なカスタム（標準を使用）' : '標準');
        $editor_svg = $has_stored ? $stored_svg : $definition['default_svg'];
        $current_svg = Setae_Icon_Registry::get($key);
        $category_labels = Setae_Icon_Registry::categories();
        $category_label = isset($category_labels[$definition['category']])
            ? $category_labels[$definition['category']]
            : $definition['category'];
        $search_text = implode(' ', array(
            $definition['label'],
            $definition['label_ja'],
            $definition['key'],
            $definition['description'],
            $definition['usage'],
        ));
        $id = 'setae-icon-' . sanitize_html_class(str_replace('.', '-', $key));
        $is_specimen = $definition['preview'] === 'specimen';
        ?>
        <article
            class="setae-icon-card<?php echo $is_specimen ? ' is-specimen' : ''; ?>"
            data-icon-card
            data-category="<?php echo esc_attr($definition['category']); ?>"
            data-search="<?php echo esc_attr($search_text); ?>"
        >
            <div class="setae-icon-card-summary">
                <div class="setae-icon-card-preview" aria-hidden="true"><?php echo $current_svg; ?></div>
                <div class="setae-icon-card-copy">
                    <h2><?php echo esc_html($definition['label']); ?></h2>
                    <p><?php echo esc_html($definition['label_ja']); ?></p>
                    <code><?php echo esc_html($key); ?></code>
                    <span class="setae-icon-card-category"><?php echo esc_html($category_label); ?></span>
                    <small><?php echo esc_html($definition['usage']); ?></small>
                </div>
                <span class="setae-icon-status<?php echo $has_valid ? ' is-custom' : ($has_stored ? ' is-invalid' : ''); ?>"><?php echo esc_html($status); ?></span>
            </div>

            <details class="setae-icon-editor" data-icon-editor>
                <summary class="button">編集</summary>
                <div class="setae-icon-editor-body">
                    <div class="setae-icon-comparison">
                        <div>
                            <strong>デフォルト</strong>
                            <div class="setae-icon-comparison-preview<?php echo $is_specimen ? ' is-specimen' : ''; ?>" aria-hidden="true"><?php echo $definition['default_svg']; ?></div>
                        </div>
                        <div>
                            <strong>現在</strong>
                            <div class="setae-icon-comparison-preview<?php echo $is_specimen ? ' is-specimen' : ''; ?>" aria-hidden="true"><?php echo $current_svg; ?></div>
                        </div>
                    </div>

                    <form method="post" action="<?php echo esc_url(admin_url('admin-post.php')); ?>" data-icon-form>
                        <input type="hidden" name="action" value="setae_save_icon_override">
                        <input type="hidden" name="icon_key" value="<?php echo esc_attr($key); ?>">
                        <?php wp_nonce_field('setae_save_icon_override_' . $key); ?>
                        <label for="<?php echo esc_attr($id); ?>"><strong>SVGコード</strong></label>
                        <textarea id="<?php echo esc_attr($id); ?>" name="svg" class="large-text code" rows="10" spellcheck="false" data-icon-svg><?php echo esc_textarea($editor_svg); ?></textarea>
                        <div class="setae-icon-file-row">
                            <label class="button">
                                SVGファイルを読み込む
                                <input type="file" accept=".svg,image/svg+xml" data-icon-file hidden>
                            </label>
                            <span data-icon-file-name></span>
                        </div>
                        <p class="setae-icon-validation" data-icon-validation aria-live="polite"></p>

                        <div class="setae-icon-live-preview" data-icon-live-preview data-preview-kind="<?php echo $is_specimen ? 'specimen' : 'icon'; ?>">
                            <strong>Preview</strong>
                            <?php if ($is_specimen): ?>
                                <div class="setae-icon-preview-theme is-light"><span>Light</span><div class="setae-icon-preview-specimen" data-icon-preview-target></div></div>
                                <div class="setae-icon-preview-theme is-dark"><span>Dark</span><div class="setae-icon-preview-specimen" data-icon-preview-target></div></div>
                            <?php else: ?>
                                <div class="setae-icon-preview-theme is-light"><span>Light</span><div class="setae-icon-preview-sizes" data-icon-preview-target data-sizes="16,20,24,32"></div></div>
                                <div class="setae-icon-preview-theme is-dark"><span>Dark</span><div class="setae-icon-preview-sizes" data-icon-preview-target data-sizes="16,20,24,32"></div></div>
                            <?php endif; ?>
                        </div>

                        <button type="submit" class="button button-primary">保存</button>
                    </form>

                    <?php if ($has_stored): ?>
                        <form method="post" action="<?php echo esc_url(admin_url('admin-post.php')); ?>" class="setae-icon-reset-form" data-confirm="<?php echo esc_attr($definition['label_ja']); ?>を標準デザインに戻します。よろしいですか？">
                            <input type="hidden" name="action" value="setae_reset_icon_override">
                            <input type="hidden" name="icon_key" value="<?php echo esc_attr($key); ?>">
                            <?php wp_nonce_field('setae_reset_icon_override_' . $key); ?>
                            <button type="submit" class="button button-secondary">標準に戻す</button>
                        </form>
                    <?php endif; ?>
                </div>
            </details>
        </article>
        <?php
    }

    private function render_notice()
    {
        if (!isset($_GET['setae_icon_notice'])) {
            return;
        }
        $type = sanitize_key(wp_unslash($_GET['setae_icon_notice']));
        $message = isset($_GET['setae_icon_message'])
            ? sanitize_text_field(wp_unslash($_GET['setae_icon_message']))
            : '';
        $class_name = $type === 'error' ? 'notice notice-error' : 'notice notice-success';
        if ($message !== '') {
            echo '<div class="' . esc_attr($class_name) . ' is-dismissible"><p>' . esc_html($message) . '</p></div>';
        }
    }

    public function handle_save()
    {
        $this->require_capability();
        $key = isset($_POST['icon_key']) ? sanitize_text_field(wp_unslash($_POST['icon_key'])) : '';
        check_admin_referer('setae_save_icon_override_' . $key);
        $svg = isset($_POST['svg']) ? wp_unslash($_POST['svg']) : '';
        $result = Setae_Icon_Registry::save_override($key, $svg);
        if (is_wp_error($result)) {
            $this->redirect('error', $result->get_error_message());
        }
        $this->redirect('success', $key . ' を保存しました。');
    }

    public function handle_reset()
    {
        $this->require_capability();
        $key = isset($_POST['icon_key']) ? sanitize_text_field(wp_unslash($_POST['icon_key'])) : '';
        check_admin_referer('setae_reset_icon_override_' . $key);
        $result = Setae_Icon_Registry::reset_override($key);
        if (is_wp_error($result)) {
            $this->redirect('error', $result->get_error_message());
        }
        $this->redirect('success', $key . ' を標準に戻しました。');
    }

    public function handle_reset_all()
    {
        $this->require_capability();
        check_admin_referer('setae_reset_all_icon_overrides');
        Setae_Icon_Registry::reset_all();
        $this->redirect('success', 'すべてのアイコンを標準に戻しました。');
    }

    public function handle_import()
    {
        $this->require_capability();
        check_admin_referer('setae_import_icon_overrides');
        $json = isset($_POST['setae_icon_import_json']) ? wp_unslash($_POST['setae_icon_import_json']) : '';
        $payload = json_decode((string) $json, true);
        if (!is_array($payload) || json_last_error() !== JSON_ERROR_NONE) {
            $this->redirect('error', 'JSONを読み取れませんでした。');
        }
        $result = Setae_Icon_Registry::import_payload($payload);
        if (is_wp_error($result)) {
            $this->redirect('error', $result->get_error_message());
        }
        $this->redirect('success', (int) $result . '件のカスタムアイコンをImportしました。');
    }

    public function handle_export()
    {
        $this->require_capability();
        check_admin_referer('setae_export_icon_overrides');
        $payload = Setae_Icon_Registry::export_payload();
        nocache_headers();
        header('Content-Type: application/json; charset=UTF-8');
        header('Content-Disposition: attachment; filename="setae-icon-overrides-' . gmdate('Ymd-His') . '.json"');
        echo wp_json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_PRETTY_PRINT);
        exit;
    }

    private function require_capability()
    {
        if (!current_user_can('manage_options')) {
            wp_die(
                esc_html__('この操作を実行する権限がありません。', 'setae-core'),
                'SETAE',
                array('response' => 403)
            );
        }
    }

    private function redirect($type, $message)
    {
        $url = add_query_arg(
            array(
                'page' => self::PAGE_SLUG,
                'setae_icon_notice' => $type,
                'setae_icon_message' => $message,
            ),
            admin_url('options-general.php')
        );
        wp_safe_redirect($url);
        exit;
    }
}
