jQuery(document).ready(function ($) {
    'use strict';

    console.log('Setae App Initializing...');

    // Desktop UI Logic (Hover/Click Actions)
    if (typeof SetaeUIDesktop !== 'undefined') {
        SetaeUIDesktop.init();
    }

    // Note: SetaeUI (Renderer) auto-initializes on document.ready in app-ui-renderer.js
    // SetaeUIActions binds touch events automatically in app-ui-renderer.js

    // Registration Logic
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

    // ▼▼▼ 追加機能: 編集提案モーダル (ここに追加) ▼▼▼

    // 1. モーダルを開く
    $('#btn-open-edit-modal').on('click', function (e) {
        e.preventDefault();

        // ボタンにセットされた data-id を取得
        var speciesId = $(this).data('id');

        // フォールバック: グローバル変数などから取得 (必要に応じて)
        if (!speciesId && typeof currentSpeciesId !== 'undefined') {
            speciesId = currentSpeciesId;
        }

        if (!speciesId) {
            console.warn('Species ID not found on button. Please ensure data-id is set when opening the detail view.');
            // IDがない場合でも、とりあえずモーダルは開くがIDは空になる（ユーザーに入力させる等の運用カバーも可）
        }

        $('#edit-req-species-id').val(speciesId);
        $('#setae-species-edit-modal').fadeIn(200).css('display', 'flex');
    });

    // 2. モーダルを閉じる
    $('#close-species-edit-modal').on('click', function () {
        $('#setae-species-edit-modal').fadeOut(200);
    });

    // 3. フォーム送信処理
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

    // ▲▲▲ 追加機能終了 ▲▲▲

}); // ← この閉じカッコの中に全てのコードが入っている必要があります
