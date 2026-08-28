var SetaeUIProfile = (function ($) {
    'use strict';

    // ▼ 追加: 翻訳用の関数を定義 (PHPで定義した SetaeBL_i18n を参照します)
    const fallbackI18n = {
        'Profile Settings': 'プロフィール設定',
        'Display Name': '表示名',
        'Email Address': 'メールアドレス',
        'New Password': '新しいパスワード',
        '(Leave empty to keep current)': '（変更しない場合は空欄）',
        'Premium Plan': 'プレミアムプラン',
        'You are a Premium Member': 'プレミアム会員です',
        'Upgrade to Premium': 'プレミアムにアップグレード',
        'Logout': 'ログアウト',
        'Cancel': 'キャンセル',
        'Save Changes': '変更を保存'
    };
    const __ = function (text) {
        if (typeof SetaeBL_i18n !== 'undefined' && SetaeBL_i18n[text]) {
            return SetaeBL_i18n[text];
        }
        return fallbackI18n[text] || text;
    };
    let externalAccessClosing = false;
    let externalAccessBusy = false;
    const GPT_LIVE_SETTINGS_VISIBLE = false;

    function escapeHtml(value) {
        return String(value || '').replace(/[&<>"']/g, function (char) {
            return {
                '&': '&amp;',
                '<': '&lt;',
                '>': '&gt;',
                '"': '&quot;',
                "'": '&#039;'
            }[char];
        });
    }

    function copyProfileText(value) {
        if (typeof SetaeCore !== 'undefined' && typeof SetaeCore.copyText === 'function') {
            return SetaeCore.copyText(value);
        }
        if (navigator.clipboard && window.isSecureContext) {
            return navigator.clipboard.writeText(String(value || ''));
        }
        return Promise.reject(new Error('copy_unavailable'));
    }

    function showProfileCopyFallback(title, value) {
        if (typeof SetaeCore !== 'undefined' && typeof SetaeCore.requestText === 'function') {
            return SetaeCore.requestText({
                title: title,
                message: '自動でコピーできませんでした。下の内容を選択してコピーしてください。',
                inputLabel: title,
                value: value,
                maxLength: Math.max(500, String(value || '').length + 20),
                confirmLabel: '閉じる'
            });
        }
        window.prompt(title, value);
        return Promise.resolve(null);
    }

    function buildReferralUrl(baseUrl, source) {
        if (!baseUrl) return '';

        try {
            const url = new URL(baseUrl, window.location.origin);
            if (source) {
                url.searchParams.set('src', source);
            }
            return url.toString();
        } catch (e) {
            const separator = baseUrl.indexOf('?') === -1 ? '?' : '&';
            return baseUrl + separator + 'src=' + encodeURIComponent(source || 'profile_qr');
        }
    }

    function renderReferralStats(stats) {
        stats = stats || {};
        const total = parseInt(stats.total, 10) || 0;
        const sources = Array.isArray(stats.sources) ? stats.sources : [];

        if (!total) {
            return `
                <div class="profile-referral-stats is-empty">
                    <strong>紹介登録 0件</strong>
                    <span>QRや公開プロフィールからの登録がここに表示されます。</span>
                </div>
            `;
        }

        return `
            <div class="profile-referral-stats">
                <strong>紹介登録 ${escapeHtml(total)}件</strong>
                <div>
                    ${sources.map(item => `
                        <span>${escapeHtml(item.label || item.source)} <b>${escapeHtml(item.count || 0)}</b></span>
                    `).join('')}
                </div>
            </div>
        `;
    }

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
        // バッジ説明モーダルを閉じる
        $(document).on('click', '#modal-badge-info-close, #btn-close-badge-info-bottom', function () {
            $('#modal-badge-info').hide();
        });

        // オーバーレイクリックで閉じる
        $(document).on('click', '#modal-badge-info', function (e) {
            if (e.target === this) {
                $(this).hide();
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
        const spiderLimit = currentUser.spider_limit || 8;
        const refCode = currentUser.referral_code || '未発行';
        const publicProfileUrl = currentUser.public_profile_url || '';
        const bonusLimit = currentUser.bonus_limit || 0;
        const themePreference = ['light', 'dark', 'system'].includes(currentUser.theme_preference)
            ? currentUser.theme_preference
            : 'system';
        const showCareFocus = !(currentUser.show_care_focus === false
            || currentUser.show_care_focus === 0
            || currentUser.show_care_focus === '0');

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
                                <img src="${avatarUrl}" alt="プロフィール画像">
                            </div>
                            <div id="profile-my-badge-container"></div>
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

                    <fieldset class="profile-preferences-panel">
                        <legend>表示設定</legend>
                        <div class="profile-preference-block">
                            <div class="profile-preference-copy">
                                <strong>カラーテーマ</strong>
                                <small>画面の明るさを選択します</small>
                            </div>
                            <div class="profile-theme-control" role="radiogroup" aria-label="カラーテーマ">
                                <label>
                                    <input type="radio" name="prof-theme-preference" value="light" ${themePreference === 'light' ? 'checked' : ''}>
                                    <span>ライト</span>
                                </label>
                                <label>
                                    <input type="radio" name="prof-theme-preference" value="dark" ${themePreference === 'dark' ? 'checked' : ''}>
                                    <span>ダーク</span>
                                </label>
                                <label>
                                    <input type="radio" name="prof-theme-preference" value="system" ${themePreference === 'system' ? 'checked' : ''}>
                                    <span>システム</span>
                                </label>
                            </div>
                        </div>
                        <div class="profile-preference-block profile-preference-toggle">
                            <div class="profile-preference-copy">
                                <strong>「今日の飼育」を表示</strong>
                                <small>個体詳細で、その日の確認ポイントを表示します</small>
                            </div>
                            <label class="setae-switch" aria-label="今日の飼育を表示">
                                <input type="checkbox" id="prof-show-care-focus" ${showCareFocus ? 'checked' : ''}>
                                <span class="setae-slider"></span>
                            </label>
                        </div>
                    </fieldset>

                    ${!currentUser.is_premium ? `
                    <div class="setae-form-group" style="background:#f5f7fa; padding:15px; border-radius:8px; border:1px dashed #ccc; margin-bottom: 20px;">
                        <label style="color:#333; font-weight:bold; display: flex; align-items: center; justify-content: space-between;">
                            <span><img draggable="false" role="img" class="emoji" alt="🎁" src="https://s.w.org/images/core/emoji/17.0.2/svg/1f381.svg" style="height: 1em; width: 1em; margin-right: 5px;"> ${__('あなたの紹介コード')}</span>
                            <button type="button" id="btn-show-badge-info" style="font-size: 12px; color: #2980b9; text-decoration: underline; background: none; border: none; padding: 0; cursor: pointer;">${__('サポーターバッジとは？')}</button>
                        </label>
                        <p style="font-size:12px; color:#666; margin-bottom:10px;">
                            ${__('このコードをSNS等でシェアして新規ユーザーが登録すると、お互いの生体登録枠が＋1されます。')}
                            <br>${__('現在の獲得ボーナス枠:')} <strong style="color:#d35400;">+${bonusLimit} 枠</strong>
                        </p>
                        <div style="display:flex; gap:8px; margin-bottom: 12px;">
                            <input type="text" id="prof-my-referral" class="setae-input" value="${refCode}" readonly style="background:#fff; font-family:monospace; font-weight:bold; color:#2980b9; flex: 1;">
                            <button type="button" class="setae-btn" id="btn-copy-referral" style="white-space:nowrap; background:#e0e6ed; color:#333;">${__('コピー')}</button>
                        </div>
                        ${publicProfileUrl ? `
                        <div class="profile-public-link-box">
                            <label>公開プロフィール</label>
                            <div>
                                <input type="text" id="prof-public-profile-url" class="setae-input" value="${publicProfileUrl}" readonly>
                                <button type="button" class="setae-btn" id="btn-copy-public-profile">${__('コピー')}</button>
                            </div>
                            <a href="${publicProfileUrl}" target="_blank" rel="noopener noreferrer">公開ページを表示</a>
                            <button type="button" class="profile-qr-open-btn" id="btn-open-profile-qr">QRカードを表示</button>
                            ${renderReferralStats(currentUser.referral_stats)}
                        </div>
                        ` : ''}
                        <button type="button" class="setae-btn" id="btn-share-x-referral" style="width: 100%; background:#000; border:none; color:#fff; font-size:13px; font-weight:bold; box-shadow:0 4px 10px rgba(0,0,0,0.2); padding: 10px; border-radius: 4px; display: flex; align-items: center; justify-content: center; gap: 8px;">
                            <span style="font-size: 16px;">𝕏</span> ${__('紹介コードをシェアして枠を獲得')}
                        </button>
                    </div>
                    ` : ''}

                    <div class="setae-form-group">
                        <label>${__('Premium Plan')}</label>
                        ${(function () {
                if (currentUser.is_premium) {
                    const cancelTimestamp = currentUser.cancel_timestamp || '';
                    const isCanceled = (cancelTimestamp !== '' && cancelTimestamp > 0);

                    let cancelDateText = '';
                    if (isCanceled) {
                        const dateObj = new Date(cancelTimestamp * 1000);
                        cancelDateText = `${dateObj.getFullYear()}/${dateObj.getMonth() + 1}/${dateObj.getDate()}`;
                    }

                    return `
                                <div class="premium-status" style="padding:15px;background:#fffbea;border:1px solid #fce8a6;border-radius:8px;text-align:center;">
                                    <div style="font-weight:bold;color:#b28900;margin-bottom:5px;">
                                        <span aria-hidden="true">🌟</span> ${__('You are a Premium Member')}
                                    </div>
                                    ${isCanceled
                            ? `<div style="font-size:12px; color:#e74c3c; margin-bottom:10px; font-weight:bold;">${__(`解約手続き済み（${cancelDateText} まで利用可）`)}</div>`
                            : `<div style="font-size:12px; color:#27ae60; margin-bottom:10px; font-weight:bold;">${__('自動更新有効')}</div>`
                        }
                                    <button type="button" id="btn-manage-subscription" class="setae-btn">
                                        ${__('プランの管理・解約手続き')}
                                    </button>
                                </div>`;
                } else {
                    return `<button type="button" class="setae-btn setae-btn-primary" id="upgrade-premium-btn" style="width:100%;height:44px;background:linear-gradient(135deg, #FFD700, #FDB931);color:#fff;border:none;border-radius:12px;font-size:15px;font-weight:600;box-shadow:0 4px 12px rgba(253, 185, 49, 0.3);">✨ ${__('Upgrade to Premium')}</button>`;
                }
            })()}
                    </div>

                    ${GPT_LIVE_SETTINGS_VISIBLE ? `
                        <div class="setae-form-group">
                            <button type="button" class="profile-external-access-entry" id="btn-open-external-access">
                                <span class="profile-external-access-mark" aria-hidden="true">AI</span>
                                <span class="profile-external-access-copy">
                                    <strong>GPT-Live連携</strong>
                                    <small>声で飼育一覧の確認・記録</small>
                                </span>
                                <span class="profile-external-access-chevron" aria-hidden="true">›</span>
                            </button>
                        </div>
                    ` : ''}

                    <div class="setae-form-group" style="text-align: center; margin-top: 10px;">
                        <button type="button" id="btn-open-credits" style="background: none; border: none; color: #888; font-size: 13px; cursor: pointer; text-decoration: underline;">
                            ${__('アプリについて / クレジット')}
                        </button>
                    </div>

                    <div id="setae-pwa-profile-card" class="setae-pwa-profile-card">
                        <div>
                            <span class="setae-pwa-profile-kicker">PWA</span>
                            <strong>ホーム画面・通知</strong>
                            <p>飼育確認と相談の返信を、端末ごとに設定できます。</p>
                        </div>
                        <div class="setae-pwa-profile-actions">
                            <button type="button" class="setae-pwa-install-action" hidden>ホーム画面に追加</button>
                            <button type="button" id="setae-open-notification-settings">通知設定</button>
                        </div>
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

        // バッジの動的生成
        const badgeContainer = document.getElementById('profile-my-badge-container');
        if (badgeContainer) {
            const isPremium = currentUser.is_premium;
            const badgeBonusLimit = currentUser.bonus_limit || 0;

            if (typeof SetaeUI !== 'undefined' && typeof SetaeUI.generateUserBadgesHtml === 'function') {
                badgeContainer.innerHTML = SetaeUI.generateUserBadgesHtml(isPremium, badgeBonusLimit);
            }
        }

        // --- イベントリスナーの設定 ---

        // ▼▼▼ ここから追加: 紹介コードのコピー処理 ▼▼▼
        $('#setae-profile-modal').on('click', '#btn-copy-referral', function () {
            const copyInput = document.getElementById("prof-my-referral");
            // 入力欄を選択状態にする
            copyInput.select();
            copyInput.setSelectionRange(0, 99999); // モバイル端末への対応

            // クリップボードにコピー
            copyProfileText(copyInput.value).then(() => {
                // コピー成功時にトースト通知を表示
                if (typeof SetaeCore !== 'undefined' && typeof SetaeCore.showToast === 'function') {
                    SetaeCore.showToast(__('紹介コードをコピーしました'), 'success');
                }
            }).catch(() => {
                SetaeCore.showToast(__('自動でコピーできませんでした'), 'warning');
                showProfileCopyFallback('紹介コード', copyInput.value);
            });
        });

        $('#setae-profile-modal').on('click', '#btn-copy-public-profile', function () {
            const copyInput = document.getElementById("prof-public-profile-url");
            if (!copyInput) return;

            copyInput.select();
            copyInput.setSelectionRange(0, 99999);

            copyProfileText(copyInput.value).then(() => {
                if (typeof SetaeCore !== 'undefined' && typeof SetaeCore.showToast === 'function') {
                    SetaeCore.showToast('公開プロフィールのリンクをコピーしました', 'success');
                }
                if (typeof SetaeCore !== 'undefined' && typeof SetaeCore.track === 'function') {
                    SetaeCore.track('profile_public_link_copy');
                }
            }).catch(() => {
                SetaeCore.showToast(__('自動でコピーできませんでした'), 'warning');
                showProfileCopyFallback('公開プロフィールURL', copyInput.value);
            });
        });

        $('#setae-profile-modal').on('click', '#btn-open-profile-qr', function () {
            if (!publicProfileUrl) return;
            openProfileQrModal({
                displayName: displayName,
                publicProfileUrl: publicProfileUrl,
                referralCode: refCode
            });
        });
        // ====== 紹介コードのXシェア処理 ======
        $('#setae-profile-modal').on('click', '#btn-share-x-referral', function () {
            const referralCode = document.getElementById('prof-my-referral').value;
            const appUrl = (typeof SetaeSettings !== 'undefined' && SetaeSettings.site_url) ? SetaeSettings.site_url : window.location.origin;
            let inviteUrl = publicProfileUrl || appUrl;
            try {
                const url = new URL(inviteUrl, window.location.origin);
                url.searchParams.set('ref', referralCode);
                inviteUrl = url.toString();
            } catch (e) {
                inviteUrl = inviteUrl + (inviteUrl.indexOf('?') === -1 ? '?' : '&') + 'ref=' + encodeURIComponent(referralCode);
            }

            const shareText = `Setaeで奇蟲を管理しよう！\n写真・給餌・脱皮・成長記録を個体ごとに残せます。\n新規登録時に紹介コード「${referralCode}」を入力すると生体登録枠が+1されます。\n#Setae`;
            const tweetUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(inviteUrl)}`;

            window.open(tweetUrl, '_blank');
        });

        // ====== バッジ説明モーダルを開く ======
        $('#setae-profile-modal').on('click', '#btn-show-badge-info', function (e) {
            e.preventDefault();
            $('#modal-badge-info').css('display', 'flex');
        });

        $('#setae-profile-modal').on('click', '#btn-open-external-access', function (e) {
            e.preventDefault();
            openExternalAccessModal();
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
            const confirmation = SetaeCore.confirmAction
                ? SetaeCore.confirmAction({
                    title: 'ログアウト',
                    message: 'SETAEからログアウトします。入力中の内容がある場合は保存されません。',
                    confirmLabel: 'ログアウトする'
                })
                : Promise.resolve(window.confirm('ログアウトしますか？'));
            confirmation.then(function (confirmed) {
                if (confirmed) {
                    try {
                        localStorage.removeItem('setae_offline_account_v1');
                    } catch (error) {}
                    window.location.href = SetaeSettings.logout_url;
                }
            });
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
            const $button = $(this);
            const originalText = $button.text();
            $button.prop('disabled', true).text('決済画面を準備中');
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
                    SetaeCore.showToast(data.message || '決済画面を準備できませんでした。', 'error');
                    $button.prop('disabled', false).text(originalText);
                }
            } catch (error) {
                console.error('Error:', error);
                SetaeCore.showToast('通信状態を確認して、もう一度お試しください。', 'error');
                $button.prop('disabled', false).text(originalText);
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
                        SetaeCore.showToast('プラン管理画面を表示できませんでした: ' + (data.message || '不明なエラー'), 'error');
                        btnManageSub.disabled = false;
                        btnManageSub.textContent = originalText;
                    }
                } catch (err) {
                    console.error(err);
                    SetaeCore.showToast('通信状態を確認して、もう一度お試しください。', 'error');
                    btnManageSub.disabled = false;
                    btnManageSub.textContent = originalText;
                }
            }
        });
    }

    async function externalAccessRequest(path, options) {
        const requestOptions = options || {};
        const headers = {
            'Accept': 'application/json',
            'X-WP-Nonce': SetaeSettings.nonce
        };
        const fetchOptions = {
            method: requestOptions.method || 'GET',
            headers: headers,
            credentials: 'same-origin',
            cache: 'no-store'
        };
        const abortController = typeof AbortController !== 'undefined' ? new AbortController() : null;
        const timeoutId = abortController ? window.setTimeout(function () {
            abortController.abort();
        }, 20000) : null;
        if (abortController) fetchOptions.signal = abortController.signal;

        if (typeof requestOptions.body !== 'undefined') {
            headers['Content-Type'] = 'application/json';
            fetchOptions.body = JSON.stringify(requestOptions.body);
        }

        let response;
        try {
            response = await fetch(
                SetaeSettings.api_root + 'setae/v1/' + String(path || '').replace(/^\/+/, ''),
                fetchOptions
            );
        } catch (error) {
            if (error && error.name === 'AbortError') {
                throw new Error('通信がタイムアウトしました。状態を確認してから再試行してください。');
            }
            throw error;
        } finally {
            if (timeoutId) window.clearTimeout(timeoutId);
        }
        let data = {};
        try {
            data = await response.json();
        } catch (error) {
            data = {};
        }

        if (!response.ok) {
            const requestError = new Error(data.message || '外部連携の設定を読み込めませんでした。');
            requestError.status = response.status;
            requestError.code = data.code || '';
            throw requestError;
        }

        return data;
    }

    function formatExternalAccessDate(value, emptyLabel) {
        if (!value) return emptyLabel || '未使用';

        const date = new Date(value);
        if (Number.isNaN(date.getTime())) return String(value);

        return new Intl.DateTimeFormat('ja-JP', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        }).format(date);
    }

    function showExternalAccessToast(message, type) {
        if (typeof SetaeCore !== 'undefined' && typeof SetaeCore.showToast === 'function') {
            SetaeCore.showToast(message, type || 'success');
        }
    }

    function openExternalAccessModal() {
        $('#setae-external-access-modal').remove();
        externalAccessClosing = false;
        externalAccessBusy = false;

        const html = `
            <div class="setae-modal-overlay active external-access-overlay" id="setae-external-access-modal" style="display:flex;">
                <div class="setae-modal-content external-access-modal-content" role="dialog" aria-modal="true" aria-labelledby="external-access-title">
                    <header class="external-access-header">
                        <div>
                            <span class="external-access-eyebrow">GPT-LIVE URL BRIDGE</span>
                            <h3 id="external-access-title">GPT-Live連携</h3>
                        </div>
                        <button type="button" class="external-access-close" id="btn-close-external-access" aria-label="GPT-Live連携を閉じる">×</button>
                    </header>
                    <div class="external-access-body" id="external-access-body">
                        <div class="external-access-loading" role="status">
                            <span aria-hidden="true"></span>
                            <p>設定を確認しています</p>
                        </div>
                    </div>
                </div>
            </div>
        `;

        $('body').append(html).addClass('setae-external-access-open');
        $('#setae-profile-modal').attr('aria-hidden', 'true');
        bindExternalAccessEvents();
        window.setTimeout(function () {
            $('#btn-close-external-access').trigger('focus');
        }, 0);

        externalAccessRequest('live/access').then(function (data) {
            renderExternalAccess(data);
        }).catch(function (error) {
            renderExternalAccessError(error.message);
        });
    }

    function bindExternalAccessEvents() {
        const $modal = $('#setae-external-access-modal');

        $modal.on('click', '#btn-close-external-access, #btn-close-external-access-error', function () {
            closeExternalAccessModal();
        });

        $modal.on('click', '#btn-issue-live-session', async function () {
            const hasActiveSession = $(this).attr('data-active') === 'true';
            if (hasActiveSession) {
                const confirmed = await confirmExternalAccessAction({
                    title: 'Liveセッションを再発行',
                    message: '現在の操作URLはすぐ無効になります。新しい会話を始める場合に再発行してください。',
                    confirmLabel: '再発行する'
                });
                if (!confirmed) return;
            }

            const mode = String($modal.find('input[name="live-access-mode"]:checked').val() || 'read_write');
            const duration = Number($modal.find('input[name="live-access-duration"]:checked').val() || 86400);
            setExternalAccessBusy(true);
            try {
                const data = await externalAccessRequest('live/access/session', {
                    method: 'POST',
                    body: {
                        mode: mode,
                        duration: duration
                    }
                });
                renderExternalAccess(data);
                showExternalAccessToast('GPT-Live用の操作URLを発行しました', 'success');
            } catch (error) {
                setExternalAccessBusy(false);
                showExternalAccessToast(error.message, 'error');
            }
        });

        $modal.on('click', '#btn-disable-external-access', async function () {
            const confirmed = await confirmExternalAccessAction({
                title: 'GPT-Live連携を停止',
                message: '発行済みの操作URLと、未実行の確認チケットがすぐ無効になります。',
                confirmLabel: '停止する'
            });
            if (!confirmed) return;

            setExternalAccessBusy(true);
            try {
                const data = await externalAccessRequest('live/access/disable', {
                    method: 'POST',
                    body: {}
                });
                renderExternalAccess(data);
                showExternalAccessToast('GPT-Live連携を停止しました', 'success');
            } catch (error) {
                setExternalAccessBusy(false);
                showExternalAccessToast(error.message, 'error');
            }
        });

        $modal.on('click', '#btn-copy-external-prompt, #btn-copy-external-prompt-primary', function () {
            const prompt = document.getElementById('external-access-prompt');
            if (prompt) copyExternalAccessValue(prompt.value, '操作プロンプト');
        });

        $(document).off('keydown.setaeExternalAccess').on('keydown.setaeExternalAccess', function (event) {
            if (event.key === 'Escape' && $('#setae-external-access-modal').length) {
                closeExternalAccessModal();
            }
        });
    }

    function renderExternalAccess(data) {
        $('#setae-external-access-modal').removeClass('is-busy');
        externalAccessBusy = false;
        const access = data && data.access ? data.access : {};
        const enabled = !!access.enabled;
        const prompt = data.prompt || '';
        const activeMode = access.mode === 'read' ? 'read' : 'read_write';
        const activeDuration = [3600, 86400, 604800].indexOf(Number(access.duration)) !== -1
            ? Number(access.duration)
            : 86400;
        const statusMeta = enabled ? `
            <div class="external-access-status-meta">
                <span>発行 ${escapeHtml(formatExternalAccessDate(access.created_at, '不明'))}</span>
                <span>期限 ${escapeHtml(formatExternalAccessDate(access.expires_at, '不明'))}</span>
                <span>最終利用 ${escapeHtml(formatExternalAccessDate(access.last_used_at, '未使用'))}</span>
            </div>
        ` : '<p>有効なLiveセッションはありません。</p>';

        const bodyHtml = `
            <section class="external-access-status${enabled ? ' is-enabled' : ''}">
                <div class="external-access-status-main">
                    <span class="external-access-status-dot" aria-hidden="true"></span>
                    <div>
                        <small>SETAE GPT-Live</small>
                        <strong>${enabled ? '操作URLは有効です' : '停止中'}</strong>
                    </div>
                    ${enabled && access.token_hint ? `<code>${escapeHtml(access.token_hint)}</code>` : ''}
                </div>
                ${statusMeta}
            </section>

            <section class="external-access-capabilities" aria-label="GPT-Liveからできること">
                <span><b>検索</b> 個体一覧を取得</span>
                <span><b>カルテ</b> 履歴を確認</span>
                <span><b>確認付き記録</b> 給餌・脱皮など</span>
                <span><b>確認付き編集</b> 名前・状態など</span>
            </section>

            ${prompt ? `
                <section class="external-token-once" aria-live="polite">
                    <div class="external-token-once-copy">
                        <span>ONE-TIME SETUP</span>
                        <strong>このプロンプトは今だけ表示されます</strong>
                        <p>コピーしてChatGPTへ送信した後、その会話でGPT-Liveを開始してください。再表示する場合はセッションを再発行します。</p>
                    </div>
                    <button type="button" class="setae-btn setae-btn-primary" id="btn-copy-external-prompt-primary">操作プロンプトをコピー</button>
                </section>
            ` : ''}

            <div class="external-access-grid external-access-chatgpt-grid external-access-live-grid">
                <section class="external-access-control" aria-labelledby="external-access-connect-title">
                    <div class="external-access-section-heading">
                        <span>1</span>
                        <div>
                            <h4 id="external-access-connect-title">Liveセッションを発行</h4>
                            <p>用途と有効期間を選びます。再発行すると以前のURLはすぐ無効になります。</p>
                        </div>
                    </div>

                    <span class="external-access-field-label">許可する操作</span>
                    <div class="external-access-mode">
                        <label>
                            <input type="radio" name="live-access-mode" value="read" ${activeMode === 'read' ? 'checked' : ''}>
                            <span>
                                <strong>見るだけ</strong>
                                <small>一覧・個体詳細・履歴</small>
                            </span>
                        </label>
                        <label>
                            <input type="radio" name="live-access-mode" value="read_write" ${activeMode === 'read_write' ? 'checked' : ''}>
                            <span>
                                <strong>見る＋記録</strong>
                                <small>確認後に記録・編集</small>
                            </span>
                        </label>
                    </div>

                    <span class="external-access-field-label external-access-duration-label">有効期間</span>
                    <div class="external-access-mode external-access-duration">
                        <label>
                            <input type="radio" name="live-access-duration" value="3600" ${activeDuration === 3600 ? 'checked' : ''}>
                            <span><strong>1時間</strong><small>短い作業向け</small></span>
                        </label>
                        <label>
                            <input type="radio" name="live-access-duration" value="86400" ${activeDuration === 86400 ? 'checked' : ''}>
                            <span><strong>24時間</strong><small>おすすめ</small></span>
                        </label>
                        <label>
                            <input type="radio" name="live-access-duration" value="604800" ${activeDuration === 604800 ? 'checked' : ''}>
                            <span><strong>7日間</strong><small>同じ会話を継続</small></span>
                        </label>
                    </div>

                    <div class="external-access-control-actions">
                        <button
                            type="button"
                            class="setae-btn setae-btn-primary"
                            id="btn-issue-live-session"
                            data-active="${enabled ? 'true' : 'false'}"
                        >
                            ${enabled ? '新しい操作URLを発行' : '操作URLを発行'}
                        </button>
                        ${enabled ? `
                            <button type="button" class="external-access-disable" id="btn-disable-external-access">今すぐ停止</button>
                        ` : ''}
                    </div>
                </section>

                <section class="external-access-setup" aria-labelledby="external-access-prompt-title">
                    <div class="external-access-section-heading">
                        <span>2</span>
                        <div>
                            <h4 id="external-access-prompt-title">ChatGPTで会話を始める</h4>
                            <p>プロンプトを文字で送信してから、その会話のGPT-Liveを開始します。</p>
                        </div>
                    </div>
                    ${prompt ? `
                        <div class="external-access-prompt-head">
                            <label class="external-access-field-label" for="external-access-prompt">操作プロンプト</label>
                            <button type="button" id="btn-copy-external-prompt">コピー</button>
                        </div>
                        <textarea id="external-access-prompt" readonly spellcheck="false">${escapeHtml(prompt)}</textarea>
                    ` : `
                        <ol class="external-access-flow">
                            <li><span>操作URLを発行</span><small>短命で、いつでも停止できます</small></li>
                            <li><span>プロンプトを送信</span><small>秘密URLは読み上げず、文字で送ります</small></li>
                            <li><span>GPT-Liveを開始</span><small>例「今日、P023に給餌した」</small></li>
                        </ol>
                        <div class="external-access-voice-note">
                            <strong>${enabled ? '新しい会話で使う場合' : '発行後に表示されます'}</strong>
                            <p>${enabled ? '秘密URLは保存されないため、セッションを再発行して新しいプロンプトをコピーしてください。' : '発行した画面で操作プロンプトを一度だけコピーできます。'}</p>
                        </div>
                    `}
                </section>
            </div>

            <p class="external-access-secret-note">書き込みは、内容の読み上げと明確な承認を経た一度限りの確認URLで実行されます。削除・譲渡・アカウント操作には使用できません。</p>
        `;

        $('#external-access-body').html(bodyHtml);
    }

    function renderExternalAccessError(message) {
        $('#external-access-body').html(`
            <div class="external-access-error" role="alert">
                <strong>設定を読み込めませんでした</strong>
                <p>${escapeHtml(message || '通信状態を確認してください。')}</p>
                <button type="button" class="setae-btn setae-btn-secondary" id="btn-close-external-access-error">閉じる</button>
            </div>
        `);
    }

    function setExternalAccessBusy(isBusy) {
        const $modal = $('#setae-external-access-modal');
        externalAccessBusy = !!isBusy;
        $modal.toggleClass('is-busy', !!isBusy);
        $modal.find('button, input, textarea').prop('disabled', !!isBusy);
    }

    function copyExternalAccessValue(value, label, onCopied) {
        copyProfileText(value).then(function () {
            if (typeof onCopied === 'function') onCopied();
            showExternalAccessToast(label + 'をコピーしました', 'success');
        }).catch(function () {
            showExternalAccessToast('自動でコピーできませんでした', 'warning');
            showProfileCopyFallback(label, value);
        });
    }

    function confirmExternalAccessAction(options) {
        if (typeof SetaeCore !== 'undefined' && typeof SetaeCore.confirmAction === 'function') {
            return SetaeCore.confirmAction(options);
        }
        return Promise.resolve(window.confirm(options.message || '実行しますか？'));
    }

    async function closeExternalAccessModal() {
        if (externalAccessClosing) return;
        if (externalAccessBusy) {
            showExternalAccessToast('処理が終わるまでお待ちください', 'warning');
            return;
        }
        externalAccessClosing = true;

        $(document).off('keydown.setaeExternalAccess');
        $('#setae-profile-modal').removeAttr('aria-hidden');
        $('body').removeClass('setae-external-access-open');
        $('#setae-external-access-modal').fadeOut(160, function () {
            $(this).remove();
            externalAccessClosing = false;
        });
    }

    function openProfileQrModal(profile) {
        const publicProfileUrl = profile.publicProfileUrl || '';
        if (!publicProfileUrl) return;

        $('#setae-profile-qr-modal').remove();

        const displayName = profile.displayName || 'SETAEユーザー';
        const referralCode = profile.referralCode || '';
        const sources = [
            { key: 'profile_qr', label: '自分用' },
            { key: 'shop_qr', label: 'ショップ配布' },
            { key: 'event_qr', label: 'イベント配布' }
        ];
        let activeSource = sources[0].key;
        let activeUrl = buildReferralUrl(publicProfileUrl, activeSource);
        const html = `
            <div class="setae-modal-overlay active" id="setae-profile-qr-modal" style="display:flex;">
                <div class="setae-modal-content profile-qr-modal-content">
                    <div class="profile-header">
                        <h3>配布用QRカード</h3>
                        <span class="setae-close" id="close-profile-qr-modal">&times;</span>
                    </div>
                    <div class="profile-qr-mode-row" aria-label="QRカードの用途">
                        ${sources.map((source, index) => `
                            <button type="button" class="${index === 0 ? 'active' : ''}" data-profile-qr-source="${escapeHtml(source.key)}">${escapeHtml(source.label)}</button>
                        `).join('')}
                    </div>
                    <div class="profile-qr-card" id="profile-qr-card">
                        <div class="profile-qr-card-head">
                            <span class="setae-logo setae-logo-text">SETAE</span>
                            <strong id="profile-qr-source-label">${escapeHtml(sources[0].label)}</strong>
                        </div>
                        <div class="profile-qr-body">
                            <div id="profile-public-qr" class="profile-public-qr" aria-label="公開プロフィールQR"></div>
                            <div class="profile-qr-copy">
                                <p>写真・給餌・脱皮・成長記録を個体ごとに残せます。</p>
                                <strong>${escapeHtml(displayName)}さんの公開プロフィール</strong>
                                ${referralCode ? `<span>紹介コード: ${escapeHtml(referralCode)}</span>` : ''}
                            </div>
                        </div>
                        <div class="profile-qr-url" id="profile-qr-url-text">${escapeHtml(activeUrl)}</div>
                    </div>
                    <div class="profile-qr-actions">
                        <button type="button" class="setae-btn setae-btn-secondary" id="btn-copy-profile-qr-url">URLコピー</button>
                        <button type="button" class="setae-btn setae-btn-primary" id="btn-download-profile-qr">QRを保存</button>
                    </div>
                </div>
            </div>
        `;

        $('body').append(html);
        renderProfileQr(activeUrl);

        if (typeof SetaeCore !== 'undefined' && typeof SetaeCore.track === 'function') {
            SetaeCore.track('profile_qr_open');
        }

        $('#setae-profile-qr-modal, #close-profile-qr-modal').on('click', function (e) {
            if (e.target !== this) return;
            $('#setae-profile-qr-modal').fadeOut(160, function () {
                $(this).remove();
            });
        });

        $('[data-profile-qr-source]').on('click', function () {
            const $button = $(this);
            const nextSource = $button.attr('data-profile-qr-source') || 'profile_qr';
            const source = sources.find(item => item.key === nextSource) || sources[0];

            activeSource = source.key;
            activeUrl = buildReferralUrl(publicProfileUrl, activeSource);
            $('[data-profile-qr-source]').removeClass('active');
            $button.addClass('active');
            $('#profile-qr-source-label').text(source.label);
            $('#profile-qr-url-text').text(activeUrl);
            renderProfileQr(activeUrl);

            if (typeof SetaeCore !== 'undefined' && typeof SetaeCore.track === 'function') {
                SetaeCore.track('profile_qr_source_change', { source: activeSource });
            }
        });

        $('#btn-copy-profile-qr-url').on('click', function () {
            const $btn = $(this);
            const originalText = $btn.text();

            function copied() {
                $btn.text('コピーしました');
                if (typeof SetaeCore !== 'undefined' && typeof SetaeCore.showToast === 'function') {
                    SetaeCore.showToast('公開プロフィールURLをコピーしました', 'success');
                }
                if (typeof SetaeCore !== 'undefined' && typeof SetaeCore.track === 'function') {
                    SetaeCore.track('profile_qr_link_copy');
                }
                setTimeout(function () {
                    $btn.text(originalText);
                }, 1300);
            }

            copyProfileText(activeUrl).then(copied).catch(function () {
                showProfileCopyFallback('公開プロフィールURL', activeUrl);
            });
        });

        $('#btn-download-profile-qr').on('click', function () {
            downloadProfileQr();
        });
    }

    function renderProfileQr(url) {
        const container = document.getElementById('profile-public-qr');
        if (!container) return;

        container.innerHTML = '';

        if (typeof QRCode === 'undefined') {
            container.classList.add('is-unavailable');
            container.textContent = 'QRを表示できません';
            return;
        }

        new QRCode(container, {
            text: url,
            width: 172,
            height: 172,
            colorDark: '#111827',
            colorLight: '#ffffff',
            correctLevel: QRCode.CorrectLevel.M
        });
    }

    function downloadProfileQr() {
        const qrContainer = document.getElementById('profile-public-qr');
        if (!qrContainer) return;

        const canvas = qrContainer.querySelector('canvas');
        const image = qrContainer.querySelector('img');
        let dataUrl = '';

        if (canvas && typeof canvas.toDataURL === 'function') {
            dataUrl = canvas.toDataURL('image/png');
        } else if (image && image.src) {
            dataUrl = image.src;
        }

        if (!dataUrl) {
            if (typeof SetaeCore !== 'undefined' && typeof SetaeCore.showToast === 'function') {
                SetaeCore.showToast('QR画像を保存できませんでした', 'error');
            }
            return;
        }

        const link = document.createElement('a');
        link.href = dataUrl;
        link.download = 'setae-profile-qr.png';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        if (typeof SetaeCore !== 'undefined' && typeof SetaeCore.track === 'function') {
            SetaeCore.track('profile_qr_download');
        }
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
        formData.append('theme_preference', $('input[name="prof-theme-preference"]:checked').val() || 'system');
        formData.append('show_care_focus', $('#prof-show-care-focus').is(':checked') ? '1' : '0');

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
                    const savedThemePreference = response.data && response.data.theme_preference
                        ? response.data.theme_preference
                        : ($('input[name="prof-theme-preference"]:checked').val() || 'system');
                    const savedCareFocus = response.data
                        && Object.prototype.hasOwnProperty.call(response.data, 'show_care_focus')
                        ? response.data.show_care_focus
                        : $('#prof-show-care-focus').is(':checked');
                    if (SetaeSettings.current_user) {
                        SetaeSettings.current_user.theme_preference = savedThemePreference;
                        SetaeSettings.current_user.show_care_focus = savedCareFocus;
                    }
                    if (typeof SetaeCore !== 'undefined') {
                        if (typeof SetaeCore.applyThemePreference === 'function') {
                            SetaeCore.applyThemePreference(savedThemePreference, true);
                        }
                        if (typeof SetaeCore.setCareFocusPreference === 'function') {
                            SetaeCore.setCareFocusPreference(savedCareFocus, true);
                        }
                    }
                    if (!savedCareFocus) {
                        $('.detail-care-focus').remove();
                    }
                    // ---------------------------------------------------

                    SetaeCore.showToast('プロフィールを更新しました', 'success');
                    $('#setae-profile-modal').fadeOut(200, function () { $(this).remove(); });
                } else {
                    SetaeCore.showToast('更新に失敗しました: ' + (response.data || '不明なエラー'), 'error');
                }
            },
            error: function () {
                SetaeCore.showToast('通信エラーが発生しました', 'error');
            }
        });
    }

    function saveCareFocusPreference(showCareFocus) {
        const normalized = !!showCareFocus;
        if (typeof SetaeCore !== 'undefined' && typeof SetaeCore.setCareFocusPreference === 'function') {
            SetaeCore.setCareFocusPreference(normalized, true);
        }

        if (typeof SetaeSettings === 'undefined'
            || SetaeSettings.guest_mode
            || SetaeSettings.offline_session) {
            return Promise.resolve({ show_care_focus: normalized });
        }

        const formData = new FormData();
        formData.append('action', 'setae_update_profile');
        formData.append('nonce', SetaeSettings.nonce);
        formData.append('show_care_focus', normalized ? '1' : '0');

        return new Promise(function (resolve, reject) {
            $.ajax({
                url: SetaeSettings.ajax_url,
                method: 'POST',
                data: formData,
                processData: false,
                contentType: false,
                success: function (response) {
                    if (!response || !response.success) {
                        reject(new Error('preference_update_failed'));
                        return;
                    }
                    const saved = response.data
                        && Object.prototype.hasOwnProperty.call(response.data, 'show_care_focus')
                        ? response.data.show_care_focus
                        : normalized;
                    if (typeof SetaeCore !== 'undefined' && typeof SetaeCore.setCareFocusPreference === 'function') {
                        SetaeCore.setCareFocusPreference(saved, true);
                    }
                    resolve(response.data || { show_care_focus: saved });
                },
                error: function (xhr) {
                    reject(xhr || new Error('preference_update_failed'));
                }
            });
        });
    }

    return {
        init: init,
        saveCareFocusPreference: saveCareFocusPreference
    };
})(jQuery);

// ドキュメントロード時に初期化
jQuery(document).ready(function () {
    SetaeUIProfile.init();
});
