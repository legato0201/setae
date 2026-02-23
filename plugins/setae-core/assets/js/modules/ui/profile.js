var SetaeUIProfile = (function ($) {
    'use strict';

    // ▼ 追加: 翻訳用の関数を定義 (PHPで定義した SetaeBL_i18n を参照します)
    const __ = function (text) {
        return (typeof SetaeBL_i18n !== 'undefined' && SetaeBL_i18n[text]) ? SetaeBL_i18n[text] : text;
    };

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
        const spiderLimit = currentUser.spider_limit || 5;
        const refCode = currentUser.referral_code || '未発行';
        const bonusLimit = currentUser.bonus_limit || 0;

        const html = `
        <div class="setae-modal-overlay active" id="setae-profile-modal" style="display:flex;">
            <div class="setae-modal-content" style="max-width: 420px;">
                
                <div class="profile-header">
                    <h3>${__('Profile Settings')}</h3>
                    <span class="setae-close" id="close-profile-modal">&times;</span>
                </div>

                <form id="setae-profile-form">
                    <div class="profile-avatar-section">
                        <div class="avatar-wrapper" id="trigger-avatar-upload" title="${__('写真・アイコンを変更')}">
                            <div class="profile-avatar-preview" id="profile-avatar-preview-container">
                                <img src="${avatarUrl}" alt="Avatar">
                            </div>
                            <div class="avatar-edit-badge">📷</div>
                        </div>
                        <input type="file" id="prof-icon" accept="image/*" style="display:none;">
                    </div>

                    <div class="setae-form-group">
                        <label>${__('Display Name')}</label>
                        <input type="text" id="prof-display-name" class="setae-input" value="${displayName}" placeholder="${__('ニックネーム')}">
                    </div>

                    <div class="setae-form-group">
                        <label>${__('Email Address')}</label>
                        <input type="email" id="prof-email" class="setae-input" value="${email}" placeholder="example@mail.com">
                    </div>

                    <div class="setae-form-group">
                        <label>${__('New Password')} <small style="font-weight:normal; text-transform:none;">${__('(Leave empty to keep current)')}</small></label>
                        <input type="password" id="prof-password" class="setae-input" placeholder="********" autocomplete="new-password">
                    </div>

                    ${!currentUser.is_premium ? `
                    <div class="setae-form-group" style="background:#f5f7fa; padding:15px; border-radius:8px; border:1px dashed #ccc;">
                        <label style="color:#333; font-weight:bold;">🎁 ${__('あなたの紹介コード')}</label>
                        <p style="font-size:12px; color:#666; margin-bottom:10px;">
                            ${__('このコードをSNS等でシェアして新規ユーザーが登録すると、お互いの生体登録枠が＋1されます。')}
                            <br>${__('現在の獲得ボーナス枠:')} <strong style="color:#d35400;">+${bonusLimit} 枠</strong>
                        </p>
                        <div style="display:flex; gap:8px;">
                            <input type="text" id="prof-my-referral" class="setae-input" value="${refCode}" readonly style="background:#fff; font-family:monospace; font-weight:bold; color:#2980b9;">
                            <button type="button" class="setae-btn" id="btn-copy-referral" style="white-space:nowrap; background:#e0e6ed; color:#333;">${__('コピー')}</button>
                        </div>
                    </div>
                    ` : ''}

                    <div class="setae-form-group">
                        <label>${__('Premium Plan')}</label>
                        ${(function () {
                if (currentUser.is_premium) {
                    let dateHtml = '';
                    if (currentUser.premium_cancel_at) {
                        // 解約予定がある場合（UNIXタイムスタンプを日付に変換）
                        const cancelDate = new Date(currentUser.premium_cancel_at * 1000);
                        const dateString = cancelDate.toLocaleDateString('ja-JP');
                        dateHtml = `<div style="font-size:12px; color:#e74c3c; margin-bottom:10px; font-weight:bold;">サービスは ${dateString} に終了します</div>`;
                    } else {
                        // 自動更新が有効な場合
                    }

                    return `
                                <div class="premium-status" style="padding:15px;background:#fffbea;border:1px solid #fce8a6;border-radius:8px;text-align:center;">
                                    <div style="font-weight:bold;color:#b28900;margin-bottom:5px;">
                                        <img draggable="false" role="img" class="emoji" alt="🌟" src="/wp-content/plugins/setae-core/assets/images/emoji/1f31f.svg"> ${__('You are a Premium Member')}
                                    </div>
                                    ${dateHtml}
                                    <button type="button" id="btn-manage-subscription" class="setae-btn">
                                        ${__('プランの管理・解約手続き')}
                                    </button>
                                </div>`;
                } else {
                    return `<button type="button" class="setae-btn setae-btn-primary" id="upgrade-premium-btn" style="width:100%;height:44px;background:linear-gradient(135deg, #FFD700, #FDB931);color:#fff;border:none;border-radius:12px;font-size:15px;font-weight:600;box-shadow:0 4px 12px rgba(253, 185, 49, 0.3);">✨ ${__('Upgrade to Premium')}</button>`;
                }
            })()}
                    </div>

                    <div class="setae-form-group" style="text-align: center; margin-top: 10px;">
                        <button type="button" id="btn-open-credits" style="background: none; border: none; color: #888; font-size: 13px; cursor: pointer; text-decoration: underline;">
                            ${__('アプリについて / クレジット')}
                        </button>
                    </div>

                    <div class="setae-form-actions">
                        <button type="button" class="setae-btn setae-btn-danger-ghost" id="setae-logout-btn">
                            <span>↪</span> ${__('Logout')}
                        </button>
                        
                        <div class="actions-right">
                            <button type="button" class="setae-btn setae-btn-secondary" id="close-profile-modal-btn">${__('Cancel')}</button>
                            <button type="submit" class="setae-btn setae-btn-primary">${__('Save Changes')}</button>
                        </div>
                    </div>
                </form>
            </div>
        </div>`;

        $('body').append(html);

        // --- イベントリスナーの設定 ---

        // ▼▼▼ ここから追加: 紹介コードのコピー処理 ▼▼▼
        $('#setae-profile-modal').on('click', '#btn-copy-referral', function () {
            const copyInput = document.getElementById("prof-my-referral");
            // 入力欄を選択状態にする
            copyInput.select();
            copyInput.setSelectionRange(0, 99999); // モバイル端末への対応

            // クリップボードにコピー
            navigator.clipboard.writeText(copyInput.value).then(() => {
                // コピー成功時にトースト通知を表示
                if (typeof SetaeCore !== 'undefined' && typeof SetaeCore.showToast === 'function') {
                    SetaeCore.showToast(__('紹介コードをコピーしました'), 'success');
                } else {
                    alert(__('紹介コードをコピーしました'));
                }
            }).catch(err => {
                alert(__('コピーに失敗しました'));
            });
        });
        // ▲▲▲ 追加ここまで ▲▲▲

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

        // クレジットモーダルを開く
        $('#setae-profile-modal').on('click', '#btn-open-credits', function (e) {
            e.preventDefault();
            $('#setae-credits-modal').fadeIn(200);
        });

        // クレジットモーダルを閉じる
        $(document).on('click', '#close-credits-modal, #setae-credits-modal', function (e) {
            if (e.target === this) {
                $('#setae-credits-modal').fadeOut(200);
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
