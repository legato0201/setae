var SetaeCore = (function ($) {
    'use strict';

    const offlineSessionKey = 'setae_offline_account_v1';
    if (typeof SetaeSettings !== 'undefined') {
        try {
            const currentUserId = parseInt(SetaeSettings.current_user_id, 10) || 0;
            if (currentUserId > 0 && !SetaeSettings.guest_mode) {
                localStorage.setItem(offlineSessionKey, JSON.stringify({
                    id: currentUserId,
                    current_user: SetaeSettings.current_user || {},
                    saved_at: new Date().toISOString()
                }));
            } else if (SetaeSettings.guest_mode && !navigator.onLine) {
                const offlineSession = JSON.parse(localStorage.getItem(offlineSessionKey) || 'null');
                if (offlineSession && parseInt(offlineSession.id, 10) > 0) {
                    SetaeSettings.current_user_id = parseInt(offlineSession.id, 10);
                    SetaeSettings.current_user = Object.assign(
                        {},
                        SetaeSettings.current_user || {},
                        offlineSession.current_user || {}
                    );
                    SetaeSettings.guest_mode = false;
                    SetaeSettings.offline_session = true;
                }
            }
        } catch (error) {
            // Private browsing can disable localStorage; IndexedDB remains feature-detected separately.
        }
    }

    const THEME_PREFERENCE_KEY = 'setae_theme_preference_v1';
    const CARE_FOCUS_PREFERENCE_KEY = 'setae_show_care_focus_v1';
    const systemThemeQuery = window.matchMedia
        ? window.matchMedia('(prefers-color-scheme: dark)')
        : null;
    let activeThemePreference = 'system';

    function normalizeThemePreference(preference) {
        return ['light', 'dark', 'system'].includes(preference) ? preference : 'system';
    }

    function getInitialThemePreference() {
        const currentUser = typeof SetaeSettings !== 'undefined'
            ? (SetaeSettings.current_user || {})
            : {};
        const hasSignedInPreference = typeof SetaeSettings !== 'undefined'
            && !SetaeSettings.guest_mode
            && currentUser.theme_preference;
        if (hasSignedInPreference) {
            return normalizeThemePreference(currentUser.theme_preference);
        }

        try {
            return normalizeThemePreference(localStorage.getItem(THEME_PREFERENCE_KEY));
        } catch (error) {
            return 'system';
        }
    }

    function applyThemePreference(preference, persist = true) {
        activeThemePreference = normalizeThemePreference(preference);
        const isDark = activeThemePreference === 'dark'
            || (activeThemePreference === 'system' && systemThemeQuery && systemThemeQuery.matches);
        const resolvedTheme = isDark ? 'dark' : 'light';

        document.documentElement.dataset.setaeThemePreference = activeThemePreference;
        document.documentElement.dataset.setaeTheme = resolvedTheme;
        document.documentElement.style.colorScheme = resolvedTheme;

        const themeColor = document.getElementById('setae-theme-color');
        if (themeColor) {
            const lightThemeColor = themeColor.getAttribute('data-light-color') || '#f5f7fa';
            themeColor.setAttribute('content', isDark ? '#101512' : lightThemeColor);
        }

        if (typeof SetaeSettings !== 'undefined' && SetaeSettings.current_user) {
            SetaeSettings.current_user.theme_preference = activeThemePreference;
        }
        if (persist) {
            try {
                localStorage.setItem(THEME_PREFERENCE_KEY, activeThemePreference);
            } catch (error) {}
        }

        if (typeof window.CustomEvent === 'function') {
            document.dispatchEvent(new CustomEvent('setae:themechange', {
                detail: {
                    preference: activeThemePreference,
                    resolvedTheme: resolvedTheme
                }
            }));
        }
        return resolvedTheme;
    }

    function normalizeCareFocusPreference(value) {
        return !(value === false || value === 0 || value === '0' || value === 'false' || value === 'off');
    }

    function getCareFocusPreference() {
        const currentUser = typeof SetaeSettings !== 'undefined'
            ? (SetaeSettings.current_user || {})
            : {};
        const hasSignedInPreference = typeof SetaeSettings !== 'undefined'
            && !SetaeSettings.guest_mode
            && Object.prototype.hasOwnProperty.call(currentUser, 'show_care_focus');
        if (hasSignedInPreference) {
            return normalizeCareFocusPreference(currentUser.show_care_focus);
        }

        try {
            const storedPreference = localStorage.getItem(CARE_FOCUS_PREFERENCE_KEY);
            return storedPreference === null ? true : normalizeCareFocusPreference(storedPreference);
        } catch (error) {
            return true;
        }
    }

    function setCareFocusPreference(showCareFocus, persist = true) {
        const normalized = normalizeCareFocusPreference(showCareFocus);
        if (typeof SetaeSettings !== 'undefined' && SetaeSettings.current_user) {
            SetaeSettings.current_user.show_care_focus = normalized;
        }
        if (persist) {
            try {
                localStorage.setItem(CARE_FOCUS_PREFERENCE_KEY, normalized ? '1' : '0');
            } catch (error) {}
        }
        return normalized;
    }

    applyThemePreference(getInitialThemePreference(), true);
    if (systemThemeQuery) {
        const handleSystemThemeChange = function () {
            if (activeThemePreference === 'system') applyThemePreference('system', false);
        };
        if (typeof systemThemeQuery.addEventListener === 'function') {
            systemThemeQuery.addEventListener('change', handleSystemThemeChange);
        } else if (typeof systemThemeQuery.addListener === 'function') {
            systemThemeQuery.addListener(handleSystemThemeChange);
        }
    }

    let toastSequence = 0;
    let activeDialog = null;

    // State Management
    let state = {
        apiRoot: (typeof SetaeSettings !== 'undefined') ? SetaeSettings.api_root + 'setae/v1' : '',
        nonce: (typeof SetaeSettings !== 'undefined') ? SetaeSettings.nonce : '',
        currentUserId: (typeof SetaeSettings !== 'undefined') ? SetaeSettings.current_user_id : 0, // ★Added: Store User ID
        cachedSpiders: [],
        mySpidersLoaded: false,
        currentDeck: localStorage.getItem('setae_my_deck') || 'all',
        currentViewMode: localStorage.getItem('setae_my_view') || 'list',
        currentSort: localStorage.getItem('setae_my_sort') || 'hungriest',
        currentSearch: localStorage.getItem('setae_my_search') || '',
        careSummary: null,

        // Encyclopedia State
        encSearch: localStorage.getItem('setae_enc_search') || '',
        encFilter: localStorage.getItem('setae_enc_filter') || 'all',
        encSort: localStorage.getItem('setae_enc_sort') || 'name',

        feedTypes: (() => {
            const saved = localStorage.getItem('setae_feed_types');
            if (saved) {
                try { return JSON.parse(saved); } catch(e) {}
            }
            return (typeof SetaeSettings !== 'undefined' && SetaeSettings.feed_types) ? SetaeSettings.feed_types : [
                'ショウジョウバエ',
                'コオロギ',
                'レッドローチ',
                'デュビア',
                'ピンキー'
            ];
        })()
    };

    // Global Utilities
    function getToastContainer() {
        let $container = $('#setae-toast-container');
        if (!$container.length) {
            $container = $('<div id="setae-toast-container" aria-label="通知"></div>');
            $('body').append($container);
        }
        return $container;
    }

    function dismissToast($toast) {
        if (!$toast || !$toast.length || $toast.hasClass('is-leaving')) return;

        const timer = $toast.data('dismissTimer');
        if (timer) window.clearTimeout(timer);
        $toast.addClass('is-leaving');
        window.setTimeout(function () {
            $toast.remove();
        }, 220);
    }

    function showToast(message, type = 'info', options = {}) {
        const safeType = ['success', 'error', 'warning', 'info'].includes(type) ? type : 'info';
        const text = String(message || '').trim();
        if (!text) return null;

        const $container = getToastContainer();
        const duplicate = $container.children('.setae-toast').filter(function () {
            return $(this).attr('data-message') === text && !$(this).hasClass('is-leaving');
        }).first();

        if (duplicate.length) {
            const count = (parseInt(duplicate.attr('data-count'), 10) || 1) + 1;
            duplicate.attr('data-count', count);
            duplicate.find('.setae-toast-count').text(count > 1 ? `x${count}` : '').prop('hidden', count <= 1);
            const previousTimer = duplicate.data('dismissTimer');
            if (previousTimer) window.clearTimeout(previousTimer);
            const duplicateTimer = window.setTimeout(function () {
                dismissToast(duplicate);
            }, safeType === 'error' ? 6000 : 3800);
            duplicate.data('dismissTimer', duplicateTimer);
            return duplicate;
        }

        toastSequence += 1;
        const toastId = `setae-toast-${toastSequence}`;
        const role = safeType === 'error' ? 'alert' : 'status';
        const $toast = $(
            `<div id="${toastId}" class="setae-toast ${safeType}" role="${role}" aria-atomic="true">
                <span class="setae-toast-mark" aria-hidden="true"></span>
                <span class="setae-toast-message"></span>
                <span class="setae-toast-count" hidden></span>
                <button type="button" class="setae-toast-close" aria-label="通知を閉じる">&times;</button>
            </div>`
        );
        $toast.attr({ 'data-message': text, 'data-count': '1' });
        $toast.find('.setae-toast-message').text(text);
        $toast.find('.setae-toast-close').on('click', function () {
            dismissToast($toast);
        });
        $container.append($toast);

        const duration = Number.isFinite(options.duration)
            ? Math.max(1500, options.duration)
            : (safeType === 'error' ? 6000 : 3800);
        if (!options.persistent) {
            const timer = window.setTimeout(function () {
                dismissToast($toast);
            }, duration);
            $toast.data('dismissTimer', timer);
        }

        return $toast;
    }

    function announce(message, priority = 'polite') {
        const text = String(message || '').trim();
        if (!text) return;

        const regionId = priority === 'assertive' ? 'setae-live-region-alert' : 'setae-live-region';
        let $region = $('#' + regionId);
        if (!$region.length) {
            $region = $('<div class="setae-visually-hidden"></div>').attr({
                id: regionId,
                'aria-live': priority === 'assertive' ? 'assertive' : 'polite',
                'aria-atomic': 'true'
            });
            $('body').append($region);
        }

        $region.text('');
        window.setTimeout(function () {
            $region.text(text);
        }, 20);
    }

    function getFocusableElements($root) {
        return $root.find([
            'a[href]',
            'button:not([disabled])',
            'input:not([disabled])',
            'select:not([disabled])',
            'textarea:not([disabled])',
            '[tabindex]:not([tabindex="-1"])'
        ].join(',')).filter(':visible');
    }

    function closeDialog(result) {
        if (!activeDialog) return;

        const dialog = activeDialog;
        activeDialog = null;
        $(document).off('.setaeCoreDialog');
        dialog.$overlay.removeClass('is-open').attr('aria-hidden', 'true');
        $('body').removeClass('setae-dialog-open');

        window.setTimeout(function () {
            dialog.$overlay.remove();
        }, 180);

        if (dialog.trigger && document.contains(dialog.trigger)) {
            dialog.trigger.focus();
        }
        dialog.resolve(result);
    }

    function openDialog(options = {}) {
        if (activeDialog) closeDialog(activeDialog.mode === 'input' ? null : false);

        const mode = options.mode === 'input' ? 'input' : 'confirm';
        const tone = options.tone === 'danger' ? 'danger' : 'primary';
        const title = String(options.title || (mode === 'input' ? '入力' : '確認'));
        const message = String(options.message || 'この操作を続けますか？');
        const confirmLabel = String(options.confirmLabel || (mode === 'input' ? '決定' : '続ける'));
        const cancelLabel = String(options.cancelLabel || 'キャンセル');
        const dialogId = `setae-core-dialog-${Date.now()}`;
        const titleId = dialogId + '-title';
        const descriptionId = dialogId + '-description';
        const inputId = dialogId + '-input';
        const trigger = document.activeElement;

        return new Promise(function (resolve) {
            const $overlay = $(
                `<div class="setae-ux-dialog" aria-hidden="true">
                    <div class="setae-ux-dialog-panel is-${tone}" role="${tone === 'danger' ? 'alertdialog' : 'dialog'}" aria-modal="true" aria-labelledby="${titleId}" aria-describedby="${descriptionId}">
                        <button type="button" class="setae-ux-dialog-close" aria-label="閉じる">&times;</button>
                        <div class="setae-ux-dialog-heading">
                            <span class="setae-ux-dialog-mark" aria-hidden="true"></span>
                            <div>
                                <span class="setae-ux-dialog-kicker">${tone === 'danger' ? 'CAUTION' : 'CONFIRM'}</span>
                                <h2 id="${titleId}"></h2>
                            </div>
                        </div>
                        <p id="${descriptionId}" class="setae-ux-dialog-message"></p>
                        <form class="setae-ux-dialog-form" novalidate>
                            <div class="setae-ux-dialog-input-wrap" hidden>
                                <label for="${inputId}"></label>
                                <textarea id="${inputId}" rows="3"></textarea>
                                <span class="setae-ux-dialog-input-error" role="alert" hidden></span>
                            </div>
                            <div class="setae-ux-dialog-actions">
                                <button type="button" class="setae-ux-dialog-cancel"></button>
                                <button type="submit" class="setae-ux-dialog-confirm"></button>
                            </div>
                        </form>
                    </div>
                </div>`
            );

            $overlay.find('#' + titleId).text(title);
            $overlay.find('#' + descriptionId).text(message);
            $overlay.find('.setae-ux-dialog-cancel').text(cancelLabel);
            $overlay.find('.setae-ux-dialog-confirm').text(confirmLabel);

            if (Array.isArray(options.details) && options.details.length) {
                const $details = $('<ul class="setae-ux-dialog-details"></ul>');
                options.details.filter(Boolean).forEach(function (detail) {
                    $('<li></li>').text(String(detail)).appendTo($details);
                });
                $details.insertAfter($overlay.find('.setae-ux-dialog-message'));
            }

            if (mode === 'input') {
                const $wrap = $overlay.find('.setae-ux-dialog-input-wrap').prop('hidden', false);
                const $input = $wrap.find('textarea');
                $wrap.find('label').text(String(options.inputLabel || '入力内容'));
                $input.attr({
                    placeholder: String(options.placeholder || ''),
                    maxlength: Math.max(1, parseInt(options.maxLength, 10) || 500)
                }).val(String(options.value || ''));
                if (options.multiline === false) {
                    $input.attr('rows', '1').addClass('is-single-line');
                    $input.on('keydown', function (event) {
                        if (event.key !== 'Enter' || event.shiftKey || event.isComposing) return;
                        event.preventDefault();
                        $overlay.find('.setae-ux-dialog-form').trigger('submit');
                    });
                }
            }

            $('body').append($overlay).addClass('setae-dialog-open');
            activeDialog = { $overlay: $overlay, resolve: resolve, trigger: trigger, mode: mode };
            window.requestAnimationFrame(function () {
                $overlay.addClass('is-open').attr('aria-hidden', 'false');
                const $focusTarget = mode === 'input'
                    ? $overlay.find('.setae-ux-dialog-input-wrap textarea')
                    : $overlay.find('.setae-ux-dialog-confirm');
                $focusTarget.trigger('focus');
                if (mode === 'input') $focusTarget[0].setSelectionRange($focusTarget.val().length, $focusTarget.val().length);
            });

            $overlay.on('click', function (event) {
                if (event.target === this) closeDialog(mode === 'input' ? null : false);
            });
            $overlay.find('.setae-ux-dialog-close, .setae-ux-dialog-cancel').on('click', function () {
                closeDialog(mode === 'input' ? null : false);
            });
            $overlay.find('.setae-ux-dialog-form').on('submit', function (event) {
                event.preventDefault();
                if (mode !== 'input') {
                    closeDialog(true);
                    return;
                }

                const $input = $overlay.find('.setae-ux-dialog-input-wrap textarea');
                const value = String($input.val() || '').trim();
                const $error = $overlay.find('.setae-ux-dialog-input-error');
                if (options.required && !value) {
                    $error.text(String(options.requiredMessage || '入力してください。')).prop('hidden', false);
                    $input.attr('aria-invalid', 'true').trigger('focus');
                    return;
                }
                $error.prop('hidden', true);
                $input.removeAttr('aria-invalid');
                closeDialog(value);
            });

            $(document).on('keydown.setaeCoreDialog', function (event) {
                if (!activeDialog || activeDialog.$overlay[0] !== $overlay[0]) return;

                if (event.key === 'Escape') {
                    event.preventDefault();
                    closeDialog(mode === 'input' ? null : false);
                    return;
                }
                if (event.key !== 'Tab') return;

                const $focusable = getFocusableElements($overlay);
                if (!$focusable.length) return;
                const first = $focusable[0];
                const last = $focusable[$focusable.length - 1];
                if (event.shiftKey && document.activeElement === first) {
                    event.preventDefault();
                    last.focus();
                } else if (!event.shiftKey && document.activeElement === last) {
                    event.preventDefault();
                    first.focus();
                }
            });
        });
    }

    function confirmAction(options) {
        if (typeof options === 'string') options = { message: options };
        return openDialog(Object.assign({}, options || {}, { mode: 'confirm' }));
    }

    function requestText(options) {
        if (typeof options === 'string') options = { message: options };
        return openDialog(Object.assign({}, options || {}, { mode: 'input' }));
    }

    function copyText(value) {
        const text = String(value || '');
        if (!text) return Promise.reject(new Error('empty_text'));

        if (navigator.clipboard && window.isSecureContext) {
            return navigator.clipboard.writeText(text);
        }

        return new Promise(function (resolve, reject) {
            const textarea = document.createElement('textarea');
            textarea.value = text;
            textarea.setAttribute('readonly', 'readonly');
            textarea.style.position = 'fixed';
            textarea.style.opacity = '0';
            textarea.style.pointerEvents = 'none';
            document.body.appendChild(textarea);
            textarea.select();

            try {
                const copied = document.execCommand('copy');
                textarea.remove();
                if (copied) resolve();
                else reject(new Error('copy_failed'));
            } catch (error) {
                textarea.remove();
                reject(error);
            }
        });
    }

    function getErrorMessage(xhr, fallback) {
        if (xhr && xhr.responseJSON && xhr.responseJSON.message) {
            return String(xhr.responseJSON.message);
        }
        if (xhr && xhr.statusText === 'timeout') {
            return '通信に時間がかかっています。入力内容はそのままなので、もう一度お試しください。';
        }
        return String(fallback || '処理に失敗しました。時間をおいてもう一度お試しください。');
    }

    function setButtonBusy(target, busy, label) {
        const $buttons = $(target);
        $buttons.each(function () {
            const $button = $(this);
            if (busy) {
                if ($button.data('setaeOriginalHtml') === undefined) {
                    $button.data('setaeOriginalHtml', $button.html());
                    $button.data('setaeOriginalDisabled', $button.prop('disabled'));
                }
                if (label) $button.text(label);
                $button.prop('disabled', true).attr('aria-busy', 'true').addClass('is-busy');
            } else {
                const originalHtml = $button.data('setaeOriginalHtml');
                if (originalHtml !== undefined) $button.html(originalHtml);
                $button.prop('disabled', !!$button.data('setaeOriginalDisabled'))
                    .removeAttr('aria-busy')
                    .removeClass('is-busy')
                    .removeData('setaeOriginalHtml')
                    .removeData('setaeOriginalDisabled');
            }
        });
    }

    function track(eventName, payload = {}) {
        if (!eventName || typeof SetaeSettings === 'undefined' || !SetaeSettings.ajax_url) return;

        const data = {
            action: 'setae_track_event',
            event: eventName,
            path: window.location.pathname,
            payload: JSON.stringify(payload || {})
        };

        try {
            const formData = new FormData();
            Object.keys(data).forEach(key => formData.append(key, data[key]));

            if (navigator.sendBeacon) {
                navigator.sendBeacon(SetaeSettings.ajax_url, formData);
                return;
            }
        } catch (e) {
            // Fall through to jQuery below.
        }

        $.ajax({
            url: SetaeSettings.ajax_url,
            type: 'POST',
            data: data
        });
    }

    function decodeHtmlEntities(value) {
        let text = String(value == null ? '' : value);
        if (text.indexOf('&') === -1 || typeof document === 'undefined') return text;

        const decoder = document.createElement('textarea');
        for (let pass = 0; pass < 2; pass++) {
            decoder.innerHTML = text;
            const decoded = decoder.value;
            if (decoded === text) break;
            text = decoded;
        }

        return text;
    }

    function normalizeSpiderDisplayFields(spider) {
        if (!spider || typeof spider !== 'object') return spider;

        const normalized = Object.assign({}, spider);
        ['title', 'nickname', 'species', 'species_name', 'scientific_name'].forEach(function (key) {
            if (typeof normalized[key] === 'string') {
                normalized[key] = decodeHtmlEntities(normalized[key]);
            }
        });
        return normalized;
    }

    function formatDateShort(dateStr) {
        if (!dateStr) return null;
        const parts = dateStr.split('-');
        if (parts.length === 3) return `${parts[1]}.${parts[2]}`; // MM.DD
        return dateStr;
    }

    function formatRelativeDate(dateStr) {
        if (!dateStr) return '-';

        // Safari/iOS対策: "YYYY-MM-DD" を "YYYY/MM/DD" に置換してからパースする
        const safeDateStr = dateStr.replace(/-/g, '/');
        const date = new Date(safeDateStr);

        if (isNaN(date.getTime())) return '-';

        const i18n = (typeof setaeI18n !== 'undefined') ? setaeI18n : {};
        const now = new Date();

        // 1. 時刻情報が含まれているか判定 (例: "2026-02-19 14:30:00" なら length > 10)
        // 時刻が含まれているデータ（ログやコメントなど）にのみ、細かい時間表記を適用する
        const hasTime = dateStr.trim().length > 10;

        if (hasTime) {
            const diffMs = now - date;
            const diffSec = Math.floor(diffMs / 1000);
            const diffMin = Math.floor(diffSec / 60);
            const diffHour = Math.floor(diffMin / 60);

            // 未来の時間が渡された場合の保護（端末の時計ズレなど）
            if (diffSec >= 0) {
                if (diffSec < 60) return i18n.just_now || 'たった今';
                if (diffMin < 60) return diffMin + (i18n.mins_ago || '分前');
                if (diffHour < 24) return diffHour + (i18n.hours_ago || '時間前');
            }
        }

        // 2. 日付のみのデータ、または24時間以上経過したデータは、時刻を0時にして「日数差」を出す
        now.setHours(0, 0, 0, 0);
        const targetDate = new Date(date);
        targetDate.setHours(0, 0, 0, 0);

        const diffTime = Math.abs(now - targetDate);
        const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

        if (diffDays === 0) return i18n.today || '今日';
        if (diffDays === 1) return i18n.yesterday || '昨日';
        if (diffDays < 30) return diffDays + (i18n.days_ago || '日前');
        if (diffDays < 365) return Math.floor(diffDays / 30) + (i18n.months_ago || 'ヶ月前');
        return Math.floor(diffDays / 365) + (i18n.years_ago || '年前');
    }

    // Public Interface
    return {
        state: state,
        showToast: showToast,
        announce: announce,
        confirmAction: confirmAction,
        requestText: requestText,
        copyText: copyText,
        applyThemePreference: applyThemePreference,
        getThemePreference: function () { return activeThemePreference; },
        getCareFocusPreference: getCareFocusPreference,
        setCareFocusPreference: setCareFocusPreference,
        getErrorMessage: getErrorMessage,
        setButtonBusy: setButtonBusy,
        track: track,
        decodeHtmlEntities: decodeHtmlEntities,
        normalizeSpiderDisplayFields: normalizeSpiderDisplayFields,
        formatDateShort: formatDateShort,
        formatRelativeDate: formatRelativeDate
    };

})(jQuery);
