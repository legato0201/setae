var SetaeUIProfile = (function ($) {
    'use strict';

    function init() {
        // 1. プロフィールモーダルを開く
        $(document).on('click', '#setae-profile-trigger', function (e) {
            e.preventDefault();
            $('#setae-profile-modal').fadeIn(200);
        });

        // 2. モーダルを閉じる
        $(document).on('click', '#close-profile-modal', function () {
            $('#setae-profile-modal').fadeOut(200);
        });

        // 3. 画像アップロードの連動
        $(document).on('click', '#btn-trigger-prof-upload', function () {
            $('#prof-icon').click();
        });

        $(document).on('change', '#prof-icon', function (e) {
            const file = e.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = function (e) {
                    $('#profile-avatar-preview-container img').attr('src', e.target.result);
                };
                reader.readAsDataURL(file);
            }
        });

        // 4. プロフィール保存処理
        $(document).on('submit', '#setae-profile-form', function (e) {
            e.preventDefault();

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

                        // --- 修正箇所：アバター画像の反映 ---
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
                        }
                        // ---------------------------------------------------

                        SetaeCore.showToast('プロフィールを更新しました', 'success');
                        $('#setae-profile-modal').fadeOut(200);
                    } else {
                        SetaeCore.showToast('更新に失敗しました: ' + (response.data || 'Unknown error'), 'error');
                    }
                },
                error: function () {
                    SetaeCore.showToast('通信エラーが発生しました', 'error');
                }
            });
        });

        // 5. ログアウト処理
        $(document).on('click', '#setae-logout-btn', function (e) {
            if (confirm('ログアウトしますか？')) {
                window.location.href = SetaeSettings.logout_url;
            }
        });
    }

    return { init: init };
})(jQuery);

// ドキュメントロード時に初期化
jQuery(document).ready(function () {
    SetaeUIProfile.init();
});
