<?php
// Main Dashboard Template

// ▼ 追加: ページキャッシュプラグインによるキャッシュを無効化し、常に最新のPHP（アバター等）を出力させる
if (!defined('DONOTCACHEPAGE')) {
    define('DONOTCACHEPAGE', true);
}

// Create path to partials
$partials_path = plugin_dir_path(__FILE__) . 'partials/';

// ヘッダー付近で現在のユーザー情報を取得
$is_guest_mode = !is_user_logged_in();
$is_premium = $is_guest_mode ? false : get_user_meta(get_current_user_id(), '_setae_is_premium', true);

// ▼ 追加：ボーナス枠数の取得と階級（ティア）判定ロジック
$bonus_slots = (int) get_user_meta(get_current_user_id(), '_setae_bonus_spider_limit', true);
$bonus_class = '';
$bonus_label = '';

if ($bonus_slots >= 51) {
    $bonus_class = 'tier-legend';
    $bonus_label = '★'; // 51〜
} elseif ($bonus_slots >= 41) {
    $bonus_class = 'tier-epic';
    $bonus_label = 'V';   // 41〜50
} elseif ($bonus_slots >= 31) {
    $bonus_class = 'tier-rare';
    $bonus_label = 'IV';  // 31〜40
} elseif ($bonus_slots >= 21) {
    $bonus_class = 'tier-uncommon';
    $bonus_label = 'III'; // 21〜30
} elseif ($bonus_slots >= 11) {
    $bonus_class = 'tier-advanced';
    $bonus_label = 'II';  // 11〜20
} elseif ($bonus_slots >= 1) {
    $bonus_class = 'tier-basic';
    $bonus_label = 'I';   // 1〜10
}
?>
<div id="setae-app"<?php echo $is_guest_mode ? ' class="is-guest-trial"' : ''; ?>>
    <!-- App Header -->
    <div class="setae-header">
        <div class="setae-header-brand">
            <a class="setae-public-brand" href="<?php echo esc_url(home_url('/')); ?>" aria-label="SETAE ホーム">
                <span class="setae-public-brand-mark" aria-hidden="true"></span>
                <span>SETAE</span>
            </a>
            <?php if ($is_premium): ?>
                <span class="setae-pro-badge">プレミアム</span>
            <?php endif; ?>
        </div>
        <button type="button" class="setae-user-actions" id="<?php echo $is_guest_mode ? 'setae-guest-account-trigger' : 'setae-profile-trigger'; ?>" aria-label="<?php echo $is_guest_mode ? '無料登録とデータ同期' : 'プロフィールと設定を開く'; ?>" aria-haspopup="dialog">
            <span id="header-user-name"><?php echo esc_html($is_guest_mode ? '体験モード' : wp_get_current_user()->display_name); ?></span>

            <span class="header-avatar-wrapper">
                <?php if ($is_guest_mode): ?>
                    <span class="setae-guest-avatar" aria-hidden="true">S</span>
                <?php else:
                // アバターのHTMLを取得
                $avatar_html = get_avatar(get_current_user_id(), 32, '', 'プロフィール', array('class' => 'header-user-icon', 'style' => 'object-fit:cover; border-radius:50%;'));
                // URLに既にパラメータが存在するか判定し、安全にキャッシュバスターを付与する
                echo preg_replace_callback('/(src=[\'"])([^\'"]+)([\'"])/i', function ($m) {
                    $sep = strpos($m[2], '?') !== false ? '&' : '?';
                    return $m[1] . $m[2] . $sep . 't=' . time() . $m[3];
                }, $avatar_html);
                endif; ?>

                <?php if ($is_premium): ?>
                    <!--                    <span class="supporter-badge" title="Setaeサポーター">✦</span>-->
                <?php endif; ?>

                <?php if ($bonus_slots > 0): ?>
                    <span class="bonus-badge <?php echo esc_attr($bonus_class); ?>"
                        title="ボーナス枠: <?php echo esc_attr($bonus_slots); ?>">
                        <?php echo esc_html($bonus_label); ?>
                    </span>
                <?php endif; ?>
            </span>

        </button>
    </div>

    <!-- Navigation -->
    <nav class="setae-nav" aria-label="メインメニュー">
        <button type="button" class="setae-nav-item" data-target="section-enc" aria-controls="section-enc">
            <span class="setae-nav-icon" aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                    <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2Z"></path>
                    <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7Z"></path>
                </svg>
            </span>
            <span class="setae-nav-label">図鑑</span>
        </button>
        <button type="button" class="setae-nav-item active" data-target="section-my" aria-controls="section-my" aria-current="page">
            <span class="setae-nav-icon" aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                    <path d="m8 2 1.9 1.9M16 2l-1.9 1.9"></path>
                    <path d="M9 7.1V6a3 3 0 0 1 6 0v1.1"></path>
                    <path d="M12 20c-3.3 0-6-2.7-6-6v-3a6 6 0 0 1 12 0v3c0 3.3-2.7 6-6 6Z"></path>
                    <path d="M6 13H2M18 13h4M7 18l-3 2M17 18l3 2M7 8 4 3M17 8l3-2"></path>
                </svg>
            </span>
            <span class="setae-nav-label">マイ個体</span>
        </button>
        <button type="button" class="setae-nav-item" data-target="section-baby" aria-controls="section-baby"<?php echo $is_guest_mode ? ' data-guest-locked="1"' : ''; ?>>
            <span class="setae-nav-icon setae-nav-icon-baby" aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                    <path d="M10 3 8 21M16 3l-2 18M4 9h16M3 15h16"></path>
                </svg>
            </span>
            <span class="setae-nav-label">ベビー</span>
        </button>
        <button type="button" class="setae-nav-item" data-target="section-care-feed" aria-controls="section-care-feed"<?php echo $is_guest_mode ? ' data-guest-locked="1"' : ''; ?>>
            <span class="setae-nav-icon" aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                    <path d="M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4Z"></path>
                </svg>
                <span class="setae-badge-count" id="social-unread-badge" style="display: none;">0</span>
            </span>
            <span class="setae-nav-label">交流</span>
        </button>
    </nav>

    <!-- Main Content -->
    <div class="setae-content">

        <?php
        // Encyclopedia Section (New Logic)
        include $partials_path . 'section-encyclopedia.php';
        ?>

        <?php
        // Encyclopedia Detail View
        include $partials_path . 'view-detail.php';
        ?>

        <?php
        // My Spiders Section
        include $partials_path . 'section-my-spiders.php';
        ?>

        <?php
        // My Spiders Detail View
        include $partials_path . 'section-my-detail.php';
        ?>

        <?php
        // Baby Group Management
        include $partials_path . 'section-baby.php';
        ?>

        <?php
        // Shared Care Feed
        include $partials_path . 'section-care-feed.php';
        ?>

        <?php
        // Shared Care Feed Detail View
        include $partials_path . 'section-care-feed-detail.php';
        ?>

        <?php
        // Community Section
        include $partials_path . 'section-community.php';
        ?>

        <?php
        // Community Detail View
        include $partials_path . 'section-community-detail.php';
        ?>

    </div> <!-- Close .setae-content -->
</div> <!-- Close #setae-app -->

<?php
// Include Modals
include $partials_path . 'modals.php';
?>
