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

    // ▼▼▼ 修正提案モーダル関連ロジック ▼▼▼

    // 1. モーダルを開く & 学名セット
    $('#btn-open-edit-modal').on('click', function (e) {
        e.preventDefault();

        var speciesId = $(this).data('id');
        // 学名 (タイトル) を取得 (詳細画面のIDに依存)
        var speciesName = $('#enc-detail-title').text() || 'Unknown Species';

        if (!speciesId && typeof currentSpeciesId !== 'undefined') {
            speciesId = currentSpeciesId;
        }

        if (!speciesId) {
            console.warn('No Species ID');
            return;
        }

        // フォームへのセット
        $('#edit-req-species-id').val(speciesId);
        $('#edit-req-species-name').val(speciesName); // 送信用
        $('#edit-req-species-name-display').text(speciesName); // 表示用

        $('#setae-species-edit-modal').fadeIn(200).css('display', 'flex');
    });

    // 2. 閉じる
    $('#close-species-edit-modal').on('click', function () {
        $('#setae-species-edit-modal').fadeOut(200);
    });

    // 3. 画像プレビュー機能
    $('#suggested-image-input').on('change', function (event) {
        const file = event.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = function (e) {
                $('#edit-image-preview').attr('src', e.target.result).show();
                $('#edit-image-placeholder').hide();
            }
            reader.readAsDataURL(file);
        }
    });

    // 4. 性格選択ダイアログの制御
    const $tempTrigger = $('#temperament-selector-trigger');
    const $tempDialog = $('#setae-temperament-dialog');
    const $tempInput = $('#suggested-temperament-input'); // hidden

    // ダイアログを開く
    $tempTrigger.on('click', function () {
        // 現在の選択状態を反映 (inputの値からチェックボックスへ)
        const currentVals = $tempInput.val().split(',');
        $('.js-temp-checkbox').prop('checked', false);
        currentVals.forEach(slug => {
            if (slug) $(`.js-temp-checkbox[value="${slug}"]`).prop('checked', true);
        });
        $tempDialog.css('display', 'flex').fadeIn(100);
    });

    // 決定ボタン
    $('#btn-confirm-temperament').on('click', function () {
        const selected = [];
        const labels = [];

        $('.js-temp-checkbox:checked').each(function () {
            selected.push($(this).val());
            labels.push($(this).data('label'));
        });

        // 隠しフィールドにセット
        $tempInput.val(selected.join(','));

        // 表示エリアを更新
        if (labels.length > 0) {
            const html = labels.map(lbl => `<span class="temp-chip">${lbl}</span>`).join('');
            $tempTrigger.html(html);
        } else {
            $tempTrigger.html('<span style="color:#999;">タップして選択してください...</span>');
        }

        $tempDialog.fadeOut(100);
    });

    // ダイアログ外クリックで閉じる (簡易実装)
    $tempDialog.on('click', function (e) {
        if (e.target === this) $(this).fadeOut(100);
    });

    // 5. 送信処理 (Ajax)
    $('#setae-species-edit-form').on('submit', function (e) {
        e.preventDefault();
        var $btn = $(this).find('button[type="submit"]');
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
                    alert('提案を送信しました。ありがとうございます！');
                    $('#setae-species-edit-modal').fadeOut(200);
                    $('#setae-species-edit-form')[0].reset();
                    // プレビューなどをリセット
                    $('#edit-image-preview').hide();
                    $('#edit-image-placeholder').show();
                    $('#temperament-selector-trigger').html('<span style="color:#999;">タップして選択してください...</span>');
                } else {
                    alert('エラー: ' + (response.data || 'Error'));
                }
            },
            error: function () {
                alert('通信エラーが発生しました。');
            },
            complete: function () {
                $btn.text('提案を送信する').prop('disabled', false);
            }
        });
    });

    // ▲▲▲ 追加機能終了 ▲▲▲

}); // ← この閉じカッコの中に全てのコードが入っている必要があります
