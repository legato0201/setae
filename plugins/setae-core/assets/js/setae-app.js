jQuery(document).ready(function ($) {
    'use strict';

    console.log('Setae App Initializing...');

    // Desktop UI Logic (Hover/Click Actions)
    if (typeof SetaeUIDesktop !== 'undefined') {
        SetaeUIDesktop.init();
    }

    // Note: SetaeUI (Renderer) auto-initializes on document.ready in app-ui-renderer.js
    // SetaeUIActions binds touch events automatically in app-ui-renderer.js

    // Registration Logic (Keep existing)
    $('#setae-btn-register-start').on('click', function (e) {
        e.preventDefault();
        $('#setae-register-modal').fadeIn(200).css('display', 'flex');
    });

    $('#close-register-modal').on('click', function () {
        $('#setae-register-modal').fadeOut(200);
    });

    $('#setae-register-form').on('submit', function (e) {
        e.preventDefault();

        var $btn = $(this).find('button[type="submit"]');
        var originalText = $btn.text();
        $btn.text('処理中...').prop('disabled', true);

        var data = {
            action: 'setae_register_user',
            username: $('#reg-username').val(),
            email: $('#reg-email').val(),
            password: $('#reg-password').val(),
        };

        var ajaxUrl = (typeof setae_vars !== 'undefined' && setae_vars.ajax_url) ? setae_vars.ajax_url : '/wp-admin/admin-ajax.php';

        $.ajax({
            url: ajaxUrl,
            type: 'POST',
            data: data,
            success: function (response) {
                if (response.success) {
                    alert('登録が完了しました。ログインしてください。');
                    location.reload();
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
