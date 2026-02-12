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

// --- Encyclopedia Edit Suggestion Modal ---
$('#btn-open-edit-modal').on('click', function (e) {
    e.preventDefault();
    var speciesId = $(this).data('id');

    if (!speciesId && typeof currentSpeciesId !== 'undefined') {
        speciesId = currentSpeciesId;
    }

    if (!speciesId) {
        alert('種IDが取得できませんでした。');
        return;
    }

    $('#edit-req-species-id').val(speciesId);
    $('#setae-species-edit-modal').fadeIn(200).css('display', 'flex');
});

$('#close-species-edit-modal').on('click', function () {
    $('#setae-species-edit-modal').fadeOut(200);
});

$('#setae-species-edit-form').on('submit', function (e) {
    e.preventDefault();
    var $btn = $(this).find('button[type="submit"]');
    var originalText = $btn.text();
    $btn.text('送信中...').prop('disabled', true);

    var formData = new FormData(this);
    var ajaxUrl = (typeof setae_vars !== 'undefined' && setae_vars.ajax_url) ? setae_vars.ajax_url : '/wp-admin/admin-ajax.php';

    $.ajax({
        url: ajaxUrl,
        type: 'POST',
        data: formData,
        processData: false,
        contentType: false,
        success: function (response) {
            if (response.success) {
                alert('提案を送信しました。管理者の確認後に反映されます。');
                $('#setae-species-edit-modal').fadeOut(200);
                $('#setae-species-edit-form')[0].reset();
            } else {
                alert('エラー: ' + (response.data || '送信できませんでした'));
            }
        },
        error: function () {
            alert('通信エラーが発生しました。');
        },
        complete: function () {
            $btn.text(originalText).prop('disabled', false);
        }
    });
});
