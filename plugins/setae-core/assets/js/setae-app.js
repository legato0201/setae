jQuery(document).ready(function ($) {
    'use strict';

    console.log('Setae App Initializing...');

    // Modules are now self-initializing via app-ui-renderer.js (Controller)
    // and actions.js handles swipe/click logic.

    if (typeof SetaeUIDesktop !== 'undefined') {
        SetaeUIDesktop.init();
    }

    // Registration Logic
    // 1. モーダルを開く
    $('#setae-btn-register-start').on('click', function (e) {
        e.preventDefault();
        $('#setae-register-modal').fadeIn(200).css('display', 'flex');
    });

    // 2. モーダルを閉じる
    $('#close-register-modal').on('click', function () {
        $('#setae-register-modal').fadeOut(200);
    });

    // 3. 登録フォーム送信処理
    $('#setae-register-form').on('submit', function (e) {
        e.preventDefault();

        var $btn = $(this).find('button[type="submit"]');
        var originalText = $btn.text();
        $btn.text('処理中...').prop('disabled', true);

        var data = {
            action: 'setae_register_user', // PHP側の関数と紐づくアクション名
            username: $('#reg-username').val(),
            email: $('#reg-email').val(),
            password: $('#reg-password').val(),
            // セキュリティ用のNonceがあればここに追加（推奨）
            // nonce: setae_vars.nonce 
        };

        // Fallback for ajax_url if not defined (though it should be)
        var ajaxUrl = (typeof setae_vars !== 'undefined' && setae_vars.ajax_url) ? setae_vars.ajax_url : '/wp-admin/admin-ajax.php';

        $.ajax({
            url: ajaxUrl,
            type: 'POST',
            data: data,
            success: function (response) {
                if (response.success) {
                    alert('登録が完了しました。ログインしてください。');
                    location.reload(); // 画面をリロードしてログインフォームへ
                } else {
                    alert('エラー: ' + (response.data || 'Unknown error'));
                    $btn.text(originalText).prop('disabled', false);
                }
            },
            error: function () {
                alert('通信エラーが発生しました。');
                $btn.text(originalText).prop('disabled', false);
            }
        });
    });

});
