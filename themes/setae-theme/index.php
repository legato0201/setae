<?php
get_header();

if (!is_user_logged_in()) {
    // Login Screen
    ?>
    <div id="setae-login-screen"
        style="display:flex; justify-content:center; align-items:center; height:100vh; background:var(--setae-bg);">
        <div class="setae-card" style="text-align:center; padding:40px; max-width:400px;">
            <h1 style="margin-bottom:20px;">SETAE</h1>
            <p style="margin-bottom:30px;">タランチュラ愛好家のための統合プラットフォーム</p>
            <a href="<?php echo wp_login_url(home_url()); ?>" class="setae-btn">ログインして開始</a>
            <div style="margin-top:20px;">
                <button id="setae-btn-register-start"
                    style="background:none; border:none; color:var(--setae-primary); cursor:pointer; text-decoration:underline;">新規登録はこちら</button>
            </div>
            <p style="margin-top:20px; font-size:12px; color:#999;">&copy; 2026 Setae Platform</p>
        </div>
    </div>

    <!-- Registration Modal (Outside Main App, only visible when logged out but we need script to handle it. 
         Ideally script handles it. But for simplicity, let's put it here and ensure script loads even if logged out?
         Wait, check is_user_logged_in condition. Script IS enqueued globally?
         Yes, 'setae_theme_enqueue_scripts' is global. But 'setae-app.js' logic mostly runs for app.
         I need to ensure 'setae-app.js' has logic for this registration that runs regardless of login.
    -->
    <div id="setae-register-modal" class="setae-modal" style="display:none;">
        <div class="setae-modal-content" style="max-width:400px;">
            <h3>新規登録</h3>
            <form id="setae-register-form">
                <div class="setae-form-group">
                    <label>ユーザー名 (英数字)</label>
                    <input type="text" id="reg-username" class="setae-input" required pattern="[a-zA-Z0-9_-]+"
                        title="英数字とハイフン、アンダースコアのみ">
                </div>
                <div class="setae-form-group">
                    <label>メールアドレス</label>
                    <input type="email" id="reg-email" class="setae-input" required>
                </div>
                <div class="setae-form-group">
                    <label>パスワード</label>
                    <input type="password" id="reg-password" class="setae-input" required minlength="6">
                </div>
                <div class="setae-form-actions">
                    <button type="button" class="setae-btn setae-btn-secondary" id="close-register-modal">キャンセル</button>
                    <button type="submit" class="setae-btn setae-btn-primary">登録</button>
                </div>
            </form>
        </div>
    </div>
    <?php
} else {
    // Main Dashboard App
    if (shortcode_exists('setae_dashboard')) {
        echo do_shortcode('[setae_dashboard]');
    } else {
        echo '<p style="text-align:center; padding:50px;">Setae Core Plugin is missing or inactive.</p>';
    }
}

get_footer();
