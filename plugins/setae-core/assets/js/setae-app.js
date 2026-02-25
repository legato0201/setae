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

    // ▼▼▼ 追加: メール認証完了後のトースト表示 ▼▼▼
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('verified') === '1') {
        // 少し遅延させてから表示（UIが描画された後）
        setTimeout(function () {
            if (typeof SetaeCore !== 'undefined' && typeof SetaeCore.showToast === 'function') {
                SetaeCore.showToast('メール認証が完了しました。ログインしてください。', 'success');
            } else {
                alert('メール認証が完了しました。ログインしてください。');
            }
            // URLパラメータをクリーニング
            window.history.replaceState({}, document.title, window.location.pathname);

            // ログインモーダルを開く処理があればここに記述
            if ($('#setae-login-modal').length) {
                $('#setae-login-modal').fadeIn(200).css('display', 'flex');
            }
        }, 500);
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
            // ▼ 追加: 紹介コードを送信データに含める
            referral_code: $('#reg-referral-code').val()
        };

        var ajaxUrl = (typeof setae_vars !== 'undefined' && setae_vars.ajax_url) ? setae_vars.ajax_url : '/wp-admin/admin-ajax.php';

        $.ajax({
            url: ajaxUrl,
            type: 'POST',
            data: data,
            success: function (response) {
                if (response.success) {
                    // アラートとリロードを削除し、トースト通知に変更
                    const successMsg = '仮登録が完了しました。入力されたメールアドレスに認証リンクを送信しましたので、ご確認ください。';

                    if (typeof SetaeCore !== 'undefined' && typeof SetaeCore.showToast === 'function') {
                        SetaeCore.showToast(successMsg, 'success');
                    } else {
                        alert(successMsg);
                    }

                    // モーダルを閉じてボタンを復元
                    $('#setae-register-modal').fadeOut(200);
                    $btn.text(originalText).prop('disabled', false);

                    // フォームをリセット
                    $('#setae-register-form')[0].reset();

                    // ※仮登録状態のため location.reload() は行わず、そのまま待機させる
                } else {
                    if (typeof SetaeCore !== 'undefined' && typeof SetaeCore.showToast === 'function') {
                        SetaeCore.showToast('エラー: ' + (response.data || 'Unknown error'), 'error');
                    } else {
                        alert('エラー: ' + (response.data || 'Unknown error'));
                    }
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
                $('#image-preview-container').show();
            }
            reader.readAsDataURL(file);
        }
    });

    // 4. 画像プレビュー削除
    $('#btn-remove-suggested-image').on('click', function () {
        $('#suggested-image-input').val('');
        $('#edit-image-preview').attr('src', '');

        // 【修正・追加】コンテナを隠し、プレースホルダーを再表示する
        $('#image-preview-container').hide();
        $('#edit-image-placeholder').show();
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

    // ▼▼▼ 追加機能: PWA向け Pull-to-Refresh (プロ仕様UI版) ▼▼▼
    (function () {
        // 1. プロ仕様のモダングラスモーフィズム・デザイン
        const ptrContainer = document.createElement('div');
        ptrContainer.id = 'setae-ptr-container';
        ptrContainer.innerHTML = `
            <div id="setae-ptr-spinner" style="
                width: 42px; height: 42px;
                background: rgba(35, 35, 35, 0.85); /* サイトに馴染むダーク透過 */
                backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px); /* グラス効果 */
                border: 1px solid rgba(255, 255, 255, 0.15); /* 繊細なエッジ */
                border-radius: 50%;
                box-shadow: 0 4px 16px rgba(0,0,0,0.3);
                display: flex; align-items: center; justify-content: center;
                color: #aaa; transition: color 0.3s, border-color 0.3s;
            ">
                <svg id="setae-ptr-icon" viewBox="0 0 24 24" width="22" height="22" stroke="currentColor" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round" style="transition: transform 0.1s;">
                    <path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8"></path>
                    <path d="M21 3v5h-5"></path>
                </svg>
            </div>
        `;

        // 2. ノッチ対策: 基準(top)をセーフエリア+16pxに設定し、そこから上に隠す（-80px）
        Object.assign(ptrContainer.style, {
            position: 'fixed',
            top: 'calc(16px + env(safe-area-inset-top))', // ノッチを確実に回避する絶対基準点
            left: '50%',
            transform: 'translate(-50%, -80px) scale(0.8)', // 初期状態（上に隠しつつ縮小）
            opacity: '0', // 初期は透明
            zIndex: '9999',
            pointerEvents: 'none',
            transition: 'transform 0.3s cubic-bezier(0.25, 0.8, 0.25, 1), opacity 0.3s ease'
        });
        document.body.prepend(ptrContainer);

        const spinner = document.getElementById('setae-ptr-spinner');
        const icon = document.getElementById('setae-ptr-icon');
        let touchStartY = 0;
        let pullDistance = 0;
        const PULL_THRESHOLD = 70; // 基準点が下がっているため、引き量は標準的でOK
        const MAX_PULL = 120;
        let isAtTop = false;
        let isRefreshing = false;

        // タッチ開始時
        window.addEventListener('touchstart', function (e) {
            if (isRefreshing) return;
            if (window.scrollY <= 1) {
                isAtTop = true;
                touchStartY = e.touches[0].clientY;
                ptrContainer.style.transition = 'none';
            } else {
                isAtTop = false;
            }
        }, { passive: true });

        // タッチ移動時
        window.addEventListener('touchmove', function (e) {
            if (!isAtTop || isRefreshing) return;

            pullDistance = e.touches[0].clientY - touchStartY;

            if (pullDistance > 0) {
                let resistance = pullDistance * 0.45;
                if (resistance > MAX_PULL) resistance = MAX_PULL;

                // 3. ネイティブライクな動き: 下がるにつれてフェードイン＆拡大
                let translateY = -80 + resistance;
                let opacity = Math.min(1, resistance / 50);
                let scale = 0.8 + Math.min(0.2, resistance / 100);

                ptrContainer.style.transform = `translate(-50%, ${translateY}px) scale(${scale})`;
                ptrContainer.style.opacity = opacity;

                // 枠全体ではなく、中のアイコンだけを回転させて上品に
                icon.style.transform = `rotate(${resistance * 4}deg)`;

                // 閾値を超えたら洗練されたブルーのアクセントカラーに
                if (resistance >= PULL_THRESHOLD) {
                    spinner.style.color = '#4ea8de';
                    spinner.style.borderColor = 'rgba(78, 168, 222, 0.5)';
                } else {
                    spinner.style.color = '#aaa';
                    spinner.style.borderColor = 'rgba(255, 255, 255, 0.15)';
                }

                if (e.cancelable) e.preventDefault();
            }
        }, { passive: false });

        // タッチ終了時
        window.addEventListener('touchend', function () {
            if (!isAtTop || isRefreshing) return;

            ptrContainer.style.transition = 'transform 0.4s cubic-bezier(0.25, 0.8, 0.25, 1), opacity 0.3s ease';

            let resistance = pullDistance * 0.45;

            if (resistance >= PULL_THRESHOLD) {
                isRefreshing = true;

                // 4. 更新中はノッチ下の定位置(translateY: 0px)で固定
                ptrContainer.style.transform = `translate(-50%, 0px) scale(1)`;
                ptrContainer.style.opacity = '1';

                icon.style.transition = 'transform 1s linear';
                let currentRotation = resistance * 4;
                icon.style.transform = `rotate(${currentRotation + 1080}deg)`;

                setTimeout(() => {
                    window.location.reload(true);
                }, 500);

            } else {
                // キャンセル時は元の隠れ位置へ戻す
                ptrContainer.style.transform = 'translate(-50%, -80px) scale(0.8)';
                ptrContainer.style.opacity = '0';
                spinner.style.color = '#aaa';
                spinner.style.borderColor = 'rgba(255, 255, 255, 0.15)';
            }

            touchStartY = 0;
            pullDistance = 0;
            isAtTop = false;
        });
    })();
    // ▲▲▲ 追加機能終了 ▲▲▲

}); // ← この閉じカッコの中に全てのコードが入っている必要があります
