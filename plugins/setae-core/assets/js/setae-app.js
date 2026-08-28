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
            if (typeof SetaeCore !== 'undefined' && typeof SetaeCore.track === 'function') {
                SetaeCore.track('email_verified');
            }
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

    if ($('#setae-public-home').length && typeof SetaeCore !== 'undefined' && typeof SetaeCore.track === 'function') {
        SetaeCore.track('public_home_view');
    }

    // Retain incoming referral attribution for existing app navigation only.
    // Public registration is owned by public-registration.js.
    try {
        const code = String(urlParams.get('ref') || urlParams.get('referral_code') || '').trim().slice(0, 64);
        const source = String(urlParams.get('src') || urlParams.get('ref_src') || urlParams.get('utm_source') || '')
            .trim().toLowerCase().replace(/[^a-z0-9_.-]/g, '_').slice(0, 48);
        if (code) localStorage.setItem('setae_referral_code', code);
        if (source) localStorage.setItem('setae_referral_source', source);
    } catch (error) { /* Referral storage is optional. */ }

    function publicRegistrationUrl() {
        const existingLink = document.querySelector('a#setae-btn-register-start[href]');
        if (existingLink) return existingLink.href;
        const configured = window.SetaeSettings && window.SetaeSettings.registration_url;
        const url = new URL(configured || '?setae_auth=register', window.location.href);
        url.searchParams.delete('register');
        url.searchParams.set('setae_auth', 'register');
        return url.href;
    }

    // Public preview navigation and safe demo interactions.
    $('.setae-public-nav-item[data-public-scroll]').on('click', function () {
        const targetSelector = $(this).data('public-scroll');
        const $target = $(targetSelector);
        if (!$target.length) return;

        $('.setae-public-nav-item').removeClass('active');
        $(this).addClass('active');

        $('html, body').animate({
            scrollTop: Math.max(0, $target.offset().top - 18)
        }, 320);
    });

    $('[data-public-preview-open]').on('click', function () {
        if ($(this).data('was-swiped')) {
            $(this).data('was-swiped', false);
            return;
        }

        if (!$('#setae-public-preview-modal').length) {
            $('body').append(`
                <div id="setae-public-preview-modal" class="setae-modal" style="display:none;">
                    <div class="setae-modal-content setae-public-preview-modal">
                        <button type="button" class="setae-close" id="close-public-preview-modal">&times;</button>
                        <div class="setae-public-preview-modal-hero">🕷️</div>
                        <h3>ベニヒザ 1号</h3>
                        <p>Brachypelma hamorii</p>
                        <div class="setae-public-preview-status">
                            <div><span>給餌</span><strong>14日前</strong></div>
                            <div><span>脱皮</span><strong>32日前</strong></div>
                            <div><span>状態</span><strong>通常</strong></div>
                        </div>
                        <a class="setae-btn setae-btn-primary" data-public-preview-register>
                            自分の個体を登録する
                        </a>
                    </div>
                </div>
            `);
        }

        $('[data-public-preview-register]').attr('href', publicRegistrationUrl());
        $('#setae-public-preview-modal').fadeIn(180).css('display', 'flex');
    });

    $(document).on('click', '#close-public-preview-modal', function () {
        $('#setae-public-preview-modal').fadeOut(160);
    });

    let publicSwipe = null;
    function setupPublicSwipeBg($row) {
        const $left = $row.find('.swipe-left');
        const $right = $row.find('.swipe-right');
        $left.css('background-color', '#2ecc71').html('<span class="swipe-icon" style="font-size:24px; line-height:1;">🦗</span>');
        $right.css('background-color', '#f1c40f').html('<span class="swipe-icon" style="font-size:24px; line-height:1;">✋</span>');
    }

    $('.setae-public-demo-row').on('pointerdown', function (e) {
        setupPublicSwipeBg($(this));
        publicSwipe = {
            row: this,
            startX: e.originalEvent.clientX,
            startY: e.originalEvent.clientY,
            moved: false
        };
    });

    $(document).on('pointermove', function (e) {
        if (!publicSwipe) return;

        const endX = (typeof e.originalEvent.clientX === 'number') ? e.originalEvent.clientX : publicSwipe.startX;
        const diffX = endX - publicSwipe.startX;
        const diffY = e.originalEvent.clientY - publicSwipe.startY;
        if (Math.abs(diffY) > Math.abs(diffX) && Math.abs(diffY) > 12) return;
        if (Math.abs(diffX) < 8) return;

        publicSwipe.moved = true;
        const $row = $(publicSwipe.row);
        const $content = $row.find('.setae-list-content');
        const $left = $row.find('.swipe-left');
        const $right = $row.find('.swipe-right');
        const moveX = Math.max(-90, Math.min(90, diffX * 0.6));

        $content.css('transform', `translateX(${moveX}px)`);

        if (diffX > 0) {
            $left.addClass('is-visible').css('width', `${64 + Math.max(0, diffX - 60) * 0.35}px`);
            $right.removeClass('is-visible');
        } else {
            $right.addClass('is-visible').css('width', `${64 + Math.max(0, Math.abs(diffX) - 60) * 0.35}px`);
            $left.removeClass('is-visible');
        }
    });

    $(document).on('pointerup pointercancel', function (e) {
        if (!publicSwipe) return;

        const endX = (typeof e.originalEvent.clientX === 'number') ? e.originalEvent.clientX : publicSwipe.startX;
        const diffX = endX - publicSwipe.startX;
        const $row = $(publicSwipe.row);
        const $content = $row.find('.setae-list-content');
        const $left = $row.find('.swipe-left');
        const $right = $row.find('.swipe-right');

        if (publicSwipe.moved) {
            $row.data('was-swiped', true);
            setTimeout(function () {
                $row.data('was-swiped', false);
            }, 600);
        }

        if (diffX > 80) {
            $left.addClass('swipe-triggered');
            $row.find('[data-demo-feed]').text('今日').removeClass('alert-text');
        } else if (diffX < -80) {
            $right.addClass('swipe-triggered');
            $row.find('[data-demo-feed]').text('拒食').addClass('alert-text');
        }

        $content.css({
            transition: 'transform 0.28s cubic-bezier(0.25, 1, 0.5, 1)',
            transform: 'translateX(0)'
        });

        setTimeout(function () {
            $content.css('transition', '');
            $left.removeClass('is-visible swipe-triggered').css('width', '64px');
            $right.removeClass('is-visible swipe-triggered').css('width', '64px');
        }, 320);

        publicSwipe = null;
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
            $('#temperament-selector-trigger').html('<span class="temperament-placeholder">タップして選択してください...</span>');
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
            $tempTrigger.html('<span class="temperament-placeholder">タップして選択してください...</span>');
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
                    SetaeCore.showToast('提案を送信しました。ありがとうございます。', 'success');
                    $('#setae-species-edit-modal').fadeOut(200);
                    $('#setae-species-edit-form')[0].reset();
                    // プレビューなどをリセット
                    $('#edit-image-preview').hide();
                    $('#edit-image-placeholder').show();
                    $('#temperament-selector-trigger').html('<span class="temperament-placeholder">タップして選択してください...</span>');
                } else {
                    SetaeCore.showToast('送信できませんでした: ' + (response.data || '内容を確認してください。'), 'error');
                }
            },
            error: function () {
                SetaeCore.showToast('通信状態を確認して、もう一度お試しください。', 'error');
            },
            complete: function () {
                $btn.text('提案を送信する').prop('disabled', false);
            }
        });
    });

    // ▲▲▲ 追加機能終了 ▲▲▲

    // ▼▼▼ 追加機能: PWA向け Pull-to-Refresh ▼▼▼
    (function () {
        const ptrContainer = document.createElement('div');
        ptrContainer.id = 'setae-ptr-container';
        ptrContainer.innerHTML = `
            <div id="setae-ptr-spinner" role="status" aria-label="更新中">
                <span id="setae-ptr-icon" aria-hidden="true"></span>
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
        let touchStartX = 0;
        let touchStartY = 0;
        let pullDistance = 0;
        const PULL_THRESHOLD = 70; // 基準点が下がっているため、引き量は標準的でOK
        const MAX_PULL = 120;
        let isAtTop = false;
        let isRefreshing = false;
        let isPullGesture = false;
        let ignorePullGesture = false;

        function resetPullGesture() {
            touchStartX = 0;
            touchStartY = 0;
            pullDistance = 0;
            isAtTop = false;
            isPullGesture = false;
            ignorePullGesture = false;
        }

        // タッチ開始時
        window.addEventListener('touchstart', function (e) {
            if (isRefreshing) return;
            if (window.scrollY <= 1) {
                isAtTop = true;
                touchStartX = e.touches[0].clientX;
                touchStartY = e.touches[0].clientY;
                pullDistance = 0;
                isPullGesture = false;
                ignorePullGesture = false;
                ptrContainer.style.transition = 'none';
            } else {
                isAtTop = false;
            }
        }, { passive: true });

        // タッチ移動時
        window.addEventListener('touchmove', function (e) {
            if (!isAtTop || isRefreshing || ignorePullGesture) return;

            const diffX = e.touches[0].clientX - touchStartX;
            const diffY = e.touches[0].clientY - touchStartY;

            if (!isPullGesture) {
                if (Math.max(Math.abs(diffX), Math.abs(diffY)) < 9) return;
                if (diffY <= 0 || Math.abs(diffY) <= Math.abs(diffX) * 1.2) {
                    ignorePullGesture = true;
                    return;
                }
                isPullGesture = true;
            }

            pullDistance = diffY;

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

                spinner.classList.toggle('is-ready', resistance >= PULL_THRESHOLD);

                if (e.cancelable) e.preventDefault();
            }
        }, { passive: false });

        // タッチ終了時
        window.addEventListener('touchend', function () {
            if (!isAtTop || isRefreshing) return;
            if (!isPullGesture || ignorePullGesture) {
                resetPullGesture();
                return;
            }

            ptrContainer.style.transition = 'transform 0.4s cubic-bezier(0.25, 0.8, 0.25, 1), opacity 0.3s ease';

            let resistance = pullDistance * 0.45;

            if (resistance >= PULL_THRESHOLD) {
                isRefreshing = true;

                // 4. 更新中はノッチ下の定位置(translateY: 0px)で固定
                ptrContainer.style.transform = `translate(-50%, 0px) scale(1)`;
                ptrContainer.style.opacity = '1';
                spinner.classList.remove('is-ready');
                spinner.classList.add('is-refreshing');
                icon.style.transform = '';

                setTimeout(() => {
                    window.location.reload(true);
                }, 500);

            } else {
                // キャンセル時は元の隠れ位置へ戻す
                ptrContainer.style.transform = 'translate(-50%, -80px) scale(0.8)';
                ptrContainer.style.opacity = '0';
                spinner.classList.remove('is-ready', 'is-refreshing');
                icon.style.transform = '';
            }

            resetPullGesture();
        });
    })();
    // ▲▲▲ 追加機能終了 ▲▲▲

    // Legacy home/trial links retain a real navigation path to the existing app auth route.
    if (urlParams.get('register') === '1' && !document.querySelector('[data-public-registration]')) {
        const destination = new URL(publicRegistrationUrl(), window.location.href);
        destination.searchParams.delete('register');
        destination.searchParams.set('setae_auth', 'register');
        if (urlParams.get('from') === 'trial') destination.searchParams.set('from', 'trial');
        if (destination.href !== window.location.href) window.location.replace(destination.href);
    }

}); // ← この閉じカッコの中に全てのコードが入っている必要があります
