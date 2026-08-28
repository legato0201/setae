var SetaePWA = (function ($) {
    'use strict';

    let installPrompt = null;
    let serviceWorkerRegistration = null;
    let pushConfig = null;
    let migrationInProgress = false;
    let notificationReturnFocus = null;

    function isGuest() {
        return !!(window.SetaeSettings && SetaeSettings.guest_mode);
    }

    function isStandalone() {
        return window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
    }

    function isIOS() {
        return /iphone|ipad|ipod/i.test(navigator.userAgent || '')
            || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    }

    function apiRequest(path, method, data) {
        return $.ajax({
            url: SetaeCore.state.apiRoot + path,
            method: method,
            data: data ? JSON.stringify(data) : undefined,
            contentType: data ? 'application/json; charset=UTF-8' : undefined,
            dataType: 'json',
            timeout: 30000,
            beforeSend: function (xhr) {
                xhr.setRequestHeader('X-WP-Nonce', SetaeCore.state.nonce);
            }
        });
    }

    function registerServiceWorker() {
        if (!('serviceWorker' in navigator) || !window.SetaeSettings || !SetaeSettings.pwa) {
            return Promise.resolve(null);
        }
        return navigator.serviceWorker.register(SetaeSettings.pwa.service_worker_url, {
            scope: '/',
            updateViaCache: 'none'
        })
            .then(function (registration) {
                serviceWorkerRegistration = registration;
                return registration;
            })
            .catch(function (error) {
                console.warn('SETAE service worker registration failed', error);
                return null;
            });
    }

    function renderConnectivityIndicator() {
        if (!$('#setae-app').length || $('#setae-connectivity-status').length) return;
        $('body').append(
            '<div id="setae-connectivity-status" class="setae-connectivity-status" role="status" aria-live="polite" hidden>' +
                '<span class="setae-connectivity-dot" aria-hidden="true"></span>' +
                '<span class="setae-connectivity-label">オンライン</span>' +
            '</div>'
        );
        updateConnectivityIndicator();
    }

    function updateConnectivityIndicator(detail) {
        const $status = $('#setae-connectivity-status');
        if (!$status.length) return;

        const state = detail || {};
        const offline = !navigator.onLine || state.offline;
        const syncing = !!state.syncing;
        const pending = Math.max(0, parseInt(state.pending, 10) || 0);
        let label = '';
        let className = '';

        if (offline) {
            label = 'オフライン保存中';
            className = 'is-offline';
        } else if (syncing) {
            label = pending ? pending + '件を同期中' : '同期中';
            className = 'is-syncing';
        } else if (pending) {
            label = pending + '件が同期待ち';
            className = 'is-pending';
        } else if (state.migrated) {
            label = state.migrated + '匹を同期しました';
            className = 'is-complete';
        }

        $status
            .removeClass('is-offline is-syncing is-pending is-complete')
            .addClass(className)
            .prop('hidden', !label)
            .find('.setae-connectivity-label').text(label);

        if (state.migrated) {
            window.setTimeout(function () {
                $status.prop('hidden', true);
            }, 4500);
        }
    }

    function renderGuestExperience() {
        if (!isGuest() || !$('#setae-app').length || $('#setae-guest-trial-bar').length) return;
        const limit = parseInt(SetaeSettings.current_user.spider_limit, 10) || 8;
        const registerUrl = SetaeSettings.registration_url || '/?register=1';
        const loginUrl = SetaeSettings.login_url || '/wp-login.php';

        $('#setae-app').addClass('is-guest-trial');
        $('.setae-user-actions').attr('aria-label', '無料登録とデータ同期');
        $('.setae-nav-item[data-guest-locked="1"]')
            .addClass('is-guest-locked')
            .attr('aria-disabled', 'true');

        $('.setae-header').after(
            '<aside id="setae-guest-trial-bar" class="setae-guest-trial-bar" aria-label="体験モード">' +
                '<div class="setae-guest-trial-copy">' +
                    '<span class="setae-guest-trial-kicker">この端末だけに保存</span>' +
                    '<strong>登録なしで' + limit + '匹まで試せます</strong>' +
                    '<p>登録後に、この端末の個体と記録をそのまま同期できます。</p>' +
                '</div>' +
                '<div class="setae-guest-trial-actions">' +
                    '<button type="button" class="setae-pwa-install-action" hidden>ホーム画面に追加</button>' +
                    '<a class="setae-guest-register-action" href="' + escapeAttribute(registerUrl) + '">無料登録して同期</a>' +
                    '<a class="setae-guest-login-action" href="' + escapeAttribute(loginUrl) + '">ログイン</a>' +
                '</div>' +
            '</aside>'
        );
        refreshInstallButtons();
    }

    function hydrateOfflineAccountShell() {
        if (!(window.SetaeSettings && SetaeSettings.offline_session) || !$('#setae-app').length) return;
        $('#setae-app').addClass('is-offline-account');
        $('#header-user-name').text(
            SetaeSettings.current_user && SetaeSettings.current_user.display_name
                ? SetaeSettings.current_user.display_name
                : 'オフライン'
        );
        $('.setae-nav-item[data-guest-locked="1"]').addClass('is-guest-locked');
    }

    function renderAccountTools() {
        if (isGuest() || !$('#setae-profile-form').length || $('#setae-pwa-profile-card').length) return;
        const card = $(
            '<div id="setae-pwa-profile-card" class="setae-pwa-profile-card">' +
                '<div>' +
                    '<span class="setae-pwa-profile-kicker">PWA</span>' +
                    '<strong>ホーム画面・通知</strong>' +
                    '<p>飼育確認と相談の返信を、端末ごとに設定できます。</p>' +
                '</div>' +
                '<div class="setae-pwa-profile-actions">' +
                    '<button type="button" class="setae-pwa-install-action" hidden>ホーム画面に追加</button>' +
                    '<button type="button" id="setae-open-notification-settings">通知設定</button>' +
                '</div>' +
            '</div>'
        );
        card.insertBefore($('#setae-profile-form .setae-form-actions'));
        renderNotificationModal();
        refreshInstallButtons();
    }

    function renderNotificationModal() {
        if ($('#setae-pwa-settings-modal').length) return;
        $('body').append(
            '<div id="setae-pwa-settings-modal" class="setae-modal setae-pwa-settings-modal" style="display:none;" aria-hidden="true">' +
                '<div class="setae-modal-content setae-pwa-settings-dialog" role="dialog" aria-modal="true" aria-labelledby="setae-pwa-settings-title">' +
                    '<div class="setae-pwa-settings-head">' +
                        '<div><span>PWA NOTIFICATIONS</span><h2 id="setae-pwa-settings-title">通知とホーム画面</h2></div>' +
                        '<button type="button" class="setae-pwa-settings-close" aria-label="閉じる">&times;</button>' +
                    '</div>' +
                    '<div id="setae-pwa-support-note" class="setae-pwa-support-note"></div>' +
                    '<section class="setae-pwa-subscription-panel">' +
                        '<div><strong>この端末の通知</strong><p id="setae-pwa-subscription-status">状態を確認しています</p></div>' +
                        '<button type="button" id="setae-pwa-subscribe">通知を許可</button>' +
                    '</section>' +
                    '<form id="setae-pwa-preferences-form">' +
                        '<label class="setae-pwa-toggle-row">' +
                            '<span><strong>飼育リマインダー</strong><small>今日まだ確認していない個体を通知</small></span>' +
                            '<input type="checkbox" id="setae-pwa-care-reminders" checked>' +
                            '<i aria-hidden="true"></i>' +
                        '</label>' +
                        '<label class="setae-pwa-time-row">' +
                            '<span><strong>通知する時刻</strong><small>端末のタイムゾーンで配信</small></span>' +
                            '<input type="time" id="setae-pwa-care-time" value="20:00" step="300">' +
                        '</label>' +
                        '<label class="setae-pwa-toggle-row">' +
                            '<span><strong>相談広場の返信</strong><small>参加中の相談に返信が届いたとき</small></span>' +
                            '<input type="checkbox" id="setae-pwa-community-messages" checked>' +
                            '<i aria-hidden="true"></i>' +
                        '</label>' +
                        '<div class="setae-pwa-settings-actions">' +
                            '<button type="button" id="setae-pwa-test-notification">テスト通知</button>' +
                            '<button type="submit">設定を保存</button>' +
                        '</div>' +
                    '</form>' +
                '</div>' +
            '</div>'
        );
    }

    function openNotificationSettings() {
        renderNotificationModal();
        const $modal = $('#setae-pwa-settings-modal');
        notificationReturnFocus = document.getElementById('setae-profile-trigger') || null;

        const $profileModal = $('#setae-profile-modal');
        if ($profileModal.length) {
            $profileModal.stop(true, true).attr('aria-hidden', 'true').remove();
        }

        $('body').addClass('setae-pwa-settings-open');
        $modal.fadeIn(160).css('display', 'flex').attr('aria-hidden', 'false');
        $modal.find('.setae-pwa-settings-close').trigger('focus');
        loadPushState();
    }

    function closeNotificationSettings() {
        $('#setae-pwa-settings-modal').stop(true, true).fadeOut(140, function () {
            $('body').removeClass('setae-pwa-settings-open');
            if (notificationReturnFocus && typeof notificationReturnFocus.focus === 'function') {
                notificationReturnFocus.focus();
            }
            notificationReturnFocus = null;
        }).attr('aria-hidden', 'true');
    }

    function loadPushState() {
        const $status = $('#setae-pwa-subscription-status').text('状態を確認しています');
        const $button = $('#setae-pwa-subscribe').prop('disabled', true);
        if (isIOS() && !isStandalone()) {
            $('#setae-pwa-support-note').html(
                '<strong>iPhone・iPadではホーム画面から設定します</strong>' +
                '<p>共有メニューの「ホーム画面に追加」後、追加したSETAEを開いて通知を許可してください。</p>'
            ).show();
            $status.text('ホーム画面に追加すると通知を設定できます');
            $button.text('ホーム画面から設定').prop('disabled', true);
            return;
        }
        if (!('Notification' in window) || !('PushManager' in window) || !('serviceWorker' in navigator)) {
            $status.text('このブラウザはWeb通知に対応していません');
            $button.text('利用できません').prop('disabled', true);
            return;
        }
        apiRequest('/pwa/config', 'GET').then(function (config) {
            pushConfig = config;
            if (!config.configured) {
                $status.text('サーバー側の通知設定が必要です');
                $button.text('現在利用できません').prop('disabled', true);
                return;
            }

            const preferences = config.preferences || {};
            $('#setae-pwa-care-reminders').prop('checked', preferences.care_reminders !== false);
            $('#setae-pwa-community-messages').prop('checked', preferences.community_messages !== false);
            const parsedHour = parseInt(preferences.care_hour, 10);
            const hour = String(Number.isFinite(parsedHour) ? parsedHour : 20).padStart(2, '0');
            const minute = String(parseInt(preferences.care_minute, 10) || 0).padStart(2, '0');
            $('#setae-pwa-care-time').val(hour + ':' + minute);

            getCurrentSubscription().then(function (subscription) {
                if (subscription) {
                    $status.text('この端末で通知を受け取ります');
                    $button.text('この端末の通知を解除').prop('disabled', false).attr('data-subscribed', '1');
                } else {
                    const denied = window.Notification && Notification.permission === 'denied';
                    $status.text(denied ? 'ブラウザ設定で通知がブロックされています' : 'この端末では通知が未設定です');
                    $button.text('通知を許可').prop('disabled', denied).attr('data-subscribed', '0');
                }
            }).catch(function () {
                $status.text('この端末の購読状態を確認できませんでした');
                $button.text('もう一度確認').prop('disabled', false);
            });

            $('#setae-pwa-support-note').empty().hide();
        }).catch(function () {
            $status.text('通知設定を読み込めませんでした');
            $button.prop('disabled', false);
        });
    }

    function getCurrentSubscription() {
        const ready = serviceWorkerRegistration
            ? Promise.resolve(serviceWorkerRegistration)
            : navigator.serviceWorker.ready;
        return ready.then(function (registration) {
            serviceWorkerRegistration = registration;
            return registration.pushManager.getSubscription();
        });
    }

    function urlBase64ToUint8Array(value) {
        const padding = '='.repeat((4 - value.length % 4) % 4);
        const base64 = (value + padding).replace(/-/g, '+').replace(/_/g, '/');
        const raw = window.atob(base64);
        return Uint8Array.from(Array.prototype.map.call(raw, function (character) {
            return character.charCodeAt(0);
        }));
    }

    function toggleSubscription() {
        const $button = $('#setae-pwa-subscribe');
        if ($button.prop('disabled')) return;
        $button.prop('disabled', true);

        getCurrentSubscription().then(function (existing) {
            if (existing) {
                const endpoint = existing.endpoint;
                return apiRequest('/pwa/subscriptions', 'DELETE', { endpoint: endpoint }).then(function () {
                    return existing.unsubscribe();
                });
            }

            if (!pushConfig || !pushConfig.public_key) {
                throw new Error('通知サーバーが設定されていません。');
            }
            return Notification.requestPermission().then(function (permission) {
                if (permission !== 'granted') {
                    throw new Error('通知は許可されませんでした。ブラウザのサイト設定から変更できます。');
                }
                return serviceWorkerRegistration.pushManager.subscribe({
                    userVisibleOnly: true,
                    applicationServerKey: urlBase64ToUint8Array(pushConfig.public_key)
                });
            }).then(function (subscription) {
                const json = subscription.toJSON();
                return apiRequest('/pwa/subscriptions', 'POST', {
                    subscription: json,
                    device_name: getDeviceName(),
                    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Tokyo'
                });
            });
        }).then(function () {
            SetaeCore.showToast('この端末の通知設定を更新しました', 'success');
            loadPushState();
        }).catch(function (error) {
            SetaeCore.showToast(error && error.message ? error.message : '通知設定を更新できませんでした', 'error');
            loadPushState();
        });
    }

    function getDeviceName() {
        const platform = navigator.userAgentData && navigator.userAgentData.platform
            ? navigator.userAgentData.platform
            : navigator.platform;
        return [platform || '端末', navigator.userAgentData ? 'ブラウザ' : getBrowserName()].join(' / ');
    }

    function getBrowserName() {
        const ua = navigator.userAgent || '';
        if (/Edg\//.test(ua)) return 'Edge';
        if (/Chrome\//.test(ua)) return 'Chrome';
        if (/Safari\//.test(ua) && !/Chrome\//.test(ua)) return 'Safari';
        if (/Firefox\//.test(ua)) return 'Firefox';
        return 'ブラウザ';
    }

    function savePushPreferences(event) {
        event.preventDefault();
        const $button = $(event.currentTarget).find('button[type="submit"]');
        const original = $button.text();
        const timeParts = String($('#setae-pwa-care-time').val() || '20:00').split(':');
        const parsedHour = parseInt(timeParts[0], 10);
        const parsedMinute = parseInt(timeParts[1], 10);
        const hour = Number.isFinite(parsedHour) ? parsedHour : 20;
        const minute = Number.isFinite(parsedMinute) ? parsedMinute : 0;
        $button.prop('disabled', true).text('保存中');
        apiRequest('/pwa/preferences', 'POST', {
            enabled: true,
            care_reminders: $('#setae-pwa-care-reminders').prop('checked'),
            community_messages: $('#setae-pwa-community-messages').prop('checked'),
            care_hour: hour,
            care_minute: minute,
            timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Tokyo'
        }).then(function () {
            SetaeCore.showToast('通知設定を保存しました', 'success');
            closeNotificationSettings();
        }).catch(function (xhr) {
            const message = xhr && xhr.responseJSON && xhr.responseJSON.message
                ? xhr.responseJSON.message
                : '通知設定を保存できませんでした';
            SetaeCore.showToast(message, 'error');
        }).always(function () {
            $button.prop('disabled', false).text(original);
        });
    }

    function sendTestNotification() {
        const $button = $('#setae-pwa-test-notification');
        const original = $button.text();
        $button.prop('disabled', true).text('送信中');
        apiRequest('/pwa/test', 'POST', {}).then(function () {
            SetaeCore.showToast('テスト通知を送信しました', 'success');
        }).catch(function (xhr) {
            const message = xhr && xhr.responseJSON && xhr.responseJSON.message
                ? xhr.responseJSON.message
                : 'テスト通知を送信できませんでした';
            SetaeCore.showToast(message, 'error');
        }).always(function () {
            $button.prop('disabled', false).text(original);
        });
    }

    function refreshInstallButtons() {
        const available = !isStandalone() && (!!installPrompt || isIOS());
        $('.setae-pwa-install-action').prop('hidden', !available);
    }

    function promptInstall() {
        if (installPrompt) {
            installPrompt.prompt();
            installPrompt.userChoice.finally(function () {
                installPrompt = null;
                refreshInstallButtons();
            });
            return;
        }
        if (isIOS() && !isStandalone()) {
            SetaeCore.openDialog({
                title: 'ホーム画面に追加',
                message: 'Safariの共有メニューを開き、「ホーム画面に追加」を選んでください。',
                confirmLabel: '確認しました'
            });
        }
    }

    function checkGuestMigration() {
        if (isGuest() || !window.SetaeOffline || migrationInProgress) return;
        SetaeOffline.hasGuestData().then(function (result) {
            if (!result.count || $('#setae-guest-migration').length) return;
            $('.setae-header').after(
                '<aside id="setae-guest-migration" class="setae-guest-migration">' +
                    '<div><span>体験データを検出</span><strong>この端末の' + result.count + '匹をアカウントへ同期できます</strong>' +
                    '<p>個体、写真、飼育記録をまとめて引き継ぎます。</p></div>' +
                    '<button type="button" id="setae-migrate-guest-data">今すぐ同期</button>' +
                '</aside>'
            );
        });
    }

    function migrateGuestData() {
        if (migrationInProgress) return;
        const $button = $('#setae-migrate-guest-data');
        const original = $button.text();
        migrationInProgress = true;
        $button.prop('disabled', true).text('同期中');
        SetaeOffline.migrateGuestData().then(function (result) {
            $('#setae-guest-migration').slideUp(180, function () { $(this).remove(); });
            SetaeCore.showToast(result.migrated + '匹と飼育記録を同期しました', 'success');
            return SetaeAPI.fetchMySpiders(function () {
                if (window.SetaeUIList) SetaeUIList.renderMySpiders();
            });
        }).catch(function (error) {
            SetaeCore.showToast(error && error.message ? error.message : '体験データを同期できませんでした', 'error');
            $button.prop('disabled', false).text(original);
        }).finally(function () {
            migrationInProgress = false;
        });
    }

    function syncNow() {
        if (isGuest() || !window.SetaeOffline || !navigator.onLine) {
            updateConnectivityIndicator();
            return;
        }
        SetaeOffline.getPendingCount().then(function (count) {
            if (!count) {
                updateConnectivityIndicator({ pending: 0 });
                return;
            }
            return SetaeOffline.syncPending().then(function (result) {
                if (result && result.failed) {
                    SetaeCore.showToast(result.failed + '件を同期できませんでした。内容を確認してください。', 'warning');
                    return;
                }
                return SetaeAPI.fetchMySpiders(function (spiders) {
                    if (window.SetaeUIList && $('#section-my').is(':visible')) {
                        SetaeUIList.init(spiders);
                    }
                });
            });
        }).catch(function () {
            updateConnectivityIndicator({ pending: 1 });
        });
    }

    function promptGuestRegistration(options) {
        const settings = Object.assign({
            title: '体験データをアカウントへ',
            message: '無料登録すると、この端末の個体と飼育記録をオンラインへ同期し、別の端末からも使えます。',
            confirmLabel: '無料登録へ',
            cancelLabel: 'あとで',
            details: []
        }, options || {});
        const registrationUrl = SetaeSettings.registration_url || '/?register=1&from=trial';

        if (!window.SetaeCore || typeof SetaeCore.confirmAction !== 'function') {
            window.location.assign(registrationUrl);
            return Promise.resolve(true);
        }

        return SetaeCore.confirmAction({
            title: settings.title,
            message: settings.message,
            confirmLabel: settings.confirmLabel,
            cancelLabel: settings.cancelLabel,
            details: settings.details
        }).then(function (confirmed) {
            if (confirmed) window.location.assign(registrationUrl);
            return confirmed;
        });
    }

    function handleLockedNavigation(event) {
        if (!isGuest()) return;
        const $item = $(event.currentTarget);
        if ($item.attr('data-guest-locked') !== '1') return;
        event.preventDefault();
        event.stopImmediatePropagation();
        promptGuestRegistration({
            title: '無料登録後に利用できます',
            message: '交流とベビー管理はアカウントに紐づく機能です。端末の体験データは登録後に同期できます。',
            confirmLabel: '無料登録へ'
        });
    }

    function handleGuestAccount() {
        if (window.SetaeSettings && SetaeSettings.offline_session) {
            SetaeCore.confirmAction({
                title: 'オフラインモード',
                message: 'この端末に保存済みの個体と飼育記録を利用しています。プロフィールや交流機能はオンラインに戻ると利用できます。',
                confirmLabel: '閉じる'
            });
            return;
        }
        promptGuestRegistration();
    }

    function handleDeepLink(url) {
        const target = new URL(url || window.location.href, window.location.origin);
        const view = target.searchParams.get('setae_view');
        const topicId = parseInt(target.searchParams.get('topic'), 10) || 0;
        if (view === 'community' && !isGuest()) {
            $('.setae-nav-item[data-target="section-care-feed"]').trigger('click');
            window.setTimeout(function () {
                $('.js-social-hub-tab[data-social-view="community"]').trigger('click');
                if (topicId && window.SetaeUI && typeof SetaeUI.openTopicDetail === 'function') {
                    SetaeUI.openTopicDetail(topicId);
                }
            }, 250);
        } else if (view === 'my') {
            $('.setae-nav-item[data-target="section-my"]').trigger('click');
        }
    }

    function bindEvents() {
        window.addEventListener('beforeinstallprompt', function (event) {
            event.preventDefault();
            installPrompt = event;
            refreshInstallButtons();
        });
        window.addEventListener('appinstalled', function () {
            installPrompt = null;
            refreshInstallButtons();
            SetaeCore.showToast('SETAEをホーム画面に追加しました', 'success');
        });
        window.addEventListener('online', function () {
            if (window.SetaeSettings && SetaeSettings.offline_session) {
                window.location.reload();
                return;
            }
            updateConnectivityIndicator({ syncing: true });
            syncNow();
        });
        window.addEventListener('offline', function () {
            updateConnectivityIndicator({ offline: true });
        });
        document.addEventListener('setae:offline-state', function (event) {
            updateConnectivityIndicator(event.detail || {});
        });
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.addEventListener('message', function (event) {
                if (!event.data) return;
                if (event.data.type === 'SETAE_SYNC_REQUEST') syncNow();
                if (event.data.type === 'SETAE_NOTIFICATION_OPEN') handleDeepLink(event.data.url);
            });
        }

        $(document).on('click', '.setae-pwa-install-action', promptInstall);
        $(document).on('click', '#setae-open-notification-settings', openNotificationSettings);
        $(document).on('click', '#setae-profile-trigger', function () {
            window.setTimeout(function () {
                renderNotificationModal();
                refreshInstallButtons();
            }, 0);
        });
        $(document).on('click', '.setae-pwa-settings-close', closeNotificationSettings);
        $(document).on('click', '#setae-pwa-settings-modal', function (event) {
            if (event.target === this) closeNotificationSettings();
        });
        $(document).on('keydown', function (event) {
            if (event.key === 'Escape' && $('#setae-pwa-settings-modal').is(':visible')) {
                closeNotificationSettings();
            }
        });
        $(document).on('click', '#setae-pwa-subscribe', toggleSubscription);
        $(document).on('submit', '#setae-pwa-preferences-form', savePushPreferences);
        $(document).on('click', '#setae-pwa-test-notification', sendTestNotification);
        $(document).on('click', '#setae-migrate-guest-data', migrateGuestData);
        $(document).on('click', '.setae-nav-item[data-guest-locked="1"]', handleLockedNavigation);
        $(document).on('click', '#setae-guest-account-trigger', handleGuestAccount);
    }

    function escapeAttribute(value) {
        return String(value || '')
            .replace(/&/g, '&amp;')
            .replace(/"/g, '&quot;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');
    }

    function init() {
        bindEvents();
        registerServiceWorker().then(function () {
            renderConnectivityIndicator();
            hydrateOfflineAccountShell();
            renderGuestExperience();
            renderAccountTools();
            checkGuestMigration();
            syncNow();
            handleDeepLink(window.location.href);
            if (serviceWorkerRegistration && serviceWorkerRegistration.active) {
                serviceWorkerRegistration.active.postMessage({ type: 'CLEAR_BADGE' });
            }
        });
    }

    $(document).ready(init);

    return {
        syncNow: syncNow,
        openNotificationSettings: openNotificationSettings,
        promptGuestRegistration: promptGuestRegistration
    };

})(jQuery);
