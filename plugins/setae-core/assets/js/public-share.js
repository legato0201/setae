/* Shared public sharing. Page adapters supply only the root and event names. */
(function () {
    'use strict';

    var mounted = new WeakSet();

    function mount(root, options) {
        if (!root || mounted.has(root)) return;
        mounted.add(root);
        options = options || {};
        var pending = new WeakSet();
        var menus = Array.from(root.querySelectorAll('[data-public-share-menu]'));
        var nativeAvailable = typeof navigator.share === 'function';

        function track(name) {
            if (!name) return;
            try {
                if (!window.SetaeCore || typeof window.SetaeCore.track !== 'function') return;
                var id = Number(root.getAttribute('data-share-id'));
                var result = window.SetaeCore.track(name, id > 0 && Number.isFinite(id) ? { id: id } : {});
                if (result && typeof result.catch === 'function') result.catch(function () {});
            } catch (error) {
                // Optional analytics must not affect sharing or navigation.
            }
        }

        function actionEvent(name) {
            if (options.eventPrefix) track(options.eventPrefix + '_' + name);
        }

        function statusFor(control) {
            var controls = control.closest('[data-public-share-controls]');
            if (controls && root.contains(controls)) {
                var status = controls.querySelector('[data-public-share-status]');
                if (status) return status;
            }
            return root.querySelector('[data-public-share-status]');
        }

        function announce(control, message, state) {
            var status = statusFor(control);
            if (!status) return;
            status.textContent = message;
            status.setAttribute('data-state', state || 'success');
        }

        function copyFallback(text) {
            var active = document.activeElement;
            var selection = window.getSelection ? window.getSelection() : null;
            var ranges = [];
            if (selection) {
                for (var index = 0; index < selection.rangeCount; index += 1) {
                    ranges.push(selection.getRangeAt(index).cloneRange());
                }
            }
            var helper = document.createElement('textarea');
            helper.className = 'setae-public-copy-helper';
            helper.value = text;
            helper.readOnly = true;
            helper.tabIndex = -1;
            helper.setAttribute('aria-hidden', 'true');
            document.body.appendChild(helper);
            try {
                helper.select();
                if (!document.execCommand('copy')) throw new Error('Copy unavailable');
            } finally {
                helper.remove();
                if (active && active.isConnected && typeof active.focus === 'function') active.focus({ preventScroll: true });
                if (selection && ranges.length) {
                    selection.removeAllRanges();
                    ranges.forEach(function (range) { selection.addRange(range); });
                }
            }
        }

        async function writeClipboard(text) {
            if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
                try {
                    await navigator.clipboard.writeText(text);
                    return;
                } catch (error) {
                    // Browsers can deny Clipboard permission; retain the DOM fallback.
                }
            }
            copyFallback(text);
        }

        async function copy(control, kind, fallback) {
            var text = root.getAttribute(kind === 'text' ? 'data-share-copy-text' : 'data-share-url') || '';
            if (!text) {
                announce(control, 'コピーする内容がありません。', 'error');
                return;
            }
            actionEvent(kind === 'text' ? 'text_copy' : 'link_copy');
            try {
                await writeClipboard(text);
                var message = !fallback && control.getAttribute('data-public-share-message');
                announce(control, message || (kind === 'text' ? '紹介文をコピーしました。' : 'リンクをコピーしました。'));
            } catch (error) {
                announce(control, 'コピーできませんでした。リンクや案内文を選択してコピーしてください。', 'error');
            }
        }

        async function share(control) {
            actionEvent('native_share');
            try {
                await navigator.share({
                    title: root.getAttribute('data-share-title') || '',
                    text: root.getAttribute('data-share-text') || '',
                    url: root.getAttribute('data-share-url') || ''
                });
                announce(control, control.getAttribute('data-public-share-message') || '共有しました。');
            } catch (error) {
                if (error && error.name === 'AbortError') return;
                await copy(control, 'link', true);
            }
        }

        root.querySelectorAll('[data-public-share-action="native"]').forEach(function (control) {
            control.hidden = !nativeAvailable;
        });

        root.addEventListener('click', async function (event) {
            var target = event.target && typeof event.target.closest === 'function' ? event.target : null;
            var control = target && target.closest('[data-public-share-action]');
            if (!control || !root.contains(control) || control.closest('[data-public-share-root]') !== root) return;
            var action = control.getAttribute('data-public-share-action');
            if (action === 'x' || action === 'line') {
                actionEvent(action + '_click');
                return; // Keep the real link, target and progressive navigation intact.
            }
            if (['native', 'link', 'text'].indexOf(action) === -1) return;
            event.preventDefault();
            if (pending.has(control) || control.disabled) return;
            pending.add(control);
            control.setAttribute('aria-busy', 'true');
            try {
                if (action === 'native') await share(control);
                else await copy(control, action, false);
            } finally {
                pending.delete(control);
                control.removeAttribute('aria-busy');
            }
        });

        root.addEventListener('keydown', function (event) {
            if (event.key !== 'Escape' || event.defaultPrevented) return;
            menus.forEach(function (menu) {
                if (!menu.open || !menu.contains(event.target)) return;
                menu.open = false;
                var summary = menu.querySelector('summary');
                if (summary) summary.focus();
                event.preventDefault();
            });
        });
        if (menus.length) {
            document.addEventListener('click', function (event) {
                menus.forEach(function (menu) {
                    if (menu.open && !menu.contains(event.target)) menu.open = false;
                });
            });
        }
        track(options.viewEvent);
    }

    window.SetaePublicShare = { mount: mount };
}());
