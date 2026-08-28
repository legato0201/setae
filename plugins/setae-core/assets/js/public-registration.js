(function () {
    'use strict';

    var REFERRAL_STORAGE_KEY = 'setae_referral_code';
    var REFERRAL_SOURCE_STORAGE_KEY = 'setae_referral_source';

    function normalizeCode(value) {
        return String(value || '').trim().slice(0, 64);
    }

    function normalizeSource(value) {
        return String(value || '').trim().toLowerCase().replace(/[^a-z0-9_.-]/g, '_').slice(0, 48);
    }

    function readStored(key) {
        try { return window.localStorage.getItem(key) || ''; } catch (error) { return ''; }
    }

    function remember(key, value) {
        if (!value) return;
        try { window.localStorage.setItem(key, value); } catch (error) { /* Optional referral storage. */ }
    }

    function init(dialog) {
        if (dialog.dataset.registrationReady === 'true') return;
        var form = dialog.querySelector('[data-public-register-form]');
        if (!form) return;
        dialog.dataset.registrationReady = 'true';
        var errorRegion = dialog.querySelector('[data-public-register-error]');
        var status = dialog.querySelector('[data-public-register-status]');
        var submit = dialog.querySelector('[data-public-register-submit]');
        var submitLabel = submit && submit.textContent.trim() || '登録する';
        var notice = document.getElementById(dialog.id + '-notice');
        var source = dialog.dataset.source || 'public_profile';
        var openTrigger = null;
        var busy = false;
        var disabledSnapshot = [];
        var backdropPointerDown = false;
        var params = new URLSearchParams(window.location.search);
        var referral = form.elements.namedItem('referral_code');
        var referralSource = form.elements.namedItem('referral_source');
        var incomingCode = normalizeCode(params.get('ref') || params.get('referral_code'));
        var incomingSource = normalizeSource(params.get('src') || params.get('ref_src') || params.get('utm_source'));

        // Server context wins for profile/partner codes. Stored referral values are a fallback only.
        if (referral && !referral.value) {
            referral.value = incomingCode || normalizeCode(readStored(REFERRAL_STORAGE_KEY));
        }
        if (referralSource && referralSource.value === source && !incomingSource) {
            referralSource.value = normalizeSource(readStored(REFERRAL_SOURCE_STORAGE_KEY)) || source;
        }
        if (incomingSource && referralSource) referralSource.value = incomingSource;
        if (referral && referral.value) {
            remember(REFERRAL_STORAGE_KEY, normalizeCode(referral.value));
            var helper = dialog.querySelector('[data-public-register-referral-help]');
            if (helper) helper.textContent = '紹介コードを入力済みです。必要に応じて変更できます。';
            track('register_referral_prefill');
        }
        if (incomingSource) remember(REFERRAL_SOURCE_STORAGE_KEY, incomingSource);

        function track(eventName, extra) {
            if (!window.SetaeCore || typeof window.SetaeCore.track !== 'function') return;
            try {
                window.SetaeCore.track(eventName, Object.assign({
                    source: source,
                    id: Number(dialog.dataset.analyticsId || 0)
                }, extra || {}));
            } catch (error) { /* Analytics must not interrupt registration. */ }
        }

        function focusableElements() {
            return Array.prototype.slice.call(dialog.querySelectorAll('a[href], button, input:not([type="hidden"]), select, textarea, [tabindex]'))
                .filter(function (element) {
                    return !element.disabled && element.tabIndex >= 0 && !element.hidden
                        && !element.closest('[hidden], [inert]') && element.getClientRects().length > 0
                        && window.getComputedStyle(element).visibility !== 'hidden';
                });
        }

        function focusReturn() {
            var trigger = openTrigger;
            openTrigger = null;
            if (trigger && trigger.isConnected && typeof trigger.focus === 'function') {
                window.requestAnimationFrame(function () { trigger.focus({ preventScroll: true }); });
            }
        }

        function clearError() {
            if (!errorRegion) return;
            errorRegion.textContent = '';
            errorRegion.hidden = true;
            form.querySelectorAll('[aria-invalid="true"]').forEach(function (field) {
                field.removeAttribute('aria-invalid');
            });
        }

        function showError(message) {
            if (!errorRegion) return;
            errorRegion.textContent = message || '登録できませんでした。入力内容を確認してください。';
            errorRegion.hidden = false;
            errorRegion.focus({ preventScroll: true });
            errorRegion.scrollIntoView({ block: 'nearest' });
        }

        function setBusy(next) {
            if (busy === Boolean(next)) return;
            busy = Boolean(next);
            dialog.dataset.busy = busy ? 'true' : 'false';
            form.setAttribute('aria-busy', busy ? 'true' : 'false');
            if (busy) {
                var controls = Array.prototype.slice.call(form.elements)
                    .concat(Array.prototype.slice.call(dialog.querySelectorAll('[data-public-register-close]')));
                disabledSnapshot = controls.filter(function (control, index) {
                    return controls.indexOf(control) === index;
                }).map(function (control) {
                    return { control: control, disabled: control.disabled };
                });
                disabledSnapshot.forEach(function (item) { item.control.disabled = true; });
                // A disabled submit cannot retain a keyboard focus anchor.
                dialog.focus({ preventScroll: true });
            } else {
                disabledSnapshot.forEach(function (item) {
                    if (item.control.isConnected) item.control.disabled = item.disabled;
                });
                disabledSnapshot = [];
            }
            if (submit) submit.textContent = busy ? '登録中…' : submitLabel;
            if (status) status.textContent = busy ? '登録情報を送信しています。' : '';
        }

        function openRegistration(trigger) {
            // Retain the real registration href as a fallback in browsers without native dialog.
            if (typeof dialog.showModal !== 'function') return false;
            if (dialog.open) return true;
            openTrigger = trigger || document.activeElement;
            clearError();
            if (notice) notice.textContent = '';
            dialog.showModal();
            var mobile = window.matchMedia && window.matchMedia('(max-width: 767px)').matches;
            window.requestAnimationFrame(function () {
                var target = mobile ? dialog : form.elements.namedItem('email');
                if (target && dialog.open) target.focus({ preventScroll: true });
            });
            track('register_start', {
                referral: Boolean(referral && normalizeCode(referral.value)),
                referral_source: referralSource ? referralSource.value : source
            });
            return true;
        }

        function closeRegistration() {
            if (busy || !dialog.open) return false;
            dialog.close();
            focusReturn();
            return true;
        }

        function isBackdrop(event) {
            if (event.target !== dialog) return false;
            var bounds = dialog.getBoundingClientRect();
            return event.clientX < bounds.left || event.clientX > bounds.right
                || event.clientY < bounds.top || event.clientY > bounds.bottom;
        }

        function responseMessage(response) {
            var data = response && response.data;
            if (typeof data === 'string' && data) return data;
            if (data && typeof data.message === 'string') return data.message;
            return '登録できませんでした。入力内容を確認してください。';
        }

        document.addEventListener('click', function (event) {
            var trigger = event.target.closest('[data-public-register]');
            if (!trigger) return;
            var targetId = trigger.getAttribute('aria-controls');
            if (targetId ? targetId !== dialog.id : document.querySelector('[data-public-registration]') !== dialog) return;
            if (openRegistration(trigger)) event.preventDefault();
        });

        dialog.querySelectorAll('[data-public-register-close]').forEach(function (button) {
            button.addEventListener('click', closeRegistration);
        });
        dialog.addEventListener('cancel', function (event) {
            event.preventDefault();
            closeRegistration();
        });
        dialog.addEventListener('close', function () {
            if (!busy) focusReturn();
        });
        dialog.addEventListener('pointerdown', function (event) { backdropPointerDown = isBackdrop(event); });
        dialog.addEventListener('click', function (event) {
            if (backdropPointerDown && isBackdrop(event)) closeRegistration();
            backdropPointerDown = false;
        });
        dialog.addEventListener('keydown', function (event) {
            if (event.key === 'Escape') {
                event.preventDefault();
                closeRegistration();
                return;
            }
            if (event.key !== 'Tab') return;
            var focusable = focusableElements();
            if (busy || !focusable.length) {
                event.preventDefault();
                dialog.focus({ preventScroll: true });
                return;
            }
            var first = focusable[0];
            var last = focusable[focusable.length - 1];
            var activeIndex = focusable.indexOf(document.activeElement);
            if (event.shiftKey && (activeIndex <= 0)) {
                event.preventDefault();
                last.focus();
            } else if (!event.shiftKey && (activeIndex === -1 || document.activeElement === last)) {
                event.preventDefault();
                first.focus();
            }
        });

        form.addEventListener('input', clearError);
        form.addEventListener('submit', function (event) {
            event.preventDefault();
            if (busy) return;
            clearError();
            if (!form.checkValidity()) {
                Array.prototype.forEach.call(form.elements, function (field) {
                    if (field.validity && !field.validity.valid) field.setAttribute('aria-invalid', 'true');
                });
                showError('メールアドレス、6文字以上のパスワード、利用規約への同意を確認してください。');
                return;
            }

            // Read all values before disabling controls; never persist form data or passwords.
            var data = new FormData(form);
            var payload = new URLSearchParams();
            payload.set('action', 'setae_register_user');
            ['username', 'email', 'password', 'referral_code', 'referral_source', 'terms_version', 'qr_claim_code'].forEach(function (name) {
                payload.set(name, String(data.get(name) || ''));
            });
            if (data.get('qr_claim_intent') === 'request_after_verification') {
                payload.set('qr_claim_intent', 'request_after_verification');
            }
            if (data.get('return_url')) payload.set('return_url', String(data.get('return_url')));
            payload.set('terms_accepted', data.get('terms_accepted') ? '1' : '0');
            var hasReferral = Boolean(normalizeCode(data.get('referral_code')));
            var submittedSource = String(data.get('referral_source') || source);
            setBusy(true);

            fetch(dialog.dataset.ajaxUrl || '/wp-admin/admin-ajax.php', {
                method: 'POST',
                credentials: 'same-origin',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' },
                body: payload.toString()
            }).then(function (response) {
                return response.json().catch(function () { return null; }).then(function (json) {
                    if (!response.ok || !json || !json.success) throw new Error(responseMessage(json));
                    return json;
                });
            }).then(function () {
                track('register_submit_success', { referral: hasReferral, referral_source: submittedSource });
                if (hasReferral) track('register_referral_submit_success');
                try {
                    window.localStorage.removeItem(REFERRAL_SOURCE_STORAGE_KEY);
                    if (hasReferral) window.localStorage.removeItem(REFERRAL_STORAGE_KEY);
                } catch (error) { /* Optional referral storage. */ }
                setBusy(false);
                closeRegistration();
                form.reset();
                if (notice) notice.textContent = dialog.dataset.successMessage
                    || '仮登録が完了しました。認証メールをご確認ください。';
            }).catch(function (error) {
                setBusy(false);
                showError(error && error.name !== 'TypeError' && error.message ? error.message
                    : '通信状態を確認して、もう一度お試しください。');
            });
        });

        if (params.get('register') === '1' && document.querySelector('[data-public-registration]') === dialog) {
            openRegistration(document.querySelector('[data-public-register]'));
        }
    }

    document.querySelectorAll('[data-public-registration]').forEach(init);
}());
