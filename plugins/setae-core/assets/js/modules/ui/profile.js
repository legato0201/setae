var SetaeUIProfile = (function ($) {
    'use strict';

    function init() {
        // 1. プロフィールモーダルを開く
        $(document).on('click', '#setae-profile-trigger', function (e) {
            e.preventDefault();
            // SetaeSettingsから現在ユーザー情報を取得してモーダルを開く
            if (SetaeSettings && SetaeSettings.current_user) {
                openProfileModal(SetaeSettings.current_user);
            } else {
                console.error('User data not found in SetaeSettings');
            }
        });
    }

    /**
     * プロフィールモーダルを動的に生成して表示
     */
    function openProfileModal(currentUser) {
        // 既存のモーダルがあれば削除
        $('#setae-profile-modal').remove();

        // 画像がない場合のフォールバック
        const avatarUrl = currentUser.avatar || SetaeSettings.plugin_url + 'assets/images/default-avatar.png';
        const displayName = currentUser.display_name || '';
        const email = currentUser.email || '';

        const html = `
        <div class="setae-modal-overlay active" id="setae-profile-modal" style="display:flex;">
            <div class="setae-modal-content" style="max-width: 420px;">
                
                <div class="profile-header">
                    <h3>Profile Settings</h3>
                    <span class="setae-close" id="close-profile-modal">&times;</span>
                </div>

                <form id="setae-profile-form">
                    <div class="profile-avatar-section">
                        <div class="avatar-wrapper" id="trigger-avatar-upload" title="写真・アイコンを変更">
                            <div class="profile-avatar-preview" id="profile-avatar-preview-container">
                                <img src="${avatarUrl}" alt="Avatar">
                            </div>
                            <div class="avatar-edit-badge">📷</div>
                        </div>
                        <input type="file" id="prof-icon" accept="image/*" style="display:none;">
                    </div>

                    <div class="setae-form-group">
                        <label>Display Name</label>
                        <input type="text" id="prof-display-name" class="setae-input" value="${displayName}" placeholder="ニックネーム">
                    </div>

                    <div class="setae-form-group">
                        <label>Email Address</label>
                        <input type="email" id="prof-email" class="setae-input" value="${email}" placeholder="example@mail.com">
                    </div>

                    <div class="setae-form-group">
                        <label>New Password <small style="font-weight:normal; text-transform:none;">(Leave empty to keep current)</small></label>
                        <input type="password" id="prof-password" class="setae-input" placeholder="********" autocomplete="new-password">
                    </div>

                    <div class="setae-form-group">
                        <label>Premium Plan</label>
                        ${currentUser.is_premium
                ? `<div class="premium-status" style="padding:15px;background:#fffbea;border:1px solid #fce8a6;border-radius:8px;text-align:center;">
                                <div style="font-weight:bold;color:#b28900;margin-bottom:10px;">
                                    <img draggable="false" role="img" class="emoji" alt="🌟" src="https://s.w.org/images/core/emoji/17.0.2/svg/1f31f.svg"> You are a Premium Member
                                </div>
                                <button type="button" id="btn-manage-subscription" class="setae-btn" style="background:#fff; color:#333; border:1px solid #dcdcdc; font-size:12px; padding:6px 16px; border-radius:4px; cursor:pointer;">
                                    プランの管理・解約手続き
                                </button>
                               </div>`
                : '<button type="button" class="setae-btn setae-btn-primary" id="upgrade-premium-btn" style="width:100%;height:44px;background:linear-gradient(135deg, #FFD700, #FDB931);color:#fff;border:none;border-radius:12px;font-size:15px;font-weight:600;box-shadow:0 4px 12px rgba(253, 185, 49, 0.3);">✨ Upgrade to Premium</button>'
            }
                    </div>

                    <div class="setae-form-actions">
                        <button type="button" class="setae-btn setae-btn-danger-ghost" id="setae-logout-btn">
                            <span>↪</span> Logout
                        </button>
                        
                        <div class="actions-right">
                            <button type="button" class="setae-btn setae-btn-secondary" id="close-profile-modal-btn">Cancel</button>
                            <button type="submit" class="setae-btn setae-btn-primary">Save Changes</button>
                        </div>
                    </div>
                </form>
            </div>
        </div>`;

        $('body').append(html);

        // --- イベントリスナーの設定 ---

        // モーダルを閉じる (オーバーレイクリック、×ボタン、Cancelボタン)
        $('#setae-profile-modal, #close-profile-modal, #close-profile-modal-btn').on('click', function (e) {
            if (e.target !== this) return; // バブリング防止 (オーバーレイのみ)
            $('#setae-profile-modal').fadeOut(200, function () {
                $(this).remove();
            });
        });

        // アバター画像クリックでファイル選択を開く
        $('#trigger-avatar-upload').on('click', function () {
            $('#prof-icon').click();
        });

        // ファイル選択時のプレビュー更新
        $('#prof-icon').on('change', function (e) {
            const file = e.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = function (e) {
                    $('#profile-avatar-preview-container img').attr('src', e.target.result);
                }
                reader.readAsDataURL(file);
            }
        });

        // 保存処理
        $('#setae-profile-form').on('submit', function (e) {
            e.preventDefault();
            updateProfile();
        });

        // ログアウト処理
        $('#setae-logout-btn').on('click', function () {
            if (confirm('ログアウトしますか？')) {
                window.location.href = SetaeSettings.logout_url;
            }
        });

        // プレミアムアップグレード処理
        $('#setae-profile-modal').on('click', '#upgrade-premium-btn', async function () {
            try {
                const response = await fetch(SetaeSettings.api_root + 'setae/v1/stripe/create-checkout-session', {
                    method: 'POST',
                    headers: { 'X-WP-Nonce': SetaeSettings.nonce }
                });
                const data = await response.json();

                if (data.url) {
                    // Stripeの安全な決済画面（Checkout）へリダイレクト
                    window.location.href = data.url;
                } else {
                    alert('決済セッションの作成に失敗しました。');
                }
            } catch (error) {
                console.error('Error:', error);
                alert('エラーが発生しました。');
            }
        });

        // サブスクリプション管理ボタンの処理 (カスタマーポータル)
        $('#setae-profile-modal').on('click', '#btn-manage-subscription', async function () {
            const btnManageSub = document.getElementById('btn-manage-subscription');
            if (btnManageSub) {
                // ボタンをローディング状態にする（連打防止）
                const originalText = btnManageSub.textContent;
                btnManageSub.disabled = true;
                btnManageSub.textContent = '読み込み中...';

                try {
                    const response = await fetch(SetaeSettings.api_root + 'setae/v1/stripe/create-portal-session', {
                        method: 'POST',
                        headers: {
                            'X-WP-Nonce': SetaeSettings.nonce,
                            'Content-Type': 'application/json'
                        }
                    });

                    const data = await response.json();

                    if (data.url) {
                        // Stripeの安全なカスタマーポータル画面へ遷移
                        window.location.href = data.url;
                    } else {
                        alert('ポータルの表示に失敗しました: ' + (data.message || '不明なエラー'));
                        btnManageSub.disabled = false;
                        btnManageSub.textContent = originalText;
                    }
                } catch (err) {
                    console.error(err);
                    alert('通信エラーが発生しました。');
                    btnManageSub.disabled = false;
                    btnManageSub.textContent = originalText;
                }
            }
        });
    }
    function updateProfile() {
        // UIに即時反映（表示名）
        const newName = $('#prof-display-name').val();

        // Prepare Data
        const formData = new FormData();
        formData.append('action', 'setae_update_profile');
        formData.append('nonce', SetaeSettings.nonce);
        formData.append('display_name', newName);
        formData.append('email', $('#prof-email').val());
        formData.append('password', $('#prof-password').val());

        const file = $('#prof-icon')[0].files[0];
        if (file) {
            formData.append('profile_image', file);
        }

        $.ajax({
            url: SetaeSettings.ajax_url,
            method: 'POST',
            data: formData,
            processData: false,
            contentType: false,
            success: function (response) {
                if (response.success) {
                    $('#header-user-name').text(newName);

                    // --- アバター画像の反映 ---
                    let newAvatarUrl = null;
                    if (response.data && response.data.avatar_url) {
                        newAvatarUrl = response.data.avatar_url;
                    } else {
                        // フォールバック: プレビュー画像を使用
                        newAvatarUrl = $('#profile-avatar-preview-container img').attr('src');
                    }

                    if (newAvatarUrl) {
                        $('.setae-profile-avatar img').attr('src', newAvatarUrl);
                        $('.header-user-icon').attr('src', newAvatarUrl);
                        $('.avatar').attr('src', newAvatarUrl); // ページ内すべてのWordPress標準アバターを更新

                        // SetaeSettingsのキャッシュも更新しておく
                        if (SetaeSettings.current_user) {
                            SetaeSettings.current_user.avatar = newAvatarUrl;
                            SetaeSettings.current_user.display_name = newName;
                            SetaeSettings.current_user.email = $('#prof-email').val();
                        }
                    }
                    // ---------------------------------------------------

                    SetaeCore.showToast('プロフィールを更新しました', 'success');
                    $('#setae-profile-modal').fadeOut(200, function () { $(this).remove(); });
                } else {
                    SetaeCore.showToast('更新に失敗しました: ' + (response.data || 'Unknown error'), 'error');
                }
            },
            error: function () {
                SetaeCore.showToast('通信エラーが発生しました', 'error');
            }
        });
    }

    return { init: init };
})(jQuery);

// ドキュメントロード時に初期化
jQuery(document).ready(function () {
    SetaeUIProfile.init();
});
