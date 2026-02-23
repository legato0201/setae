<?php
// Main Dashboard Template
// Create path to partials
$partials_path = plugin_dir_path(__FILE__) . 'partials/';

// ヘッダー付近で現在のユーザー情報を取得
$is_premium = get_user_meta(get_current_user_id(), '_setae_is_premium', true);

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
<div id="setae-app">
    <!-- App Header -->
    <div class="setae-header">
        <div class="setae-logo setae-logo-text" style="display: flex; align-items: center;">
            SETAE
            <?php if ($is_premium): ?>
                <span class="setae-pro-badge">PRO</span>
            <?php endif; ?>
        </div>
        <div class="setae-user-actions" id="setae-profile-trigger">
            <span id="header-user-name"><?php echo esc_html(wp_get_current_user()->display_name); ?></span>

            <div class="header-avatar-wrapper">
                <?php echo get_avatar(get_current_user_id(), 32, '', 'Profile', array('class' => 'header-user-icon', 'style' => 'object-fit:cover; border-radius:50%;')); ?>

                <?php if ($is_premium): ?>
                    <span class="supporter-badge" title="Setae Supporter">✦</span>
                <?php endif; ?>

                <?php if ($bonus_slots > 0): ?>
                    <span class="bonus-badge <?php echo esc_attr($bonus_class); ?>"
                        title="ボーナス枠: <?php echo esc_attr($bonus_slots); ?>">
                        <?php echo esc_html($bonus_label); ?>
                    </span>
                <?php endif; ?>
            </div>

        </div>
    </div>

    <!-- Navigation -->
    <div class="setae-nav">
        <div class="setae-nav-item" data-target="section-enc">
            <span class="setae-nav-icon">📖</span> <span class="setae-nav-label">図鑑</span>
        </div>
        <div class="setae-nav-item active" data-target="section-my">
            <span class="setae-nav-icon">🕷️</span> <span class="setae-nav-label">My Spiders</span>
        </div>
        <div class="setae-nav-item" data-target="section-bl">
            <span class="setae-nav-icon">
                🤝
                <span class="setae-badge-count" style="display: none;">0</span>
            </span>
            <span class="setae-nav-label">BL Match</span>
        </div>
        <div class="setae-nav-item" data-target="section-com">
            <span class="setae-nav-icon">💬</span> <span class="setae-nav-label">Community</span>
        </div>
    </div>

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
        // Breeding Loan Section
        include $partials_path . 'section-bl.php';
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