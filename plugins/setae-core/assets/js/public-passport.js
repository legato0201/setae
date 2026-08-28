(function () {
    'use strict';

    function ready(callback) {
        if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', callback, { once: true });
        else callback();
    }

    ready(function () {
        document.querySelectorAll('.setae-qr-public-page').forEach(function (root) {
            var shareData = {
                title: root.getAttribute('data-public-share-title') || document.title,
                text: root.getAttribute('data-public-share-text') || '',
                url: root.getAttribute('data-public-share-url') || ''
            };
            var status = root.querySelector('[data-setae-public-toast]');
            var statusTimer = 0;
            var shareBusy = false;

            function announce(message) {
                if (!status) return;
                window.clearTimeout(statusTimer);
                status.textContent = '';
                status.classList.add('is-visible');
                // A second identical copy must still produce an accessible update.
                window.setTimeout(function () { status.textContent = message; }, 20);
                statusTimer = window.setTimeout(function () { status.classList.remove('is-visible'); }, 5000);
            }

            function fallbackCopy(value) {
                var active = document.activeElement;
                var input = document.createElement('textarea');
                input.className = 'setae-public-copy-helper';
                input.value = value;
                input.setAttribute('readonly', '');
                input.setAttribute('aria-label', 'コピーする公開URL');
                document.body.appendChild(input);
                input.select();
                input.setSelectionRange(0, input.value.length);
                var copied = false;
                try { copied = Boolean(document.execCommand('copy')); } catch (error) { copied = false; }
                input.remove();
                if (active && active.isConnected && typeof active.focus === 'function') active.focus({ preventScroll: true });
                return copied;
            }

            async function copyUrl() {
                if (!shareData.url) return;
                var copied = false;
                if (navigator.clipboard && window.isSecureContext) {
                    try { await navigator.clipboard.writeText(shareData.url); copied = true; } catch (error) { /* Try the local fallback. */ }
                }
                if (!copied) copied = fallbackCopy(shareData.url);
                announce(copied ? 'リンクをコピーしました' : 'コピーできませんでした。ブラウザーのアドレス欄からURLをコピーしてください。');
            }

            root.querySelectorAll('[data-setae-public-copy]').forEach(function (button) {
                button.addEventListener('click', function () { copyUrl(); });
            });
            root.querySelectorAll('[data-setae-public-share]').forEach(function (button) {
                button.addEventListener('click', async function () {
                    if (shareBusy || !shareData.url) return;
                    shareBusy = true;
                    try {
                        if (typeof navigator.share !== 'function') { await copyUrl(); return; }
                        try { await navigator.share(shareData); }
                        catch (error) { if (!error || error.name !== 'AbortError') await copyUrl(); }
                    } finally { shareBusy = false; }
                });
            });

            // Native POST remains authoritative. Disabled submit control is not a payload field.
            root.querySelectorAll('[data-setae-public-claim]').forEach(function (form) {
                var pending = false;
                var submit = form.querySelector('button[type="submit"]');
                var original = submit ? submit.textContent : '';
                var claimStatus = form.querySelector('[data-setae-public-claim-status]');
                form.addEventListener('submit', function (event) {
                    if (pending) { event.preventDefault(); return; }
                    pending = true;
                    form.setAttribute('aria-busy', 'true');
                    if (submit) { submit.disabled = true; submit.textContent = '申請中…'; }
                    if (claimStatus) claimStatus.textContent = '引き継ぎ申請を送信しています';
                });
                window.addEventListener('pageshow', function () {
                    pending = false;
                    form.removeAttribute('aria-busy');
                    if (submit) { submit.disabled = false; submit.textContent = original; }
                    if (claimStatus) claimStatus.textContent = '';
                });
            });

            var dataNode = root.querySelector('[data-setae-public-photo-data]');
            var dialog = root.querySelector('[data-setae-public-photo-dialog]');
            if (!dataNode || !dialog) return;
            var photos;
            try { photos = JSON.parse(dataNode.textContent || '[]'); } catch (error) { photos = []; }
            if (!Array.isArray(photos) || !photos.length) return;
            photos = photos.filter(function (photo) {
                if (!photo || typeof photo.url !== 'string') return false;
                try { return /^(https?:)$/.test(new URL(photo.url, document.baseURI).protocol); } catch (error) { return false; }
            });
            if (!photos.length) return;

            var image = dialog.querySelector('[data-setae-public-photo-image]');
            var label = dialog.querySelector('[data-setae-public-photo-label]');
            var date = dialog.querySelector('[data-setae-public-photo-date]');
            var count = dialog.querySelector('[data-setae-public-photo-count]');
            var close = dialog.querySelector('[data-setae-public-photo-close]');
            var previous = dialog.querySelector('[data-setae-public-photo-prev]');
            var next = dialog.querySelector('[data-setae-public-photo-next]');
            var index = 0;
            var opener = null;
            var preloads = [];
            var backdropStarted = false;

            function showPhoto(nextIndex) {
                index = (nextIndex + photos.length) % photos.length;
                var photo = photos[index];
                image.src = photo.url;
                image.alt = photo.label || '個体の写真';
                label.textContent = photo.label || '個体の写真';
                count.textContent = '写真' + (index + 1) + ' / ' + photos.length + '点';
                var hasDate = /^\d{4}-\d{2}-\d{2}$/.test(photo.date || '');
                date.textContent = hasDate ? photo.date.replace(/-/g, '.') : '';
                date.dateTime = hasDate ? photo.date : '';
                date.hidden = !hasDate;
                // Keep only neighboring images warm; never fetch the whole gallery at high priority.
                preloads = [];
                if (photos.length > 1) {
                    var urls = new Set([photos[(index + 1) % photos.length].url, photos[(index + photos.length - 1) % photos.length].url]);
                    urls.forEach(function (url) {
                        if (url === photo.url) return;
                        var preload = new Image();
                        preload.decoding = 'async';
                        preload.fetchPriority = 'low';
                        preload.src = url;
                        preloads.push(preload);
                    });
                }
            }

            function restoreFocus() {
                document.documentElement.classList.remove('setae-photo-dialog-open');
                preloads = [];
                if (opener && opener.isConnected) opener.focus({ preventScroll: true });
                opener = null;
            }

            function closePhoto() {
                if (!dialog.open) return;
                dialog.close();
            }

            root.querySelectorAll('.js-setae-public-photo').forEach(function (button) {
                button.addEventListener('click', function () {
                    if (dialog.open) return;
                    if (typeof dialog.showModal !== 'function') {
                        announce('このブラウザーでは写真の拡大表示を利用できません。ページ内の写真をご覧ください。');
                        return;
                    }
                    opener = button;
                    showPhoto(parseInt(button.getAttribute('data-public-photo-index'), 10) || 0);
                    dialog.showModal();
                    document.documentElement.classList.add('setae-photo-dialog-open');
                    close.focus({ preventScroll: true });
                });
            });
            if (previous) previous.addEventListener('click', function () { showPhoto(index - 1); });
            if (next) next.addEventListener('click', function () { showPhoto(index + 1); });
            close.addEventListener('click', closePhoto);
            dialog.addEventListener('close', restoreFocus);
            dialog.addEventListener('cancel', function (event) { event.preventDefault(); closePhoto(); });
            function onBackdrop(event) {
                var bounds = dialog.getBoundingClientRect();
                return event.target === dialog && (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom);
            }
            dialog.addEventListener('pointerdown', function (event) { backdropStarted = onBackdrop(event); });
            dialog.addEventListener('click', function (event) {
                // A drag from the photo or panel to the backdrop must not dismiss it.
                if (onBackdrop(event) && backdropStarted) closePhoto();
                backdropStarted = false;
            });
            dialog.addEventListener('keydown', function (event) {
                if (event.key === 'Escape') { event.preventDefault(); closePhoto(); return; }
                if (event.key === 'ArrowLeft' && photos.length > 1) { event.preventDefault(); showPhoto(index - 1); }
                if (event.key === 'ArrowRight' && photos.length > 1) { event.preventDefault(); showPhoto(index + 1); }
                if (event.key !== 'Tab') return;
                var focusable = Array.from(dialog.querySelectorAll('button:not([disabled]), a[href], input:not([disabled]), [tabindex="0"]')).filter(function (node) { return !node.hidden && node.getClientRects().length > 0; });
                var first = focusable[0];
                var last = focusable[focusable.length - 1];
                if (!first) { event.preventDefault(); return; }
                if (event.shiftKey && (document.activeElement === first || !dialog.contains(document.activeElement))) { event.preventDefault(); last.focus(); }
                else if (!event.shiftKey && (document.activeElement === last || !dialog.contains(document.activeElement))) { event.preventDefault(); first.focus(); }
            });
        });
    });
}());
