<?php
// Main Dashboard Template
// Create path to partials
$partials_path = plugin_dir_path(__FILE__) . 'partials/';

// ヘッダー付近で現在のユーザー情報を取得
$is_premium = get_user_meta(get_current_user_id(), '_setae_is_premium', true);
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
            <span id="header-user-name"
                class="<?php echo $is_premium ? '' : ''; ?>"><?php echo esc_html(wp_get_current_user()->display_name); ?></span>
            <?php echo get_avatar(get_current_user_id(), 32, '', 'Profile', array('class' => 'header-user-icon', 'style' => 'object-fit:cover; border-radius:50%;')); ?>
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