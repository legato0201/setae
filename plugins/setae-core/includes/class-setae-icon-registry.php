<?php

/**
 * Central registry for bundled SVG icons and administrator overrides.
 */
class Setae_Icon_Registry
{
    const OPTION_NAME = 'setae_icon_overrides_v1';
    const SCHEMA_VERSION = 1;
    const REWRITE_VERSION = '1';

    private static $definitions_cache = null;
    private static $overrides_cache = null;
    private static $validated_overrides_cache = array();

    public static function categories()
    {
        return array(
            'navigation' => 'ナビゲーション',
            'record' => '記録・飼育',
            'actions' => '操作',
            'utility' => '状態・ユーティリティ',
            'public' => '公開ページ',
            'specimen' => '標本プレースホルダー',
        );
    }

    public static function app_key_map()
    {
        return array(
            'today' => 'nav.today',
            'collection' => 'nav.collection',
            'records' => 'nav.records',
            'community' => 'nav.community',
            'settings' => 'nav.settings',
            'plus' => 'ui.plus',
            'logout' => 'ui.logout',
            'user' => 'ui.user',
            'star' => 'status.favorite',
            'qr' => 'ui.qr',
            'husbandry' => 'nav.husbandry',
            'feed' => 'action.feed',
            'observation' => 'action.observation',
            'molt' => 'action.molt',
            'growth' => 'action.growth',
            'photo' => 'action.photo',
            'pairing' => 'action.pairing',
            'environment' => 'action.environment',
            'maintenance' => 'action.maintenance',
            'more' => 'ui.more',
            'close' => 'ui.close',
            'chevronRight' => 'ui.chevron-right',
            'chevronLeft' => 'ui.chevron-left',
            'chevronUp' => 'ui.chevron-up',
            'chevronDown' => 'ui.chevron-down',
            'edit' => 'ui.edit',
            'trash' => 'ui.trash',
            'moveUp' => 'ui.move-up',
            'moveDown' => 'ui.move-down',
            'moveLeft' => 'ui.move-left',
            'moveRight' => 'ui.move-right',
            'resize' => 'ui.resize',
            'externalLink' => 'ui.external-link',
            'print' => 'ui.print',
            'check' => 'ui.check',
            'search' => 'ui.search',
            'filter' => 'ui.filter',
            'sort' => 'ui.sort',
            'minus' => 'ui.minus',
        );
    }

    public static function public_key_map()
    {
        return array(
            'share' => 'public.share',
            'copy' => 'public.copy',
            'expand' => 'public.expand',
            'qr' => 'public.qr',
            'calendar' => 'public.calendar',
            'sparkles' => 'public.sparkles',
            'badge' => 'public.badge',
            'arrow-up-right' => 'public.arrow-up-right',
            'arrow-right' => 'public.arrow-right',
            'feed' => 'public.feed',
            'molt' => 'public.molt',
            'pairing' => 'public.pairing',
            'observation' => 'public.observation',
            'growth' => 'public.growth',
            'plus' => 'public.plus',
            'transfer' => 'public.transfer',
            'x' => 'public.close',
            'chevron-left' => 'public.chevron-left',
            'chevron-right' => 'public.chevron-right',
            'droplet' => 'public.droplet',
            'heart-pulse' => 'public.heart-pulse',
            'image' => 'public.image',
            'history' => 'public.history',
        );
    }

    public static function definitions()
    {
        if (is_array(self::$definitions_cache)) {
            return self::$definitions_cache;
        }

        $definitions = array();
        $app_paths = array(
            'today' => '<path d="M8 2v4M16 2v4"/><rect width="18" height="18" x="3" y="4" rx="2"/><path d="M3 10h18M8 14h.01M12 14h.01M16 14h.01M8 18h.01M12 18h.01"/>',
            'collection' => '<rect width="20" height="5" x="2" y="3" rx="1"/><path d="M4 8v11a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8M10 12h4"/>',
            'records' => '<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2Z"/>',
            'community' => '<path d="M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4Z"/><path d="M8 9h8M8 13h5"/>',
            'settings' => '<path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.38a2 2 0 0 0-.73-2.73l-.15-.09a2 2 0 0 1-1-1.74v-.51a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2Z"/><circle cx="12" cy="12" r="3"/>',
            'plus' => '<path d="M5 12h14M12 5v14"/>',
            'logout' => '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/>',
            'user' => '<circle cx="12" cy="8" r="4"/><path d="M4 22a8 8 0 0 1 16 0"/>',
            'star' => '<path d="m12 2.8 2.85 5.77 6.37.93-4.61 4.49 1.09 6.34L12 17.34l-5.7 2.99 1.09-6.34L2.78 9.5l6.37-.93L12 2.8Z"/>',
            'qr' => '<path d="M3.5 3.5h6v6h-6zM5.5 5.5h2v2h-2zM14.5 3.5h6v6h-6zM16.5 5.5h2v2h-2zM3.5 14.5h6v6h-6zM5.5 16.5h2v2h-2zM13 13h2v2h-2zM18 13h2.5v3M13 18h3v2.5M18.5 18.5h2"/>',
            'husbandry' => '<path d="M14 4v10.54a4 4 0 1 1-4 0V4a2 2 0 0 1 4 0Z"/><path d="M12 8v8M8 4h2M8 8h2"/>',
            'feed' => '<ellipse cx="12" cy="8.2" rx="2.1" ry="2.5"/><ellipse cx="12" cy="13.2" rx="2.8" ry="3.1"/><path d="M10.9 5.8 9.3 3.7M13.1 5.8l1.6-2.1M9.6 10 6.3 8.2M14.4 10l3.3-1.8M9.2 13H5.3M14.8 13h3.9M9.7 15.4l-3 3M14.3 15.4l3 3"/>',
            'observation' => '<path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z"/><circle cx="12" cy="12" r="2.5"/>',
            'molt' => '<path d="M11.2 4.2c-3.7.6-6.3 3.2-6.3 6.4 0 4 2.8 7.2 6.3 9.2M12.8 4.2c3.7.6 6.3 3.2 6.3 6.4 0 4-2.8 7.2-6.3 9.2M12 3v18M9.7 7.2 7 5.4M14.3 7.2 17 5.4M9.3 11.4 5.5 10M14.7 11.4l3.8-1.4M9.6 15.2 6.8 17M14.4 15.2l2.8 1.8"/>',
            'growth' => '<path d="M5 19 19 5M8 16l-2-2M11 13l-2-2M14 10l-2-2M17 7l-2-2"/><path d="m15 5 4 4"/>',
            'photo' => '<path d="M14.5 5 13 3h-2L9.5 5H5a2 2 0 0 0-2 2v11a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-4.5Z"/><circle cx="12" cy="12.5" r="3.5"/>',
            'pairing' => '<path d="M10 13a5 5 0 0 0 7.1.1l2-2a5 5 0 0 0-7.1-7.1l-1.1 1.1"/><path d="M14 11a5 5 0 0 0-7.1-.1l-2 2A5 5 0 0 0 12 20l1.1-1.1"/>',
            'environment' => '<path d="M14 4v10.54a4 4 0 1 1-4 0V4a2 2 0 0 1 4 0Z"/><path d="M12 8v8M17 7h4M17 12h3"/>',
            'maintenance' => '<path d="m14.7 6.3 3-3a4 4 0 0 1-5 5L5 16l-1 4 4-1 7.7-7.7a4 4 0 0 1 5-5l-3 3-3-3Z"/>',
            'more' => '<circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/>',
            'close' => '<path d="m6 6 12 12M18 6 6 18"/>',
            'chevronRight' => '<path d="m9 18 6-6-6-6"/>',
            'chevronLeft' => '<path d="m15 18-6-6 6-6"/>',
            'chevronUp' => '<path d="m18 15-6-6-6 6"/>',
            'chevronDown' => '<path d="m6 9 6 6 6-6"/>',
            'edit' => '<path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L8 18l-4 1 1-4Z"/>',
            'trash' => '<path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6M10 11v5M14 11v5"/>',
            'moveUp' => '<path d="M12 19V5M6 11l6-6 6 6"/>',
            'moveDown' => '<path d="M12 5v14M18 13l-6 6-6-6"/>',
            'moveLeft' => '<path d="M19 12H5M11 18l-6-6 6-6"/>',
            'moveRight' => '<path d="M5 12h14M13 6l6 6-6 6"/>',
            'resize' => '<path d="M8 3H3v5M16 21h5v-5M3 8l6-6M21 16l-6 6"/>',
            'externalLink' => '<path d="M15 3h6v6M10 14 21 3M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>',
            'print' => '<path d="M6 9V2h12v7M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect width="12" height="8" x="6" y="14"/>',
            'check' => '<path d="m5 12 4 4L19 6"/>',
            'search' => '<circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/>',
            'filter' => '<path d="M4 5h16M7 12h10M10 19h4"/>',
            'sort' => '<path d="M8 7h12M8 12h8M8 17h4M4 5v14"/>',
            'minus' => '<path d="M5 12h14"/>',
        );
        $app_meta = array(
            'today' => array('Today', '今日', 'navigation', 'サイドナビ / モバイルナビ'),
            'collection' => array('Collection', 'コレクション', 'navigation', 'サイドナビ / 個体一覧'),
            'records' => array('Records', '記録', 'navigation', 'サイドナビ / 記録'),
            'community' => array('Community', '交流', 'navigation', 'サイドナビ / 交流'),
            'settings' => array('Settings', '設定', 'navigation', 'サイドナビ / 設定'),
            'husbandry' => array('Husbandry', '飼育管理', 'navigation', '飼育管理への導線'),
            'feed' => array('Feed', '給餌', 'record', '給餌記録'),
            'observation' => array('Observation', '観察', 'record', '観察記録'),
            'molt' => array('Molt', '脱皮', 'record', '脱皮記録'),
            'growth' => array('Growth', '成長', 'record', '成長・計測記録'),
            'photo' => array('Photo', '写真', 'record', '写真記録'),
            'pairing' => array('Pairing', 'ペアリング', 'record', '繁殖記録'),
            'environment' => array('Environment', '環境', 'record', '環境記録'),
            'maintenance' => array('Maintenance', 'メンテナンス', 'record', 'メンテナンス記録'),
            'star' => array('Favorite', 'お気に入り', 'utility', 'お気に入り状態'),
            'check' => array('Check', '完了', 'utility', '完了・選択状態'),
            'plus' => array('Plus', '追加', 'actions', '追加操作'),
            'logout' => array('Logout', 'ログアウト', 'actions', 'ログアウト操作'),
            'user' => array('User', 'ユーザー', 'utility', 'ユーザー表示'),
            'qr' => array('QR', 'QR', 'actions', 'QR操作'),
            'more' => array('More', 'その他', 'actions', 'その他メニュー'),
            'close' => array('Close', '閉じる', 'actions', '閉じる操作'),
            'chevronRight' => array('Chevron Right', '右へ', 'actions', '次へ / 開く'),
            'chevronLeft' => array('Chevron Left', '左へ', 'actions', '前へ / 戻る'),
            'chevronUp' => array('Chevron Up', '上へ', 'actions', '上方向'),
            'chevronDown' => array('Chevron Down', '下へ', 'actions', '選択メニュー'),
            'edit' => array('Edit', '編集', 'actions', '編集操作'),
            'trash' => array('Trash', '削除', 'actions', '削除操作'),
            'moveUp' => array('Move Up', '上へ移動', 'actions', '並べ替え'),
            'moveDown' => array('Move Down', '下へ移動', 'actions', '並べ替え'),
            'moveLeft' => array('Move Left', '左へ移動', 'actions', '並べ替え'),
            'moveRight' => array('Move Right', '右へ移動', 'actions', '並べ替え'),
            'resize' => array('Resize', 'サイズ変更', 'actions', 'サイズ変更'),
            'externalLink' => array('External Link', '外部リンク', 'actions', '外部ページを開く'),
            'print' => array('Print', '印刷', 'actions', '印刷操作'),
            'search' => array('Search', '検索', 'actions', '検索フィールド'),
            'filter' => array('Filter', '絞り込み', 'actions', '絞り込み操作'),
            'sort' => array('Sort', '並べ替え', 'actions', '並べ替え操作'),
            'minus' => array('Minus', '減らす', 'actions', '数量を減らす'),
        );

        foreach (self::app_key_map() as $name => $key) {
            $meta = $app_meta[$name];
            $definitions[$key] = self::definition(
                $key,
                $meta[0],
                $meta[1],
                $meta[2],
                self::line_svg($app_paths[$name], 'ui-icon', '1.5'),
                $meta[3],
                'app'
            );
        }

        $public_paths = array(
            'share' => '<circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="m8.59 13.51 6.83 3.98"/><path d="m15.41 6.51-6.82 3.98"/>',
            'copy' => '<rect width="14" height="14" x="8" y="8" rx="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/>',
            'expand' => '<path d="m15 3 6 0 0 6"/><path d="m9 21-6 0 0-6"/><path d="m21 3-7 7"/><path d="m3 21 7-7"/>',
            'qr' => '<rect width="5" height="5" x="3" y="3" rx="1"/><rect width="5" height="5" x="16" y="3" rx="1"/><rect width="5" height="5" x="3" y="16" rx="1"/><path d="M21 16h-3a2 2 0 0 0-2 2v3"/><path d="M21 21v.01"/><path d="M12 7v3a2 2 0 0 1-2 2H7"/><path d="M3 12h.01"/><path d="M12 3h.01"/><path d="M12 16v.01"/><path d="M16 12h1"/><path d="M21 12v.01"/><path d="M12 21v-1"/>',
            'calendar' => '<path d="M8 2v4"/><path d="M16 2v4"/><rect width="18" height="18" x="3" y="4" rx="2"/><path d="M3 10h18"/>',
            'sparkles' => '<path d="m12 3-1.9 5.1L5 10l5.1 1.9L12 17l1.9-5.1L19 10l-5.1-1.9Z"/><path d="M5 3v4"/><path d="M3 5h4"/><path d="M19 17v4"/><path d="M17 19h4"/>',
            'badge' => '<path d="M12 15a6 6 0 1 0 0-12 6 6 0 0 0 0 12Z"/><path d="m9 14-1 8 4-3 4 3-1-8"/>',
            'arrow-up-right' => '<path d="M7 17 17 7"/><path d="M7 7h10v10"/>',
            'arrow-right' => '<path d="M5 12h14"/><path d="m13 6 6 6-6 6"/>',
            'feed' => '<path d="M3 2v7c0 1.1.9 2 2 2h4V2"/><path d="M7 2v20"/><path d="M21 15V2c-3 0-5 2-5 5v6c0 1.1.9 2 2 2h3Zm0 0v7"/>',
            'molt' => '<path d="m12 2-8 4 8 4 8-4-8-4Z"/><path d="m4 10 8 4 8-4"/><path d="m4 14 8 4 8-4"/>',
            'pairing' => '<path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.6l-1-1a5.5 5.5 0 0 0-7.8 7.8l1 1L12 21l7.8-7.6 1-1a5.5 5.5 0 0 0 0-7.8Z"/>',
            'observation' => '<path d="M2.1 12a10.9 10.9 0 0 1 19.8 0 10.9 10.9 0 0 1-19.8 0Z"/><circle cx="12" cy="12" r="3"/>',
            'growth' => '<path d="m3 17 6-6 4 4 8-8"/><path d="M14 7h7v7"/>',
            'plus' => '<path d="M5 12h14"/><path d="M12 5v14"/>',
            'transfer' => '<path d="m16 3 4 4-4 4"/><path d="M20 7H4"/><path d="m8 21-4-4 4-4"/><path d="M4 17h16"/>',
            'x' => '<path d="M18 6 6 18"/><path d="m6 6 12 12"/>',
            'chevron-left' => '<path d="m15 18-6-6 6-6"/>',
            'chevron-right' => '<path d="m9 18 6-6-6-6"/>',
            'droplet' => '<path d="M12 2.7 6.6 9a7 7 0 1 0 10.8 0L12 2.7Z"/>',
            'heart-pulse' => '<path d="M19 14c1.5-1.5 3-3.2 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.8 0-3.2.8-4.5 2.2C10.7 3.8 9.3 3 7.5 3A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4 3 5.5l7 7Z"/><path d="M3.2 12H7l1.5-4.5 3 9 1.5-4.5h7.8"/>',
            'image' => '<rect width="18" height="18" x="3" y="3" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-5-5L5 21"/>',
            'history' => '<path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/><path d="M12 7v5l4 2"/>',
        );
        $public_labels = array(
            'share' => array('Share', '共有'), 'copy' => array('Copy', 'コピー'),
            'expand' => array('Expand', '拡大'), 'qr' => array('QR', 'QR'),
            'calendar' => array('Calendar', 'カレンダー'), 'sparkles' => array('Sparkles', '特徴'),
            'badge' => array('Badge', '証明'), 'arrow-up-right' => array('Arrow Up Right', '外部へ'),
            'arrow-right' => array('Arrow Right', '右へ'), 'feed' => array('Feed', '給餌'),
            'molt' => array('Molt', '脱皮'), 'pairing' => array('Pairing', 'ペアリング'),
            'observation' => array('Observation', '観察'), 'growth' => array('Growth', '成長'),
            'plus' => array('Plus', '追加'), 'transfer' => array('Transfer', '引き継ぎ'),
            'x' => array('Close', '閉じる'), 'chevron-left' => array('Chevron Left', '前へ'),
            'chevron-right' => array('Chevron Right', '次へ'), 'droplet' => array('Droplet', '水分'),
            'heart-pulse' => array('Health', '健康'), 'image' => array('Image', '画像'),
            'history' => array('History', '履歴'),
        );

        foreach (self::public_key_map() as $name => $key) {
            $labels = $public_labels[$name];
            $definitions[$key] = self::definition(
                $key,
                $labels[0],
                $labels[1],
                'public',
                self::line_svg($public_paths[$name], 'setae-icon', '2'),
                '個体公開ページ',
                'public'
            );
        }

        $specimen_files = array(
            'specimen.spider' => array('Spider', 'クモ', 'spider-silhouette.svg', '写真未登録のクモ個体'),
            'specimen.spider-detailed' => array('Spider Detailed', 'クモ（詳細）', 'spider.svg', 'クモの標本イラスト'),
            'specimen.scorpion' => array('Scorpion', 'サソリ', 'scorpion.svg', '写真未登録のサソリ個体'),
            'specimen.insect' => array('Insect', '昆虫', 'insect.svg', '写真未登録の昆虫個体'),
            'specimen.plant' => array('Plant', '植物', 'plant.svg', '写真未登録の植物個体'),
            'specimen.generic' => array('Generic Specimen', '汎用標本', 'generic-specimen.svg', '写真未登録の汎用個体'),
            'specimen.collection' => array('Specimen', '標本', 'specimen.svg', '汎用の標本イラスト'),
        );
        $plugin_dir = defined('SETAE_PLUGIN_DIR') ? SETAE_PLUGIN_DIR : dirname(__DIR__) . '/';
        $plugin_url = defined('SETAE_PLUGIN_URL') ? SETAE_PLUGIN_URL : '';
        foreach ($specimen_files as $key => $meta) {
            $file_path = $plugin_dir . 'assets/images/specimen/' . $meta[2];
            $default_svg = is_readable($file_path) ? (string) file_get_contents($file_path) : '';
            $definition = self::definition($key, $meta[0], $meta[1], 'specimen', $default_svg, $meta[3], 'specimen');
            $definition['default_url'] = $plugin_url . 'assets/images/specimen/' . $meta[2];
            $definition['preview'] = 'specimen';
            $definitions[$key] = $definition;
        }

        self::$definitions_cache = $definitions;
        return self::$definitions_cache;
    }

    private static function definition($key, $label, $label_ja, $category, $default_svg, $usage, $surface)
    {
        return array(
            'key' => $key,
            'label' => $label,
            'label_ja' => $label_ja,
            'description' => $label_ja . 'に使用するSVG',
            'category' => $category,
            'default_svg' => $default_svg,
            'usage' => $usage,
            'surface' => $surface,
            'preview' => 'icon',
        );
    }

    private static function line_svg($body, $class_name, $stroke_width)
    {
        return '<svg class="' . $class_name . '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="' . $stroke_width . '" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">' . $body . '</svg>';
    }

    public static function get_definition($key)
    {
        $definitions = self::definitions();
        return isset($definitions[$key]) ? $definitions[$key] : null;
    }

    public static function get_default($key)
    {
        $definition = self::get_definition($key);
        return $definition ? $definition['default_svg'] : '';
    }

    public static function get($key, $fallback_key = 'nav.records')
    {
        $definition = self::get_definition($key);
        if (!$definition) {
            $definition = self::get_definition($fallback_key);
        }
        if (!$definition) {
            return '';
        }

        $override = self::get_valid_override($definition['key']);
        return $override !== '' ? $override : $definition['default_svg'];
    }

    public static function render($key, $class_name = '')
    {
        $svg = self::get($key);
        if ($svg === '') {
            return '';
        }
        return self::apply_runtime_attributes($svg, $class_name);
    }

    public static function get_frontend_overrides()
    {
        $overrides = array();
        foreach (array_unique(array_values(self::app_key_map())) as $key) {
            $svg = self::get_valid_override($key);
            if ($svg !== '') {
                $overrides[$key] = $svg;
            }
        }
        return $overrides;
    }

    public static function get_specimen_assets()
    {
        return array(
            'spider' => self::asset_url('specimen.spider'),
            'spiderDetailed' => self::asset_url('specimen.spider-detailed'),
            'scorpion' => self::asset_url('specimen.scorpion'),
            'insect' => self::asset_url('specimen.insect'),
            'plant' => self::asset_url('specimen.plant'),
            'generic' => self::asset_url('specimen.generic'),
            'specimen' => self::asset_url('specimen.collection'),
        );
    }

    private static function standalone_svg($svg)
    {
        $svg = trim((string) $svg);
        if ($svg === '') {
            return '';
        }

        if (!preg_match('/<svg\b[^>]*\sxmlns\s*=/i', $svg)) {
            $standalone = preg_replace(
                '/<svg\b/i',
                '<svg xmlns="http://www.w3.org/2000/svg"',
                $svg,
                1
            );
            return is_string($standalone) ? $standalone : '';
        }

        return $svg;
    }

    public static function asset_url($key)
    {
        $definition = self::get_definition($key);
        if (!$definition || $definition['category'] !== 'specimen') {
            return '';
        }
        $svg = self::standalone_svg(self::get($key));
        $version = substr(hash('sha256', $svg), 0, 12);
        $path = '/setae-icon/' . rawurlencode($key) . '.svg';
        $url = function_exists('home_url') ? home_url($path) : $path;
        return function_exists('add_query_arg') ? add_query_arg('v', $version, $url) : $url . '?v=' . $version;
    }

    public static function register_rewrite_rule()
    {
        if (function_exists('add_rewrite_rule')) {
            add_rewrite_rule('^setae-icon/([a-z0-9.-]+)\.svg$', 'index.php?setae_icon_asset=$matches[1]', 'top');
        }
    }

    public static function register_query_var($vars)
    {
        $vars[] = 'setae_icon_asset';
        return $vars;
    }

    public static function maybe_flush_rewrite_rules()
    {
        if (!function_exists('get_option') || !function_exists('flush_rewrite_rules')) {
            return;
        }
        if ((string) get_option('setae_icon_rewrite_version', '') === self::REWRITE_VERSION) {
            return;
        }
        self::register_rewrite_rule();
        flush_rewrite_rules(false);
        update_option('setae_icon_rewrite_version', self::REWRITE_VERSION, false);
    }

    public static function maybe_render_asset()
    {
        $key = function_exists('get_query_var') ? (string) get_query_var('setae_icon_asset') : '';
        if ($key === '') {
            return;
        }
        $definition = self::get_definition($key);
        if (!$definition || $definition['category'] !== 'specimen') {
            if (function_exists('status_header')) {
                status_header(404);
            }
            exit;
        }

        $svg = self::standalone_svg(self::get($key));
        $etag = '"' . hash('sha256', $svg) . '"';
        if (isset($_SERVER['HTTP_IF_NONE_MATCH']) && trim((string) $_SERVER['HTTP_IF_NONE_MATCH']) === $etag) {
            if (function_exists('status_header')) {
                status_header(304);
            }
            exit;
        }

        header('Content-Type: image/svg+xml; charset=UTF-8');
        header('X-Content-Type-Options: nosniff');
        header('Cache-Control: public, max-age=300, stale-while-revalidate=86400');
        header('ETag: ' . $etag);
        echo $svg;
        exit;
    }

    public static function get_raw_overrides()
    {
        if (is_array(self::$overrides_cache)) {
            return self::$overrides_cache;
        }
        $stored = function_exists('get_option') ? get_option(self::OPTION_NAME, array()) : array();
        self::$overrides_cache = is_array($stored) ? $stored : array();
        return self::$overrides_cache;
    }

    public static function get_stored_override($key)
    {
        $overrides = self::get_raw_overrides();
        return isset($overrides[$key]) && is_string($overrides[$key]) ? $overrides[$key] : '';
    }

    public static function has_stored_override($key)
    {
        return self::get_stored_override($key) !== '';
    }

    public static function has_valid_override($key)
    {
        return self::get_valid_override($key) !== '';
    }

    private static function get_valid_override($key)
    {
        if (array_key_exists($key, self::$validated_overrides_cache)) {
            return self::$validated_overrides_cache[$key];
        }
        if (!self::get_definition($key)) {
            self::$validated_overrides_cache[$key] = '';
            return '';
        }
        $raw = self::get_stored_override($key);
        if ($raw === '') {
            self::$validated_overrides_cache[$key] = '';
            return '';
        }
        $sanitized = self::sanitize_svg($raw);
        self::$validated_overrides_cache[$key] = self::is_error($sanitized) ? '' : $sanitized;
        return self::$validated_overrides_cache[$key];
    }

    public static function save_override($key, $svg)
    {
        if (!self::get_definition($key)) {
            return self::error('unknown_icon', '登録されていないアイコンキーです。');
        }
        $sanitized = self::sanitize_svg($svg);
        if (self::is_error($sanitized)) {
            return $sanitized;
        }
        $overrides = self::get_raw_overrides();
        $overrides[$key] = $sanitized;
        self::persist_overrides($overrides);
        return $sanitized;
    }

    public static function reset_override($key)
    {
        if (!self::get_definition($key)) {
            return self::error('unknown_icon', '登録されていないアイコンキーです。');
        }
        $overrides = self::get_raw_overrides();
        unset($overrides[$key]);
        self::persist_overrides($overrides);
        return true;
    }

    public static function reset_all()
    {
        self::persist_overrides(array());
        return true;
    }

    public static function export_payload()
    {
        $icons = array();
        foreach (self::definitions() as $key => $definition) {
            $override = self::get_valid_override($key);
            if ($override !== '') {
                $icons[$key] = $override;
            }
        }
        return array(
            'schemaVersion' => self::SCHEMA_VERSION,
            'icons' => $icons,
        );
    }

    public static function import_payload($payload)
    {
        if (!is_array($payload) || (int) ($payload['schemaVersion'] ?? 0) !== self::SCHEMA_VERSION || !isset($payload['icons']) || !is_array($payload['icons'])) {
            return self::error('invalid_import', 'Icon Studio schemaVersion 1のJSONを指定してください。');
        }
        $validated = array();
        foreach ($payload['icons'] as $key => $svg) {
            if (!is_string($key) || !self::get_definition($key)) {
                return self::error('invalid_import_key', '未登録のキーです: ' . (string) $key);
            }
            if (!is_string($svg)) {
                return self::error('invalid_import_svg', $key . ': SVGコードが文字列ではありません。');
            }
            $sanitized = self::sanitize_svg($svg);
            if (self::is_error($sanitized)) {
                return self::error('invalid_import_svg', $key . ': ' . self::error_message($sanitized));
            }
            $validated[$key] = $sanitized;
        }
        $overrides = array_merge(self::get_raw_overrides(), $validated);
        self::persist_overrides($overrides);
        return count($validated);
    }

    private static function persist_overrides($overrides)
    {
        $overrides = is_array($overrides) ? $overrides : array();
        if (function_exists('update_option')) {
            update_option(self::OPTION_NAME, $overrides, false);
        }
        self::$overrides_cache = $overrides;
        self::$validated_overrides_cache = array();
    }

    public static function sanitize_svg($svg)
    {
        $svg = trim((string) $svg);
        if ($svg === '') {
            return self::error('empty_svg', 'SVGコードを入力してください。');
        }
        if (strlen($svg) > 200000) {
            return self::error('svg_too_large', 'SVGは200KB以下にしてください。');
        }
        if (preg_match('/\bxmlns\s*:/i', $svg)) {
            return self::error('unsafe_namespace', 'xmlns:xlinkなどの追加名前空間は使用できません。');
        }
        if (preg_match('/<!DOCTYPE|<!ENTITY|<\s*(script|foreignObject|iframe|object|embed|image|style|a|use)\b|\bon[a-z0-9_-]+\s*=|\b(?:href|xlink:href)\s*=/i', $svg)) {
            return self::error('unsafe_svg', '外部参照、スクリプト、イベント属性を含むSVGは保存できません。');
        }
        if (!class_exists('DOMDocument')) {
            return self::error('svg_parser_missing', 'SVGを安全に検証できないため保存できません。');
        }

        $previous = libxml_use_internal_errors(true);
        $document = new DOMDocument();
        $loaded = $document->loadXML($svg, LIBXML_NONET | LIBXML_NOERROR | LIBXML_NOWARNING | LIBXML_COMPACT);
        libxml_clear_errors();
        libxml_use_internal_errors($previous);
        if (!$loaded || !$document->documentElement || strtolower($document->documentElement->localName) !== 'svg') {
            return self::error('invalid_svg', '正しい<svg>要素を入力してください。');
        }

        $root = $document->documentElement;
        $svg_namespace = 'http://www.w3.org/2000/svg';
        $root_namespace = (string) $root->namespaceURI;
        $has_namespace = $root->hasAttribute('xmlns') || $root_namespace !== '';
        if ($has_namespace && ($root->getAttribute('xmlns') !== $svg_namespace || $root_namespace !== $svg_namespace)) {
            return self::error('unsafe_namespace', 'SVG名前空間が正しくありません。');
        }
        $view_box = trim((string) $root->getAttribute('viewBox'));
        $number = '-?(?:\d+(?:\.\d+)?|\.\d+)(?:[eE][+-]?\d+)?';
        if ($view_box === '' || !preg_match('/^\s*' . $number . '[,\s]+' . $number . '[,\s]+' . $number . '[,\s]+' . $number . '\s*$/', $view_box)) {
            return self::error('missing_viewbox', 'SVGにviewBoxがありません。例: viewBox="0 0 24 24"');
        }

        $allowed_elements = array('svg', 'g', 'path', 'circle', 'ellipse', 'rect', 'line', 'polyline', 'polygon', 'title');
        $allowed_attributes = array(
            'viewBox', 'preserveAspectRatio', 'fill', 'stroke', 'stroke-width', 'stroke-linecap',
            'stroke-linejoin', 'stroke-miterlimit', 'stroke-dasharray', 'stroke-dashoffset',
            'stroke-opacity', 'fill-opacity', 'fill-rule', 'clip-rule', 'opacity', 'transform', 'vector-effect',
            'x', 'y', 'x1', 'y1', 'x2', 'y2', 'cx', 'cy', 'r', 'rx', 'ry', 'width',
            'height', 'points', 'd', 'pathLength', 'xmlns',
        );
        $remove_attributes = array('class', 'id', 'role', 'tabindex', 'focusable', 'aria-hidden', 'aria-label', 'aria-labelledby');
        $nodes = array($root);
        while ($nodes) {
            $node = array_shift($nodes);
            $tag = strtolower($node->localName);
            if ($node !== $root && $node->hasAttribute('xmlns')) {
                return self::error('unsafe_namespace', 'SVG名前空間はroot <svg>でのみ宣言できます。');
            }
            $node_namespace = (string) $node->namespaceURI;
            if ($node_namespace !== '' && $node_namespace !== $svg_namespace) {
                return self::error('unsafe_namespace', 'SVG名前空間が正しくありません。');
            }
            if (!in_array($tag, $allowed_elements, true) || ($tag === 'svg' && $node !== $root)) {
                return self::error(
                    'unsupported_element',
                    'このSVGは <' . $node->localName . '> を使用しています。現在のIcon Studioでは未対応です。'
                );
            }
            $attribute_names = array();
            foreach ($node->attributes as $attribute) {
                $attribute_names[] = $attribute->nodeName;
            }
            foreach ($attribute_names as $attribute_name) {
                $local_name = $attribute_name;
                $value = (string) $node->getAttribute($attribute_name);
                if ($attribute_name === 'xmlns') {
                    if ($node !== $root || $value !== 'http://www.w3.org/2000/svg') {
                        return self::error('unsafe_namespace', 'SVG名前空間が正しくありません。');
                    }
                    $node->removeAttribute($attribute_name);
                    continue;
                }
                if (strpos($attribute_name, ':') !== false && $attribute_name !== 'xmlns') {
                    return self::error('unsafe_attribute', '名前空間付き属性は使用できません: ' . $attribute_name);
                }
                if (in_array($local_name, $remove_attributes, true)) {
                    $node->removeAttribute($attribute_name);
                    continue;
                }
                if (!in_array($local_name, $allowed_attributes, true)) {
                    return self::error(
                        'unsupported_attribute',
                        'このSVGは "' . $attribute_name . '" 属性を使用しています。現在のIcon Studioでは未対応です。'
                    );
                }
                if (preg_match('/[\x00-\x08\x0B\x0C\x0E-\x1F]|url\s*\(|javascript\s*:|data\s*:|https?\s*:/i', $value)) {
                    return self::error('unsafe_attribute_value', '外部参照を含むSVG属性は使用できません。');
                }
            }
            if ($node === $root) {
                $node->removeAttribute('width');
                $node->removeAttribute('height');
            }
            foreach (iterator_to_array($node->childNodes) as $child) {
                if ($child->nodeType === XML_ELEMENT_NODE) {
                    $nodes[] = $child;
                } elseif ($child->nodeType === XML_TEXT_NODE) {
                    if ($tag !== 'title' && trim($child->nodeValue) !== '') {
                        return self::error('unsafe_text', 'title以外のSVGテキストは使用できません。');
                    }
                } elseif ($child->nodeType === XML_COMMENT_NODE) {
                    $node->removeChild($child);
                } else {
                    return self::error('unsafe_node', '許可されていないSVGノードを含んでいます。');
                }
            }
        }

        $root->setAttribute('aria-hidden', 'true');
        $root->setAttribute('focusable', 'false');
        $sanitized = trim((string) $document->saveXML($root));
        $without_namespace = preg_replace(
            '/\sxmlns=(["\'])http:\/\/www\.w3\.org\/2000\/svg\1/i',
            '',
            $sanitized,
            1
        );
        return is_string($without_namespace) ? $without_namespace : $sanitized;
    }

    private static function apply_runtime_attributes($svg, $class_name)
    {
        if ($class_name === '') {
            return $svg;
        }
        $class_name = preg_replace('/[^a-zA-Z0-9 _-]/', '', (string) $class_name);
        $svg = preg_replace('/\sclass=("[^"]*"|\'[^\']*\')/i', '', $svg, 1);
        $svg = preg_replace('/\s(?:aria-hidden|focusable|tabindex)=("[^"]*"|\'[^\']*\')/i', '', $svg);
        return preg_replace('/<svg\b/i', '<svg class="' . $class_name . '" aria-hidden="true" focusable="false"', $svg, 1);
    }

    private static function error($code, $message)
    {
        return new WP_Error($code, $message);
    }

    private static function is_error($value)
    {
        return function_exists('is_wp_error') ? is_wp_error($value) : $value instanceof WP_Error;
    }

    private static function error_message($error)
    {
        return is_object($error) && method_exists($error, 'get_error_message') ? $error->get_error_message() : 'SVGを保存できません。';
    }
}
