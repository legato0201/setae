jQuery(document).ready(function ($) {
    'use strict';

    console.log('Setae App Initializing...');

    // Desktop UI Logic (Hover/Click Actions)
    if (typeof SetaeUIDesktop !== 'undefined') {
        SetaeUIDesktop.init();
    }

    // ▼▼▼ 追加: チュートリアル初期化 ▼▼▼
    if (typeof SetaeTutorial !== 'undefined') {
        SetaeTutorial.init();
    }
    // ▲▲▲ 追加終了 ▲▲▲

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

    // 1. モーダルを開く & 学名セット & 既存データの流し込み
    $('#btn-open-edit-modal').on('click', function (e) {
        e.preventDefault();

        var speciesId = $(this).data('id');
        var speciesName = $('#enc-detail-title').text() || 'Unknown Species';

        if (!speciesId && typeof currentSpeciesId !== 'undefined') {
            speciesId = currentSpeciesId;
        }

        if (!speciesId) {
            console.warn('No Species ID');
            return;
        }

        // 基本情報のセット
        $('#edit-req-species-id').val(speciesId);
        $('#edit-req-species-name').val(speciesName);
        $('#edit-req-species-name-display').text(speciesName);

        // ▼▼▼ 追加: 既存データの取得と挿入 ▼▼▼

        // 和名
        var currentCommonName = $('#enc-detail-common-name').text();
        if (currentCommonName) $('input[name="suggested_common_name_ja"]').val(currentCommonName);

        // --- 修正箇所: ライフスタイルの判定ロジック ---
        var lifestyleVal = '';
        // 詳細画面の表示テキストを取得 (例: "樹上性", "Arboreal" など)
        var lsText = $('#enc-detail-lifestyle').text().trim();

        // 日本語または英語が含まれているか判定して値を決定
        if (lsText.indexOf('地表') > -1 || lsText.toLowerCase().indexOf('terrestrial') > -1) {
            lifestyleVal = '地表性';
        } else if (lsText.indexOf('樹上') > -1 || lsText.toLowerCase().indexOf('arboreal') > -1) {
            lifestyleVal = '樹上性';
        } else if (lsText.indexOf('地中') > -1 || lsText.toLowerCase().indexOf('fossorial') > -1) {
            lifestyleVal = '地中性';
        }

        // セレクトボックスに値をセット
        if (lifestyleVal) {
            $('select[name="suggested_lifestyle"]').val(lifestyleVal);
        }

        // 温度 (Temp)
        var currentTemp = $('#enc-detail-temp').text();
        if (currentTemp && currentTemp !== '-') $('input[name="suggested_temperature"]').val(currentTemp);

        // 湿度 (Humidity)
        var currentHumid = $('#enc-detail-humidity').text();
        if (currentHumid && currentHumid !== '-') $('input[name="suggested_humidity"]').val(currentHumid);

        // 寿命 (Lifespan)
        var currentLifespan = $('#enc-detail-lifespan').text();
        if (currentLifespan && currentLifespan !== '-') $('input[name="suggested_lifespan"]').val(currentLifespan);

        // サイズ (Legspan)
        var currentSize = $('#enc-detail-size').text();
        if (currentSize && currentSize !== '-') $('input[name="suggested_size"]').val(currentSize);

        // 説明文
        var currentDesc = $('#enc-detail-description').text();
        if (currentDesc && !currentDesc.includes('No description')) {
            $('textarea[name="suggested_description"]').val(currentDesc.trim());
        } else {
            $('textarea[name="suggested_description"]').val('');
        }

        // 性格 (Temperament)
        var tempIds = [];
        var tempLabels = [];
        $('#enc-detail-temperament-list .setae-chip').each(function () {
            var id = $(this).data('id');
            var label = $(this).text();
            if (id) {
                tempIds.push(id);
                tempLabels.push(label);
            }
        });

        // 性格入力欄へセット
        if (tempIds.length > 0) {
            $('#suggested-temperament-input').val(tempIds.join(','));
            // トリガー表示の更新
            var html = tempLabels.map(lbl => `<span class="temp-chip">${lbl}</span>`).join('');
            $('#temperament-selector-trigger').html(html);
        } else {
            // リセット
            $('#suggested-temperament-input').val('');
            $('#temperament-selector-trigger').html('<span style="color:#999;">タップして選択してください...</span>');
        }

        // ▲▲▲ 追加終了 ▲▲▲

        // ▲▲▲ 追加終了 ▲▲▲

        $('#setae-species-edit-modal').fadeIn(200).css('display', 'flex');

        // ▼▼▼ ここに追加: モーダルが開いた後にチュートリアルを起動 ▼▼▼
        if (typeof SetaeTutorial !== 'undefined' && typeof SetaeTutorial.initEditSuggestion === 'function') {
            SetaeTutorial.initEditSuggestion();
        }
        // ▲▲▲ 追加終了 ▲▲▲
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
